CREATE TABLE IF NOT EXISTS user_2fa (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  secret text NOT NULL,
  enabled boolean DEFAULT false,
  backup_codes text[],
  enabled_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE user_2fa ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_2fa_self ON user_2fa;
CREATE POLICY user_2fa_self ON user_2fa FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
NOTIFY pgrst, 'reload schema';
