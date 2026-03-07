-- Migration: Projects Architecture (Zoho-style)
-- Starting from partially-renamed DB state (boards→projects already done)
-- This migration completes the architecture: task_lists, project_statuses, status_id on tasks

-- ============================================================
-- STEP 1: Wipe all data (fresh start — reverse FK dependency order)
-- ============================================================
TRUNCATE TABLE
  automation_logs, automation_actions, automation_rate_counters, automation_rules,
  webhook_deliveries, webhooks,
  bulk_operations, filter_presets,
  task_custom_field_values, project_custom_fields,
  task_labels, labels,
  task_dependencies, task_reminders, task_watchers,
  attachments, comments, time_entries, activity_log,
  task_assignees, recurring_task_configs,
  subtasks, tasks,
  project_shares, project_members, project_columns, task_groups,
  milestones, positions,
  projects,
  notifications, recent_items,
  invitations, workspace_members, workspaces,
  refresh_tokens, password_reset_tokens, accounts, users, tenants
CASCADE;

-- ============================================================
-- STEP 2: Drop column_id from tasks + drop project_columns table
-- ============================================================
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_column_id_fkey;
ALTER TABLE tasks DROP COLUMN IF EXISTS column_id;
ALTER TABLE tasks DROP COLUMN IF EXISTS column_entered_at;
DROP INDEX IF EXISTS idx_tasks_column;
DROP TABLE IF EXISTS project_columns CASCADE;

-- ============================================================
-- STEP 3: Rename task_groups → task_lists; add is_default
-- ============================================================
ALTER TABLE task_groups RENAME TO task_lists;
ALTER TABLE task_lists ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

-- Rename indexes
ALTER INDEX IF EXISTS task_groups_pkey RENAME TO task_lists_pkey;
ALTER INDEX IF EXISTS idx_task_groups_project RENAME TO idx_task_lists_project;
ALTER INDEX IF EXISTS idx_task_groups_project_position RENAME TO idx_task_lists_project_position;
ALTER INDEX IF EXISTS idx_task_groups_tenant RENAME TO idx_task_lists_tenant;

-- ============================================================
-- STEP 4: Rename tasks.group_id → task_list_id
-- ============================================================
ALTER TABLE tasks RENAME COLUMN group_id TO task_list_id;
ALTER INDEX IF EXISTS idx_tasks_group RENAME TO idx_tasks_task_list;

-- ============================================================
-- STEP 5: Create project_statuses table
-- ============================================================
CREATE TABLE project_statuses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  color       VARCHAR(7) NOT NULL DEFAULT '#6B7280',
  type        VARCHAR(20) NOT NULL CHECK (type IN ('not_started','active','done','cancelled')),
  position    VARCHAR(255) NOT NULL,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, name)
);
CREATE INDEX idx_project_statuses_project ON project_statuses(project_id);

-- ============================================================
-- STEP 6: Add status_id to tasks (nullable — populated by app when tasks created)
-- ============================================================
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status_id UUID REFERENCES project_statuses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status_id) WHERE status_id IS NOT NULL;

-- ============================================================
-- STEP 7: Drop old trigger + create new create_default_task_list trigger
-- ============================================================
DROP TRIGGER IF EXISTS create_default_task_group ON projects;
DROP TRIGGER IF EXISTS create_default_task_group ON boards;
DROP FUNCTION IF EXISTS create_default_task_group();

CREATE OR REPLACE FUNCTION create_default_task_list()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO task_lists (id, project_id, name, color, position, is_default, tenant_id, created_by_id)
  VALUES (gen_random_uuid(), NEW.id, 'General', '#6B7280', 'a0', true, NEW.tenant_id, NEW.created_by_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_default_task_list
AFTER INSERT ON projects
FOR EACH ROW EXECUTE FUNCTION create_default_task_list();

-- ============================================================
-- STEP 8: Also create default statuses trigger for new projects
-- ============================================================
CREATE OR REPLACE FUNCTION create_default_project_statuses()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO project_statuses (project_id, name, color, type, position, is_default, tenant_id) VALUES
    (NEW.id, 'Open',        '#6B7280', 'not_started', 'a0', true,  NEW.tenant_id),
    (NEW.id, 'In Progress', '#3B82F6', 'active',       'b0', false, NEW.tenant_id),
    (NEW.id, 'On Hold',     '#F59E0B', 'active',       'c0', false, NEW.tenant_id),
    (NEW.id, 'Completed',   '#10B981', 'done',         'd0', false, NEW.tenant_id),
    (NEW.id, 'Cancelled',   '#EF4444', 'cancelled',    'e0', false, NEW.tenant_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_default_project_statuses
AFTER INSERT ON projects
FOR EACH ROW EXECUTE FUNCTION create_default_project_statuses();

-- ============================================================
-- STEP 9: Add task_status_changed to automation_trigger enum
-- ============================================================
ALTER TYPE automation_trigger ADD VALUE IF NOT EXISTS 'task_status_changed';

-- ============================================================
-- STEP 10: Update user_preferences default view to 'list'
-- ============================================================
UPDATE user_preferences SET default_project_view = 'list';

-- ============================================================
-- STEP 11: Update task_lists index on tasks
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_tasks_task_list_nn ON tasks(task_list_id) WHERE task_list_id IS NOT NULL;

-- ============================================================
-- STEP 12: Drop old column-related template tables (project_template_columns)
-- ============================================================
DROP TABLE IF EXISTS project_template_columns CASCADE;
