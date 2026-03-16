-- ============================================
-- Fix broken materialized views for new schema
-- ============================================
-- The original views (20260310000001) reference boards, board_columns,
-- t.board_id, t.column_id, and bc.status_mapping — all removed in the
-- board→project schema migration. Rewrite against new schema:
--   boards         → projects
--   board_columns  → project_statuses
--   t.board_id     → t.project_id
--   t.column_id    → t.status_id
--   bc.status_mapping ILIKE '%done%' → ps.type = 'done'

-- Drop broken views
DROP MATERIALIZED VIEW IF EXISTS metrics_cycle_time_by_week;
DROP MATERIALIZED VIEW IF EXISTS metrics_task_velocity;
DROP MATERIALIZED VIEW IF EXISTS metrics_workload_by_person;

-- Drop old function
DROP FUNCTION IF EXISTS refresh_metrics_views();

-- Cycle time by week: average days from task creation to reaching a "done" status
CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_cycle_time_by_week AS
SELECT
    t.project_id,
    p.workspace_id,
    date_trunc('week', t.updated_at)::DATE AS week_start,
    ROUND(AVG(EXTRACT(EPOCH FROM (t.updated_at - t.created_at)) / 86400)::NUMERIC, 2) AS avg_cycle_days,
    COUNT(*)::INTEGER AS tasks_completed
FROM tasks t
JOIN projects p ON p.id = t.project_id
JOIN project_statuses ps ON ps.id = t.status_id
WHERE t.deleted_at IS NULL
  AND p.deleted_at IS NULL
  AND ps.type = 'done'
GROUP BY t.project_id, p.workspace_id, date_trunc('week', t.updated_at)::DATE
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_metrics_cycle_time_project_week
    ON metrics_cycle_time_by_week(project_id, week_start);

-- Task velocity: tasks completed per week per project
CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_task_velocity AS
SELECT
    t.project_id,
    p.workspace_id,
    date_trunc('week', t.updated_at)::DATE AS week_start,
    COUNT(*)::INTEGER AS tasks_completed
FROM tasks t
JOIN projects p ON p.id = t.project_id
JOIN project_statuses ps ON ps.id = t.status_id
WHERE t.deleted_at IS NULL
  AND p.deleted_at IS NULL
  AND ps.type = 'done'
GROUP BY t.project_id, p.workspace_id, date_trunc('week', t.updated_at)::DATE
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_metrics_task_velocity_project_week
    ON metrics_task_velocity(project_id, week_start);

-- Workload by person: active/overdue/completed task counts per user
CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_workload_by_person AS
SELECT
    wm.workspace_id,
    u.id AS user_id,
    u.name AS user_name,
    COUNT(DISTINCT ta.task_id) FILTER (
        WHERE t.deleted_at IS NULL
          AND NOT (ps.type = 'done')
    )::INTEGER AS active_tasks,
    COUNT(DISTINCT ta.task_id) FILTER (
        WHERE t.deleted_at IS NULL
          AND t.due_date < now()
          AND NOT (ps.type = 'done')
    )::INTEGER AS overdue_tasks,
    COUNT(DISTINCT ta.task_id) FILTER (
        WHERE t.deleted_at IS NULL
          AND ps.type = 'done'
          AND t.updated_at >= date_trunc('week', now())
    )::INTEGER AS completed_this_week
FROM workspace_members wm
JOIN users u ON u.id = wm.user_id
LEFT JOIN task_assignees ta ON ta.user_id = u.id
LEFT JOIN tasks t ON t.id = ta.task_id
LEFT JOIN project_statuses ps ON ps.id = t.status_id
WHERE u.deleted_at IS NULL
GROUP BY wm.workspace_id, u.id, u.name
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_metrics_workload_user
    ON metrics_workload_by_person(workspace_id, user_id);

-- Function to refresh all metrics views concurrently
CREATE OR REPLACE FUNCTION refresh_metrics_views()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY metrics_cycle_time_by_week;
    REFRESH MATERIALIZED VIEW CONCURRENTLY metrics_task_velocity;
    REFRESH MATERIALIZED VIEW CONCURRENTLY metrics_workload_by_person;
END;
$$ LANGUAGE plpgsql;
