-- Inter-departmental requests module
-- Created: 2026-04-12

CREATE TABLE IF NOT EXISTS inter_dept_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    number serial NOT NULL,
    title text NOT NULL,
    description text,
    from_dept text NOT NULL,
    to_dept text NOT NULL,
    priority text NOT NULL DEFAULT 'normal'
        CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    status text NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'submitted', 'in_review', 'approved', 'rejected', 'completed')),
    requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    requested_by_name text,
    assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at timestamptz,
    completed_at timestamptz,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_idr_workspace ON inter_dept_requests(workspace_id);
CREATE INDEX IF NOT EXISTS idx_idr_status ON inter_dept_requests(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_idr_from_dept ON inter_dept_requests(workspace_id, from_dept);
CREATE INDEX IF NOT EXISTS idx_idr_to_dept ON inter_dept_requests(workspace_id, to_dept);
CREATE INDEX IF NOT EXISTS idx_idr_requester ON inter_dept_requests(requested_by);

-- Comments / activity hub
CREATE TABLE IF NOT EXISTS inter_dept_request_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id uuid NOT NULL REFERENCES inter_dept_requests(id) ON DELETE CASCADE,
    author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    author_name text,
    text text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_idr_comments_request ON inter_dept_request_comments(request_id, created_at DESC);

-- RLS
ALTER TABLE inter_dept_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE inter_dept_request_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "idr_workspace_access" ON inter_dept_requests
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "idr_comments_workspace_access" ON inter_dept_request_comments
    FOR ALL USING (
        request_id IN (
            SELECT id FROM inter_dept_requests WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
            )
        )
    );
