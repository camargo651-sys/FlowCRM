CREATE TABLE IF NOT EXISTS booking_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  description text,
  duration_minutes int DEFAULT 30,
  buffer_minutes int DEFAULT 15,
  availability jsonb DEFAULT '{"mon":["09:00-17:00"],"tue":["09:00-17:00"],"wed":["09:00-17:00"],"thu":["09:00-17:00"],"fri":["09:00-17:00"]}'::jsonb,
  timezone text DEFAULT 'UTC',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, slug)
);
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES booking_links(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  guest_name text NOT NULL,
  guest_email text NOT NULL,
  guest_phone text,
  scheduled_at timestamptz NOT NULL,
  duration_minutes int NOT NULL,
  notes text,
  status text DEFAULT 'confirmed' CHECK (status IN ('confirmed','cancelled','completed','no_show')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE booking_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS links_owner ON booking_links;
CREATE POLICY links_owner ON booking_links FOR ALL USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())) WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()));
DROP POLICY IF EXISTS bookings_owner ON bookings;
CREATE POLICY bookings_owner ON bookings FOR ALL USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())) WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()));
NOTIFY pgrst, 'reload schema';
