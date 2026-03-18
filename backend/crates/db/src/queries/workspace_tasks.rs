//! Cross-project workspace tasks queries
//!
//! Provides queries for fetching tasks across all projects in a workspace
//! with RBAC filtering via project_members.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::TaskPriority;

/// A task item returned in the cross-project list
#[derive(Debug, Serialize, Clone, sqlx::FromRow)]
pub struct WorkspaceTaskItem {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub priority: TaskPriority,
    pub due_date: Option<DateTime<Utc>>,
    pub project_id: Uuid,
    pub project_name: String,
    pub status_id: Option<Uuid>,
    pub status_name: Option<String>,
    pub status_type: Option<String>,
    pub position: String,
    pub child_count: i32,
    pub completed_child_count: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Paginated cross-project task response
#[derive(Debug, Serialize)]
pub struct PaginatedWorkspaceTasks {
    pub items: Vec<WorkspaceTaskItem>,
    pub next_cursor: Option<String>,
}

/// Filter options for cross-project tasks
#[derive(Debug, Deserialize, Default)]
pub struct WorkspaceTaskFilters {
    pub status: Option<String>,
    pub priority: Option<TaskPriority>,
    pub assignee: Option<Uuid>,
    pub due_before: Option<DateTime<Utc>>,
    pub due_after: Option<DateTime<Utc>>,
    pub cursor: Option<Uuid>,
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    20
}

/// List tasks across all projects in a workspace that the user has access to.
/// Filters by project_members for RBAC and only returns top-level tasks.
pub async fn list_workspace_tasks(
    pool: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
    filters: &WorkspaceTaskFilters,
) -> Result<PaginatedWorkspaceTasks, sqlx::Error> {
    let limit = filters.limit.clamp(1, 100);
    let fetch_limit = limit + 1;

    // Convert priority filter to the postgres enum text representation
    let priority_str: Option<String> = filters.priority.as_ref().map(|p| match p {
        TaskPriority::Urgent => "urgent".to_string(),
        TaskPriority::High => "high".to_string(),
        TaskPriority::Medium => "medium".to_string(),
        TaskPriority::Low => "low".to_string(),
    });

    let rows = sqlx::query_as::<_, WorkspaceTaskItem>(
        r#"
        SELECT
            t.id,
            t.title,
            t.description,
            t.priority,
            t.due_date,
            t.project_id,
            p.name AS project_name,
            t.status_id,
            ps.name AS status_name,
            ps.type AS status_type,
            t.position,
            t.child_count,
            t.completed_child_count,
            t.created_at,
            t.updated_at
        FROM tasks t
        INNER JOIN projects p ON p.id = t.project_id AND p.deleted_at IS NULL
        INNER JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = $1
        LEFT JOIN project_statuses ps ON ps.id = t.status_id
        WHERE p.workspace_id = $2
          AND t.deleted_at IS NULL
          AND t.parent_task_id IS NULL
          AND ($3::text IS NULL OR ps.name = $3)
          AND ($4::text IS NULL OR t.priority = $4::task_priority)
          AND ($5::uuid IS NULL OR EXISTS (
            SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $5
          ))
          AND ($6::timestamptz IS NULL OR t.due_date <= $6)
          AND ($7::timestamptz IS NULL OR t.due_date >= $7)
          AND ($8::uuid IS NULL OR t.id > $8)
        ORDER BY t.updated_at DESC, t.id ASC
        LIMIT $9
        "#,
    )
    .bind(user_id)
    .bind(workspace_id)
    .bind(&filters.status)
    .bind(&priority_str)
    .bind(filters.assignee)
    .bind(filters.due_before)
    .bind(filters.due_after)
    .bind(filters.cursor)
    .bind(fetch_limit)
    .fetch_all(pool)
    .await?;

    let has_more = rows.len() > limit as usize;
    let items: Vec<WorkspaceTaskItem> = rows.into_iter().take(limit as usize).collect();
    let next_cursor = if has_more {
        items.last().map(|item| item.id.to_string())
    } else {
        None
    };

    Ok(PaginatedWorkspaceTasks { items, next_cursor })
}
