CREATE TABLE IF NOT EXISTS roadmap_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text DEFAULT 'feature' CHECK (category IN ('feature','improvement','bugfix','integration')),
  status text DEFAULT 'planned' CHECK (status IN ('idea','planned','in_progress','shipped','declined')),
  vote_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  shipped_at timestamptz
);
CREATE TABLE IF NOT EXISTS roadmap_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES roadmap_items(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_email text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(item_id, user_id),
  UNIQUE(item_id, guest_email)
);
ALTER TABLE roadmap_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS roadmap_public_read ON roadmap_items;
DROP POLICY IF EXISTS roadmap_auth_write ON roadmap_items;
DROP POLICY IF EXISTS votes_public_read ON roadmap_votes;
DROP POLICY IF EXISTS votes_auth_write ON roadmap_votes;
CREATE POLICY roadmap_public_read ON roadmap_items FOR SELECT USING (true);
CREATE POLICY roadmap_auth_write ON roadmap_items FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY votes_public_read ON roadmap_votes FOR SELECT USING (true);
CREATE POLICY votes_auth_write ON roadmap_votes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL OR guest_email IS NOT NULL);

INSERT INTO roadmap_items (title, description, category, status)
SELECT * FROM (VALUES
  ('Gmail two-way sync', 'Real-time email sync with Gmail OAuth', 'integration', 'in_progress'),
  ('Outlook two-way sync', 'Real-time email sync with Outlook OAuth', 'integration', 'planned'),
  ('Zapier integration', 'Trigger Tracktio actions from 5000+ apps', 'integration', 'planned'),
  ('Mobile native iOS/Android', 'Native apps with offline support', 'feature', 'idea'),
  ('Advanced forecasting AI', 'ML-powered deal close prediction', 'feature', 'idea')
) AS v(title, description, category, status)
WHERE NOT EXISTS (SELECT 1 FROM roadmap_items WHERE roadmap_items.title = v.title);

NOTIFY pgrst, 'reload schema';
