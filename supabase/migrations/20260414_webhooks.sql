CREATE TABLE IF NOT EXISTS webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  events text[] NOT NULL,
  secret text,
  active boolean DEFAULT true,
  last_triggered_at timestamptz,
  fail_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb NOT NULL,
  status_code int,
  response_body text,
  delivered_at timestamptz DEFAULT now()
);
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wh_owner ON webhooks;
CREATE POLICY wh_owner ON webhooks FOR ALL USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())) WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()));
DROP POLICY IF EXISTS whd_owner ON webhook_deliveries;
CREATE POLICY whd_owner ON webhook_deliveries FOR SELECT USING (webhook_id IN (SELECT id FROM webhooks WHERE workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())));
NOTIFY pgrst, 'reload schema';
