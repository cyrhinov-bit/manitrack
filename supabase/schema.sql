CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'PRODUCTEUR')),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'ACTIVE', 'DISABLED')) DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS producers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  country TEXT,
  region TEXT,
  department TEXT,
  sub_prefecture TEXT,
  city TEXT,
  locality TEXT,
  profile_photo_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS parcels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES producers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  country TEXT,
  region TEXT,
  department TEXT,
  sub_prefecture TEXT,
  city TEXT,
  locality TEXT,
  area_hectares NUMERIC(10,2) NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  description TEXT,
  status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cultivation_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
  producer_id UUID NOT NULL REFERENCES producers(id) ON DELETE CASCADE,
  cassava_variety TEXT NOT NULL,
  planting_date DATE,
  planted_area_hectares NUMERIC(10,2),
  production_start_estimate DATE,
  expected_harvest_date DATE,
  actual_harvest_date DATE,
  status TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS harvests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES cultivation_cycles(id) ON DELETE CASCADE,
  parcel_id UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
  producer_id UUID NOT NULL REFERENCES producers(id) ON DELETE CASCADE,
  harvest_date DATE,
  harvested_area_hectares NUMERIC(10,2),
  quantity_tonnes NUMERIC(10,2),
  notes TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS field_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES producers(id) ON DELETE CASCADE,
  parcel_id UUID REFERENCES parcels(id) ON DELETE CASCADE,
  cycle_id UUID REFERENCES cultivation_cycles(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  post_type TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS field_post_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES field_posts(id) ON DELETE CASCADE,
  producer_id UUID NOT NULL REFERENCES producers(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_post_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES field_posts(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_table TEXT NOT NULL,
  target_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role_status ON profiles(role, status);
CREATE INDEX IF NOT EXISTS idx_producers_region_department ON producers(region, department, locality);
CREATE INDEX IF NOT EXISTS idx_parcels_producer_id ON parcels(producer_id);
CREATE INDEX IF NOT EXISTS idx_parcels_locality ON parcels(locality, region, department);
CREATE INDEX IF NOT EXISTS idx_cycles_status ON cultivation_cycles(status);
CREATE INDEX IF NOT EXISTS idx_harvests_producer_date ON harvests(producer_id, harvest_date);
CREATE INDEX IF NOT EXISTS idx_posts_producer_created ON field_posts(producer_id, created_at DESC);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE producers ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcels ENABLE ROW LEVEL SECURITY;
ALTER TABLE cultivation_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE harvests ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_post_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_post_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all profiles" ON profiles FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles current_profile
    WHERE current_profile.id = auth.uid()
      AND current_profile.role = 'ADMIN'
      AND current_profile.status = 'ACTIVE'
  )
);

CREATE POLICY "Producers can read own profile" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid() AND role = 'PRODUCTEUR');

CREATE POLICY "Admins can manage all producers" ON producers FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles admin_profile
    WHERE admin_profile.id = auth.uid()
      AND admin_profile.role = 'ADMIN'
      AND admin_profile.status = 'ACTIVE'
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles admin_profile
    WHERE admin_profile.id = auth.uid()
      AND admin_profile.role = 'ADMIN'
      AND admin_profile.status = 'ACTIVE'
  )
);

CREATE POLICY "Producers can manage own records" ON producers FOR ALL USING (
  user_id = auth.uid()
) WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY "Admins can read all parcels" ON parcels FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles admin_profile
    WHERE admin_profile.id = auth.uid()
      AND admin_profile.role = 'ADMIN'
      AND admin_profile.status = 'ACTIVE'
  )
);

CREATE POLICY "Producers can manage own parcels" ON parcels FOR ALL USING (
  producer_id IN (
    SELECT id FROM producers WHERE user_id = auth.uid()
  )
) WITH CHECK (
  producer_id IN (
    SELECT id FROM producers WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins can read all cycles" ON cultivation_cycles FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles admin_profile
    WHERE admin_profile.id = auth.uid()
      AND admin_profile.role = 'ADMIN'
      AND admin_profile.status = 'ACTIVE'
  )
);

CREATE POLICY "Producers can manage own cycles" ON cultivation_cycles FOR ALL USING (
  producer_id IN (
    SELECT id FROM producers WHERE user_id = auth.uid()
  )
) WITH CHECK (
  producer_id IN (
    SELECT id FROM producers WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins can read all harvests" ON harvests FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles admin_profile
    WHERE admin_profile.id = auth.uid()
      AND admin_profile.role = 'ADMIN'
      AND admin_profile.status = 'ACTIVE'
  )
);

CREATE POLICY "Producers can manage own harvests" ON harvests FOR ALL USING (
  producer_id IN (
    SELECT id FROM producers WHERE user_id = auth.uid()
  )
) WITH CHECK (
  producer_id IN (
    SELECT id FROM producers WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins can read all posts" ON field_posts FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles admin_profile
    WHERE admin_profile.id = auth.uid()
      AND admin_profile.role = 'ADMIN'
      AND admin_profile.status = 'ACTIVE'
  )
);

CREATE POLICY "Producers can manage own posts" ON field_posts FOR ALL USING (
  producer_id IN (
    SELECT id FROM producers WHERE user_id = auth.uid()
  )
) WITH CHECK (
  producer_id IN (
    SELECT id FROM producers WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins can read all photos" ON field_post_photos FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles admin_profile
    WHERE admin_profile.id = auth.uid()
      AND admin_profile.role = 'ADMIN'
      AND admin_profile.status = 'ACTIVE'
  )
);

CREATE POLICY "Producers can access own photos" ON field_post_photos FOR SELECT USING (
  producer_id IN (
    SELECT id FROM producers WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage admin notes" ON admin_post_notes FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles admin_profile
    WHERE admin_profile.id = auth.uid()
      AND admin_profile.role = 'ADMIN'
      AND admin_profile.status = 'ACTIVE'
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles admin_profile
    WHERE admin_profile.id = auth.uid()
      AND admin_profile.role = 'ADMIN'
      AND admin_profile.status = 'ACTIVE'
  )
);

CREATE POLICY "Admins can read audit logs" ON audit_logs FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles admin_profile
    WHERE admin_profile.id = auth.uid()
      AND admin_profile.role = 'ADMIN'
      AND admin_profile.status = 'ACTIVE'
  )
);

CREATE POLICY "Admins can insert audit logs" ON audit_logs FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles admin_profile
    WHERE admin_profile.id = auth.uid()
      AND admin_profile.role = 'ADMIN'
      AND admin_profile.status = 'ACTIVE'
  )
);

CREATE OR REPLACE FUNCTION public.is_active_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'ADMIN'
      AND status = 'ACTIVE'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_active_producer()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'PRODUCTEUR'
      AND status = 'ACTIVE'
  );
$$;

CREATE OR REPLACE FUNCTION public.enforce_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.role = 'ADMIN' AND auth.uid() IS NOT NULL AND NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Un utilisateur ne peut pas s''attribuer le rôle ADMIN.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enforce_profile_role ON profiles;
CREATE TRIGGER trigger_enforce_profile_role
BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_profile_role();
