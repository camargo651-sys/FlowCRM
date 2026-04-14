CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  name text NOT NULL,
  amount numeric NOT NULL,
  currency text DEFAULT 'USD',
  interval text NOT NULL CHECK (interval IN ('weekly','monthly','quarterly','yearly')),
  next_invoice_date date NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active','paused','cancelled')),
  description text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_link text;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sub_owner ON subscriptions;
CREATE POLICY sub_owner ON subscriptions FOR ALL USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())) WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()));
NOTIFY pgrst, 'reload schema';
