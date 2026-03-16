use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::TaskPriority;

use super::tasks::{verify_board_membership, TaskQueryError};

/// Flat list of tasks for list view (with enriched data)
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TaskListItem {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub priority: TaskPriority,
    pub due_date: Option<DateTime<Utc>>,
    pub status_id: Uuid,
    pub status_name: String,
    pub status_color: Option<String>,
    pub status_type: Option<String>,
    pub column_name: String,
    pub task_list_id: Option<Uuid>,
    pub task_list_name: Option<String>,
    pub position: String,
    pub created_by_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Paginated response for task list items
#[derive(Debug, Serialize)]
pub struct PaginatedTaskList {
    pub items: Vec<TaskListItem>,
    pub next_cursor: Option<String>,
}

/// Paginated response for gantt tasks
#[derive(Debug, Serialize)]
pub struct PaginatedGanttTasks {
    pub items: Vec<GanttTask>,
    pub next_cursor: Option<String>,
}

/// List all tasks for a board as a flat list with column names (cursor-based pagination)
pub async fn list_tasks_flat(
    pool: &PgPool,
    board_id: Uuid,
    user_id: Uuid,
    cursor: Option<Uuid>,
    limit: i64,
) -> Result<PaginatedTaskList, TaskQueryError> {
    if !verify_board_membership(pool, board_id, user_id).await? {
        return Err(TaskQueryError::NotProjectMember);
    }

    let limit = limit.clamp(1, 200);
    let fetch_limit = limit + 1;

    let tasks = sqlx::query_as::<_, TaskListItem>(
        r#"
        SELECT t.id, t.title, t.description,
               t.priority,
               t.due_date, t.status_id,
               ps.name as status_name,
               ps.color as status_color,
               ps.type as status_type,
               ps.name as column_name,
               t.task_list_id,
               tl.name as task_list_name,
               t.position, t.created_by_id,
               t.created_at, t.updated_at
        FROM tasks t
        JOIN project_statuses ps ON ps.id = t.status_id
        LEFT JOIN task_lists tl ON tl.id = t.task_list_id
        WHERE t.project_id = $1 AND t.deleted_at IS NULL AND t.parent_task_id IS NULL
          AND ($2::uuid IS NULL OR t.id < $2)
        ORDER BY t.created_at DESC, t.id DESC
        LIMIT $3
        "#,
    )
    .bind(board_id)
    .bind(cursor)
    .bind(fetch_limit)
    .fetch_all(pool)
    .await?;

    let has_more = tasks.len() > limit as usize;
    let items: Vec<TaskListItem> = tasks.into_iter().take(limit as usize).collect();
    let next_cursor = if has_more {
        items.last().map(|item| item.id.to_string())
    } else {
        None
    };

    Ok(PaginatedTaskList { items, next_cursor })
}

/// Calendar task for date-based views
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CalendarTask {
    pub id: Uuid,
    pub title: String,
    pub priority: TaskPriority,
    pub due_date: DateTime<Utc>,
    pub start_date: Option<DateTime<Utc>>,
    pub status_id: Uuid,
    pub column_name: String,
    pub is_done: bool,
    pub milestone_id: Option<Uuid>,
}

/// List tasks for a board filtered by date range (for calendar view)
pub async fn list_tasks_for_calendar(
    pool: &PgPool,
    board_id: Uuid,
    user_id: Uuid,
    start: DateTime<Utc>,
    end: DateTime<Utc>,
) -> Result<Vec<CalendarTask>, TaskQueryError> {
    if !verify_board_membership(pool, board_id, user_id).await? {
        return Err(TaskQueryError::NotProjectMember);
    }

    let tasks = sqlx::query_as::<_, CalendarTask>(
        r#"
        SELECT
            t.id, t.title, t.priority,
            t.due_date as "due_date!",
            t.start_date,
            t.status_id,
            ps.name as column_name,
            (ps.type = 'done') as "is_done!",
            t.milestone_id
        FROM tasks t
        JOIN project_statuses ps ON ps.id = t.status_id
        WHERE t.project_id = $1
            AND t.deleted_at IS NULL
            AND t.parent_task_id IS NULL
            AND t.due_date IS NOT NULL
            AND t.due_date >= $2
            AND t.due_date <= $3
        ORDER BY t.due_date ASC
        "#,
    )
    .bind(board_id)
    .bind(start)
    .bind(end)
    .fetch_all(pool)
    .await?;

    Ok(tasks)
}

/// Gantt task for timeline views
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct GanttTask {
    pub id: Uuid,
    pub title: String,
    pub priority: TaskPriority,
    pub start_date: Option<DateTime<Utc>>,
    pub due_date: Option<DateTime<Utc>>,
    pub status_id: Uuid,
    pub column_name: String,
    pub is_done: bool,
    pub milestone_id: Option<Uuid>,
}

/// List tasks for a board that have dates (for Gantt chart, cursor-based pagination)
pub async fn list_tasks_for_gantt(
    pool: &PgPool,
    board_id: Uuid,
    user_id: Uuid,
    cursor: Option<Uuid>,
    limit: i64,
) -> Result<PaginatedGanttTasks, TaskQueryError> {
    if !verify_board_membership(pool, board_id, user_id).await? {
        return Err(TaskQueryError::NotProjectMember);
    }

    let limit = limit.clamp(1, 200);
    let fetch_limit = limit + 1;

    let tasks = sqlx::query_as::<_, GanttTask>(
        r#"
        SELECT
            t.id, t.title, t.priority,
            t.start_date,
            t.due_date,
            t.status_id,
            ps.name as column_name,
            (ps.type = 'done') as "is_done!",
            t.milestone_id
        FROM tasks t
        JOIN project_statuses ps ON ps.id = t.status_id
        WHERE t.project_id = $1
            AND t.deleted_at IS NULL
            AND t.parent_task_id IS NULL
            AND (t.start_date IS NOT NULL OR t.due_date IS NOT NULL)
            AND ($2::uuid IS NULL OR t.id > $2)
        ORDER BY COALESCE(t.start_date, t.due_date) ASC, t.id ASC
        LIMIT $3
        "#,
    )
    .bind(board_id)
    .bind(cursor)
    .bind(fetch_limit)
    .fetch_all(pool)
    .await?;

    let has_more = tasks.len() > limit as usize;
    let items: Vec<GanttTask> = tasks.into_iter().take(limit as usize).collect();
    let next_cursor = if has_more {
        items.last().map(|item| item.id.to_string())
    } else {
        None
    };

    Ok(PaginatedGanttTasks { items, next_cursor })
}
