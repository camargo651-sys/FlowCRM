CREATE TABLE IF NOT EXISTS approval_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  entity text NOT NULL CHECK (entity IN ('quote','expense','invoice','contract','deal')),
  field text NOT NULL,
  operator text NOT NULL CHECK (operator IN ('gt','gte','lt','lte','eq')),
  value numeric NOT NULL,
  approver_role text,
  approver_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES approval_rules(id) ON DELETE SET NULL,
  entity text NOT NULL,
  entity_id uuid NOT NULL,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reason text,
  decided_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE approval_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rules_owner ON approval_rules;
CREATE POLICY rules_owner ON approval_rules FOR ALL USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())) WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()));
DROP POLICY IF EXISTS req_owner ON approval_requests;
CREATE POLICY req_owner ON approval_requests FOR ALL USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())) WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()));
NOTIFY pgrst, 'reload schema';
