-- ============================================================================
-- Migration: Rename Board -> Project
-- ============================================================================
-- Renames 5 tables, board_id columns in 16+ tables, enum, 30 indexes,
-- materialized views, triggers, and constraints.
-- Creates backward-compat views for transition period.
-- ============================================================================

-- ============================================================================
-- Step 1: Rename the enum
-- ============================================================================
ALTER TYPE board_member_role RENAME TO project_member_role;

-- ============================================================================
-- Step 2: Drop materialized view indexes (must drop before recreating views)
-- ============================================================================
DROP INDEX IF EXISTS idx_metrics_cycle_time_board_week;
DROP INDEX IF EXISTS idx_metrics_task_velocity_board_week;

-- ============================================================================
-- Step 3: Drop materialized views (will recreate with new column names)
-- ============================================================================
DROP MATERIALIZED VIEW IF EXISTS metrics_cycle_time_by_week;
DROP MATERIALIZED VIEW IF EXISTS metrics_task_velocity;
DROP MATERIALIZED VIEW IF EXISTS metrics_workload_by_person;

-- ============================================================================
-- Step 4: Drop triggers on tables being renamed
-- ============================================================================
DROP TRIGGER IF EXISTS update_boards_updated_at ON boards;
DROP TRIGGER IF EXISTS update_custom_fields_updated_at ON board_custom_fields;

-- ============================================================================
-- Step 5: Rename tables
-- ============================================================================
ALTER TABLE boards RENAME TO projects;
ALTER TABLE board_members RENAME TO project_members;
ALTER TABLE board_columns RENAME TO project_columns;
ALTER TABLE board_custom_fields RENAME TO project_custom_fields;
ALTER TABLE board_shares RENAME TO project_shares;

-- ============================================================================
-- Step 6: Rename board_id columns in renamed tables
-- ============================================================================
ALTER TABLE project_members RENAME COLUMN board_id TO project_id;
ALTER TABLE project_columns RENAME COLUMN board_id TO project_id;
ALTER TABLE project_custom_fields RENAME COLUMN board_id TO project_id;
ALTER TABLE project_shares RENAME COLUMN board_id TO project_id;

-- ============================================================================
-- Step 7: Rename board_id columns in other tables
-- ============================================================================
ALTER TABLE tasks RENAME COLUMN board_id TO project_id;
ALTER TABLE labels RENAME COLUMN board_id TO project_id;
ALTER TABLE milestones RENAME COLUMN board_id TO project_id;
ALTER TABLE automation_rules RENAME COLUMN board_id TO project_id;
ALTER TABLE webhooks RENAME COLUMN board_id TO project_id;
ALTER TABLE task_groups RENAME COLUMN board_id TO project_id;
ALTER TABLE positions RENAME COLUMN board_id TO project_id;
ALTER TABLE filter_presets RENAME COLUMN board_id TO project_id;
ALTER TABLE bulk_operations RENAME COLUMN board_id TO project_id;
ALTER TABLE time_entries RENAME COLUMN board_id TO project_id;
ALTER TABLE task_templates RENAME COLUMN board_id TO project_id;

-- ============================================================================
-- Step 8: Rename unique constraints
-- ============================================================================
ALTER INDEX board_members_board_id_user_id_key RENAME TO project_members_project_id_user_id_key;
ALTER INDEX board_custom_fields_board_id_name_key RENAME TO project_custom_fields_project_id_name_key;
ALTER INDEX board_shares_share_token_key RENAME TO project_shares_share_token_key;
ALTER INDEX filter_presets_user_id_board_id_name_key RENAME TO filter_presets_user_id_project_id_name_key;
ALTER INDEX positions_board_id_name_key RENAME TO positions_project_id_name_key;

-- ============================================================================
-- Step 9: Rename primary key indexes
-- ============================================================================
ALTER INDEX boards_pkey RENAME TO projects_pkey;
ALTER INDEX board_members_pkey RENAME TO project_members_pkey;
ALTER INDEX board_columns_pkey RENAME TO project_columns_pkey;
ALTER INDEX board_custom_fields_pkey RENAME TO project_custom_fields_pkey;
ALTER INDEX board_shares_pkey RENAME TO project_shares_pkey;

-- ============================================================================
-- Step 10: Rename regular indexes
-- ============================================================================
ALTER INDEX idx_boards_workspace RENAME TO idx_projects_workspace;
ALTER INDEX idx_boards_tenant RENAME TO idx_projects_tenant;
ALTER INDEX idx_boards_is_sample RENAME TO idx_projects_is_sample;
ALTER INDEX idx_board_columns_board RENAME TO idx_project_columns_project;
ALTER INDEX idx_board_members_user RENAME TO idx_project_members_user;
ALTER INDEX idx_board_shares_board RENAME TO idx_project_shares_project;
ALTER INDEX idx_board_shares_token RENAME TO idx_project_shares_token;
ALTER INDEX idx_custom_fields_board RENAME TO idx_custom_fields_project;
ALTER INDEX idx_tasks_board RENAME TO idx_tasks_project;
ALTER INDEX idx_tasks_board_task_number RENAME TO idx_tasks_project_task_number;
ALTER INDEX idx_labels_board RENAME TO idx_labels_project;
ALTER INDEX idx_milestones_board RENAME TO idx_milestones_project;
ALTER INDEX idx_automation_rules_board RENAME TO idx_automation_rules_project;
ALTER INDEX idx_webhooks_board RENAME TO idx_webhooks_project;
ALTER INDEX idx_task_groups_board RENAME TO idx_task_groups_project;
ALTER INDEX idx_positions_board RENAME TO idx_positions_project;
ALTER INDEX idx_filter_presets_user_board RENAME TO idx_filter_presets_user_project;
ALTER INDEX idx_task_templates_board RENAME TO idx_task_templates_project;

-- task_groups has a composite index too
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_task_groups_position') THEN
        ALTER INDEX idx_task_groups_position RENAME TO idx_task_groups_project_position;
    END IF;
END
$$;

-- ============================================================================
-- Step 11: Recreate triggers on renamed tables
-- ============================================================================
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_fields_updated_at
    BEFORE UPDATE ON project_custom_fields
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Step 12: Recreate materialized views with new names
-- ============================================================================
CREATE MATERIALIZED VIEW metrics_cycle_time_by_week AS
SELECT
    t.project_id,
    p.workspace_id,
    date_trunc('week', t.updated_at)::DATE AS week_start,
    ROUND(AVG(EXTRACT(EPOCH FROM (t.updated_at - t.created_at)) / 86400), 2) AS avg_cycle_days,
    COUNT(*)::INTEGER AS tasks_completed
FROM tasks t
JOIN projects p ON p.id = t.project_id
JOIN project_columns pc ON pc.id = t.column_id
WHERE t.deleted_at IS NULL AND p.deleted_at IS NULL
    AND pc.status_mapping::TEXT ILIKE '%done%'
GROUP BY t.project_id, p.workspace_id, date_trunc('week', t.updated_at)::DATE
WITH NO DATA;

CREATE UNIQUE INDEX idx_metrics_cycle_time_project_week
    ON metrics_cycle_time_by_week(project_id, week_start);

CREATE MATERIALIZED VIEW metrics_task_velocity AS
SELECT
    t.project_id,
    p.workspace_id,
    date_trunc('week', t.updated_at)::DATE AS week_start,
    COUNT(*)::INTEGER AS tasks_completed,
    SUM(CASE WHEN t.priority = 'urgent' OR t.priority = 'high' THEN 1 ELSE 0 END)::INTEGER AS high_priority_completed
FROM tasks t
JOIN projects p ON p.id = t.project_id
JOIN project_columns pc ON pc.id = t.column_id
WHERE t.deleted_at IS NULL AND p.deleted_at IS NULL
    AND pc.status_mapping::TEXT ILIKE '%done%'
GROUP BY t.project_id, p.workspace_id, date_trunc('week', t.updated_at)::DATE
WITH NO DATA;

CREATE UNIQUE INDEX idx_metrics_task_velocity_project_week
    ON metrics_task_velocity(project_id, week_start);

CREATE MATERIALIZED VIEW metrics_workload_by_person AS
SELECT
    ta.user_id,
    u.name AS user_name,
    u.avatar_url,
    w.id AS workspace_id,
    COUNT(t.id)::INTEGER AS active_tasks,
    COUNT(CASE WHEN t.due_date < NOW() AND t.deleted_at IS NULL THEN 1 END)::INTEGER AS overdue_tasks,
    AVG(CASE
        WHEN t.priority = 'urgent' THEN 4
        WHEN t.priority = 'high' THEN 3
        WHEN t.priority = 'medium' THEN 2
        WHEN t.priority = 'low' THEN 1
        ELSE 0
    END)::NUMERIC(3,2) AS avg_priority_score
FROM task_assignees ta
JOIN tasks t ON t.id = ta.task_id
JOIN projects p ON p.id = t.project_id
JOIN workspaces w ON w.id = p.workspace_id
JOIN users u ON u.id = ta.user_id
LEFT JOIN project_columns pc ON pc.id = t.column_id
WHERE t.deleted_at IS NULL
    AND p.deleted_at IS NULL
    AND (pc.status_mapping IS NULL OR pc.status_mapping::TEXT NOT ILIKE '%done%')
GROUP BY ta.user_id, u.name, u.avatar_url, w.id
WITH NO DATA;

CREATE UNIQUE INDEX idx_metrics_workload_user_workspace
    ON metrics_workload_by_person(user_id, workspace_id);

-- ============================================================================
-- Step 13: Update recent_items entity_type constraint
-- ============================================================================
-- The recent_items CHECK constraint references 'board' - update to 'project'
-- First drop the old constraint, then add new one
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT con.conname INTO constraint_name
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'recent_items'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%entity_type%';

    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE recent_items DROP CONSTRAINT %I', constraint_name);
    END IF;
END
$$;

-- Update existing data BEFORE adding constraint (H2 fix: constraint would reject 'board' rows)
UPDATE recent_items SET entity_type = 'project' WHERE entity_type = 'board';

ALTER TABLE recent_items ADD CONSTRAINT recent_items_entity_type_check
    CHECK (entity_type IN ('task', 'project'));

-- ============================================================================
-- Step 14: Update user_preferences default_board_view -> default_project_view
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_preferences' AND column_name = 'default_board_view'
    ) THEN
        ALTER TABLE user_preferences RENAME COLUMN default_board_view TO default_project_view;
    END IF;
END
$$;

-- ============================================================================
-- Step 15: Backward-compat views (temporary, for transition)
-- ============================================================================
CREATE OR REPLACE VIEW boards AS SELECT * FROM projects;
CREATE OR REPLACE VIEW board_members AS
    SELECT id, project_id AS board_id, user_id, role, joined_at FROM project_members;
CREATE OR REPLACE VIEW board_columns AS
    SELECT id, name, project_id AS board_id, position, color, status_mapping, wip_limit, icon, created_at FROM project_columns;
CREATE OR REPLACE VIEW board_custom_fields AS
    SELECT id, project_id AS board_id, name, field_type, options, is_required, position, tenant_id, created_by_id, created_at, updated_at FROM project_custom_fields;
CREATE OR REPLACE VIEW board_shares AS
    SELECT id, project_id AS board_id, share_token, name, password_hash, expires_at, is_active, permissions, tenant_id, created_by_id, created_at FROM project_shares;

-- ============================================================================
-- Step 16: Refresh materialized views
-- ============================================================================
REFRESH MATERIALIZED VIEW metrics_cycle_time_by_week;
REFRESH MATERIALIZED VIEW metrics_task_velocity;
REFRESH MATERIALIZED VIEW metrics_workload_by_person;
