-- Stage transition conditions for pipeline deals
-- Created: 2026-04-13

CREATE TABLE IF NOT EXISTS stage_conditions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  from_stage       text NOT NULL,
  to_stage         text NOT NULL,
  required_fields  jsonb NOT NULL DEFAULT '[]'::jsonb,
  require_approval boolean NOT NULL DEFAULT false,
  min_value        numeric,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, from_stage, to_stage)
);

CREATE INDEX IF NOT EXISTS idx_stage_conditions_workspace
  ON stage_conditions (workspace_id);

ALTER TABLE stage_conditions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stage_conditions_owner_access ON stage_conditions;
CREATE POLICY stage_conditions_owner_access ON stage_conditions
  FOR ALL
  USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );
