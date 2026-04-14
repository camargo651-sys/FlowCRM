-- Push notification subscriptions for PWA web push
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text,
  auth text,
  user_agent text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- Ensure new columns exist on pre-existing installs
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS p256dh text;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS auth text;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS user_agent text;

-- Drop NOT NULL on legacy jsonb `keys` column if present so new rows can omit it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'push_subscriptions' AND column_name = 'keys'
  ) THEN
    BEGIN
      ALTER TABLE push_subscriptions ALTER COLUMN keys DROP NOT NULL;
    EXCEPTION WHEN others THEN NULL;
    END;
  END IF;
END $$;

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_self ON push_subscriptions;
CREATE POLICY push_self ON push_subscriptions
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
