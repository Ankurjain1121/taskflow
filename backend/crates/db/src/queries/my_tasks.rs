//! My Tasks database queries
//!
//! Provides queries for fetching tasks assigned to the current user across all boards.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::TaskPriority;

/// Task item for my tasks list with board context
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
    pub column_id: Uuid,
    pub column_name: String,
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
struct MyTaskRow {
    id: Uuid,
    title: String,
    description: Option<String>,
    priority: TaskPriority,
    due_date: Option<DateTime<Utc>>,
    board_id: Uuid,
    board_name: String,
    workspace_id: Uuid,
    column_id: Uuid,
    column_name: String,
    position: String,
    status_mapping: Option<serde_json::Value>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

/// List tasks assigned to a user across all boards they're a member of
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `user_id` - The user's UUID
/// * `sort_by` - Field to sort by
/// * `sort_order` - Sort direction (asc/desc)
/// * `board_filter` - Optional board ID to filter by
/// * `cursor` - Optional cursor for pagination (task ID)
/// * `limit` - Number of items to return
pub async fn list_my_tasks(
    pool: &PgPool,
    user_id: Uuid,
    sort_by: MyTasksSortBy,
    sort_order: SortOrder,
    board_filter: Option<Uuid>,
    cursor: Option<Uuid>,
    limit: i64,
) -> Result<PaginatedMyTasks, sqlx::Error> {
    // Clamp limit
    let limit = limit.min(50).max(1);
    let fetch_limit = limit + 1;

    // Build ORDER BY clause based on sort options
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

    // Build query dynamically based on filters
    let query = format!(
        r#"
        SELECT
            t.id,
            t.title,
            t.description,
            t.priority as "priority: TaskPriority",
            t.due_date,
            t.board_id,
            b.name as board_name,
            b.workspace_id,
            t.column_id,
            bc.name as column_name,
            t.position,
            bc.status_mapping,
            t.created_at,
            t.updated_at
        FROM tasks t
        INNER JOIN task_assignees ta ON ta.task_id = t.id
        INNER JOIN boards b ON b.id = t.board_id AND b.deleted_at IS NULL
        INNER JOIN board_columns bc ON bc.id = t.column_id
        INNER JOIN board_members bm ON bm.board_id = t.board_id AND bm.user_id = $1
        WHERE ta.user_id = $1
          AND t.deleted_at IS NULL
          {}
          {}
        ORDER BY {}
        LIMIT $3
        "#,
        if board_filter.is_some() {
            "AND t.board_id = $4"
        } else {
            ""
        },
        if cursor.is_some() {
            "AND t.id > $5"
        } else {
            ""
        },
        order_clause
    );

    // Execute query based on which optional params are present
    let rows = match (board_filter, cursor) {
        (Some(board_id), Some(cursor_id)) => {
            sqlx::query_as!(
                MyTaskRow,
                r#"
                SELECT
                    t.id,
                    t.title,
                    t.description,
                    t.priority as "priority: TaskPriority",
                    t.due_date,
                    t.board_id,
                    b.name as board_name,
                    b.workspace_id,
                    t.column_id,
                    bc.name as column_name,
                    t.position,
                    bc.status_mapping,
                    t.created_at,
                    t.updated_at
                FROM tasks t
                INNER JOIN task_assignees ta ON ta.task_id = t.id
                INNER JOIN boards b ON b.id = t.board_id AND b.deleted_at IS NULL
                INNER JOIN board_columns bc ON bc.id = t.column_id
                INNER JOIN board_members bm ON bm.board_id = t.board_id AND bm.user_id = $1
                WHERE ta.user_id = $1
                  AND t.deleted_at IS NULL
                  AND t.board_id = $2
                  AND t.id > $3
                ORDER BY t.due_date ASC NULLS LAST, t.id ASC
                LIMIT $4
                "#,
                user_id,
                board_id,
                cursor_id,
                fetch_limit
            )
            .fetch_all(pool)
            .await?
        }
        (Some(board_id), None) => {
            sqlx::query_as!(
                MyTaskRow,
                r#"
                SELECT
                    t.id,
                    t.title,
                    t.description,
                    t.priority as "priority: TaskPriority",
                    t.due_date,
                    t.board_id,
                    b.name as board_name,
                    b.workspace_id,
                    t.column_id,
                    bc.name as column_name,
                    t.position,
                    bc.status_mapping,
                    t.created_at,
                    t.updated_at
                FROM tasks t
                INNER JOIN task_assignees ta ON ta.task_id = t.id
                INNER JOIN boards b ON b.id = t.board_id AND b.deleted_at IS NULL
                INNER JOIN board_columns bc ON bc.id = t.column_id
                INNER JOIN board_members bm ON bm.board_id = t.board_id AND bm.user_id = $1
                WHERE ta.user_id = $1
                  AND t.deleted_at IS NULL
                  AND t.board_id = $2
                ORDER BY t.due_date ASC NULLS LAST, t.id ASC
                LIMIT $3
                "#,
                user_id,
                board_id,
                fetch_limit
            )
            .fetch_all(pool)
            .await?
        }
        (None, Some(cursor_id)) => {
            sqlx::query_as!(
                MyTaskRow,
                r#"
                SELECT
                    t.id,
                    t.title,
                    t.description,
                    t.priority as "priority: TaskPriority",
                    t.due_date,
                    t.board_id,
                    b.name as board_name,
                    b.workspace_id,
                    t.column_id,
                    bc.name as column_name,
                    t.position,
                    bc.status_mapping,
                    t.created_at,
                    t.updated_at
                FROM tasks t
                INNER JOIN task_assignees ta ON ta.task_id = t.id
                INNER JOIN boards b ON b.id = t.board_id AND b.deleted_at IS NULL
                INNER JOIN board_columns bc ON bc.id = t.column_id
                INNER JOIN board_members bm ON bm.board_id = t.board_id AND bm.user_id = $1
                WHERE ta.user_id = $1
                  AND t.deleted_at IS NULL
                  AND t.id > $2
                ORDER BY t.due_date ASC NULLS LAST, t.id ASC
                LIMIT $3
                "#,
                user_id,
                cursor_id,
                fetch_limit
            )
            .fetch_all(pool)
            .await?
        }
        (None, None) => {
            sqlx::query_as!(
                MyTaskRow,
                r#"
                SELECT
                    t.id,
                    t.title,
                    t.description,
                    t.priority as "priority: TaskPriority",
                    t.due_date,
                    t.board_id,
                    b.name as board_name,
                    b.workspace_id,
                    t.column_id,
                    bc.name as column_name,
                    t.position,
                    bc.status_mapping,
                    t.created_at,
                    t.updated_at
                FROM tasks t
                INNER JOIN task_assignees ta ON ta.task_id = t.id
                INNER JOIN boards b ON b.id = t.board_id AND b.deleted_at IS NULL
                INNER JOIN board_columns bc ON bc.id = t.column_id
                INNER JOIN board_members bm ON bm.board_id = t.board_id AND bm.user_id = $1
                WHERE ta.user_id = $1
                  AND t.deleted_at IS NULL
                ORDER BY t.due_date ASC NULLS LAST, t.id ASC
                LIMIT $2
                "#,
                user_id,
                fetch_limit
            )
            .fetch_all(pool)
            .await?
        }
    };

    // Convert rows to items and determine done status
    let items: Vec<MyTaskItem> = rows
        .into_iter()
        .take(limit as usize)
        .map(|row| {
            let is_done = row
                .status_mapping
                .as_ref()
                .and_then(|sm: &serde_json::Value| sm.get("done"))
                .and_then(|v: &serde_json::Value| v.as_bool())
                .unwrap_or(false);

            MyTaskItem {
                id: row.id,
                title: row.title,
                description: row.description,
                priority: row.priority,
                due_date: row.due_date,
                board_id: row.board_id,
                board_name: row.board_name,
                workspace_id: row.workspace_id,
                column_id: row.column_id,
                column_name: row.column_name,
                position: row.position,
                is_done,
                created_at: row.created_at,
                updated_at: row.updated_at,
            }
        })
        .collect();

    let has_more = items.len() == limit as usize;
    let next_cursor = if has_more {
        items.last().map(|item| item.id.to_string())
    } else {
        None
    };

    Ok(PaginatedMyTasks { items, next_cursor })
}

/// Get summary statistics for tasks assigned to a user
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `user_id` - The user's UUID
pub async fn my_tasks_summary(pool: &PgPool, user_id: Uuid) -> Result<MyTasksSummary, sqlx::Error> {
    let now = chrono::Utc::now();
    let three_days_from_now = now + chrono::Duration::days(3);
    let seven_days_ago = now - chrono::Duration::days(7);

    // Get total assigned, due soon, and overdue counts
    let stats = sqlx::query!(
        r#"
        SELECT
            COUNT(DISTINCT t.id) as "total_assigned!",
            COUNT(DISTINCT t.id) FILTER (
                WHERE t.due_date IS NOT NULL
                AND t.due_date <= $2
                AND t.due_date > $3
                AND (bc.status_mapping IS NULL OR NOT (bc.status_mapping->>'done')::boolean)
            ) as "due_soon!",
            COUNT(DISTINCT t.id) FILTER (
                WHERE t.due_date IS NOT NULL
                AND t.due_date < $3
                AND (bc.status_mapping IS NULL OR NOT (bc.status_mapping->>'done')::boolean)
            ) as "overdue!"
        FROM tasks t
        INNER JOIN task_assignees ta ON ta.task_id = t.id
        INNER JOIN boards b ON b.id = t.board_id AND b.deleted_at IS NULL
        INNER JOIN board_columns bc ON bc.id = t.column_id
        INNER JOIN board_members bm ON bm.board_id = t.board_id AND bm.user_id = $1
        WHERE ta.user_id = $1
          AND t.deleted_at IS NULL
        "#,
        user_id,
        three_days_from_now,
        now
    )
    .fetch_one(pool)
    .await?;

    // Get completed this week from activity_log
    // Looking for 'moved' actions where the destination column has done=true
    let completed_this_week = sqlx::query_scalar!(
        r#"
        SELECT COUNT(DISTINCT al.entity_id) as "count!"
        FROM activity_log al
        INNER JOIN tasks t ON t.id = al.entity_id AND t.deleted_at IS NULL
        INNER JOIN task_assignees ta ON ta.task_id = t.id AND ta.user_id = $1
        INNER JOIN board_columns bc ON bc.id = t.column_id
        WHERE al.action = 'moved'
          AND al.entity_type = 'task'
          AND al.created_at >= $2
          AND bc.status_mapping IS NOT NULL
          AND (bc.status_mapping->>'done')::boolean = true
        "#,
        user_id,
        seven_days_ago
    )
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
