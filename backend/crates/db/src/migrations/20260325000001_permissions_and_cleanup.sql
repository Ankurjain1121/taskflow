-- Permissions overhaul: wire role_id, drop teams, add tenant_id to workspace_job_roles
-- This migration is idempotent: safe to re-run.

BEGIN;

-- 1. Seed missing system workspace roles for every workspace that doesn't have them yet.
--    The 5 system roles: Owner, Admin, Manager, Member, Viewer.
INSERT INTO workspace_roles (id, workspace_id, name, description, is_system, capabilities, position, created_at, updated_at)
SELECT
    gen_random_uuid(),
    w.id,
    role_def.name,
    role_def.description,
    true,
    role_def.capabilities::jsonb,
    role_def.position,
    NOW(),
    NOW()
FROM workspaces w
CROSS JOIN (VALUES
    ('Owner',   'Full workspace access',         '{"can_view_all_tasks":true,"can_create_tasks":true,"can_edit_own_tasks":true,"can_edit_all_tasks":true,"can_delete_tasks":true,"can_manage_members":true,"can_manage_project_settings":true,"can_manage_automations":true,"can_export":true,"can_manage_billing":true,"can_invite_members":true,"can_manage_roles":true}', 0),
    ('Admin',   'Manage workspace and projects',  '{"can_view_all_tasks":true,"can_create_tasks":true,"can_edit_own_tasks":true,"can_edit_all_tasks":true,"can_delete_tasks":true,"can_manage_members":true,"can_manage_project_settings":true,"can_manage_automations":true,"can_export":true,"can_manage_billing":false,"can_invite_members":true,"can_manage_roles":true}', 1),
    ('Manager', 'Manage tasks and team',          '{"can_view_all_tasks":true,"can_create_tasks":true,"can_edit_own_tasks":true,"can_edit_all_tasks":true,"can_delete_tasks":false,"can_manage_members":false,"can_manage_project_settings":false,"can_manage_automations":true,"can_export":true,"can_manage_billing":false,"can_invite_members":false,"can_manage_roles":false}', 2),
    ('Member',  'Create and edit own tasks',      '{"can_view_all_tasks":false,"can_create_tasks":true,"can_edit_own_tasks":true,"can_edit_all_tasks":false,"can_delete_tasks":false,"can_manage_members":false,"can_manage_project_settings":false,"can_manage_automations":false,"can_export":true,"can_manage_billing":false,"can_invite_members":false,"can_manage_roles":false}', 3),
    ('Viewer',  'View only access',               '{"can_view_all_tasks":false,"can_create_tasks":false,"can_edit_own_tasks":false,"can_edit_all_tasks":false,"can_delete_tasks":false,"can_manage_members":false,"can_manage_project_settings":false,"can_manage_automations":false,"can_export":false,"can_manage_billing":false,"can_invite_members":false,"can_manage_roles":false}', 4)
) AS role_def(name, description, capabilities, position)
ON CONFLICT (workspace_id, name) DO NOTHING;

-- 2. Backfill workspace_members.role_id from their text role column.
--    Maps: owner→Owner, admin→Admin, manager→Manager, member→Member, viewer→Viewer.
UPDATE workspace_members wm
SET role_id = (
    SELECT wr.id FROM workspace_roles wr
    WHERE wr.workspace_id = wm.workspace_id
      AND wr.is_system = true
      AND LOWER(wr.name) = LOWER(wm.role::text)
    LIMIT 1
)
WHERE wm.role_id IS NULL;

-- 3. Add FK constraint if not present (role_id → workspace_roles.id).
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'workspace_members_role_id_fkey'
          AND table_name = 'workspace_members'
    ) THEN
        ALTER TABLE workspace_members
            ADD CONSTRAINT workspace_members_role_id_fkey
            FOREIGN KEY (role_id) REFERENCES workspace_roles(id);
    END IF;
END $$;

-- 4. Drop teams and team_members tables.
DROP TABLE IF EXISTS team_members CASCADE;
DROP TABLE IF EXISTS teams CASCADE;

-- 5. Add tenant_id to workspace_job_roles if not present.
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'workspace_job_roles' AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE workspace_job_roles ADD COLUMN tenant_id UUID;
        -- Backfill from workspace
        UPDATE workspace_job_roles wjr
        SET tenant_id = (SELECT w.tenant_id FROM workspaces w WHERE w.id = wjr.workspace_id);
    END IF;
END $$;

COMMIT;
