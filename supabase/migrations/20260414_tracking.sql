CREATE TABLE IF NOT EXISTS engagement_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  entity text NOT NULL,
  entity_id uuid NOT NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('email_open','email_click','quote_view','invoice_view','portal_view','link_click')),
  user_agent text,
  ip text,
  metadata jsonb DEFAULT '{}',
  occurred_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_engagement_workspace ON engagement_events(workspace_id, entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_engagement_contact ON engagement_events(contact_id);
ALTER TABLE engagement_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS engage_owner ON engagement_events;
CREATE POLICY engage_owner ON engagement_events FOR ALL USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())) WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()));
NOTIFY pgrst, 'reload schema';
