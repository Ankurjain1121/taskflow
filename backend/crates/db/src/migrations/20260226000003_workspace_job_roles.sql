-- Workspace Job Roles: custom roles like Developer, Designer, QA, etc.
CREATE TABLE IF NOT EXISTS workspace_job_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#6366f1',
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workspace_id, name)
);

CREATE INDEX IF NOT EXISTS idx_workspace_job_roles_ws ON workspace_job_roles(workspace_id);

-- Many-to-many: members can have multiple job roles
CREATE TABLE IF NOT EXISTS workspace_member_job_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_role_id UUID NOT NULL REFERENCES workspace_job_roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, job_role_id)
);

CREATE INDEX IF NOT EXISTS idx_member_job_roles_role ON workspace_member_job_roles(job_role_id);

-- Extend automation enums with new trigger and action
ALTER TYPE automation_trigger ADD VALUE IF NOT EXISTS 'member_joined';
ALTER TYPE automation_action_type ADD VALUE IF NOT EXISTS 'assign_to_role_members';
