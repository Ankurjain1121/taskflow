-- Workspace Roles table
-- Replaces fixed PG enums with a flexible role table supporting custom roles.
-- Each workspace gets 6 system roles seeded via the application layer.

CREATE TABLE IF NOT EXISTS workspace_roles (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name          VARCHAR(100) NOT NULL,
    description   TEXT,
    is_system     BOOLEAN NOT NULL DEFAULT false,
    capabilities  JSONB NOT NULL DEFAULT '{}',
    position      INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workspace_id, name)
);

CREATE INDEX IF NOT EXISTS idx_workspace_roles_workspace ON workspace_roles(workspace_id);

-- Seed system roles for every existing workspace.
-- Uses a lateral cross join to generate 6 rows per workspace.
INSERT INTO workspace_roles (workspace_id, name, description, is_system, capabilities, position)
SELECT
    w.id,
    r.name,
    r.description,
    true,
    r.capabilities::jsonb,
    r.position
FROM workspaces w
CROSS JOIN LATERAL (
    VALUES
        ('Owner',   'Full control over the workspace',        0, '{
            "can_view_all_tasks": true,
            "can_create_tasks": true,
            "can_edit_own_tasks": true,
            "can_edit_all_tasks": true,
            "can_delete_tasks": true,
            "can_manage_members": true,
            "can_manage_project_settings": true,
            "can_manage_automations": true,
            "can_export": true,
            "can_manage_billing": true,
            "can_invite_members": true,
            "can_manage_roles": true
        }'),
        ('Admin',   'Administer workspace settings and members', 1, '{
            "can_view_all_tasks": true,
            "can_create_tasks": true,
            "can_edit_own_tasks": true,
            "can_edit_all_tasks": true,
            "can_delete_tasks": true,
            "can_manage_members": true,
            "can_manage_project_settings": true,
            "can_manage_automations": true,
            "can_export": true,
            "can_manage_billing": false,
            "can_invite_members": true,
            "can_manage_roles": true
        }'),
        ('Manager', 'Manage projects and team members',      2, '{
            "can_view_all_tasks": true,
            "can_create_tasks": true,
            "can_edit_own_tasks": true,
            "can_edit_all_tasks": true,
            "can_delete_tasks": false,
            "can_manage_members": true,
            "can_manage_project_settings": false,
            "can_manage_automations": true,
            "can_export": true,
            "can_manage_billing": false,
            "can_invite_members": false,
            "can_manage_roles": false
        }'),
        ('Member',  'Standard workspace member',             3, '{
            "can_view_all_tasks": false,
            "can_create_tasks": true,
            "can_edit_own_tasks": true,
            "can_edit_all_tasks": false,
            "can_delete_tasks": false,
            "can_manage_members": false,
            "can_manage_project_settings": false,
            "can_manage_automations": false,
            "can_export": true,
            "can_manage_billing": false,
            "can_invite_members": false,
            "can_manage_roles": false
        }'),
        ('Viewer',  'Read-only access',                      4, '{
            "can_view_all_tasks": false,
            "can_create_tasks": false,
            "can_edit_own_tasks": false,
            "can_edit_all_tasks": false,
            "can_delete_tasks": false,
            "can_manage_members": false,
            "can_manage_project_settings": false,
            "can_manage_automations": false,
            "can_export": false,
            "can_manage_billing": false,
            "can_invite_members": false,
            "can_manage_roles": false
        }'),
        ('Guest',   'Limited access to specific projects',   5, '{
            "can_view_all_tasks": false,
            "can_create_tasks": false,
            "can_edit_own_tasks": false,
            "can_edit_all_tasks": false,
            "can_delete_tasks": false,
            "can_manage_members": false,
            "can_manage_project_settings": false,
            "can_manage_automations": false,
            "can_export": false,
            "can_manage_billing": false,
            "can_invite_members": false,
            "can_manage_roles": false
        }')
) AS r(name, description, position, capabilities)
WHERE w.deleted_at IS NULL
ON CONFLICT (workspace_id, name) DO NOTHING;
