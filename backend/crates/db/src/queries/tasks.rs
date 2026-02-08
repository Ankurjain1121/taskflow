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
    pub column_id: Uuid,
    pub assignee_ids: Option<Vec<Uuid>>,
}

/// Input for updating an existing task
#[derive(Debug, Deserialize)]
pub struct UpdateTaskInput {
    pub title: Option<String>,
    pub description: Option<String>,
    pub priority: Option<TaskPriority>,
    pub due_date: Option<DateTime<Utc>>,
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
#[derive(Debug, Serialize)]
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
    let result = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM board_members
            WHERE board_id = $1 AND user_id = $2
        ) as "exists!"
        "#,
        board_id,
        user_id
    )
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
    let tasks = sqlx::query_as!(
        Task,
        r#"
        SELECT
            id,
            title,
            description,
            priority as "priority: TaskPriority",
            due_date,
            board_id,
            column_id,
            position,
            tenant_id,
            created_by_id,
            deleted_at,
            created_at,
            updated_at
        FROM tasks
        WHERE board_id = $1 AND deleted_at IS NULL
        ORDER BY position ASC
        "#,
        board_id
    )
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
    let task = sqlx::query_as!(
        Task,
        r#"
        SELECT
            id,
            title,
            description,
            priority as "priority: TaskPriority",
            due_date,
            board_id,
            column_id,
            position,
            tenant_id,
            created_by_id,
            deleted_at,
            created_at,
            updated_at
        FROM tasks
        WHERE id = $1 AND deleted_at IS NULL
        "#,
        task_id
    )
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
    let assignees = sqlx::query_as!(
        AssigneeInfo,
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
        task_id
    )
    .fetch_all(pool)
    .await?;

    // Fetch labels
    let labels = sqlx::query_as!(
        Label,
        r#"
        SELECT l.id, l.name, l.color, l.board_id
        FROM labels l
        JOIN task_labels tl ON tl.label_id = l.id
        WHERE tl.task_id = $1
        "#,
        task_id
    )
    .fetch_all(pool)
    .await?;

    // Get comment count
    let comment_count = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) as "count!"
        FROM comments
        WHERE task_id = $1 AND deleted_at IS NULL
        "#,
        task_id
    )
    .fetch_one(pool)
    .await?;

    // Get attachment count
    let attachment_count = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) as "count!"
        FROM attachments
        WHERE task_id = $1 AND deleted_at IS NULL
        "#,
        task_id
    )
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
    let last_position = sqlx::query_scalar!(
        r#"
        SELECT position
        FROM tasks
        WHERE column_id = $1 AND deleted_at IS NULL
        ORDER BY position DESC
        LIMIT 1
        "#,
        input.column_id
    )
    .fetch_optional(pool)
    .await?;

    let position = generate_key_between(last_position.as_deref(), None);

    let task_id = Uuid::new_v4();

    // Insert the task
    let task = sqlx::query_as!(
        Task,
        r#"
        INSERT INTO tasks (id, title, description, priority, due_date, board_id, column_id, position, tenant_id, created_by_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING
            id,
            title,
            description,
            priority as "priority: TaskPriority",
            due_date,
            board_id,
            column_id,
            position,
            tenant_id,
            created_by_id,
            deleted_at,
            created_at,
            updated_at
        "#,
        task_id,
        input.title,
        input.description,
        input.priority as TaskPriority,
        input.due_date,
        board_id,
        input.column_id,
        position,
        tenant_id,
        created_by_id
    )
    .fetch_one(pool)
    .await?;

    // Insert assignees if provided
    if let Some(assignee_ids) = input.assignee_ids {
        for assignee_id in assignee_ids {
            sqlx::query!(
                r#"
                INSERT INTO task_assignees (id, task_id, user_id)
                VALUES ($1, $2, $3)
                ON CONFLICT (task_id, user_id) DO NOTHING
                "#,
                Uuid::new_v4(),
                task_id,
                assignee_id
            )
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
    let task = sqlx::query_as!(
        Task,
        r#"
        UPDATE tasks
        SET
            title = COALESCE($2, title),
            description = COALESCE($3, description),
            priority = COALESCE($4, priority),
            due_date = COALESCE($5, due_date),
            updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING
            id,
            title,
            description,
            priority as "priority: TaskPriority",
            due_date,
            board_id,
            column_id,
            position,
            tenant_id,
            created_by_id,
            deleted_at,
            created_at,
            updated_at
        "#,
        task_id,
        input.title,
        input.description,
        input.priority as Option<TaskPriority>,
        input.due_date
    )
    .fetch_optional(pool)
    .await?
    .ok_or(TaskQueryError::NotFound)?;

    Ok(task)
}

/// Soft delete a task
pub async fn soft_delete_task(pool: &PgPool, task_id: Uuid) -> Result<(), TaskQueryError> {
    let rows_affected = sqlx::query!(
        r#"
        UPDATE tasks
        SET deleted_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        "#,
        task_id
    )
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
    let task = sqlx::query_as!(
        Task,
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
            priority as "priority: TaskPriority",
            due_date,
            board_id,
            column_id,
            position,
            tenant_id,
            created_by_id,
            deleted_at,
            created_at,
            updated_at
        "#,
        task_id,
        target_column_id,
        new_position
    )
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
    let assignee = sqlx::query_as!(
        TaskAssignee,
        r#"
        INSERT INTO task_assignees (id, task_id, user_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (task_id, user_id) DO UPDATE SET assigned_at = task_assignees.assigned_at
        RETURNING id, task_id, user_id, assigned_at
        "#,
        Uuid::new_v4(),
        task_id,
        user_id
    )
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
    let rows_affected = sqlx::query!(
        r#"
        DELETE FROM task_assignees
        WHERE task_id = $1 AND user_id = $2
        "#,
        task_id,
        user_id
    )
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
    sqlx::query_scalar!(
        r#"
        SELECT board_id FROM tasks WHERE id = $1 AND deleted_at IS NULL
        "#,
        task_id
    )
    .fetch_optional(pool)
    .await
}

/// Get assignee IDs for a task
pub async fn get_task_assignee_ids(pool: &PgPool, task_id: Uuid) -> Result<Vec<Uuid>, sqlx::Error> {
    sqlx::query_scalar!(
        r#"
        SELECT user_id FROM task_assignees WHERE task_id = $1
        "#,
        task_id
    )
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

    let tasks = sqlx::query_as!(
        TaskListItem,
        r#"
        SELECT t.id, t.title, t.description,
               t.priority as "priority: TaskPriority",
               t.due_date, t.column_id,
               bc.name as column_name,
               t.position, t.created_by_id,
               t.created_at, t.updated_at
        FROM tasks t
        JOIN board_columns bc ON bc.id = t.column_id
        WHERE t.board_id = $1 AND t.deleted_at IS NULL
        ORDER BY t.created_at DESC
        "#,
        board_id
    )
    .fetch_all(pool)
    .await?;

    Ok(tasks)
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
