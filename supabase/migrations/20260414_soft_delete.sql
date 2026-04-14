ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_contacts_deleted ON contacts(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_deals_deleted ON deals(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_deleted ON invoices(workspace_id) WHERE deleted_at IS NULL;
NOTIFY pgrst, 'reload schema';
