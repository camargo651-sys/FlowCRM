CREATE TABLE IF NOT EXISTS sales_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  period text NOT NULL CHECK (period IN ('monthly','quarterly','yearly')),
  target_amount numeric NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  metric text DEFAULT 'won_value' CHECK (metric IN ('won_value','deal_count','calls_count')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE sales_quotas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quotas_owner ON sales_quotas;
CREATE POLICY quotas_owner ON sales_quotas FOR ALL USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())) WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()));
NOTIFY pgrst, 'reload schema';
