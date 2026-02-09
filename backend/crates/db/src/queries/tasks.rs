use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::collections::HashMap;
use uuid::Uuid;

use crate::models::{Label, Task, TaskAssignee, TaskPriority};
use crate::utils::generate_key_between;

/// Error type for task query operations
#[derive(Debug, thiserror::Error)]
pub enum TaskQueryError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("User is not a member of this board")]
    NotBoardMember,
    #[error("Task not found")]
    NotFound,
}

/// Input for creating a new task
#[derive(Debug, Deserialize)]
pub struct CreateTaskInput {
    pub title: String,
    pub description: Option<String>,
    pub priority: TaskPriority,
    pub due_date: Option<DateTime<Utc>>,
    pub start_date: Option<DateTime<Utc>>,
    pub estimated_hours: Option<f64>,
    pub column_id: Uuid,
    pub milestone_id: Option<Uuid>,
    pub assignee_ids: Option<Vec<Uuid>>,
    pub label_ids: Option<Vec<Uuid>>,
}

/// Input for updating an existing task
#[derive(Debug, Deserialize)]
pub struct UpdateTaskInput {
    pub title: Option<String>,
    pub description: Option<String>,
    pub priority: Option<TaskPriority>,
    pub due_date: Option<DateTime<Utc>>,
    pub start_date: Option<DateTime<Utc>>,
    pub estimated_hours: Option<f64>,
    pub milestone_id: Option<Uuid>,
}

/// Task with all associated details
#[derive(Debug, Serialize)]
pub struct TaskWithDetails {
    #[serde(flatten)]
    pub task: Task,
    pub assignees: Vec<AssigneeInfo>,
    pub labels: Vec<Label>,
    pub comment_count: i64,
    pub attachment_count: i64,
}

/// Basic assignee information
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AssigneeInfo {
    pub user_id: Uuid,
    pub name: String,
    pub avatar_url: Option<String>,
    pub assigned_at: DateTime<Utc>,
}

/// Verify user is a member of the board
async fn verify_board_membership(
    pool: &PgPool,
    board_id: Uuid,
    user_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM board_members
            WHERE board_id = $1 AND user_id = $2
        )
        "#,
    )
    .bind(board_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    Ok(result)
}

/// List all tasks for a board, grouped by column_id
/// Returns HashMap<column_id, Vec<Task>>
pub async fn list_tasks_by_board(
    pool: &PgPool,
    board_id: Uuid,
    user_id: Uuid,
) -> Result<HashMap<Uuid, Vec<Task>>, TaskQueryError> {
    // First verify user is a board member
    if !verify_board_membership(pool, board_id, user_id).await? {
        return Err(TaskQueryError::NotBoardMember);
    }

    // Fetch all tasks for the board
    let tasks = sqlx::query_as::<_, Task>(
        r#"
        SELECT
            id,
            title,
            description,
            priority,
            due_date,
            start_date,
            estimated_hours,
            board_id,
            column_id,
            position,
            milestone_id,
            tenant_id,
            created_by_id,
            deleted_at,
            created_at,
            updated_at
        FROM tasks
        WHERE board_id = $1 AND deleted_at IS NULL
        ORDER BY position ASC
        "#,
    )
    .bind(board_id)
    .fetch_all(pool)
    .await?;

    // Group tasks by column_id
    let mut grouped: HashMap<Uuid, Vec<Task>> = HashMap::new();
    for task in tasks {
        grouped.entry(task.column_id).or_default().push(task);
    }

    Ok(grouped)
}

/// Get a task by ID with all details (assignees, labels, counts)
pub async fn get_task_by_id(
    pool: &PgPool,
    task_id: Uuid,
    user_id: Uuid,
) -> Result<Option<TaskWithDetails>, TaskQueryError> {
    // Fetch the task first
    let task = sqlx::query_as::<_, Task>(
        r#"
        SELECT
            id,
            title,
            description,
            priority,
            due_date,
            start_date,
            estimated_hours,
            board_id,
            column_id,
            position,
            milestone_id,
            tenant_id,
            created_by_id,
            deleted_at,
            created_at,
            updated_at
        FROM tasks
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(task_id)
    .fetch_optional(pool)
    .await?;

    let task = match task {
        Some(t) => t,
        None => return Ok(None),
    };

    // Verify user is a board member
    if !verify_board_membership(pool, task.board_id, user_id).await? {
        return Err(TaskQueryError::NotBoardMember);
    }

    // Fetch assignees with user info
    let assignees = sqlx::query_as::<_, AssigneeInfo>(
        r#"
        SELECT
            ta.user_id,
            u.name,
            u.avatar_url,
            ta.assigned_at
        FROM task_assignees ta
        JOIN users u ON u.id = ta.user_id
        WHERE ta.task_id = $1
        "#,
    )
    .bind(task_id)
    .fetch_all(pool)
    .await?;

    // Fetch labels
    let labels = sqlx::query_as::<_, Label>(
        r#"
        SELECT l.id, l.name, l.color, l.board_id
        FROM labels l
        JOIN task_labels tl ON tl.label_id = l.id
        WHERE tl.task_id = $1
        "#,
    )
    .bind(task_id)
    .fetch_all(pool)
    .await?;

    // Get comment count
    let comment_count: i64 = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)
        FROM comments
        WHERE task_id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(task_id)
    .fetch_one(pool)
    .await?;

    // Get attachment count
    let attachment_count: i64 = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)
        FROM attachments
        WHERE task_id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(task_id)
    .fetch_one(pool)
    .await?;

    Ok(Some(TaskWithDetails {
        task,
        assignees,
        labels,
        comment_count,
        attachment_count,
    }))
}

/// Create a new task
pub async fn create_task(
    pool: &PgPool,
    board_id: Uuid,
    input: CreateTaskInput,
    tenant_id: Uuid,
    created_by_id: Uuid,
) -> Result<Task, TaskQueryError> {
    // Get the last position in the column to calculate new position
    let last_position = sqlx::query_scalar::<_, String>(
        r#"
        SELECT position
        FROM tasks
        WHERE column_id = $1 AND deleted_at IS NULL
        ORDER BY position DESC
        LIMIT 1
        "#,
    )
    .bind(input.column_id)
    .fetch_optional(pool)
    .await?;

    let position = generate_key_between(last_position.as_deref(), None);

    let task_id = Uuid::new_v4();

    // Insert the task
    let task = sqlx::query_as::<_, Task>(
        r#"
        INSERT INTO tasks (id, title, description, priority, due_date, start_date, estimated_hours, board_id, column_id, position, milestone_id, tenant_id, created_by_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING
            id,
            title,
            description,
            priority,
            due_date,
            start_date,
            estimated_hours,
            board_id,
            column_id,
            position,
            milestone_id,
            tenant_id,
            created_by_id,
            deleted_at,
            created_at,
            updated_at
        "#,
    )
    .bind(task_id)
    .bind(&input.title)
    .bind(&input.description)
    .bind(&input.priority)
    .bind(input.due_date)
    .bind(input.start_date)
    .bind(input.estimated_hours)
    .bind(board_id)
    .bind(input.column_id)
    .bind(&position)
    .bind(input.milestone_id)
    .bind(tenant_id)
    .bind(created_by_id)
    .fetch_one(pool)
    .await?;

    // Insert assignees if provided
    if let Some(assignee_ids) = input.assignee_ids {
        for assignee_id in assignee_ids {
            sqlx::query(
                r#"
                INSERT INTO task_assignees (id, task_id, user_id)
                VALUES ($1, $2, $3)
                ON CONFLICT (task_id, user_id) DO NOTHING
                "#,
            )
            .bind(Uuid::new_v4())
            .bind(task_id)
            .bind(assignee_id)
            .execute(pool)
            .await?;
        }
    }

    // Insert labels if provided
    if let Some(label_ids) = input.label_ids {
        for label_id in label_ids {
            sqlx::query(
                r#"
                INSERT INTO task_labels (id, task_id, label_id)
                VALUES ($1, $2, $3)
                ON CONFLICT (task_id, label_id) DO NOTHING
                "#,
            )
            .bind(Uuid::new_v4())
            .bind(task_id)
            .bind(label_id)
            .execute(pool)
            .await?;
        }
    }

    Ok(task)
}

/// Update an existing task
pub async fn update_task(
    pool: &PgPool,
    task_id: Uuid,
    input: UpdateTaskInput,
) -> Result<Task, TaskQueryError> {
    let task = sqlx::query_as::<_, Task>(
        r#"
        UPDATE tasks
        SET
            title = COALESCE($2, title),
            description = COALESCE($3, description),
            priority = COALESCE($4, priority),
            due_date = COALESCE($5, due_date),
            start_date = COALESCE($6, start_date),
            estimated_hours = COALESCE($7, estimated_hours),
            milestone_id = COALESCE($8, milestone_id),
            updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING
            id,
            title,
            description,
            priority,
            due_date,
            start_date,
            estimated_hours,
            board_id,
            column_id,
            position,
            milestone_id,
            tenant_id,
            created_by_id,
            deleted_at,
            created_at,
            updated_at
        "#,
    )
    .bind(task_id)
    .bind(&input.title)
    .bind(&input.description)
    .bind(&input.priority)
    .bind(input.due_date)
    .bind(input.start_date)
    .bind(input.estimated_hours)
    .bind(input.milestone_id)
    .fetch_optional(pool)
    .await?
    .ok_or(TaskQueryError::NotFound)?;

    Ok(task)
}

/// Soft delete a task
pub async fn soft_delete_task(pool: &PgPool, task_id: Uuid) -> Result<(), TaskQueryError> {
    let rows_affected = sqlx::query(
        r#"
        UPDATE tasks
        SET deleted_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(task_id)
    .execute(pool)
    .await?
    .rows_affected();

    if rows_affected == 0 {
        return Err(TaskQueryError::NotFound);
    }

    Ok(())
}

/// Move a task to a different column and/or position
pub async fn move_task(
    pool: &PgPool,
    task_id: Uuid,
    target_column_id: Uuid,
    new_position: String,
) -> Result<Task, TaskQueryError> {
    let task = sqlx::query_as::<_, Task>(
        r#"
        UPDATE tasks
        SET
            column_id = $2,
            position = $3,
            updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING
            id,
            title,
            description,
            priority,
            due_date,
            start_date,
            estimated_hours,
            board_id,
            column_id,
            position,
            milestone_id,
            tenant_id,
            created_by_id,
            deleted_at,
            created_at,
            updated_at
        "#,
    )
    .bind(task_id)
    .bind(target_column_id)
    .bind(&new_position)
    .fetch_optional(pool)
    .await?
    .ok_or(TaskQueryError::NotFound)?;

    Ok(task)
}

/// Assign a user to a task
pub async fn assign_user(
    pool: &PgPool,
    task_id: Uuid,
    user_id: Uuid,
) -> Result<TaskAssignee, TaskQueryError> {
    let assignee = sqlx::query_as::<_, TaskAssignee>(
        r#"
        INSERT INTO task_assignees (id, task_id, user_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (task_id, user_id) DO UPDATE SET assigned_at = task_assignees.assigned_at
        RETURNING id, task_id, user_id, assigned_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(task_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    Ok(assignee)
}

/// Unassign a user from a task
pub async fn unassign_user(
    pool: &PgPool,
    task_id: Uuid,
    user_id: Uuid,
) -> Result<(), TaskQueryError> {
    let rows_affected = sqlx::query(
        r#"
        DELETE FROM task_assignees
        WHERE task_id = $1 AND user_id = $2
        "#,
    )
    .bind(task_id)
    .bind(user_id)
    .execute(pool)
    .await?
    .rows_affected();

    if rows_affected == 0 {
        return Err(TaskQueryError::NotFound);
    }

    Ok(())
}

/// Get task's board_id (for authorization checks)
pub async fn get_task_board_id(pool: &PgPool, task_id: Uuid) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT board_id FROM tasks WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(task_id)
    .fetch_optional(pool)
    .await
}

/// Get assignee IDs for a task
pub async fn get_task_assignee_ids(pool: &PgPool, task_id: Uuid) -> Result<Vec<Uuid>, sqlx::Error> {
    sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT user_id FROM task_assignees WHERE task_id = $1
        "#,
    )
    .bind(task_id)
    .fetch_all(pool)
    .await
}

/// Flat list of tasks for list view (with enriched data)
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TaskListItem {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub priority: TaskPriority,
    pub due_date: Option<DateTime<Utc>>,
    pub column_id: Uuid,
    pub column_name: String,
    pub position: String,
    pub created_by_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// List all tasks for a board as a flat list with column names
pub async fn list_tasks_flat(
    pool: &PgPool,
    board_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<TaskListItem>, TaskQueryError> {
    if !verify_board_membership(pool, board_id, user_id).await? {
        return Err(TaskQueryError::NotBoardMember);
    }

    let tasks = sqlx::query_as::<_, TaskListItem>(
        r#"
        SELECT t.id, t.title, t.description,
               t.priority,
               t.due_date, t.column_id,
               bc.name as column_name,
               t.position, t.created_by_id,
               t.created_at, t.updated_at
        FROM tasks t
        JOIN board_columns bc ON bc.id = t.column_id
        WHERE t.board_id = $1 AND t.deleted_at IS NULL
        ORDER BY t.created_at DESC
        "#,
    )
    .bind(board_id)
    .fetch_all(pool)
    .await?;

    Ok(tasks)
}

/// Calendar task for date-based views
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CalendarTask {
    pub id: Uuid,
    pub title: String,
    pub priority: TaskPriority,
    pub due_date: DateTime<Utc>,
    pub start_date: Option<DateTime<Utc>>,
    pub column_id: Uuid,
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
        return Err(TaskQueryError::NotBoardMember);
    }

    let tasks = sqlx::query_as::<_, CalendarTask>(
        r#"
        SELECT
            t.id, t.title, t.priority,
            t.due_date as "due_date!",
            t.start_date,
            t.column_id,
            bc.name as column_name,
            COALESCE(bc.status_mapping->>'done' = 'true', false) as "is_done!",
            t.milestone_id
        FROM tasks t
        JOIN board_columns bc ON bc.id = t.column_id
        WHERE t.board_id = $1
            AND t.deleted_at IS NULL
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
    pub column_id: Uuid,
    pub column_name: String,
    pub is_done: bool,
    pub milestone_id: Option<Uuid>,
}

/// List tasks for a board that have dates (for Gantt chart)
pub async fn list_tasks_for_gantt(
    pool: &PgPool,
    board_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<GanttTask>, TaskQueryError> {
    if !verify_board_membership(pool, board_id, user_id).await? {
        return Err(TaskQueryError::NotBoardMember);
    }

    let tasks = sqlx::query_as::<_, GanttTask>(
        r#"
        SELECT
            t.id, t.title, t.priority,
            t.start_date,
            t.due_date,
            t.column_id,
            bc.name as column_name,
            COALESCE(bc.status_mapping->>'done' = 'true', false) as "is_done!",
            t.milestone_id
        FROM tasks t
        JOIN board_columns bc ON bc.id = t.column_id
        WHERE t.board_id = $1
            AND t.deleted_at IS NULL
            AND (t.start_date IS NOT NULL OR t.due_date IS NOT NULL)
        ORDER BY COALESCE(t.start_date, t.due_date) ASC
        "#,
    )
    .bind(board_id)
    .fetch_all(pool)
    .await?;

    Ok(tasks)
}

/// Input for bulk updating tasks
#[derive(Debug, Deserialize)]
pub struct BulkUpdateInput {
    pub task_ids: Vec<Uuid>,
    pub column_id: Option<Uuid>,
    pub priority: Option<TaskPriority>,
    pub milestone_id: Option<Uuid>,
    pub clear_milestone: Option<bool>,
}

/// Bulk update multiple tasks at once
pub async fn bulk_update_tasks(
    pool: &PgPool,
    board_id: Uuid,
    user_id: Uuid,
    input: BulkUpdateInput,
) -> std::result::Result<u64, TaskQueryError> {
    // Verify board membership
    let is_member = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM board_members WHERE board_id = $1 AND user_id = $2)",
    )
    .bind(board_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    if !is_member {
        return Err(TaskQueryError::NotBoardMember);
    }

    if input.task_ids.is_empty() {
        return Ok(0);
    }

    let mut updated: u64 = 0;

    // Update column if specified
    if let Some(column_id) = input.column_id {
        let result = sqlx::query(
            r#"
            UPDATE tasks SET column_id = $1, updated_at = now()
            WHERE id = ANY($2) AND board_id = $3 AND deleted_at IS NULL
            "#,
        )
        .bind(column_id)
        .bind(&input.task_ids)
        .bind(board_id)
        .execute(pool)
        .await?;
        updated = result.rows_affected();
    }

    // Update priority if specified
    if let Some(ref priority) = input.priority {
        let result = sqlx::query(
            r#"
            UPDATE tasks SET priority = $1, updated_at = now()
            WHERE id = ANY($2) AND board_id = $3 AND deleted_at IS NULL
            "#,
        )
        .bind(priority)
        .bind(&input.task_ids)
        .bind(board_id)
        .execute(pool)
        .await?;
        updated = result.rows_affected();
    }

    // Update milestone if specified
    if input.clear_milestone == Some(true) {
        let result = sqlx::query(
            r#"
            UPDATE tasks SET milestone_id = NULL, updated_at = now()
            WHERE id = ANY($1) AND board_id = $2 AND deleted_at IS NULL
            "#,
        )
        .bind(&input.task_ids)
        .bind(board_id)
        .execute(pool)
        .await?;
        updated = result.rows_affected();
    } else if let Some(milestone_id) = input.milestone_id {
        let result = sqlx::query(
            r#"
            UPDATE tasks SET milestone_id = $1, updated_at = now()
            WHERE id = ANY($2) AND board_id = $3 AND deleted_at IS NULL
            "#,
        )
        .bind(milestone_id)
        .bind(&input.task_ids)
        .bind(board_id)
        .execute(pool)
        .await?;
        updated = result.rows_affected();
    }

    Ok(updated)
}

/// Bulk delete (soft) multiple tasks
pub async fn bulk_delete_tasks(
    pool: &PgPool,
    board_id: Uuid,
    user_id: Uuid,
    task_ids: &[Uuid],
) -> std::result::Result<u64, TaskQueryError> {
    let is_member = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM board_members WHERE board_id = $1 AND user_id = $2)",
    )
    .bind(board_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    if !is_member {
        return Err(TaskQueryError::NotBoardMember);
    }

    let result = sqlx::query(
        r#"
        UPDATE tasks SET deleted_at = now(), updated_at = now()
        WHERE id = ANY($1) AND board_id = $2 AND deleted_at IS NULL
        "#,
    )
    .bind(task_ids)
    .bind(board_id)
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_task_input_deserialize() {
        let json = r#"{
            "title": "Test Task",
            "description": "A test description",
            "priority": "high",
            "column_id": "00000000-0000-0000-0000-000000000001"
        }"#;

        let input: CreateTaskInput = serde_json::from_str(json).unwrap();
        assert_eq!(input.title, "Test Task");
        assert_eq!(input.priority, TaskPriority::High);
    }
}
