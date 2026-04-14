-- Email messages: extends pre-existing table (from earlier Gmail/Outlook sync work)
-- Adds inbox UI fields. Idempotent: safe on existing installs.
CREATE TABLE IF NOT EXISTS email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES deals(id) ON DELETE SET NULL,
  external_id text,
  thread_id text,
  direction text CHECK (direction IN ('inbound','outbound')),
  from_address text,
  from_name text,
  to_addresses text[],
  cc_addresses text[],
  subject text,
  snippet text,
  body_html text,
  body_text text,
  has_attachments boolean DEFAULT false,
  is_read boolean DEFAULT false,
  starred boolean DEFAULT false,
  archived boolean DEFAULT false,
  labels text[],
  received_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Add columns that may be missing on pre-existing installations
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS body_html text;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS body_text text;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS has_attachments boolean DEFAULT false;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS starred boolean DEFAULT false;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES deals(id) ON DELETE SET NULL;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS external_id text;

CREATE INDEX IF NOT EXISTS idx_email_workspace ON email_messages(workspace_id, archived, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_contact ON email_messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_thread ON email_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_starred ON email_messages(workspace_id, starred) WHERE starred = true;

ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_owner ON email_messages;
CREATE POLICY email_owner ON email_messages FOR ALL
  USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()));

NOTIFY pgrst, 'reload schema';
