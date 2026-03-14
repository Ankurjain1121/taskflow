//! Metrics database queries
//!
//! Queries the materialized views for workspace, team, and personal dashboards.
//! Views are refreshed via `refresh_metrics_views()` SQL function.

use chrono::NaiveDate;
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

/// Workspace-level metrics dashboard
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkspaceDashboard {
    pub cycle_time: Vec<CycleTimePoint>,
    pub velocity: Vec<VelocityPoint>,
    pub on_time_pct: f64,
    pub workload: Vec<WorkloadRow>,
}

/// Team-level metrics dashboard
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TeamDashboard {
    pub cycle_time: Vec<CycleTimePoint>,
    pub velocity: Vec<VelocityPoint>,
    pub on_time_pct: f64,
    pub workload: Vec<WorkloadRow>,
}

/// Personal metrics dashboard
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PersonalDashboard {
    pub cycle_time: Vec<CycleTimePoint>,
    pub velocity: Vec<VelocityPoint>,
    pub on_time_pct: f64,
    pub active_tasks: i32,
    pub overdue_tasks: i32,
    pub completed_this_week: i32,
}

/// On-time percentage row
#[derive(Debug, sqlx::FromRow)]
struct OnTimePctRow {
    pub on_time_pct: f64,
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
pub async fn get_workspace_dashboard(
    pool: &PgPool,
    workspace_id: Uuid,
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

    let on_time_row = sqlx::query_as::<_, OnTimePctRow>(
        r#"
        SELECT COALESCE(
            ROUND(
                COUNT(*) FILTER (
                    WHERE t.due_date IS NULL OR t.updated_at <= t.due_date
                )::NUMERIC * 100.0 / NULLIF(COUNT(*), 0),
                1
            )::FLOAT8,
            100.0
        ) AS on_time_pct
        FROM tasks t
        JOIN projects b ON b.id = t.project_id AND b.deleted_at IS NULL
        JOIN project_statuses bc ON bc.id = t.status_id
        WHERE b.workspace_id = $1
          AND t.deleted_at IS NULL
          AND bc.type = 'done'
        "#,
    )
    .bind(workspace_id)
    .fetch_one(pool)
    .await?;

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
        on_time_pct: on_time_row.on_time_pct,
        workload,
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
        JOIN project_members bm ON bm.project_id = ct.board_id
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
        JOIN project_members bm ON bm.project_id = tv.board_id
        JOIN team_members tm ON tm.user_id = bm.user_id AND tm.team_id = $1
        GROUP BY tv.week_start
        ORDER BY tv.week_start DESC
        LIMIT 12
        "#,
    )
    .bind(team_id)
    .fetch_all(pool)
    .await?;

    // On-time % for tasks assigned to team members
    let on_time_row = sqlx::query_as::<_, OnTimePctRow>(
        r#"
        SELECT COALESCE(
            ROUND(
                COUNT(*) FILTER (
                    WHERE t.due_date IS NULL OR t.updated_at <= t.due_date
                )::NUMERIC * 100.0 / NULLIF(COUNT(*), 0),
                1
            )::FLOAT8,
            100.0
        ) AS on_time_pct
        FROM tasks t
        JOIN task_assignees ta ON ta.task_id = t.id
        JOIN team_members tm ON tm.user_id = ta.user_id AND tm.team_id = $1
        JOIN project_statuses bc ON bc.id = t.status_id
        WHERE t.deleted_at IS NULL
          AND bc.type = 'done'
        "#,
    )
    .bind(team_id)
    .fetch_all(pool)
    .await?
    .into_iter()
    .next()
    .unwrap_or(OnTimePctRow { on_time_pct: 100.0 });

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

    Ok(TeamDashboard {
        cycle_time,
        velocity,
        on_time_pct: on_time_row.on_time_pct,
        workload,
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
        JOIN project_members bm ON bm.project_id = ct.board_id AND bm.user_id = $1
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
        JOIN project_members bm ON bm.project_id = tv.board_id AND bm.user_id = $1
        GROUP BY tv.week_start
        ORDER BY tv.week_start DESC
        LIMIT 12
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    // On-time % for user's completed tasks
    let on_time_row = sqlx::query_as::<_, OnTimePctRow>(
        r#"
        SELECT COALESCE(
            ROUND(
                COUNT(*) FILTER (
                    WHERE t.due_date IS NULL OR t.updated_at <= t.due_date
                )::NUMERIC * 100.0 / NULLIF(COUNT(*), 0),
                1
            )::FLOAT8,
            100.0
        ) AS on_time_pct
        FROM tasks t
        JOIN task_assignees ta ON ta.task_id = t.id AND ta.user_id = $1
        JOIN project_statuses bc ON bc.id = t.status_id
        WHERE t.deleted_at IS NULL
          AND bc.type = 'done'
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

    Ok(PersonalDashboard {
        cycle_time,
        velocity,
        on_time_pct: on_time_row.on_time_pct,
        active_tasks: stats.active_tasks,
        overdue_tasks: stats.overdue_tasks,
        completed_this_week: stats.completed_this_week,
    })
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
            on_time_pct: 87.5,
            workload: vec![WorkloadRow {
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
        assert!(json.contains("on_time_pct"));
        assert!(json.contains("workload"));
    }

    #[test]
    fn test_team_dashboard_serializes() {
        let dashboard = TeamDashboard {
            cycle_time: vec![],
            velocity: vec![],
            on_time_pct: 100.0,
            workload: vec![],
        };
        let json = serde_json::to_string(&dashboard).expect("serialize");
        assert!(json.contains("on_time_pct"));
    }

    #[test]
    fn test_personal_dashboard_serializes() {
        let dashboard = PersonalDashboard {
            cycle_time: vec![],
            velocity: vec![],
            on_time_pct: 95.0,
            active_tasks: 5,
            overdue_tasks: 1,
            completed_this_week: 3,
        };
        let json = serde_json::to_string(&dashboard).expect("serialize");
        assert!(json.contains("active_tasks"));
        assert!(json.contains("overdue_tasks"));
        assert!(json.contains("completed_this_week"));
    }
}
