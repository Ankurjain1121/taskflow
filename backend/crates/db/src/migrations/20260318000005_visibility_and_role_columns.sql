-- Migration: Add visibility columns, role_id columns, guest access table
-- Depends on: workspace_roles table (created in prior migration)
-- Note: FK constraints on role_id are NOT added here. They will be added
-- after the data migration that populates role_id from existing enum values.

-- ============================================
-- 1. Add role_id columns (no FK yet)
-- ============================================
ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS role_id UUID;
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS role_id UUID;

-- ============================================
-- 2. Add visibility columns with CHECK constraints
-- ============================================

-- Workspace-level default: NULL means application treats as 'public'
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS default_project_visibility VARCHAR(20) DEFAULT NULL
  CHECK (default_project_visibility IS NULL OR default_project_visibility IN ('public', 'private', 'assignee_only'));

-- Project-level: NULL = inherit from workspace default
ALTER TABLE projects ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT NULL
  CHECK (visibility IS NULL OR visibility IN ('public', 'private', 'assignee_only'));

-- Task list level: NULL = inherit from project; can only restrict further
ALTER TABLE task_lists ADD COLUMN IF NOT EXISTS visibility_override VARCHAR(20) DEFAULT NULL
  CHECK (visibility_override IS NULL OR visibility_override IN ('public', 'assignee_only'));

-- ============================================
-- 3. Materialized effective_visibility on task_lists
-- ============================================
ALTER TABLE task_lists ADD COLUMN IF NOT EXISTS effective_visibility VARCHAR(20) NOT NULL DEFAULT 'public';

-- ============================================
-- 4. Index on task_assignees for visibility queries
-- ============================================
CREATE INDEX IF NOT EXISTS idx_task_assignees_user_task ON task_assignees(user_id, task_id);

-- ============================================
-- 5. board_members legacy table
-- ============================================
-- board_members was renamed to project_members in migration 20260314000001.
-- Legacy references to "board_members" in query code refer to the project_members table.
-- No separate board_members table exists to drop.

-- ============================================
-- 6. Guest project access table
-- ============================================
CREATE TABLE IF NOT EXISTS guest_project_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  can_comment BOOLEAN NOT NULL DEFAULT true,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  granted_by UUID NOT NULL REFERENCES users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_guest_access_user ON guest_project_access(user_id);
CREATE INDEX IF NOT EXISTS idx_guest_access_project ON guest_project_access(project_id);
