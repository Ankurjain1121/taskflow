-- ============================================
-- Phase J2: Materialized Views for Metrics
-- ============================================

-- Cycle time by week: average days from task creation to reaching a "done" column
CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_cycle_time_by_week AS
SELECT
    t.board_id,
    b.workspace_id,
    date_trunc('week', t.updated_at)::DATE AS week_start,
    ROUND(AVG(EXTRACT(EPOCH FROM (t.updated_at - t.created_at)) / 86400)::NUMERIC, 2) AS avg_cycle_days,
    COUNT(*)::INTEGER AS tasks_completed
FROM tasks t
JOIN boards b ON b.id = t.board_id
JOIN board_columns bc ON bc.id = t.column_id
WHERE t.deleted_at IS NULL
  AND b.deleted_at IS NULL
  AND bc.status_mapping::TEXT ILIKE '%done%'
GROUP BY t.board_id, b.workspace_id, date_trunc('week', t.updated_at)::DATE
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_metrics_cycle_time_board_week
    ON metrics_cycle_time_by_week(board_id, week_start);

-- Task velocity: tasks completed per week per board
CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_task_velocity AS
SELECT
    t.board_id,
    b.workspace_id,
    date_trunc('week', t.updated_at)::DATE AS week_start,
    COUNT(*)::INTEGER AS tasks_completed
FROM tasks t
JOIN boards b ON b.id = t.board_id
JOIN board_columns bc ON bc.id = t.column_id
WHERE t.deleted_at IS NULL
  AND b.deleted_at IS NULL
  AND bc.status_mapping::TEXT ILIKE '%done%'
GROUP BY t.board_id, b.workspace_id, date_trunc('week', t.updated_at)::DATE
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_metrics_task_velocity_board_week
    ON metrics_task_velocity(board_id, week_start);

-- Workload by person: active/overdue/completed task counts per user
CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_workload_by_person AS
SELECT
    wm.workspace_id,
    u.id AS user_id,
    u.name AS user_name,
    COUNT(DISTINCT ta.task_id) FILTER (
        WHERE t.deleted_at IS NULL
          AND NOT (bc.status_mapping::TEXT ILIKE '%done%')
    )::INTEGER AS active_tasks,
    COUNT(DISTINCT ta.task_id) FILTER (
        WHERE t.deleted_at IS NULL
          AND t.due_date < now()
          AND NOT (bc.status_mapping::TEXT ILIKE '%done%')
    )::INTEGER AS overdue_tasks,
    COUNT(DISTINCT ta.task_id) FILTER (
        WHERE t.deleted_at IS NULL
          AND bc.status_mapping::TEXT ILIKE '%done%'
          AND t.updated_at >= date_trunc('week', now())
    )::INTEGER AS completed_this_week
FROM workspace_members wm
JOIN users u ON u.id = wm.user_id
LEFT JOIN task_assignees ta ON ta.user_id = u.id
LEFT JOIN tasks t ON t.id = ta.task_id
LEFT JOIN board_columns bc ON bc.id = t.column_id
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
