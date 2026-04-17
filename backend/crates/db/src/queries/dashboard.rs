//! Dashboard database queries
//!
//! Provides queries for dashboard statistics and recent activity
//! across all workspaces for a given user, with optional workspace filtering.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{ActivityAction, TaskPriority};

// Re-export chart/visualization queries so consumers don't need import changes
pub use super::dashboard_charts::*;

/// Dashboard statistics for the authenticated user
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DashboardStats {
    pub total_tasks: i64,
    pub overdue: i64,
    pub completed_this_week: i64,
    pub due_today: i64,
}

/// Internal row type for the stats aggregation query
#[derive(Debug, sqlx::FromRow)]
struct StatsRow {
    pub total_tasks: i64,
    pub overdue: i64,
    pub due_today: i64,
    pub completed_this_week: i64,
}

/// A recent activity entry with actor information for the dashboard feed
#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct DashboardActivityEntry {
    pub id: Uuid,
    pub action: ActivityAction,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub metadata: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub actor_name: String,
    pub actor_avatar_url: Option<String>,
}

/// Get dashboard statistics for a user, optionally filtered by workspace
pub async fn get_dashboard_stats(
    pool: &PgPool,
    user_id: Uuid,
    workspace_id: Option<Uuid>,
) -> Result<DashboardStats, sqlx::Error> {
    let now = chrono::Utc::now();
    let seven_days_ago = now - chrono::Duration::days(7);

    // NOTE: Parameters are shared between outer query and scalar subquery.
    // $1=user_id, $2=now, $3=seven_days_ago, $4=workspace_id
    let stats = sqlx::query_as::<_, StatsRow>(
        r"
        SELECT
            COUNT(DISTINCT t.id)::bigint AS total_tasks,
            COUNT(DISTINCT t.id) FILTER (
                WHERE t.due_date IS NOT NULL AND t.due_date < $2 AND bc.type != 'done'
            )::bigint AS overdue,
            COUNT(DISTINCT t.id) FILTER (
                WHERE t.due_date IS NOT NULL
                AND t.due_date >= CURRENT_DATE AND t.due_date < CURRENT_DATE + INTERVAL '1 day'
            )::bigint AS due_today,
            (SELECT COUNT(DISTINCT al.entity_id)::bigint
             FROM activity_log al
             INNER JOIN tasks t2 ON t2.id = al.entity_id AND t2.deleted_at IS NULL AND t2.parent_task_id IS NULL
             INNER JOIN task_assignees ta2 ON ta2.task_id = t2.id AND ta2.user_id = $1
             INNER JOIN project_statuses bc2 ON bc2.id = t2.status_id
             WHERE al.action = 'moved' AND al.entity_type = 'task'
               AND al.created_at >= $3 AND bc2.type = 'done'
               AND ($4::uuid IS NULL OR EXISTS (
                   SELECT 1 FROM projects p2 WHERE p2.id = t2.project_id AND p2.workspace_id = $4
               ))
            ) AS completed_this_week
        FROM tasks t
        INNER JOIN task_assignees ta ON ta.task_id = t.id
        INNER JOIN projects b ON b.id = t.project_id AND b.deleted_at IS NULL
        INNER JOIN project_statuses bc ON bc.id = t.status_id
        INNER JOIN workspaces w ON w.id = b.workspace_id
        WHERE ta.user_id = $1 AND t.deleted_at IS NULL
          AND (
              EXISTS (SELECT 1 FROM project_members bm WHERE bm.project_id = t.project_id AND bm.user_id = $1)
              OR EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = b.workspace_id AND wm.user_id = $1)
              OR (EXISTS (SELECT 1 FROM users u WHERE u.id = $1 AND u.role IN ('admin', 'super_admin') AND u.deleted_at IS NULL)
                  AND w.visibility != 'private')
          )
          AND t.parent_task_id IS NULL
          AND ($4::uuid IS NULL OR b.workspace_id = $4)
        ",
    )
    .bind(user_id)
    .bind(now)
    .bind(seven_days_ago)
    .bind(workspace_id)
    .fetch_one(pool)
    .await?;

    Ok(DashboardStats {
        total_tasks: stats.total_tasks,
        overdue: stats.overdue,
        completed_this_week: stats.completed_this_week,
        due_today: stats.due_today,
    })
}

/// Get recent activity for a user's tenant
pub async fn get_recent_activity(
    pool: &PgPool,
    _user_id: Uuid,
    tenant_id: Uuid,
    limit: i64,
    workspace_id: Option<Uuid>,
) -> Result<Vec<DashboardActivityEntry>, sqlx::Error> {
    let limit = limit.clamp(1, 20);

    let entries = sqlx::query_as::<_, DashboardActivityEntry>(
        r"
        SELECT
            al.id,
            al.action,
            al.entity_type,
            al.entity_id,
            al.metadata,
            al.created_at,
            u.name as actor_name,
            u.avatar_url as actor_avatar_url
        FROM activity_log al
        JOIN users u ON u.id = al.user_id
        LEFT JOIN tasks t ON t.id = al.entity_id AND al.entity_type = 'task'
        LEFT JOIN projects b ON b.id = t.project_id
        WHERE al.tenant_id = $1
          AND ($3::uuid IS NULL OR b.workspace_id = $3)
        ORDER BY al.created_at DESC
        LIMIT $2
        ",
    )
    .bind(tenant_id)
    .bind(limit)
    .bind(workspace_id)
    .fetch_all(pool)
    .await?;

    Ok(entries)
}

/// Overdue task details for dashboard table
#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct OverdueTask {
    pub id: Uuid,
    pub title: String,
    pub due_date: DateTime<Utc>,
    pub priority: TaskPriority,
    pub project_id: Uuid,
    pub board_name: String,
    pub days_overdue: i32,
}

/// Get overdue tasks with details
pub async fn get_overdue_tasks(
    pool: &PgPool,
    user_id: Uuid,
    limit: i64,
    workspace_id: Option<Uuid>,
) -> Result<Vec<OverdueTask>, sqlx::Error> {
    let now = Utc::now();
    let limit = limit.clamp(1, 50);

    let rows = sqlx::query_as::<_, OverdueTask>(
        r"
        SELECT
            t.id,
            t.title,
            t.due_date,
            t.priority,
            t.project_id,
            b.name as board_name,
            EXTRACT(DAY FROM (NOW() - t.due_date))::integer as days_overdue
        FROM tasks t
        INNER JOIN task_assignees ta ON ta.task_id = t.id
        INNER JOIN projects b ON b.id = t.project_id AND b.deleted_at IS NULL
        INNER JOIN project_statuses bc ON bc.id = t.status_id
        INNER JOIN workspaces w ON w.id = b.workspace_id
        WHERE ta.user_id = $1
          AND t.deleted_at IS NULL
          AND t.parent_task_id IS NULL
          AND t.due_date IS NOT NULL
          AND t.due_date < $2
          AND bc.type != 'done'
          AND (
              EXISTS (SELECT 1 FROM project_members bm WHERE bm.project_id = t.project_id AND bm.user_id = $1)
              OR EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = b.workspace_id AND wm.user_id = $1)
              OR (EXISTS (SELECT 1 FROM users u WHERE u.id = $1 AND u.role IN ('admin', 'super_admin') AND u.deleted_at IS NULL)
                  AND w.visibility != 'private')
          )
          AND ($4::uuid IS NULL OR b.workspace_id = $4)
        ORDER BY t.due_date ASC
        LIMIT $3
        ",
    )
    .bind(user_id)
    .bind(now)
    .bind(limit)
    .bind(workspace_id)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

/// Upcoming deadline task
#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct UpcomingDeadline {
    pub id: Uuid,
    pub title: String,
    pub due_date: DateTime<Utc>,
    pub priority: TaskPriority,
    pub board_name: String,
    pub days_until_due: i32,
}

/// Get upcoming deadlines (tasks due in next N days)
pub async fn get_upcoming_deadlines(
    pool: &PgPool,
    user_id: Uuid,
    days: i64,
    workspace_id: Option<Uuid>,
) -> Result<Vec<UpcomingDeadline>, sqlx::Error> {
    let now = Utc::now();
    let end_date = now + chrono::Duration::days(days);

    let rows = sqlx::query_as::<_, UpcomingDeadline>(
        r"
        SELECT
            t.id,
            t.title,
            t.due_date,
            t.priority,
            b.name as board_name,
            EXTRACT(DAY FROM (t.due_date - NOW()))::integer as days_until_due
        FROM tasks t
        INNER JOIN task_assignees ta ON ta.task_id = t.id
        INNER JOIN projects b ON b.id = t.project_id AND b.deleted_at IS NULL
        INNER JOIN project_statuses bc ON bc.id = t.status_id
        INNER JOIN workspaces w ON w.id = b.workspace_id
        WHERE ta.user_id = $1
          AND t.deleted_at IS NULL
          AND t.parent_task_id IS NULL
          AND t.due_date IS NOT NULL
          AND t.due_date >= $2
          AND t.due_date <= $3
          AND bc.type != 'done'
          AND (
              EXISTS (SELECT 1 FROM project_members bm WHERE bm.project_id = t.project_id AND bm.user_id = $1)
              OR EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = b.workspace_id AND wm.user_id = $1)
              OR (EXISTS (SELECT 1 FROM users u WHERE u.id = $1 AND u.role IN ('admin', 'super_admin') AND u.deleted_at IS NULL)
                  AND w.visibility != 'private')
          )
          AND ($4::uuid IS NULL OR b.workspace_id = $4)
        ORDER BY t.due_date ASC
        LIMIT 50
        ",
    )
    .bind(user_id)
    .bind(now)
    .bind(end_date)
    .bind(workspace_id)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dashboard_stats_serializes() {
        let stats = DashboardStats {
            total_tasks: 42,
            overdue: 3,
            completed_this_week: 7,
            due_today: 2,
        };
        let json = serde_json::to_string(&stats).unwrap();
        assert!(json.contains("total_tasks"));
        assert!(json.contains("overdue"));
        assert!(json.contains("completed_this_week"));
        assert!(json.contains("due_today"));
    }

    #[test]
    fn test_dashboard_activity_serializes() {
        let entry = DashboardActivityEntry {
            id: Uuid::new_v4(),
            action: ActivityAction::Created,
            entity_type: "task".to_string(),
            entity_id: Uuid::new_v4(),
            metadata: None,
            created_at: Utc::now(),
            actor_name: "John".to_string(),
            actor_avatar_url: None,
        };
        let json = serde_json::to_string(&entry).unwrap();
        assert!(json.contains("actor_name"));
        assert!(json.contains("entity_type"));
    }

    #[test]
    fn test_focus_task_serializes() {
        let task = FocusTask {
            id: Uuid::new_v4(),
            title: "Fix bug".to_string(),
            priority: TaskPriority::High,
            due_date: Some(Utc::now()),
            project_id: Uuid::new_v4(),
            project_name: "Backend".to_string(),
            project_color: Some("#3b82f6".to_string()),
            status_name: "In Progress".to_string(),
            status_color: "#eab308".to_string(),
            days_overdue: Some(2),
            assignees: vec![FocusTaskAssignee {
                id: Uuid::new_v4(),
                name: "Alice".to_string(),
                avatar_url: None,
            }],
        };
        let json = serde_json::to_string(&task).unwrap();
        assert!(json.contains("project_name"));
        assert!(json.contains("status_color"));
        assert!(json.contains("days_overdue"));
        assert!(json.contains("assignees"));
    }

    #[test]
    fn test_project_pulse_serializes() {
        let pulse = ProjectPulse {
            project_id: Uuid::new_v4(),
            project_name: "Frontend".to_string(),
            project_color: Some("#10b981".to_string()),
            active_tasks: 12,
            overdue_tasks: 2,
            completed_this_week: 5,
            health: ProjectHealth::Amber,
            sparkline: vec![0, 1, 0, 2, 1, 0, 0, 3, 1, 0, 2, 1, 0, 1],
        };
        let json = serde_json::to_string(&pulse).unwrap();
        assert!(json.contains("\"health\":\"amber\""));
        assert!(json.contains("sparkline"));
    }

    #[test]
    fn test_compute_health_green_no_overdue() {
        assert_eq!(compute_health(10, 0), ProjectHealth::Green);
    }

    #[test]
    fn test_compute_health_green_low_ratio() {
        assert_eq!(compute_health(100, 5), ProjectHealth::Green);
    }

    #[test]
    fn test_compute_health_amber() {
        assert_eq!(compute_health(10, 2), ProjectHealth::Amber);
    }

    #[test]
    fn test_compute_health_red_high_ratio() {
        assert_eq!(compute_health(10, 5), ProjectHealth::Red);
    }

    #[test]
    fn test_compute_health_red_overdue_over_five() {
        assert_eq!(compute_health(100, 6), ProjectHealth::Red);
    }

    #[test]
    fn test_compute_health_green_no_active() {
        assert_eq!(compute_health(0, 0), ProjectHealth::Green);
    }

    #[test]
    fn test_user_streak_serializes() {
        let streak = UserStreak {
            current_streak: 5,
            longest_streak: 12,
            completed_today: 3,
        };
        let json = serde_json::to_string(&streak).unwrap();
        assert!(json.contains("current_streak"));
        assert!(json.contains("longest_streak"));
        assert!(json.contains("completed_today"));
    }
}
