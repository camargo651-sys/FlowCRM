CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  last_used_at timestamptz,
  expires_at timestamptz,
  scopes text[] DEFAULT '{read,write}',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS api_keys_owner ON api_keys;
CREATE POLICY api_keys_owner ON api_keys FOR ALL USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())) WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()));
NOTIFY pgrst, 'reload schema';
