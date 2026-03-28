//! Metrics database queries
//!
//! Queries the materialized views for workspace, team, and personal dashboards.
//! Views are refreshed via `refresh_metrics_views()` SQL function.

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

/// Cycle time data point (weekly average)
#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct CycleTimePoint {
    pub week_start: NaiveDate,
    pub avg_cycle_days: f64,
    pub tasks_completed: i32,
}

/// Velocity data point (weekly task count)
#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct VelocityPoint {
    pub week_start: NaiveDate,
    pub tasks_completed: i32,
}

/// Workload per user
#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct WorkloadRow {
    pub user_id: Uuid,
    pub user_name: String,
    pub active_tasks: i32,
    pub overdue_tasks: i32,
    pub completed_this_week: i32,
}

/// On-time metric with breakdown
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OnTimeMetric {
    pub on_time_pct: f64,
    pub total_completed: i64,
    pub on_time_count: i64,
}

/// Previous period on-time comparison
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OnTimePrevious {
    pub on_time_pct: f64,
    pub total_completed: i64,
    pub period_label: String,
}

/// Overdue aging breakdown
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OverdueAging {
    pub critical: i64,
    pub recent: i64,
}

/// Workspace-level metrics dashboard
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkspaceDashboard {
    pub cycle_time: Vec<CycleTimePoint>,
    pub velocity: Vec<VelocityPoint>,
    pub on_time: OnTimeMetric,
    pub on_time_previous: Option<OnTimePrevious>,
    pub overdue_aging: OverdueAging,
    pub workload_balance: Vec<WorkloadRow>,
}

/// Team-level metrics dashboard
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TeamDashboard {
    pub cycle_time: Vec<CycleTimePoint>,
    pub velocity: Vec<VelocityPoint>,
    pub on_time: OnTimeMetric,
    pub workload_balance: Vec<WorkloadRow>,
}

/// Personal metrics dashboard
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PersonalDashboard {
    pub cycle_time: Vec<CycleTimePoint>,
    pub velocity: Vec<VelocityPoint>,
    pub on_time: OnTimeMetric,
    pub active_tasks: i32,
    pub overdue_tasks: i32,
    pub completed_this_week: i32,
}

/// Combined on-time + overdue aging query result
#[derive(Debug, sqlx::FromRow)]
struct OnTimeAgingRow {
    pub on_time_count: i64,
    pub total_completed: i64,
    pub prev_on_time_count: i64,
    pub prev_total_completed: i64,
    pub overdue_critical: i64,
    pub overdue_recent: i64,
}

/// Simple on-time query result (for team/personal dashboards)
#[derive(Debug, sqlx::FromRow)]
struct OnTimeRow {
    pub on_time_count: i64,
    pub total_completed: i64,
}

/// Personal stats row
#[derive(Debug, sqlx::FromRow)]
struct PersonalStatsRow {
    pub active_tasks: i32,
    pub overdue_tasks: i32,
    pub completed_this_week: i32,
}

/// Fetch workspace-level metrics dashboard.
///
/// Aggregates cycle time, velocity, on-time %, and workload across all boards
/// in the workspace. Uses materialized views for performance.
///
/// `current_start` / `prev_start` scope the on-time calculation to a calendar period.
/// `period_label` is the human-readable label for the previous period (e.g. "Feb").
pub async fn get_workspace_dashboard(
    pool: &PgPool,
    workspace_id: Uuid,
    current_start: Option<DateTime<Utc>>,
    prev_start: Option<DateTime<Utc>>,
    period_label: Option<String>,
) -> Result<WorkspaceDashboard, sqlx::Error> {
    let cycle_time = sqlx::query_as::<_, CycleTimePoint>(
        r#"
        SELECT
            week_start,
            ROUND(AVG(avg_cycle_days)::NUMERIC, 2)::FLOAT8 AS avg_cycle_days,
            SUM(tasks_completed)::INTEGER AS tasks_completed
        FROM metrics_cycle_time_by_week
        WHERE workspace_id = $1
        GROUP BY week_start
        ORDER BY week_start DESC
        LIMIT 12
        "#,
    )
    .bind(workspace_id)
    .fetch_all(pool)
    .await?;

    let velocity = sqlx::query_as::<_, VelocityPoint>(
        r#"
        SELECT
            week_start,
            SUM(tasks_completed)::INTEGER AS tasks_completed
        FROM metrics_task_velocity
        WHERE workspace_id = $1
        GROUP BY week_start
        ORDER BY week_start DESC
        LIMIT 12
        "#,
    )
    .bind(workspace_id)
    .fetch_all(pool)
    .await?;

    // Combined on-time + previous period + overdue aging in a single query
    let on_time_row = sqlx::query_as::<_, OnTimeAgingRow>(
        r#"
        SELECT
            COALESCE(COUNT(*) FILTER (
                WHERE bc.type = 'done' AND t.due_date IS NOT NULL
                  AND ($2::TIMESTAMPTZ IS NULL OR t.updated_at >= $2)
                  AND t.updated_at <= t.due_date
            ), 0)::BIGINT AS on_time_count,
            COALESCE(COUNT(*) FILTER (
                WHERE bc.type = 'done' AND t.due_date IS NOT NULL
                  AND ($2::TIMESTAMPTZ IS NULL OR t.updated_at >= $2)
            ), 0)::BIGINT AS total_completed,
            COALESCE(COUNT(*) FILTER (
                WHERE bc.type = 'done' AND t.due_date IS NOT NULL
                  AND $3::TIMESTAMPTZ IS NOT NULL AND $2::TIMESTAMPTZ IS NOT NULL
                  AND t.updated_at >= $3 AND t.updated_at < $2
                  AND t.updated_at <= t.due_date
            ), 0)::BIGINT AS prev_on_time_count,
            COALESCE(COUNT(*) FILTER (
                WHERE bc.type = 'done' AND t.due_date IS NOT NULL
                  AND $3::TIMESTAMPTZ IS NOT NULL AND $2::TIMESTAMPTZ IS NOT NULL
                  AND t.updated_at >= $3 AND t.updated_at < $2
            ), 0)::BIGINT AS prev_total_completed,
            COALESCE(COUNT(*) FILTER (
                WHERE bc.type != 'done' AND t.due_date IS NOT NULL AND t.due_date < NOW()
                  AND EXTRACT(DAY FROM (NOW() - t.due_date)) > 7
            ), 0)::BIGINT AS overdue_critical,
            COALESCE(COUNT(*) FILTER (
                WHERE bc.type != 'done' AND t.due_date IS NOT NULL AND t.due_date < NOW()
                  AND EXTRACT(DAY FROM (NOW() - t.due_date)) <= 7
            ), 0)::BIGINT AS overdue_recent
        FROM tasks t
        JOIN projects b ON b.id = t.project_id AND b.deleted_at IS NULL
        JOIN project_statuses bc ON bc.id = t.status_id
        WHERE b.workspace_id = $1
          AND t.deleted_at IS NULL
          AND t.parent_task_id IS NULL
        "#,
    )
    .bind(workspace_id)
    .bind(current_start)
    .bind(prev_start)
    .fetch_one(pool)
    .await?;

    let on_time_pct = if on_time_row.total_completed == 0 {
        0.0
    } else {
        (on_time_row.on_time_count as f64 / on_time_row.total_completed as f64 * 100.0).round()
    };

    let on_time = OnTimeMetric {
        on_time_pct,
        total_completed: on_time_row.total_completed,
        on_time_count: on_time_row.on_time_count,
    };

    let on_time_previous = if on_time_row.prev_total_completed > 0 {
        let prev_pct = (on_time_row.prev_on_time_count as f64
            / on_time_row.prev_total_completed as f64
            * 100.0)
            .round();
        Some(OnTimePrevious {
            on_time_pct: prev_pct,
            total_completed: on_time_row.prev_total_completed,
            period_label: period_label.unwrap_or_default(),
        })
    } else {
        None
    };

    let overdue_aging = OverdueAging {
        critical: on_time_row.overdue_critical,
        recent: on_time_row.overdue_recent,
    };

    let workload = sqlx::query_as::<_, WorkloadRow>(
        r#"
        SELECT
            user_id,
            user_name,
            active_tasks,
            overdue_tasks,
            completed_this_week
        FROM metrics_workload_by_person
        WHERE workspace_id = $1
        ORDER BY active_tasks DESC
        "#,
    )
    .bind(workspace_id)
    .fetch_all(pool)
    .await?;

    Ok(WorkspaceDashboard {
        cycle_time,
        velocity,
        on_time,
        on_time_previous,
        overdue_aging,
        workload_balance: workload,
    })
}

/// Fetch team-level metrics dashboard.
///
/// Scopes metrics to boards where team members are assigned.
pub async fn get_team_dashboard(
    pool: &PgPool,
    team_id: Uuid,
) -> Result<TeamDashboard, sqlx::Error> {
    // Get cycle time for boards that team members work on
    let cycle_time = sqlx::query_as::<_, CycleTimePoint>(
        r#"
        SELECT
            ct.week_start,
            ROUND(AVG(ct.avg_cycle_days)::NUMERIC, 2)::FLOAT8 AS avg_cycle_days,
            SUM(ct.tasks_completed)::INTEGER AS tasks_completed
        FROM metrics_cycle_time_by_week ct
        JOIN project_members bm ON bm.project_id = ct.project_id
        JOIN team_members tm ON tm.user_id = bm.user_id AND tm.team_id = $1
        GROUP BY ct.week_start
        ORDER BY ct.week_start DESC
        LIMIT 12
        "#,
    )
    .bind(team_id)
    .fetch_all(pool)
    .await?;

    let velocity = sqlx::query_as::<_, VelocityPoint>(
        r#"
        SELECT
            tv.week_start,
            SUM(tv.tasks_completed)::INTEGER AS tasks_completed
        FROM metrics_task_velocity tv
        JOIN project_members bm ON bm.project_id = tv.project_id
        JOIN team_members tm ON tm.user_id = bm.user_id AND tm.team_id = $1
        GROUP BY tv.week_start
        ORDER BY tv.week_start DESC
        LIMIT 12
        "#,
    )
    .bind(team_id)
    .fetch_all(pool)
    .await?;

    // On-time count for tasks assigned to team members (exclude no-due-date)
    let on_time_row = sqlx::query_as::<_, OnTimeRow>(
        r#"
        SELECT
            COALESCE(COUNT(*) FILTER (
                WHERE t.due_date IS NOT NULL AND t.updated_at <= t.due_date
            ), 0)::BIGINT AS on_time_count,
            COALESCE(COUNT(*) FILTER (
                WHERE t.due_date IS NOT NULL
            ), 0)::BIGINT AS total_completed
        FROM tasks t
        JOIN task_assignees ta ON ta.task_id = t.id
        JOIN team_members tm ON tm.user_id = ta.user_id AND tm.team_id = $1
        JOIN project_statuses bc ON bc.id = t.status_id
        WHERE t.deleted_at IS NULL
          AND bc.type = 'done'
          AND t.parent_task_id IS NULL
        "#,
    )
    .bind(team_id)
    .fetch_one(pool)
    .await?;

    // Workload for team members
    let workload = sqlx::query_as::<_, WorkloadRow>(
        r#"
        SELECT
            w.user_id,
            w.user_name,
            w.active_tasks,
            w.overdue_tasks,
            w.completed_this_week
        FROM metrics_workload_by_person w
        JOIN team_members tm ON tm.user_id = w.user_id AND tm.team_id = $1
        ORDER BY w.active_tasks DESC
        "#,
    )
    .bind(team_id)
    .fetch_all(pool)
    .await?;

    let on_time_pct = if on_time_row.total_completed == 0 {
        0.0
    } else {
        (on_time_row.on_time_count as f64 / on_time_row.total_completed as f64 * 100.0).round()
    };

    Ok(TeamDashboard {
        cycle_time,
        velocity,
        on_time: OnTimeMetric {
            on_time_pct,
            total_completed: on_time_row.total_completed,
            on_time_count: on_time_row.on_time_count,
        },
        workload_balance: workload,
    })
}

/// Fetch personal metrics dashboard for a single user.
pub async fn get_personal_dashboard(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<PersonalDashboard, sqlx::Error> {
    // Cycle time for boards the user is a member of
    let cycle_time = sqlx::query_as::<_, CycleTimePoint>(
        r#"
        SELECT
            ct.week_start,
            ROUND(AVG(ct.avg_cycle_days)::NUMERIC, 2)::FLOAT8 AS avg_cycle_days,
            SUM(ct.tasks_completed)::INTEGER AS tasks_completed
        FROM metrics_cycle_time_by_week ct
        JOIN project_members bm ON bm.project_id = ct.project_id AND bm.user_id = $1
        GROUP BY ct.week_start
        ORDER BY ct.week_start DESC
        LIMIT 12
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    let velocity = sqlx::query_as::<_, VelocityPoint>(
        r#"
        SELECT
            tv.week_start,
            SUM(tv.tasks_completed)::INTEGER AS tasks_completed
        FROM metrics_task_velocity tv
        JOIN project_members bm ON bm.project_id = tv.project_id AND bm.user_id = $1
        GROUP BY tv.week_start
        ORDER BY tv.week_start DESC
        LIMIT 12
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    // On-time count for user's completed tasks (exclude no-due-date)
    let on_time_row = sqlx::query_as::<_, OnTimeRow>(
        r#"
        SELECT
            COALESCE(COUNT(*) FILTER (
                WHERE t.due_date IS NOT NULL AND t.updated_at <= t.due_date
            ), 0)::BIGINT AS on_time_count,
            COALESCE(COUNT(*) FILTER (
                WHERE t.due_date IS NOT NULL
            ), 0)::BIGINT AS total_completed
        FROM tasks t
        JOIN task_assignees ta ON ta.task_id = t.id AND ta.user_id = $1
        JOIN project_statuses bc ON bc.id = t.status_id
        WHERE t.deleted_at IS NULL
          AND bc.type = 'done'
          AND t.parent_task_id IS NULL
        "#,
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    // Personal stats from workload view (aggregate across workspaces)
    let stats = sqlx::query_as::<_, PersonalStatsRow>(
        r#"
        SELECT
            COALESCE(SUM(active_tasks), 0)::INTEGER AS active_tasks,
            COALESCE(SUM(overdue_tasks), 0)::INTEGER AS overdue_tasks,
            COALESCE(SUM(completed_this_week), 0)::INTEGER AS completed_this_week
        FROM metrics_workload_by_person
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    let on_time_pct = if on_time_row.total_completed == 0 {
        0.0
    } else {
        (on_time_row.on_time_count as f64 / on_time_row.total_completed as f64 * 100.0).round()
    };

    Ok(PersonalDashboard {
        cycle_time,
        velocity,
        on_time: OnTimeMetric {
            on_time_pct,
            total_completed: on_time_row.total_completed,
            on_time_count: on_time_row.on_time_count,
        },
        active_tasks: stats.active_tasks,
        overdue_tasks: stats.overdue_tasks,
        completed_this_week: stats.completed_this_week,
    })
}

/// Per-user resource utilization for a workspace
#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct ResourceUtilizationRow {
    pub user_id: Uuid,
    pub user_name: String,
    pub total_estimated_hours: f64,
    pub total_actual_hours: f64,
    pub task_count: i64,
}

/// Fetch per-user resource utilization for a workspace.
///
/// Aggregates estimated hours (from tasks), actual hours (from time entries),
/// and task count for each workspace member.
pub async fn get_resource_utilization(
    pool: &PgPool,
    workspace_id: Uuid,
) -> Result<Vec<ResourceUtilizationRow>, sqlx::Error> {
    sqlx::query_as::<_, ResourceUtilizationRow>(
        r#"
        SELECT
            u.id AS user_id,
            u.name AS user_name,
            COALESCE(SUM(t.estimated_hours), 0)::FLOAT8 AS total_estimated_hours,
            COALESCE(SUM(te.duration_minutes)::FLOAT8 / 60.0, 0)::FLOAT8 AS total_actual_hours,
            COUNT(DISTINCT t.id)::BIGINT AS task_count
        FROM users u
        JOIN workspace_members wm ON wm.user_id = u.id AND wm.workspace_id = $1
        LEFT JOIN task_assignees ta ON ta.user_id = u.id
        LEFT JOIN tasks t ON t.id = ta.task_id AND t.deleted_at IS NULL
        LEFT JOIN time_entries te ON te.user_id = u.id AND te.ended_at IS NOT NULL
        GROUP BY u.id, u.name
        ORDER BY total_estimated_hours DESC
        "#,
    )
    .bind(workspace_id)
    .fetch_all(pool)
    .await
}

/// Refresh all materialized metrics views by calling the SQL function.
pub async fn refresh_metrics(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query("SELECT refresh_metrics_views()")
        .execute(pool)
        .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_workspace_dashboard_serializes() {
        let dashboard = WorkspaceDashboard {
            cycle_time: vec![CycleTimePoint {
                week_start: NaiveDate::from_ymd_opt(2026, 3, 3).expect("valid date"),
                avg_cycle_days: 3.5,
                tasks_completed: 10,
            }],
            velocity: vec![VelocityPoint {
                week_start: NaiveDate::from_ymd_opt(2026, 3, 3).expect("valid date"),
                tasks_completed: 10,
            }],
            on_time: OnTimeMetric {
                on_time_pct: 87.5,
                total_completed: 8,
                on_time_count: 7,
            },
            on_time_previous: Some(OnTimePrevious {
                on_time_pct: 75.0,
                total_completed: 4,
                period_label: "Feb".to_string(),
            }),
            overdue_aging: OverdueAging {
                critical: 3,
                recent: 5,
            },
            workload_balance: vec![WorkloadRow {
                user_id: Uuid::new_v4(),
                user_name: "Alice".to_string(),
                active_tasks: 5,
                overdue_tasks: 1,
                completed_this_week: 3,
            }],
        };
        let json = serde_json::to_string(&dashboard).expect("serialize");
        assert!(json.contains("cycle_time"));
        assert!(json.contains("velocity"));
        assert!(json.contains("on_time"));
        assert!(json.contains("on_time_pct"));
        assert!(json.contains("total_completed"));
        assert!(json.contains("on_time_previous"));
        assert!(json.contains("overdue_aging"));
        assert!(json.contains("workload_balance"));
    }

    #[test]
    fn test_team_dashboard_serializes() {
        let dashboard = TeamDashboard {
            cycle_time: vec![],
            velocity: vec![],
            on_time: OnTimeMetric {
                on_time_pct: 0.0,
                total_completed: 0,
                on_time_count: 0,
            },
            workload_balance: vec![],
        };
        let json = serde_json::to_string(&dashboard).expect("serialize");
        assert!(json.contains("on_time"));
    }

    #[test]
    fn test_personal_dashboard_serializes() {
        let dashboard = PersonalDashboard {
            cycle_time: vec![],
            velocity: vec![],
            on_time: OnTimeMetric {
                on_time_pct: 95.0,
                total_completed: 20,
                on_time_count: 19,
            },
            active_tasks: 5,
            overdue_tasks: 1,
            completed_this_week: 3,
        };
        let json = serde_json::to_string(&dashboard).expect("serialize");
        assert!(json.contains("active_tasks"));
        assert!(json.contains("overdue_tasks"));
        assert!(json.contains("completed_this_week"));
    }

    #[test]
    fn test_on_time_zero_completions() {
        let metric = OnTimeMetric {
            on_time_pct: 0.0,
            total_completed: 0,
            on_time_count: 0,
        };
        let json = serde_json::to_string(&metric).expect("serialize");
        assert!(json.contains("\"on_time_pct\":0.0"));
    }
}
