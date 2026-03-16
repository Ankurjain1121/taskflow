//! My Tasks database queries
//!
//! Provides queries for fetching tasks assigned to the current user across all projects.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::TaskPriority;

/// Task item for my tasks list with project context
#[derive(Debug, Serialize, Clone)]
pub struct MyTaskItem {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub priority: TaskPriority,
    pub due_date: Option<DateTime<Utc>>,
    pub board_id: Uuid,
    pub board_name: String,
    pub workspace_id: Uuid,
    pub status_id: Option<Uuid>,
    pub status_name: Option<String>,
    pub position: String,
    pub is_done: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Paginated response for my tasks
#[derive(Debug, Serialize)]
pub struct PaginatedMyTasks {
    pub items: Vec<MyTaskItem>,
    pub next_cursor: Option<String>,
}

/// Summary statistics for my tasks
#[derive(Debug, Serialize)]
pub struct MyTasksSummary {
    pub total_assigned: i64,
    pub due_soon: i64,
    pub overdue: i64,
    pub completed_this_week: i64,
}

/// Sort field options for my tasks
#[derive(Debug, Deserialize, Clone, Copy, Default)]
#[serde(rename_all = "snake_case")]
pub enum MyTasksSortBy {
    #[default]
    DueDate,
    Priority,
    CreatedAt,
    UpdatedAt,
}

/// Sort order options
#[derive(Debug, Deserialize, Clone, Copy, Default)]
#[serde(rename_all = "snake_case")]
pub enum SortOrder {
    #[default]
    Asc,
    Desc,
}

/// Internal row type for my tasks query
#[derive(sqlx::FromRow)]
struct MyTaskRow {
    id: Uuid,
    title: String,
    description: Option<String>,
    priority: TaskPriority,
    due_date: Option<DateTime<Utc>>,
    project_id: Uuid,
    project_name: String,
    workspace_id: Uuid,
    status_id: Option<Uuid>,
    status_name: Option<String>,
    status_type: Option<String>,
    position: String,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

/// List tasks assigned to a user across all projects they're a member of
pub async fn list_my_tasks(
    pool: &PgPool,
    user_id: Uuid,
    sort_by: MyTasksSortBy,
    sort_order: SortOrder,
    board_filter: Option<Uuid>,
    cursor: Option<Uuid>,
    limit: i64,
) -> Result<PaginatedMyTasks, sqlx::Error> {
    let limit = limit.clamp(1, 50);
    let fetch_limit = limit + 1;

    let order_clause = match (sort_by, sort_order) {
        (MyTasksSortBy::DueDate, SortOrder::Asc) => "t.due_date ASC NULLS LAST, t.id ASC",
        (MyTasksSortBy::DueDate, SortOrder::Desc) => "t.due_date DESC NULLS LAST, t.id DESC",
        (MyTasksSortBy::Priority, SortOrder::Asc) => "t.priority ASC, t.id ASC",
        (MyTasksSortBy::Priority, SortOrder::Desc) => "t.priority DESC, t.id DESC",
        (MyTasksSortBy::CreatedAt, SortOrder::Asc) => "t.created_at ASC, t.id ASC",
        (MyTasksSortBy::CreatedAt, SortOrder::Desc) => "t.created_at DESC, t.id DESC",
        (MyTasksSortBy::UpdatedAt, SortOrder::Asc) => "t.updated_at ASC, t.id ASC",
        (MyTasksSortBy::UpdatedAt, SortOrder::Desc) => "t.updated_at DESC, t.id DESC",
    };

    // Fixed parameter positions: $1=user_id, $2=board_filter, $3=cursor, $4=limit
    let query_str = format!(
        r#"
        SELECT
            t.id,
            t.title,
            t.description,
            t.priority,
            t.due_date,
            t.project_id,
            p.name as project_name,
            p.workspace_id,
            t.status_id,
            ps.name as status_name,
            ps.type as status_type,
            t.position,
            t.created_at,
            t.updated_at
        FROM tasks t
        INNER JOIN task_assignees ta ON ta.task_id = t.id
        INNER JOIN projects p ON p.id = t.project_id AND p.deleted_at IS NULL
        INNER JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = $1
        LEFT JOIN project_statuses ps ON ps.id = t.status_id
        WHERE ta.user_id = $1
          AND t.deleted_at IS NULL
          AND t.parent_task_id IS NULL
          AND ($2::uuid IS NULL OR t.project_id = $2)
          AND ($3::uuid IS NULL OR t.id > $3)
        ORDER BY {}
        LIMIT $4
        "#,
        order_clause
    );

    let query = sqlx::query_as::<_, MyTaskRow>(&query_str)
        .bind(user_id)
        .bind(board_filter)
        .bind(cursor)
        .bind(fetch_limit);

    let rows = query.fetch_all(pool).await?;

    let raw_count = rows.len();

    let items: Vec<MyTaskItem> = rows
        .into_iter()
        .take(limit as usize)
        .map(|row| {
            let is_done = row
                .status_type
                .as_deref()
                .map(|t| t == "done")
                .unwrap_or(false);

            MyTaskItem {
                id: row.id,
                title: row.title,
                description: row.description,
                priority: row.priority,
                due_date: row.due_date,
                board_id: row.project_id,
                board_name: row.project_name,
                workspace_id: row.workspace_id,
                status_id: row.status_id,
                status_name: row.status_name,
                position: row.position,
                is_done,
                created_at: row.created_at,
                updated_at: row.updated_at,
            }
        })
        .collect();

    let has_more = raw_count > limit as usize;
    let next_cursor = if has_more {
        items.last().map(|item| item.id.to_string())
    } else {
        None
    };

    Ok(PaginatedMyTasks { items, next_cursor })
}

/// Get summary statistics for tasks assigned to a user
pub async fn my_tasks_summary(pool: &PgPool, user_id: Uuid) -> Result<MyTasksSummary, sqlx::Error> {
    let now = chrono::Utc::now();
    let three_days_from_now = now + chrono::Duration::days(3);
    let seven_days_ago = now - chrono::Duration::days(7);

    // Use runtime query_as instead of compile-time query! macro
    #[derive(sqlx::FromRow)]
    struct StatsRow {
        total_assigned: i64,
        due_soon: i64,
        overdue: i64,
    }

    let stats = sqlx::query_as::<_, StatsRow>(
        r#"
        SELECT
            COUNT(DISTINCT t.id)::bigint as total_assigned,
            COUNT(DISTINCT t.id) FILTER (
                WHERE t.due_date IS NOT NULL
                AND t.due_date <= $2
                AND t.due_date > $3
                AND (ps.type IS NULL OR ps.type != 'done')
            )::bigint as due_soon,
            COUNT(DISTINCT t.id) FILTER (
                WHERE t.due_date IS NOT NULL
                AND t.due_date < $3
                AND (ps.type IS NULL OR ps.type != 'done')
            )::bigint as overdue
        FROM tasks t
        INNER JOIN task_assignees ta ON ta.task_id = t.id
        INNER JOIN projects p ON p.id = t.project_id AND p.deleted_at IS NULL
        INNER JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = $1
        LEFT JOIN project_statuses ps ON ps.id = t.status_id
        WHERE ta.user_id = $1
          AND t.deleted_at IS NULL
          AND t.parent_task_id IS NULL
        "#,
    )
    .bind(user_id)
    .bind(three_days_from_now)
    .bind(now)
    .fetch_one(pool)
    .await?;

    // Get completed this week - tasks that were moved to a 'done' status recently
    let completed_this_week = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(DISTINCT al.entity_id)::bigint
        FROM activity_log al
        INNER JOIN tasks t ON t.id = al.entity_id AND t.deleted_at IS NULL
        INNER JOIN task_assignees ta ON ta.task_id = t.id AND ta.user_id = $1
        LEFT JOIN project_statuses ps ON ps.id = t.status_id
        WHERE al.action = 'moved'
          AND al.entity_type = 'task'
          AND al.created_at >= $2
          AND ps.type = 'done'
        "#,
    )
    .bind(user_id)
    .bind(seven_days_ago)
    .fetch_one(pool)
    .await?;

    Ok(MyTasksSummary {
        total_assigned: stats.total_assigned,
        due_soon: stats.due_soon,
        overdue: stats.overdue,
        completed_this_week,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_my_tasks_summary_serializes() {
        let summary = MyTasksSummary {
            total_assigned: 10,
            due_soon: 3,
            overdue: 1,
            completed_this_week: 5,
        };
        let json = serde_json::to_string(&summary).unwrap();
        assert!(json.contains("total_assigned"));
        assert!(json.contains("completed_this_week"));
    }

    #[test]
    fn test_sort_by_deserialize() {
        let json = r#""due_date""#;
        let sort: MyTasksSortBy = serde_json::from_str(json).unwrap();
        assert!(matches!(sort, MyTasksSortBy::DueDate));
    }
}
