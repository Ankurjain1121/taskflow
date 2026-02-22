-- Add workspace-level roles to workspace_members
-- Enables per-workspace role management (owner, admin, member, viewer)

DO $$ BEGIN
    CREATE TYPE workspace_member_role AS ENUM ('owner', 'admin', 'member', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE workspace_members
    ADD COLUMN IF NOT EXISTS role workspace_member_role NOT NULL DEFAULT 'member';

-- Set workspace creators as owners
UPDATE workspace_members wm
SET role = 'owner'
FROM workspaces w
WHERE wm.workspace_id = w.id
  AND wm.user_id = w.created_by_id
  AND wm.role = 'member';

CREATE INDEX IF NOT EXISTS idx_workspace_members_role ON workspace_members(workspace_id, role);
