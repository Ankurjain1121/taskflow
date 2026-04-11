-- Project Groups (Phase 2 polish)
-- Lightweight collections of projects within a workspace.
-- Separate from workspaces (which are tenant/org-scoped) — groups let one
-- workspace organize projects into buckets like "Q3 Launches", "Client X",
-- "Internal Tools". Single-group-per-project for v1.

CREATE TABLE project_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(255) NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#BF7B54',
    position VARCHAR(255) NOT NULL DEFAULT 'a0',
    description TEXT,
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, name)
);

CREATE INDEX idx_project_groups_workspace ON project_groups(workspace_id);
CREATE INDEX idx_project_groups_tenant ON project_groups(tenant_id);

CREATE TRIGGER update_project_groups_updated_at
    BEFORE UPDATE ON project_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add nullable FK on projects. NULL = "ungrouped" (default, backward compat).
-- ON DELETE SET NULL: deleting a group un-groups the projects rather than cascading.
ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS project_group_id UUID
        REFERENCES project_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_group ON projects(project_group_id)
    WHERE project_group_id IS NOT NULL AND deleted_at IS NULL;
