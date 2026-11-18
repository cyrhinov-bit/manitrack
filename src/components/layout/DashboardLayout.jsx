import { Fragment, useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  Archive,
  FileText,
  History,
  Leaf,
  LayoutDashboard,
  Map,
  Menu,
  Users,
  UserRound,
  UserRoundCog,
  X,
} from 'lucide-react';

const menuGroups = {
  ADMIN: [
    {
      label: 'VUE GÉNÉRALE',
      items: [{ label: 'Tableau de bord', to: '/admin/dashboard', icon: LayoutDashboard }],
    },
    {
      label: 'GESTION AGRICOLE',
      items: [
        { label: 'Producteurs', to: '/admin/producers', icon: Users },
        { label: 'Parcelles', to: '/admin/parcels', icon: Leaf },
        { label: 'Cartographie', to: '/admin/map', icon: Map },
        { label: 'Cycles de culture', to: '/admin/cycles', icon: Leaf },
        { label: 'Publications', to: '/admin/posts', icon: FileText },
        { label: 'Récoltes', to: '/admin/harvests', icon: Archive },
      ],
    },
    {
      label: 'ADMINISTRATION',
      items: [
        { label: 'Gestion des comptes', to: '/admin/accounts', icon: UserRoundCog },
        { label: 'Statistiques', to: '/admin/stats', icon: LayoutDashboard },
        { label: 'Journal d’audit', to: '/admin/audit', icon: History },
      ],
    },
  ],
  PRODUCTEUR: [
    {
      label: 'MON ESPACE',
      items: [
        { label: 'Tableau de bord', to: '/producer/dashboard', icon: LayoutDashboard },
        { label: 'Mon profil', to: '/producer/profile', icon: UserRound },
      ],
    },
    {
      label: 'MON EXPLOITATION',
      items: [
        { label: 'Mes parcelles', to: '/producer/parcels', icon: Leaf },
        { label: 'Mes cycles', to: '/producer/cycles', icon: Leaf },
        { label: 'Mes publications', to: '/producer/posts', icon: FileText },
        { label: 'Mes récoltes', to: '/producer/harvests', icon: Archive },
      ],
    },
    {
      label: 'ACTIONS RAPIDES',
      items: [
        { label: 'Ajouter une parcelle', to: '/producer/parcels/new', icon: Leaf },
        { label: 'Enregistrer un cycle', to: '/producer/cycles/new', icon: Leaf },
        { label: 'Publier un rapport', to: '/producer/posts/new', icon: FileText },
      ],
    },
  ],
};

const pageTitles = {
  '/admin/dashboard': 'Tableau de bord',
  '/admin/producers': 'Producteurs',
  '/admin/parcels': 'Parcelles',
  '/admin/map': 'Cartographie',
  '/admin/cycles': 'Cycles de culture',
  '/admin/posts': 'Publications de terrain',
  '/admin/harvests': 'Récoltes',
  '/admin/stats': 'Statistiques et rapports',
  '/admin/accounts': 'Gestion des comptes',
  '/admin/audit': 'Journal d’audit',
  '/producer/dashboard': 'Tableau de bord',
  '/producer/profile': 'Mon profil',
  '/producer/parcels': 'Mes parcelles',
  '/producer/cycles': 'Mes cycles de culture',
  '/producer/posts': 'Mes publications',
  '/producer/harvests': 'Mes récoltes',
};

const templateStylesheets = [
  '/vendor/adminbsb/plugins/bootstrap/css/bootstrap.css',
  '/vendor/adminbsb/css/style.css',
  '/vendor/adminbsb/css/themes/theme-green.css',
];

function NavigationContent({ role, onNavigate }) {
  const groups = menuGroups[role] || [];

  return (
    <ul className="list">
      {groups.map((group) => (
        <Fragment key={group.label}>
          <li className="header">{group.label}</li>
          {group.items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end
                  onClick={onNavigate}
                  className={({ isActive }) => (isActive ? 'toggled' : undefined)}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </Fragment>
      ))}
    </ul>
  );
}

export default function DashboardLayout({ session, role, children, onLogout }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [isLargeScreen, setIsLargeScreen] = useState(
    () => window.matchMedia('(min-width: 1200px)').matches,
  );
  const location = useLocation();

  useEffect(() => {
    const links = templateStylesheets.map((href) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.dataset.adminbsb = 'true';
      link.onerror = () => console.error(`Impossible de charger la feuille de style ${href}`);
      document.head.appendChild(link);
      return link;
    });

    return () => links.forEach((link) => link.remove());
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1200px)');
    const updateScreenSize = () => setIsLargeScreen(mediaQuery.matches);
    mediaQuery.addEventListener('change', updateScreenSize);
    return () => mediaQuery.removeEventListener('change', updateScreenSize);
  }, []);

  const title =
    pageTitles[location.pathname] ||
    (location.pathname.startsWith('/admin/producers/') ? 'Fiche producteur' :
      location.pathname.startsWith('/admin/posts/') ? 'Détail de la publication' :
        location.pathname.startsWith('/producer/parcels/') ? 'Ajouter une parcelle' :
          location.pathname.startsWith('/producer/cycles/') ? 'Enregistrer un cycle' :
            location.pathname.startsWith('/producer/posts/') ? 'Publier un rapport' : 'ManiTrack');
  const closeMobileMenu = () => setMobileOpen(false);
  const handleLogout = async () => {
    setLogoutError('');
    try {
      const error = await onLogout();
      if (error) setLogoutError(error);
    } catch (error) {
      setLogoutError(error.message || 'Impossible de fermer la session.');
    }
  };
  const shellClassName = [
    'adminbsb-app',
    'theme-green',
    !isLargeScreen && mobileOpen ? 'overlay-open' : '',
    !isLargeScreen && !mobileOpen ? 'ls-closed' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={shellClassName}>
      <nav className="navbar navbar-fixed-top">
        <div className="container-fluid">
          <div className="navbar-header">
            {!isLargeScreen && (
              <button
                type="button"
                className="navbar-toggle"
                onClick={() => setMobileOpen((open) => !open)}
                aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            )}
            <Link className="navbar-brand" to={role === 'ADMIN' ? '/admin/dashboard' : '/producer/dashboard'}>
              <img src="/manitrack-logo.png" alt="ManiTrack" />
            </Link>
          </div>
          <div className="navbar-right">
            <span className="adminbsb-role">{role}</span>
            <button type="button" className="adminbsb-logout" onClick={handleLogout}>Déconnexion</button>
          </div>
        </div>
      </nav>
      {logoutError && <p className="adminbsb-auth-error" role="alert">{logoutError}</p>}

      <aside className="sidebar">
        <div className="user-info">
          <div className="adminbsb-avatar" aria-hidden="true">
            {session?.fullName?.charAt(0) || 'M'}
          </div>
          <div className="info-container">
            <div className="name">{session?.fullName || 'Utilisateur ManiTrack'}</div>
            <div className="email">{session?.email || ''}</div>
          </div>
        </div>
        <div className="menu">
          <NavigationContent role={role} onNavigate={closeMobileMenu} />
        </div>
      </aside>

      {!isLargeScreen && mobileOpen && (
        <button
          type="button"
          className="overlay"
          onClick={closeMobileMenu}
          aria-label="Fermer le menu"
        />
      )}

      <section className="content">
        <div className="container-fluid">
          <div className="block-header">
            <h2>{title}</h2>
          </div>
          {children}
        </div>
      </section>
    </div>
  );
}
