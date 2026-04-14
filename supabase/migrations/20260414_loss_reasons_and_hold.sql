-- Loss reasons table
CREATE TABLE IF NOT EXISTS loss_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  label text NOT NULL,
  color text DEFAULT '#94a3b8',
  order_index int DEFAULT 0,
  archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, label)
);
CREATE INDEX IF NOT EXISTS idx_loss_reasons_workspace ON loss_reasons(workspace_id);
ALTER TABLE loss_reasons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loss_reasons_owner ON loss_reasons;
CREATE POLICY loss_reasons_owner ON loss_reasons FOR ALL
  USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()));

-- Add hold/standby fields to deals
ALTER TABLE deals ADD COLUMN IF NOT EXISTS hold_reason text;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS hold_until date;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS hold_at timestamptz;

-- Add lost_reason_id FK (keeps lost_reason text for legacy)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS lost_reason_id uuid REFERENCES loss_reasons(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_deals_lost_reason_id ON deals(lost_reason_id);
CREATE INDEX IF NOT EXISTS idx_deals_status_workspace ON deals(workspace_id, status);

-- Seed default reasons for each existing workspace
INSERT INTO loss_reasons (workspace_id, label, order_index, color)
SELECT w.id, r.label, r.idx, r.color
FROM workspaces w
CROSS JOIN (VALUES
  ('Price too high', 1, '#ef4444'),
  ('Lost to competitor', 2, '#f97316'),
  ('No budget', 3, '#eab308'),
  ('Bad timing', 4, '#3b82f6'),
  ('No decision maker', 5, '#a855f7'),
  ('Product fit', 6, '#94a3b8')
) AS r(label, idx, color)
ON CONFLICT (workspace_id, label) DO NOTHING;

NOTIFY pgrst, 'reload schema';
