import { useEffect, useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import {
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  Leaf,
  MapPinned,
  MapPin,
  Package,
  Search,
  ShieldCheck,
  Sprout,
  TrendingUp,
  Users,
  Warehouse,
} from 'lucide-react';
import './App.css';
import 'leaflet/dist/leaflet.css';
import DashboardLayout from './components/layout/DashboardLayout.jsx';
import PresentationSlider from './components/PresentationSlider.jsx';
import { getSupabaseConfigStatus, supabase } from './config/supabase';
import {
  auditLogs,
  adminPostNotes,
  cultivationCycles,
  dashboardStats,
  fieldPosts,
  harvests,
  parcels,
  producers,
} from './data/mockData';

const statusBadgeColors = {
  ACTIVE: 'badge-success',
  PENDING: 'badge-warning',
  DISABLED: 'badge-danger',
};

function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(Boolean(supabase));
  const [authError, setAuthError] = useState('');
  const [online, setOnline] = useState(true);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    return error?.message;
  };

  useEffect(() => {
    if (!supabase) {
      return undefined;
    }

    let active = true;
    let authRequest = 0;
    const syncSession = async (authSession) => {
      const request = ++authRequest;
      if (!authSession?.user) {
        if (active && request === authRequest) {
          setSession(null);
          setAuthError('');
          setAuthLoading(false);
        }
        return;
      }

      try {
        const appSession = await getAppSession(authSession.user);
        if (active && request === authRequest) {
          setSession(appSession);
          setAuthError('');
        }
      } catch (error) {
        if (active && request === authRequest) {
          setSession(null);
          setAuthError(error.message || 'Impossible de charger votre profil ManiTrack.');
        }
      } finally {
        if (active && request === authRequest) setAuthLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, authSession) => {
      if (event === 'TOKEN_REFRESHED') return;
      setAuthLoading(true);
      window.setTimeout(() => { void syncSession(authSession); }, 0);
    });

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        return syncSession(data.session);
      })
      .catch((error) => {
        if (!active) return;
        setSession(null);
        setAuthError(error.message || 'Impossible de vérifier votre session Supabase.');
        setAuthLoading(false);
      });

    const updateConnection = () => setOnline(navigator.onLine);
    updateConnection();

    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }

    return () => {
      active = false;
      subscription.unsubscribe();
      window.removeEventListener('online', updateConnection);
      window.removeEventListener('offline', updateConnection);
    };
  }, []);

  return (
    <BrowserRouter>
      <div className="app-shell">
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<AuthPage session={session} setSession={setSession} authError={authError} />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          <Route
            path="/producer/*"
            element={
              <ProtectedRoute allowedRoles={['PRODUCTEUR']} session={session} loading={authLoading}>
                <ProducerRoutes session={session} online={online} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/*"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']} session={session} loading={authLoading}>
                <AdminRoutes session={session} online={online} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

async function getAppSession(user) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('full_name, role, status')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    throw new Error('Profil ManiTrack introuvable ou inaccessible. Vérifiez la table profiles et ses règles RLS.');
  }
  if (profile.status === 'DISABLED') {
    throw new Error('Ce compte ManiTrack est désactivé. Contactez un administrateur.');
  }
  if (!['ADMIN', 'PRODUCTEUR'].includes(profile.role)) {
    throw new Error('Le rôle associé à ce compte ne permet pas d’accéder à ManiTrack.');
  }

  return {
    id: user.id,
    role: profile.role,
    status: profile.status,
    fullName: profile.full_name,
    email: user.email || '',
  };
}

function ProtectedRoute({ session, allowedRoles, loading, children }) {
  if (loading) {
    return <PageFrame><p role="status">Vérification de la session…</p></PageFrame>;
  }

  if (!session?.role) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(session.role)) {
    return <Navigate to={session.role === 'ADMIN' ? '/admin/dashboard' : '/producer/dashboard'} replace />;
  }

  return children;
}

function AuthPage({ session, setSession, authError }) {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  if (session?.role) {
    return <Navigate to={session.role === 'ADMIN' ? '/admin/dashboard' : '/producer/dashboard'} replace />;
  }

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');

    if (!getSupabaseConfigStatus()) {
      setErrorMessage('Supabase n’est pas configuré. Renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans .env.local.');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email.trim(),
        password: formData.password,
      });
      if (error) throw error;

      const appSession = await getAppSession(data.user);
      setSession(appSession);
      navigate(appSession.role === 'ADMIN' ? '/admin/dashboard' : '/producer/dashboard', { replace: true });
    } catch (error) {
      setErrorMessage(error.message || 'La connexion a échoué. Vérifiez vos identifiants et réessayez.');
      if (supabase) {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          setErrorMessage(`${error.message} La session n’a pas pu être fermée : ${signOutError.message}`);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageFrame className="login-frame">
      <div className="login-page-content">
        <div className="login-page-brand">
          <img className="auth-logo" src="/manitrack-logo.png" alt="ManiTrack" />
        </div>
        <PresentationSlider />
        <div className="auth-card login-card">
          <h2>Connexion</h2>
          {(errorMessage || authError) && (
            <p className="auth-error" role="alert">{errorMessage || authError}</p>
          )}
          <form onSubmit={handleSubmit} className="form-grid">
            <label>
              E-mail
              <input name="email" type="email" placeholder="nom@exemple.com" value={formData.email} onChange={handleChange} required />
            </label>
            <label>
              Mot de passe
              <input name="password" type="password" placeholder="Votre mot de passe" value={formData.password} onChange={handleChange} required />
            </label>
            <div className="login-forgot">
              <Link to="/forgot-password">Mot de passe oublié ?</Link>
            </div>
            <button type="submit" className="primary-btn" disabled={submitting}>
              {submitting ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
          <div className="login-signup">
            Pas encore de compte ? <Link to="/signup">S’inscrire</Link>
          </div>
        </div>
        <footer className="login-footer">ManiTrack · Suivi des producteurs et des exploitations de manioc</footer>
      </div>
    </PageFrame>
  );
}

function SignupPage() {
  const [message, setMessage] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    setMessage('La création de compte depuis cette page n’est pas encore reliée à Supabase. Contactez un administrateur pour activer votre compte.');
  };

  return (
    <PageFrame>
      <div className="auth-card wide-card">
        <div className="auth-brand">
          <img className="auth-logo" src="/manitrack-logo.png" alt="ManiTrack" />
        </div>
        <h2>Créer un compte producteur</h2>
        {message && <p className="auth-error" role="alert">{message}</p>}
        <form onSubmit={handleSubmit} className="form-grid two-columns">
          <label>
            Prénom
            <input type="text" defaultValue="Ahou" />
          </label>
          <label>
            Nom
            <input type="text" defaultValue="Kouassi" />
          </label>
          <label>
            Téléphone
            <input type="tel" defaultValue="+225 07 00 00 00" />
          </label>
          <label>
            E-mail
            <input type="email" defaultValue="ahou@manitrack.app" />
          </label>
          <label>
            Région
            <input type="text" defaultValue="Lagunes" />
          </label>
          <label>
            Localité
            <input type="text" defaultValue="Maféré" />
          </label>
          <label>
            Mot de passe
            <input type="password" defaultValue="password123" />
          </label>
          <label>
            Confirmer le mot de passe
            <input type="password" defaultValue="password123" />
          </label>
          <button type="submit" className="primary-btn full-width">Inscription</button>
        </form>
      </div>
    </PageFrame>
  );
}

function ForgotPasswordPage() {
  return (
    <PageFrame>
      <div className="auth-card">
        <div className="auth-brand">
          <img className="auth-logo" src="/manitrack-logo.png" alt="ManiTrack" />
        </div>
        <h2>Récupération du mot de passe</h2>
        <form className="form-grid">
          <label>
            Adresse e-mail
            <input type="email" defaultValue="kouassi@manitrack.app" />
          </label>
          <button type="button" className="primary-btn">Recevoir le lien</button>
        </form>
      </div>
    </PageFrame>
  );
}

function ProducerRoutes({ session, online, onLogout }) {
  const producer = producers[0];
  const producerParcels = parcels.filter((parcel) => parcel.producerId === producer.id);
  const producerCycles = cultivationCycles.filter((cycle) => cycle.producerId === producer.id);
  const myHarvests = harvests.filter((harvest) => harvest.producerId === producer.id);

  return (
    <DashboardLayout session={session} role="PRODUCTEUR" online={online} onLogout={onLogout}>
      <Routes>
        <Route path="dashboard" element={<ProducerDashboard producer={producer} parcels={producerParcels} cycles={producerCycles} harvests={myHarvests} />} />
        <Route path="profile" element={<ProducerProfile producer={producer} />} />
        <Route path="parcels" element={<ProducerParcels parcels={producerParcels} />} />
        <Route path="parcels/new" element={<ParcelForm />} />
        <Route path="cycles" element={<ProducerCycles cycles={producerCycles} />} />
        <Route path="cycles/new" element={<CycleForm />} />
        <Route path="posts" element={<ProducerPosts />} />
        <Route path="posts/new" element={<PostForm />} />
        <Route path="harvests" element={<ProducerHarvests harvests={myHarvests} />} />
        <Route path="" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </DashboardLayout>
  );
}

function AdminRoutes({ session, online, onLogout }) {
  return (
    <DashboardLayout session={session} role="ADMIN" online={online} onLogout={onLogout}>
      <Routes>
        <Route path="dashboard" element={<AdminDashboard online={online} />} />
        <Route path="producers" element={<AdminProducers />} />
        <Route path="producers/:id" element={<ProducerDetails />} />
        <Route path="parcels" element={<AdminParcels />} />
        <Route path="map" element={<AdminMap />} />
        <Route path="cycles" element={<AdminCycles />} />
        <Route path="posts" element={<AdminPosts />} />
        <Route path="posts/:id" element={<AdminPostDetails />} />
        <Route path="harvests" element={<AdminHarvests />} />
        <Route path="stats" element={<AdminStats />} />
        <Route path="accounts" element={<AdminAccounts />} />
        <Route path="audit" element={<AuditTrail />} />
        <Route path="" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </DashboardLayout>
  );
}

function ProducerDashboard({ producer, parcels, cycles, harvests }) {
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Espace producteur</p>
          <h2>Tableau de bord</h2>
        </div>
        <LinkButton to="/producer/parcels/new" variant="primary">Ajouter une parcelle</LinkButton>
      </header>

      <section className="stats-grid">
        <StatCard icon={<MapPinned size={18} />} label="Mes parcelles" value={parcels.length} tone="green" />
        <StatCard icon={<Leaf size={18} />} label="Superficie totale" value={`${parcels.reduce((sum, item) => sum + item.areaHectares, 0).toFixed(1)} ha`} tone="gold" />
        <StatCard icon={<Sprout size={18} />} label="Cycles en cours" value={cycles.length} tone="blue" />
        <StatCard icon={<Warehouse size={18} />} label="Récoltes déclarées" value={harvests.length} tone="green" />
      </section>

      <section className="section-card">
        <div className="section-head">
          <h3>Mes parcelles</h3>
          <LinkButton to="/producer/parcels" variant="secondary">Voir toutes</LinkButton>
        </div>
        <div className="list-grid">
          {parcels.map((parcel) => (
            <div className="info-card" key={parcel.id}>
              <h4>{parcel.name}</h4>
              <p>{parcel.locality} • {parcel.areaHectares} ha</p>
              <span className="status-line">{parcel.status}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProducerProfile({ producer }) {
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Profil</p>
          <h2>Mon profil</h2>
        </div>
      </header>
      <div className="section-card profile-card">
        <div className="profile-hero">
          <div className="avatar-large">{producer.firstName.charAt(0)}</div>
          <div>
            <h3>{producer.firstName} {producer.lastName}</h3>
            <p>{producer.locality} • {producer.region}</p>
          </div>
        </div>
        <div className="details-grid">
          <div><strong>Téléphone</strong><span>{producer.phone}</span></div>
          <div><strong>Département</strong><span>{producer.department}</span></div>
          <div><strong>Ville</strong><span>{producer.city}</span></div>
          <div><strong>Statut</strong><span className={`badge ${statusBadgeColors[producer.status] || ''}`}>{producer.status}</span></div>
        </div>
      </div>
    </div>
  );
}

function ProducerParcels({ parcels }) {
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Parcelles</p>
          <h2>Mes parcelles</h2>
        </div>
        <LinkButton to="/producer/parcels/new" variant="primary">Nouvelle parcelle</LinkButton>
      </header>
      <div className="list-grid">
        {parcels.map((parcel) => (
          <div className="info-card" key={parcel.id}>
            <h4>{parcel.name}</h4>
            <p>{parcel.locality}</p>
            <p>Superficie : {parcel.areaHectares} ha</p>
            <p>Latitude : {parcel.latitude}</p>
            <p>Longitude : {parcel.longitude}</p>
            <span className="status-line">{parcel.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProducerCycles({ cycles }) {
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Cycles</p>
          <h2>Mes cycles de culture</h2>
        </div>
        <LinkButton to="/producer/cycles/new" variant="primary">Ajouter un cycle</LinkButton>
      </header>
      <div className="list-grid">
        {cycles.map((cycle) => (
          <div className="info-card" key={cycle.id}>
            <h4>{cycle.cassavaVariety}</h4>
            <p>Plantation : {cycle.plantingDate}</p>
            <p>Récolte estimée : {cycle.expectedHarvestDate}</p>
            <span className="status-line">{cycle.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProducerPosts() {
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Rapports</p>
          <h2>Publications de terrain</h2>
        </div>
        <LinkButton to="/producer/posts/new" variant="primary">Nouvelle publication</LinkButton>
      </header>
      <div className="list-grid">
        {fieldPosts.filter((post) => post.producerId === producers[0].id).map((post) => (
          <div className="info-card" key={post.id}>
            <h4>{post.postType}</h4>
            <p>{post.description}</p>
            <span className="status-line">{post.createdAt}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProducerHarvests({ harvests }) {
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Récoltes</p>
          <h2>Mes déclarations</h2>
        </div>
      </header>
      <div className="list-grid">
        {harvests.map((harvest) => (
          <div className="info-card" key={harvest.id}>
            <h4>{harvest.harvestDate}</h4>
            <p>{harvest.quantityTonnes} tonnes</p>
            <p>Surface : {harvest.harvestedAreaHectares} ha</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ParcelForm() {
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Parcelles</p>
          <h2>Ajouter une parcelle</h2>
        </div>
      </header>
      <div className="section-card">
        <form className="form-grid two-columns">
          <label>Nom de la parcelle<input type="text" defaultValue="Parcelle M4" /></label>
          <label>Superficie (ha)<input type="number" defaultValue="2.5" /></label>
          <label>Latitude<input type="text" defaultValue="5.3571" /></label>
          <label>Longitude<input type="text" defaultValue="-4.0248" /></label>
          <label>Région<input type="text" defaultValue="Lagunes" /></label>
          <label>Localité<input type="text" defaultValue="Maféré" /></label>
          <label className="full-span">Description<textarea defaultValue="Terrain bien exposé et accessible." rows="4" /></label>
          <button type="button" className="primary-btn">Enregistrer</button>
        </form>
      </div>
    </div>
  );
}

function CycleForm() {
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Cycles</p>
          <h2>Enregistrer un cycle</h2>
        </div>
      </header>
      <div className="section-card">
        <form className="form-grid two-columns">
          <label>Variété<input type="text" defaultValue="TMS 30572" /></label>
          <label>Superficie plantée<input type="number" defaultValue="1.9" /></label>
          <label>Date de plantation<input type="date" defaultValue="2024-05-02" /></label>
          <label>Statut<select defaultValue="En développement"><option>À planter</option><option>Planté</option><option>En développement</option><option>Prêt pour la récolte</option></select></label>
          <label className="full-span">Observations<textarea rows="4" defaultValue="Cycle correctement suivi." /></label>
          <button type="button" className="primary-btn">Enregistrer</button>
        </form>
      </div>
    </div>
  );
}

function PostForm() {
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Rapports</p>
          <h2>Créer une publication</h2>
        </div>
      </header>
      <div className="section-card">
        <form className="form-grid two-columns">
          <label>Type d’observation<select defaultValue="Préparation du terrain"><option>Préparation du terrain</option><option>Début de plantation</option><option>État de croissance</option><option>Champ prêt pour la récolte</option></select></label>
          <label>Parcelle<select defaultValue="Parcelle 1 - Maféré"><option>Parcelle 1 - Maféré</option></select></label>
          <label className="full-span">Description<textarea rows="4" defaultValue="Le terrain est prêt et la plantation est en cours." /></label>
          <label>Photo<input type="file" /></label>
          <button type="button" className="primary-btn">Publier</button>
        </form>
      </div>
    </div>
  );
}

function AdminDashboard({ online }) {
  const stats = dashboardStats;
  const pendingProducers = producers.filter((producer) => producer.status === 'PENDING').length;
  const activeCycles = cultivationCycles.filter((cycle) => cycle.status !== 'Récolté').length;
  const recentLogs = [...auditLogs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);

  return (
    <AdminPage
      eyebrow="Vue générale"
      title="Tableau de bord"
      description="Un aperçu des activités agricoles enregistrées sur ManiTrack."
      actions={
        <span className={`admin-connection ${online ? 'is-online' : 'is-offline'}`}>
          <span />{online ? 'Connecté' : 'Hors connexion'}
        </span>
      }
    >
      <section className="admin-metrics-grid">
        <AdminMetric icon={<Users />} label="Producteurs inscrits" value={stats.totalProducers} hint={`${stats.activeProducers} comptes actifs`} tone="green" />
        <AdminMetric icon={<MapPinned />} label="Parcelles suivies" value={stats.totalParcels} hint={`${stats.parcelsInProduction} en production`} tone="blue" />
        <AdminMetric icon={<Leaf />} label="Superficie déclarée" value={`${stats.totalAreaHa.toFixed(1)} ha`} hint="Toutes les parcelles" tone="gold" />
        <AdminMetric icon={<Warehouse />} label="Production récoltée" value={`${stats.totalHarvestTonnes.toFixed(1)} t`} hint={`${stats.harvestDeclarations} déclarations`} tone="violet" />
      </section>

      <section className="admin-dashboard-grid">
        <div className="admin-panel">
          <div className="admin-panel-heading">
            <div><h2>Producteurs récents</h2><p>Comptes enregistrés dans le registre</p></div>
            <Link className="admin-text-link" to="/admin/producers">Tous les producteurs <span>→</span></Link>
          </div>
          <AdminTable columns={['Producteur', 'Localité', 'Inscription', 'Statut', '']}>
            {[...producers].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((producer) => (
              <tr key={producer.id}>
                <td><ProducerCell producer={producer} /></td>
                <td>{producer.locality}, {producer.region}</td>
                <td>{formatDate(producer.createdAt)}</td>
                <td><StatusBadge status={producer.status} /></td>
                <td><Link className="admin-row-action" to={`/admin/producers/${producer.id}`} aria-label={`Voir ${producer.firstName} ${producer.lastName}`}><Eye size={17} /></Link></td>
              </tr>
            ))}
          </AdminTable>
        </div>

        <aside className="admin-panel admin-overview-panel">
          <div className="admin-panel-heading">
            <div><h2>À surveiller</h2><p>Indicateurs opérationnels</p></div>
          </div>
          <Link className="admin-overview-item" to="/admin/producers?status=PENDING">
            <span className="admin-overview-icon is-amber"><Clock3 size={18} /></span>
            <span><strong>Comptes en attente</strong><small>Producteurs à vérifier</small></span>
            <b>{pendingProducers}</b>
          </Link>
          <Link className="admin-overview-item" to="/admin/cycles">
            <span className="admin-overview-icon is-green"><Sprout size={18} /></span>
            <span><strong>Cycles en cours</strong><small>Suivi de production</small></span>
            <b>{activeCycles}</b>
          </Link>
          <Link className="admin-overview-item" to="/admin/posts">
            <span className="admin-overview-icon is-blue"><FileTextIcon /></span>
            <span><strong>Publications terrain</strong><small>Rapports partagés</small></span>
            <b>{fieldPosts.length}</b>
          </Link>
          <Link className="admin-panel-footer" to="/admin/audit">Consulter le journal d’audit <span>→</span></Link>
        </aside>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div><h2>Activité récente</h2><p>Dernières opérations consignées</p></div>
          <Link className="admin-text-link" to="/admin/audit">Voir le journal <span>→</span></Link>
        </div>
        {recentLogs.length ? (
          <div className="admin-activity-list">
            {recentLogs.map((log) => (
              <div className="admin-activity-row" key={log.id}>
                <span className="admin-activity-icon"><ShieldCheck size={17} /></span>
                <span><strong>{auditActionLabel(log.action)}</strong><small>{log.details}</small></span>
                <time>{formatDateTime(log.createdAt)}</time>
              </div>
            ))}
          </div>
        ) : <AdminEmpty message="Aucune activité enregistrée pour le moment." />}
      </section>
    </AdminPage>
  );
}

function AdminProducers() {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(searchParams.get('status') || 'ALL');
  const filteredProducers = producers.filter((producer) => {
    const text = `${producer.firstName} ${producer.lastName} ${producer.locality} ${producer.region} ${producer.phone}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (status === 'ALL' || producer.status === status);
  });

  return (
    <AdminPage eyebrow="Registre agricole" title="Producteurs" description={`${producers.length} profils dans le registre des producteurs.`}>
      <section className="admin-metrics-grid admin-metrics-compact">
        <AdminMetric icon={<Users />} label="Tous les profils" value={producers.length} tone="green" />
        <AdminMetric icon={<CheckCircle2 />} label="Actifs" value={dashboardStats.activeProducers} tone="blue" />
        <AdminMetric icon={<Clock3 />} label="En attente" value={dashboardStats.pendingProducers} tone="gold" />
      </section>
      <section className="admin-panel">
        <AdminFilterBar query={query} onQueryChange={setQuery} status={status} onStatusChange={setStatus} placeholder="Rechercher un nom, une localité…" />
        <AdminTable columns={['Producteur', 'Localité', 'Téléphone', 'Date d’inscription', 'Statut', '']}>
          {filteredProducers.map((producer) => (
            <tr key={producer.id}>
              <td><ProducerCell producer={producer} /></td>
              <td>{producer.locality}<small className="admin-cell-secondary">{producer.region}</small></td>
              <td>{producer.phone}</td>
              <td>{formatDate(producer.createdAt)}</td>
              <td><StatusBadge status={producer.status} /></td>
              <td><Link className="admin-row-action" to={`/admin/producers/${producer.id}`} aria-label={`Voir ${producer.firstName} ${producer.lastName}`}><Eye size={17} /></Link></td>
            </tr>
          ))}
        </AdminTable>
        {!filteredProducers.length && <AdminEmpty message="Aucun producteur ne correspond à ces filtres." />}
      </section>
    </AdminPage>
  );
}

function ProducerDetails() {
  const { id } = useParams();
  const producer = producers.find((item) => item.id === id);
  const producerParcels = parcels.filter((parcel) => parcel.producerId === id);
  const producerCycles = cultivationCycles.filter((cycle) => cycle.producerId === id);

  if (!producer) {
    return <AdminPage eyebrow="Registre agricole" title="Profil introuvable"><AdminEmpty message="Ce profil producteur n’existe pas dans les données disponibles." /></AdminPage>;
  }

  return (
    <AdminPage eyebrow="Registre agricole" title={`${producer.firstName} ${producer.lastName}`} description={`Profil créé le ${formatDate(producer.createdAt)}.`} actions={<Link className="admin-button-secondary" to="/admin/producers">← Retour aux producteurs</Link>}>
      <section className="admin-profile-hero">
        <div className="admin-profile-avatar">{producer.firstName.charAt(0)}{producer.lastName.charAt(0)}</div>
        <div className="admin-profile-main"><span className="admin-kicker">Producteur</span><h2>{producer.firstName} {producer.lastName}</h2><p><MapPin size={15} />{producer.locality}, {producer.region}</p></div>
        <StatusBadge status={producer.status} />
      </section>
      <section className="admin-metrics-grid admin-metrics-compact">
        <AdminMetric icon={<MapPinned />} label="Parcelles" value={producerParcels.length} tone="green" />
        <AdminMetric icon={<Leaf />} label="Superficie totale" value={`${producerParcels.reduce((sum, parcel) => sum + parcel.areaHectares, 0).toFixed(1)} ha`} tone="gold" />
        <AdminMetric icon={<Sprout />} label="Cycles déclarés" value={producerCycles.length} tone="blue" />
      </section>
      <section className="admin-detail-grid">
        <div className="admin-panel">
          <div className="admin-panel-heading"><div><h2>Informations du profil</h2><p>Coordonnées et localisation</p></div></div>
          <dl className="admin-details-list">
            <div><dt>Téléphone</dt><dd>{producer.phone}</dd></div>
            <div><dt>Pays</dt><dd>{producer.country}</dd></div>
            <div><dt>Région</dt><dd>{producer.region}</dd></div>
            <div><dt>Département</dt><dd>{producer.department}</dd></div>
            <div><dt>Sous-préfecture</dt><dd>{producer.subPrefecture}</dd></div>
            <div><dt>Ville / localité</dt><dd>{producer.city} · {producer.locality}</dd></div>
          </dl>
        </div>
        <div className="admin-panel">
          <div className="admin-panel-heading"><div><h2>Parcelles associées</h2><p>Parcelles rattachées à ce profil</p></div><Link className="admin-text-link" to="/admin/parcels">Tout voir →</Link></div>
          {producerParcels.length ? producerParcels.map((parcel) => (
            <div className="admin-linked-record" key={parcel.id}>
              <span className="admin-overview-icon is-green"><MapPinned size={17} /></span>
              <span><strong>{parcel.name}</strong><small>{parcel.locality} · {parcel.areaHectares} ha</small></span>
              <StatusBadge status={parcel.status} />
            </div>
          )) : <AdminEmpty message="Aucune parcelle associée à ce profil." />}
        </div>
      </section>
    </AdminPage>
  );
}

function AdminParcels() {
  const [query, setQuery] = useState('');
  const filteredParcels = parcels.filter((parcel) => {
    const producer = producers.find((item) => item.id === parcel.producerId);
    return `${parcel.name} ${parcel.locality} ${parcel.region} ${producer?.firstName || ''} ${producer?.lastName || ''}`.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <AdminPage eyebrow="Registre agricole" title="Parcelles" description="Parcelles déclarées et superficies suivies sur le territoire.">
      <section className="admin-metrics-grid admin-metrics-compact">
        <AdminMetric icon={<MapPinned />} label="Parcelles" value={parcels.length} tone="green" />
        <AdminMetric icon={<Leaf />} label="Superficie totale" value={`${dashboardStats.totalAreaHa.toFixed(1)} ha`} tone="gold" />
        <AdminMetric icon={<Sprout />} label="En production" value={dashboardStats.parcelsInProduction} tone="blue" />
      </section>
      <section className="admin-panel">
        <AdminFilterBar query={query} onQueryChange={setQuery} placeholder="Rechercher une parcelle ou un producteur…" />
        <AdminTable columns={['Parcelle', 'Localité', 'Superficie', 'Producteur', 'Statut', '']}>
          {filteredParcels.map((parcel) => {
            const producer = producers.find((item) => item.id === parcel.producerId);
            return (
              <tr key={parcel.id}>
                <td><strong>{parcel.name}</strong><small className="admin-cell-secondary">{parcel.region} · {parcel.department}</small></td>
                <td>{parcel.locality}</td>
                <td><strong>{parcel.areaHectares} ha</strong></td>
                <td>{producer ? <Link className="admin-inline-link" to={`/admin/producers/${producer.id}`}>{producer.firstName} {producer.lastName}</Link> : '—'}</td>
                <td><StatusBadge status={parcel.status} /></td>
                <td><Link className="admin-row-action" to="/admin/map" aria-label={`Voir ${parcel.name} sur la carte`}><MapPin size={17} /></Link></td>
              </tr>
            );
          })}
        </AdminTable>
        {!filteredParcels.length && <AdminEmpty message="Aucune parcelle ne correspond à cette recherche." />}
      </section>
    </AdminPage>
  );
}

function AdminMap() {
  const center = [5.347, -4.024];

  return (
    <AdminPage eyebrow="Cartographie" title="Carte des parcelles" description="Localisation des parcelles enregistrées en Côte d’Ivoire.">
      <section className="admin-metrics-grid admin-metrics-compact">
        <AdminMetric icon={<MapPinned />} label="Parcelles cartographiées" value={parcels.length} tone="green" />
        <AdminMetric icon={<Users />} label="Producteurs représentés" value={new Set(parcels.map((parcel) => parcel.producerId)).size} tone="blue" />
        <AdminMetric icon={<Leaf />} label="Surface cartographiée" value={`${dashboardStats.totalAreaHa.toFixed(1)} ha`} tone="gold" />
      </section>
      <section className="admin-map-layout">
        <div className="admin-map-frame">
          <MapContainer center={center} zoom={7} scrollWheelZoom className="map-container">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
            {parcels.map((parcel) => (
              <Marker key={parcel.id} position={[parcel.latitude, parcel.longitude]}>
                <Popup>
                  <strong>{parcel.name}</strong><br />
                  {parcel.locality} · {parcel.areaHectares} ha<br />
                  {producers.find((producer) => producer.id === parcel.producerId)?.firstName || 'Producteur'}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
        <aside className="admin-panel admin-map-sidebar">
          <div className="admin-panel-heading"><div><h2>Parcelles</h2><p>Sélectionnez une fiche pour consulter le producteur.</p></div></div>
          {parcels.map((parcel) => {
            const producer = producers.find((item) => item.id === parcel.producerId);
            return (
              <div className="admin-map-record" key={parcel.id}>
                <span className="admin-map-pin"><MapPin size={17} /></span>
                <span><strong>{parcel.name}</strong><small>{parcel.locality} · {parcel.areaHectares} ha</small><small>{producer ? `${producer.firstName} ${producer.lastName}` : 'Producteur non renseigné'}</small></span>
              </div>
            );
          })}
        </aside>
      </section>
    </AdminPage>
  );
}

function AdminCycles() {
  return (
    <AdminPage eyebrow="Production" title="Cycles de culture" description={`${cultivationCycles.length} cycles déclarés par les producteurs.`}>
      <section className="admin-metrics-grid admin-metrics-compact">
        <AdminMetric icon={<Sprout />} label="Cycles déclarés" value={cultivationCycles.length} tone="green" />
        <AdminMetric icon={<TrendingUp />} label="En cours" value={cultivationCycles.filter((cycle) => cycle.status !== 'Récolté').length} tone="blue" />
        <AdminMetric icon={<CheckCircle2 />} label="Récoltés" value={cultivationCycles.filter((cycle) => cycle.status === 'Récolté').length} tone="gold" />
      </section>
      <section className="admin-panel">
        <AdminTable columns={['Variété', 'Parcelle', 'Producteur', 'Plantation', 'Récolte prévue', 'Statut']}>
          {cultivationCycles.map((cycle) => {
            const parcel = parcels.find((item) => item.id === cycle.parcelId);
            const producer = producers.find((item) => item.id === cycle.producerId);
            return (
              <tr key={cycle.id}>
                <td><strong>{cycle.cassavaVariety}</strong><small className="admin-cell-secondary">{cycle.plantedAreaHectares} ha plantés</small></td>
                <td>{parcel?.name || '—'}</td>
                <td>{producer ? <Link className="admin-inline-link" to={`/admin/producers/${producer.id}`}>{producer.firstName} {producer.lastName}</Link> : '—'}</td>
                <td>{formatDate(cycle.plantingDate)}</td>
                <td>{formatDate(cycle.expectedHarvestDate)}</td>
                <td><StatusBadge status={cycle.status} /></td>
              </tr>
            );
          })}
        </AdminTable>
      </section>
    </AdminPage>
  );
}

function AdminPosts() {
  return (
    <AdminPage eyebrow="Terrain" title="Publications de terrain" description={`${fieldPosts.length} observations partagées depuis les exploitations.`}>
      {!fieldPosts.length ? <AdminEmpty message="Aucune publication de terrain pour le moment." /> : (
        <section className="admin-post-grid">
          {[...fieldPosts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((post) => {
            const producer = producers.find((item) => item.id === post.producerId);
            const parcel = parcels.find((item) => item.id === post.parcelId);
            return (
              <article className="admin-panel admin-post-card" key={post.id}>
                <div className="admin-post-card-top"><span className="admin-post-icon"><FileTextIcon /></span><time>{formatDateTime(post.createdAt)}</time></div>
                <span className="admin-kicker">{post.postType}</span>
                <p className="admin-post-description">{post.description}</p>
                <div className="admin-post-meta"><span><UserIcon />{producer ? `${producer.firstName} ${producer.lastName}` : 'Producteur'}</span><span><MapPin size={14} />{parcel?.locality || 'Parcelle'}</span></div>
                <Link className="admin-post-link" to={`/admin/posts/${post.id}`}>Ouvrir la publication <span>→</span></Link>
              </article>
            );
          })}
        </section>
      )}
    </AdminPage>
  );
}

function AdminPostDetails() {
  const { id } = useParams();
  const post = fieldPosts.find((item) => item.id === id);
  const producer = producers.find((item) => item.id === post?.producerId);
  const parcel = parcels.find((item) => item.id === post?.parcelId);
  const notes = adminPostNotes.filter((note) => note.postId === id);

  if (!post) {
    return <AdminPage eyebrow="Terrain" title="Publication introuvable" actions={<Link className="admin-button-secondary" to="/admin/posts">← Retour aux publications</Link>}><AdminEmpty message="Cette publication n’existe pas dans les données disponibles." /></AdminPage>;
  }

  return (
    <AdminPage eyebrow="Terrain" title={post.postType} description={`Publication du ${formatDateTime(post.createdAt)}.`} actions={<Link className="admin-button-secondary" to="/admin/posts">← Retour aux publications</Link>}>
      <div className="admin-detail-grid">
        <article className="admin-panel">
          <div className="admin-panel-heading"><div><h2>Observation terrain</h2><p>Contenu partagé par le producteur</p></div></div>
          <p className="admin-long-description">{post.description}</p>
          <div className="admin-details-list">
            <div><span>Type</span><strong>{post.postType}</strong></div>
            <div><span>Date de création</span><strong>{formatDateTime(post.createdAt)}</strong></div>
            <div><span>Dernière mise à jour</span><strong>{formatDateTime(post.updatedAt)}</strong></div>
            <div><span>Coordonnées</span><strong>{post.latitude}, {post.longitude}</strong></div>
          </div>
        </article>
        <aside className="admin-panel">
          <div className="admin-panel-heading"><div><h2>Contexte</h2><p>Exploitation concernée</p></div></div>
          <div className="admin-context-card"><span className="admin-overview-icon is-blue"><Users size={18} /></span><div><small>Producteur</small><strong>{producer ? `${producer.firstName} ${producer.lastName}` : 'Non renseigné'}</strong>{producer && <Link to={`/admin/producers/${producer.id}`}>Voir le profil →</Link>}</div></div>
          <div className="admin-context-card"><span className="admin-overview-icon is-green"><MapPinned size={18} /></span><div><small>Parcelle</small><strong>{parcel?.name || 'Non renseignée'}</strong><span>{parcel?.locality || '—'}</span></div></div>
        </aside>
      </div>
      <section className="admin-panel">
        <div className="admin-panel-heading"><div><h2>Notes internes</h2><p>Annotations consignées dans le suivi administratif</p></div></div>
        {notes.length ? notes.map((note) => <div className="admin-note" key={note.id}><span className="admin-overview-icon is-amber"><ShieldCheck size={17} /></span><div><p>{note.note}</p><small>{formatDateTime(note.createdAt)}</small></div></div>) : <AdminEmpty message="Aucune note interne pour cette publication." />}
      </section>
    </AdminPage>
  );
}

function AdminHarvests() {
  const averageYield = dashboardStats.totalHarvestTonnes / harvests.reduce((sum, harvest) => sum + harvest.harvestedAreaHectares, 0);

  return (
    <AdminPage eyebrow="Production" title="Récoltes" description="Déclarations de récolte remontées par les producteurs.">
      <section className="admin-metrics-grid admin-metrics-compact">
        <AdminMetric icon={<Warehouse />} label="Déclarations" value={harvests.length} tone="green" />
        <AdminMetric icon={<Package />} label="Volume total" value={`${dashboardStats.totalHarvestTonnes.toFixed(1)} t`} tone="gold" />
        <AdminMetric icon={<TrendingUp />} label="Rendement moyen" value={`${Number.isFinite(averageYield) ? averageYield.toFixed(1) : '0.0'} t/ha`} tone="blue" />
      </section>
      <section className="admin-panel">
        <AdminTable columns={['Date', 'Parcelle', 'Producteur', 'Surface récoltée', 'Quantité', 'Observations']}>
          {harvests.map((harvest) => {
            const parcel = parcels.find((item) => item.id === harvest.parcelId);
            const producer = producers.find((item) => item.id === harvest.producerId);
            return (
              <tr key={harvest.id}>
                <td>{formatDate(harvest.harvestDate)}</td>
                <td>{parcel?.name || '—'}</td>
                <td>{producer ? <Link className="admin-inline-link" to={`/admin/producers/${producer.id}`}>{producer.firstName} {producer.lastName}</Link> : '—'}</td>
                <td>{harvest.harvestedAreaHectares} ha</td>
                <td><strong>{harvest.quantityTonnes} t</strong></td>
                <td className="admin-notes-cell">{harvest.notes}</td>
              </tr>
            );
          })}
        </AdminTable>
        {!harvests.length && <AdminEmpty message="Aucune récolte déclarée pour le moment." />}
      </section>
    </AdminPage>
  );
}

function AdminStats() {
  const regionalRows = [...new Set(producers.map((producer) => producer.region))].map((region) => {
    const regionProducers = producers.filter((producer) => producer.region === region);
    const regionIds = new Set(regionProducers.map((producer) => producer.id));
    const regionParcels = parcels.filter((parcel) => regionIds.has(parcel.producerId));
    const regionHarvests = harvests.filter((harvest) => regionIds.has(harvest.producerId));
    return {
      region,
      producerCount: regionProducers.length,
      parcelCount: regionParcels.length,
      area: regionParcels.reduce((sum, parcel) => sum + parcel.areaHectares, 0),
      production: regionHarvests.reduce((sum, harvest) => sum + harvest.quantityTonnes, 0),
    };
  });

  return (
    <AdminPage eyebrow="Analyse agricole" title="Statistiques" description="Indicateurs calculés à partir des données actuellement enregistrées.">
      <div className="admin-data-notice"><span>i</span><p>Ces chiffres reflètent les données de démonstration locales et ne constituent pas encore un rapport de production connecté.</p></div>
      <section className="admin-metrics-grid">
        <AdminMetric icon={<Users />} label="Producteurs" value={dashboardStats.totalProducers} hint={`${dashboardStats.activeProducers} actifs`} tone="green" />
        <AdminMetric icon={<MapPinned />} label="Parcelles" value={dashboardStats.totalParcels} hint={`${dashboardStats.parcelsInProduction} en production`} tone="blue" />
        <AdminMetric icon={<Leaf />} label="Surface totale" value={`${dashboardStats.totalAreaHa.toFixed(1)} ha`} hint={`${dashboardStats.readyForHarvest} prêtes à récolter`} tone="gold" />
        <AdminMetric icon={<Warehouse />} label="Production déclarée" value={`${dashboardStats.totalHarvestTonnes.toFixed(1)} t`} hint={`${dashboardStats.harvestDeclarations} déclarations`} tone="violet" />
      </section>
      <section className="admin-detail-grid">
        <div className="admin-panel">
          <div className="admin-panel-heading"><div><h2>Répartition des producteurs</h2><p>Statut des comptes dans le registre</p></div></div>
          <StatusDistribution label="Actifs" count={dashboardStats.activeProducers} total={dashboardStats.totalProducers} tone="green" />
          <StatusDistribution label="En attente" count={dashboardStats.pendingProducers} total={dashboardStats.totalProducers} tone="gold" />
          <StatusDistribution label="Désactivés" count={producers.filter((producer) => producer.status === 'DISABLED').length} total={dashboardStats.totalProducers} tone="red" />
        </div>
        <div className="admin-panel">
          <div className="admin-panel-heading"><div><h2>Production agricole</h2><p>Cycles et rendement déclaré</p></div></div>
          <div className="admin-stat-line"><span><Sprout size={17} />Cycles en cours</span><strong>{cultivationCycles.filter((cycle) => cycle.status !== 'Récolté').length}</strong></div>
          <div className="admin-stat-line"><span><CheckCircle2 size={17} />Cycles récoltés</span><strong>{cultivationCycles.filter((cycle) => cycle.status === 'Récolté').length}</strong></div>
          <div className="admin-stat-line"><span><TrendingUp size={17} />Rendement moyen</span><strong>{(dashboardStats.totalHarvestTonnes / harvests.reduce((sum, harvest) => sum + harvest.harvestedAreaHectares, 0) || 0).toFixed(1)} t/ha</strong></div>
        </div>
      </section>
      <section className="admin-panel">
        <div className="admin-panel-heading"><div><h2>Indicateurs par région</h2><p>Répartition à partir de la région du producteur</p></div></div>
        <AdminTable columns={['Région', 'Producteurs', 'Parcelles', 'Superficie', 'Récolte déclarée']}>
          {regionalRows.map((row) => (
            <tr key={row.region}><td><strong>{row.region}</strong></td><td>{row.producerCount}</td><td>{row.parcelCount}</td><td>{row.area.toFixed(1)} ha</td><td>{row.production.toFixed(1)} t</td></tr>
          ))}
        </AdminTable>
      </section>
    </AdminPage>
  );
}

function AdminAccounts() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const filteredProducers = producers.filter((producer) => {
    const text = `${producer.firstName} ${producer.lastName} ${producer.phone} ${producer.userId}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (status === 'ALL' || producer.status === status);
  });

  return (
    <AdminPage eyebrow="Administration" title="Comptes producteurs" description="État des profils et comptes associés aux producteurs.">
      <div className="admin-data-notice"><span>i</span><p>Consultation uniquement : l’authentification et la gestion des comptes ne sont pas encore reliées à Supabase.</p></div>
      <section className="admin-panel">
        <AdminFilterBar query={query} onQueryChange={setQuery} status={status} onStatusChange={setStatus} placeholder="Rechercher un nom, téléphone ou identifiant…" />
        <AdminTable columns={['Compte', 'Identifiant', 'Téléphone', 'Créé le', 'État', '']}>
          {filteredProducers.map((producer) => (
            <tr key={producer.id}>
              <td><ProducerCell producer={producer} /></td>
              <td><code>{producer.userId}</code></td>
              <td>{producer.phone}</td>
              <td>{formatDate(producer.createdAt)}</td>
              <td><StatusBadge status={producer.status} /></td>
              <td><Link className="admin-row-action" to={`/admin/producers/${producer.id}`} aria-label={`Voir le profil de ${producer.firstName} ${producer.lastName}`}><Eye size={17} /></Link></td>
            </tr>
          ))}
        </AdminTable>
        {!filteredProducers.length && <AdminEmpty message="Aucun compte ne correspond à ces filtres." />}
      </section>
    </AdminPage>
  );
}

function AuditTrail() {
  const logs = [...auditLogs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <AdminPage eyebrow="Traçabilité" title="Journal d’audit" description={`${auditLogs.length} opérations consignées dans les données disponibles.`}>
      <div className="admin-data-notice"><span>i</span><p>Journal de démonstration local : il ne représente pas encore un journal d’audit serveur.</p></div>
      <section className="admin-panel">
        {!logs.length ? <AdminEmpty message="Aucune opération enregistrée." /> : (
          <div className="admin-audit-list">
            {logs.map((log) => (
              <article className="admin-audit-row" key={log.id}>
                <span className="admin-audit-icon"><ShieldCheck size={18} /></span>
                <div className="admin-audit-content"><div><strong>{auditActionLabel(log.action)}</strong><span className="admin-audit-target">{log.targetTable} · {log.targetId}</span></div><p>{log.details}</p><small>Acteur : {log.actorId}</small></div>
                <time>{formatDateTime(log.createdAt)}</time>
              </article>
            ))}
          </div>
        )}
      </section>
    </AdminPage>
  );
}

function AdminPage({ eyebrow, title, description, actions, children }) {
  return (
    <div className="admin-page page-stack">
      <header className="admin-page-header">
        <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p className="admin-page-description">{description}</p>}</div>
        {actions && <div className="admin-page-actions">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

function AdminMetric({ icon, label, value, hint, tone }) {
  return (
    <article className={`admin-metric-card tone-${tone}`}>
      <span className="admin-metric-icon">{icon}</span>
      <span className="admin-metric-label">{label}</span>
      <strong className="admin-metric-value">{value}</strong>
      {hint && <small className="admin-metric-hint">{hint}</small>}
    </article>
  );
}

function AdminTable({ columns, children }) {
  return (
    <div className="admin-table-scroll">
      <table className="admin-table">
        <thead><tr>{columns.map((column, index) => <th key={`${column}-${index}`}>{column}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function AdminFilterBar({ query, onQueryChange, status, onStatusChange, placeholder }) {
  return (
    <div className="admin-filter-bar">
      <label className="admin-search"><Search size={17} /><input type="search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={placeholder} aria-label="Rechercher dans la liste" /></label>
      {onStatusChange && (
        <label className="admin-status-filter"><span>Statut</span><select value={status} onChange={(event) => onStatusChange(event.target.value)} aria-label="Filtrer par statut">
          <option value="ALL">Tous les statuts</option><option value="ACTIVE">Actif</option><option value="PENDING">En attente</option><option value="DISABLED">Désactivé</option>
        </select></label>
      )}
    </div>
  );
}

function ProducerCell({ producer }) {
  return (
    <Link className="admin-producer-cell" to={`/admin/producers/${producer.id}`}>
      <span>{producer.firstName.charAt(0)}{producer.lastName.charAt(0)}</span>
      <span><strong>{producer.firstName} {producer.lastName}</strong><small>{producer.region}</small></span>
    </Link>
  );
}

function StatusBadge({ status }) {
  const normalized = status === 'ACTIVE' ? 'active' : status === 'PENDING' ? 'pending' : status === 'DISABLED' ? 'disabled' :
    status?.toLowerCase().includes('récolt') || status?.toLowerCase().includes('production') ? 'active' :
      status?.toLowerCase().includes('prêt') ? 'pending' : 'neutral';
  const label = status === 'ACTIVE' ? 'Actif' : status === 'PENDING' ? 'En attente' : status === 'DISABLED' ? 'Désactivé' : status;
  return <span className={`admin-status-badge is-${normalized}`}>{label}</span>;
}

function StatusDistribution({ label, count, total, tone }) {
  const percentage = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className={`admin-distribution tone-${tone}`}>
      <div><span>{label}</span><strong>{count} <small>({percentage} %)</small></strong></div>
      <span className="admin-progress-track"><span style={{ width: `${percentage}%` }} /></span>
    </div>
  );
}

function AdminEmpty({ message }) {
  return <div className="admin-empty"><Search size={20} /><p>{message}</p></div>;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

function auditActionLabel(action) {
  const labels = {
    ACTIVATE_PRODUCER: 'Validation d’un compte producteur',
    UPLOAD_FIELD_PHOTO: 'Vérification d’une publication terrain',
  };
  return labels[action] || action.replaceAll('_', ' ').toLowerCase();
}

function FileTextIcon() {
  return <FileText size={18} />;
}

function UserIcon() {
  return <Users size={14} />;
}

function PageFrame({ children, className = '' }) {
  return <div className={`page-frame ${className}`}>{children}</div>;
}

function StatCard({ icon, label, value, tone }) {
  return (
    <div className={`stat-card ${tone}`}>
      <div className="icon-box">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function LinkButton({ to, children, variant = 'primary' }) {
  return (
    <Link to={to} className={`action-btn ${variant}`}>
      {children}
    </Link>
  );
}

export default App;
