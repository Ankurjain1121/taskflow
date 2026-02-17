//! Dashboard database queries
//!
//! Provides queries for dashboard statistics and recent activity
//! across all workspaces for a given user, with optional workspace filtering.

use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{ActivityAction, TaskPriority};

/// Dashboard statistics for the authenticated user
#[derive(Debug, Serialize, Clone)]
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
}

/// Internal row type for the completed count query
#[derive(Debug, sqlx::FromRow)]
struct CountRow {
    pub count: i64,
}

/// A recent activity entry with actor information for the dashboard feed
#[derive(Debug, Serialize, Clone, sqlx::FromRow)]
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

    let stats = sqlx::query_as::<_, StatsRow>(
        r#"
        SELECT
            COUNT(DISTINCT t.id)::bigint as total_tasks,
            COUNT(DISTINCT t.id) FILTER (
                WHERE t.due_date IS NOT NULL
                AND t.due_date < $2
                AND (bc.status_mapping IS NULL OR NOT (bc.status_mapping->>'done')::boolean)
            )::bigint as overdue,
            COUNT(DISTINCT t.id) FILTER (
                WHERE t.due_date IS NOT NULL
                AND t.due_date::date = CURRENT_DATE
            )::bigint as due_today
        FROM tasks t
        INNER JOIN task_assignees ta ON ta.task_id = t.id
        INNER JOIN boards b ON b.id = t.board_id AND b.deleted_at IS NULL
        INNER JOIN board_columns bc ON bc.id = t.column_id
        INNER JOIN board_members bm ON bm.board_id = t.board_id AND bm.user_id = $1
        WHERE ta.user_id = $1
          AND t.deleted_at IS NULL
          AND ($3::uuid IS NULL OR b.workspace_id = $3)
        "#,
    )
    .bind(user_id)
    .bind(now)
    .bind(workspace_id)
    .fetch_one(pool)
    .await?;

    let completed = sqlx::query_as::<_, CountRow>(
        r#"
        SELECT COUNT(DISTINCT al.entity_id)::bigint as count
        FROM activity_log al
        INNER JOIN tasks t ON t.id = al.entity_id AND t.deleted_at IS NULL
        INNER JOIN task_assignees ta ON ta.task_id = t.id AND ta.user_id = $1
        INNER JOIN boards b ON b.id = t.board_id AND b.deleted_at IS NULL
        INNER JOIN board_columns bc ON bc.id = t.column_id
        WHERE al.action = 'moved'
          AND al.entity_type = 'task'
          AND al.created_at >= $2
          AND bc.status_mapping IS NOT NULL
          AND (bc.status_mapping->>'done')::boolean = true
          AND ($3::uuid IS NULL OR b.workspace_id = $3)
        "#,
    )
    .bind(user_id)
    .bind(seven_days_ago)
    .bind(workspace_id)
    .fetch_one(pool)
    .await?;

    Ok(DashboardStats {
        total_tasks: stats.total_tasks,
        overdue: stats.overdue,
        completed_this_week: completed.count,
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
        r#"
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
        LEFT JOIN boards b ON b.id = t.board_id
        WHERE al.tenant_id = $1
          AND ($3::uuid IS NULL OR b.workspace_id = $3)
        ORDER BY al.created_at DESC
        LIMIT $2
        "#,
    )
    .bind(tenant_id)
    .bind(limit)
    .bind(workspace_id)
    .fetch_all(pool)
    .await?;

    Ok(entries)
}

/// Tasks grouped by status (column name)
#[derive(Debug, Serialize, Clone, sqlx::FromRow)]
pub struct TasksByStatus {
    pub status: String,
    pub count: i64,
    pub color: Option<String>,
}

/// Get tasks grouped by status for dashboard chart
pub async fn get_tasks_by_status(
    pool: &PgPool,
    user_id: Uuid,
    workspace_id: Option<Uuid>,
) -> Result<Vec<TasksByStatus>, sqlx::Error> {
    let rows = sqlx::query_as::<_, TasksByStatus>(
        r#"
        SELECT
            bc.name as status,
            COUNT(DISTINCT t.id)::bigint as count,
            bc.color
        FROM tasks t
        INNER JOIN task_assignees ta ON ta.task_id = t.id
        INNER JOIN boards b ON b.id = t.board_id AND b.deleted_at IS NULL
        INNER JOIN board_columns bc ON bc.id = t.column_id
        INNER JOIN board_members bm ON bm.board_id = t.board_id AND bm.user_id = $1
        WHERE ta.user_id = $1
          AND t.deleted_at IS NULL
          AND ($2::uuid IS NULL OR b.workspace_id = $2)
        GROUP BY bc.name, bc.color
        ORDER BY count DESC
        "#,
    )
    .bind(user_id)
    .bind(workspace_id)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

/// Tasks grouped by priority
#[derive(Debug, Serialize, Clone, sqlx::FromRow)]
pub struct TasksByPriority {
    pub priority: TaskPriority,
    pub count: i64,
}

/// Get tasks grouped by priority for dashboard chart
pub async fn get_tasks_by_priority(
    pool: &PgPool,
    user_id: Uuid,
    workspace_id: Option<Uuid>,
) -> Result<Vec<TasksByPriority>, sqlx::Error> {
    let rows = sqlx::query_as::<_, TasksByPriority>(
        r#"
        SELECT
            t.priority as "priority: TaskPriority",
            COUNT(DISTINCT t.id)::bigint as count
        FROM tasks t
        INNER JOIN task_assignees ta ON ta.task_id = t.id
        INNER JOIN boards b ON b.id = t.board_id AND b.deleted_at IS NULL
        INNER JOIN board_members bm ON bm.board_id = t.board_id AND bm.user_id = $1
        WHERE ta.user_id = $1
          AND t.deleted_at IS NULL
          AND ($2::uuid IS NULL OR b.workspace_id = $2)
        GROUP BY t.priority
        ORDER BY
            CASE t.priority
                WHEN 'urgent' THEN 1
                WHEN 'high' THEN 2
                WHEN 'medium' THEN 3
                WHEN 'low' THEN 4
            END
        "#,
    )
    .bind(user_id)
    .bind(workspace_id)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

/// Overdue task details for dashboard table
#[derive(Debug, Serialize, Clone, sqlx::FromRow)]
pub struct OverdueTask {
    pub id: Uuid,
    pub title: String,
    pub due_date: DateTime<Utc>,
    pub priority: TaskPriority,
    pub board_id: Uuid,
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
        r#"
        SELECT
            t.id,
            t.title,
            t.due_date,
            t.priority,
            t.board_id,
            b.name as board_name,
            EXTRACT(DAY FROM (NOW() - t.due_date))::integer as days_overdue
        FROM tasks t
        INNER JOIN task_assignees ta ON ta.task_id = t.id
        INNER JOIN boards b ON b.id = t.board_id AND b.deleted_at IS NULL
        INNER JOIN board_columns bc ON bc.id = t.column_id
        INNER JOIN board_members bm ON bm.board_id = t.board_id AND bm.user_id = $1
        WHERE ta.user_id = $1
          AND t.deleted_at IS NULL
          AND t.due_date IS NOT NULL
          AND t.due_date < $2
          AND (bc.status_mapping IS NULL OR NOT (bc.status_mapping->>'done')::boolean)
          AND ($4::uuid IS NULL OR b.workspace_id = $4)
        ORDER BY t.due_date ASC
        LIMIT $3
        "#,
    )
    .bind(user_id)
    .bind(now)
    .bind(limit)
    .bind(workspace_id)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

/// Completion trend data point
#[derive(Debug, Serialize, Clone, sqlx::FromRow)]
pub struct CompletionTrendPoint {
    pub date: String,
    pub completed: i64,
}

/// Get completion trend over the last N days
pub async fn get_completion_trend(
    pool: &PgPool,
    user_id: Uuid,
    days: i64,
    workspace_id: Option<Uuid>,
) -> Result<Vec<CompletionTrendPoint>, sqlx::Error> {
    let days = days.clamp(7, 90);
    let start_date = Utc::now() - chrono::Duration::days(days);

    let rows = sqlx::query_as::<_, CompletionTrendPoint>(
        r#"
        SELECT
            DATE(al.created_at)::text as date,
            COUNT(DISTINCT al.entity_id)::bigint as completed
        FROM activity_log al
        INNER JOIN tasks t ON t.id = al.entity_id AND t.deleted_at IS NULL
        INNER JOIN task_assignees ta ON ta.task_id = t.id AND ta.user_id = $1
        INNER JOIN boards b ON b.id = t.board_id AND b.deleted_at IS NULL
        INNER JOIN board_columns bc ON bc.id = t.column_id
        WHERE al.action = 'moved'
          AND al.entity_type = 'task'
          AND al.created_at >= $2
          AND bc.status_mapping IS NOT NULL
          AND (bc.status_mapping->>'done')::boolean = true
          AND ($3::uuid IS NULL OR b.workspace_id = $3)
        GROUP BY DATE(al.created_at)
        ORDER BY date ASC
        "#,
    )
    .bind(user_id)
    .bind(start_date)
    .bind(workspace_id)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

/// Upcoming deadline task
#[derive(Debug, Serialize, Clone, sqlx::FromRow)]
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
        r#"
        SELECT
            t.id,
            t.title,
            t.due_date,
            t.priority,
            b.name as board_name,
            EXTRACT(DAY FROM (t.due_date - NOW()))::integer as days_until_due
        FROM tasks t
        INNER JOIN task_assignees ta ON ta.task_id = t.id
        INNER JOIN boards b ON b.id = t.board_id AND b.deleted_at IS NULL
        INNER JOIN board_columns bc ON bc.id = t.column_id
        INNER JOIN board_members bm ON bm.board_id = t.board_id AND bm.user_id = $1
        WHERE ta.user_id = $1
          AND t.deleted_at IS NULL
          AND t.due_date IS NOT NULL
          AND t.due_date >= $2
          AND t.due_date <= $3
          AND (bc.status_mapping IS NULL OR NOT (bc.status_mapping->>'done')::boolean)
          AND ($4::uuid IS NULL OR b.workspace_id = $4)
        ORDER BY t.due_date ASC
        "#,
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
}
