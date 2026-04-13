-- ============================================================
-- Field-level RBAC permissions (stub migration)
-- Persists admin-configured rules that control which roles can
-- see / read / edit individual fields on core entities.
-- Until this table is wired, the app falls back to
-- localStorage (`tracktio_field_permissions`) and the defaults
-- defined in src/lib/rbac/field-permissions.ts.
-- ============================================================

CREATE TABLE IF NOT EXISTS field_permissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL,
  role          text NOT NULL,
  entity        text NOT NULL,
  field         text NOT NULL,
  access        text NOT NULL CHECK (access IN ('hidden', 'readonly', 'editable')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, role, entity, field)
);

CREATE INDEX IF NOT EXISTS idx_field_permissions_workspace
  ON field_permissions (workspace_id);

CREATE INDEX IF NOT EXISTS idx_field_permissions_lookup
  ON field_permissions (workspace_id, role, entity);

-- RLS — only workspace members can read/write their own rules.
ALTER TABLE field_permissions ENABLE ROW LEVEL SECURITY;

-- Policies are intentionally permissive stubs; tighten once the
-- workspace membership helper functions land.
DROP POLICY IF EXISTS field_permissions_select ON field_permissions;
CREATE POLICY field_permissions_select ON field_permissions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS field_permissions_write ON field_permissions;
CREATE POLICY field_permissions_write ON field_permissions
  FOR ALL USING (true) WITH CHECK (true);
