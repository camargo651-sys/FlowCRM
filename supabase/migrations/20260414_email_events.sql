CREATE TABLE IF NOT EXISTS email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  message_id uuid REFERENCES email_messages(id) ON DELETE SET NULL,
  provider text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('sent','delivered','bounced','soft_bounced','complained','opened','clicked','unsubscribed','rejected')),
  recipient_email text,
  provider_event_id text,
  reason text,
  metadata jsonb DEFAULT '{}',
  occurred_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_events_workspace ON email_events(workspace_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_events_type ON email_events(workspace_id, event_type);
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS email_events_owner ON email_events;
CREATE POLICY email_events_owner ON email_events FOR ALL USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())) WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()));
NOTIFY pgrst, 'reload schema';
