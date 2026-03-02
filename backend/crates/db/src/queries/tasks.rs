use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::collections::HashMap;
use uuid::Uuid;

use crate::models::{Label, Task, TaskPriority};
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
    pub group_id: Option<Uuid>,
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
    /// Explicit clear flags — when true, set the field to NULL even if the value is None
    #[serde(default)]
    pub clear_description: Option<bool>,
    #[serde(default)]
    pub clear_due_date: Option<bool>,
    #[serde(default)]
    pub clear_start_date: Option<bool>,
    #[serde(default)]
    pub clear_estimated_hours: Option<bool>,
    #[serde(default)]
    pub clear_milestone: Option<bool>,
}

/// Task with all associated details
#[derive(Debug, Serialize)]
pub struct TaskWithDetails {
    #[serde(flatten)]
    pub task: Task,
    pub assignees: Vec<AssigneeInfo>,
    pub labels: Vec<Label>,
    pub watchers: Vec<super::task_watchers::WatcherInfo>,
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
pub(crate) async fn verify_board_membership(
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
            id, title, description, priority, due_date, start_date,
            estimated_hours, board_id, column_id, group_id, position,
            milestone_id, task_number, eisenhower_urgency, eisenhower_importance,
            tenant_id, created_by_id, deleted_at, created_at, updated_at
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
            id, title, description, priority, due_date, start_date,
            estimated_hours, board_id, column_id, group_id, position,
            milestone_id, task_number, eisenhower_urgency, eisenhower_importance,
            tenant_id, created_by_id, deleted_at, created_at, updated_at
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

    // Fetch watchers with user info
    let watchers = super::task_watchers::get_watcher_info(pool, task_id).await?;

    Ok(Some(TaskWithDetails {
        task,
        assignees,
        labels,
        watchers,
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

    // Insert the task with auto-assigned task_number
    let task = sqlx::query_as::<_, Task>(
        r#"
        INSERT INTO tasks (id, title, description, priority, due_date, start_date,
                          estimated_hours, board_id, column_id, group_id, position,
                          milestone_id, task_number, tenant_id, created_by_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                COALESCE((SELECT MAX(task_number) FROM tasks WHERE board_id = $8), 0) + 1,
                $13, $14)
        RETURNING
            id, title, description, priority, due_date, start_date,
            estimated_hours, board_id, column_id, group_id, position,
            milestone_id, task_number, eisenhower_urgency, eisenhower_importance,
            tenant_id, created_by_id, deleted_at, created_at, updated_at
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
    .bind(input.group_id)
    .bind(&position)
    .bind(input.milestone_id)
    .bind(tenant_id)
    .bind(created_by_id)
    .fetch_one(pool)
    .await?;

    // Insert assignees if provided — batch insert
    if let Some(ref assignee_ids) = input.assignee_ids {
        if !assignee_ids.is_empty() {
            sqlx::query(
                r#"
                INSERT INTO task_assignees (id, task_id, user_id)
                SELECT gen_random_uuid(), $1, unnest($2::uuid[])
                ON CONFLICT (task_id, user_id) DO NOTHING
                "#,
            )
            .bind(task_id)
            .bind(assignee_ids)
            .execute(pool)
            .await?;
        }
    }

    // Insert labels if provided — batch insert
    if let Some(ref label_ids) = input.label_ids {
        if !label_ids.is_empty() {
            sqlx::query(
                r#"
                INSERT INTO task_labels (id, task_id, label_id)
                SELECT gen_random_uuid(), $1, unnest($2::uuid[])
                ON CONFLICT (task_id, label_id) DO NOTHING
                "#,
            )
            .bind(task_id)
            .bind(label_ids)
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
            description = CASE WHEN $9 = true THEN NULL WHEN $3 IS NOT NULL THEN $3 ELSE description END,
            priority = COALESCE($4, priority),
            due_date = CASE WHEN $10 = true THEN NULL WHEN $5 IS NOT NULL THEN $5 ELSE due_date END,
            start_date = CASE WHEN $11 = true THEN NULL WHEN $6 IS NOT NULL THEN $6 ELSE start_date END,
            estimated_hours = CASE WHEN $12 = true THEN NULL WHEN $7 IS NOT NULL THEN $7 ELSE estimated_hours END,
            milestone_id = CASE WHEN $13 = true THEN NULL WHEN $8 IS NOT NULL THEN $8 ELSE milestone_id END,
            updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING
            id, title, description, priority, due_date, start_date,
            estimated_hours, board_id, column_id, group_id, position,
            milestone_id, task_number, eisenhower_urgency, eisenhower_importance,
            tenant_id, created_by_id, deleted_at, created_at, updated_at
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
    .bind(input.clear_description.unwrap_or(false))
    .bind(input.clear_due_date.unwrap_or(false))
    .bind(input.clear_start_date.unwrap_or(false))
    .bind(input.clear_estimated_hours.unwrap_or(false))
    .bind(input.clear_milestone.unwrap_or(false))
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
            id, title, description, priority, due_date, start_date,
            estimated_hours, board_id, column_id, group_id, position,
            milestone_id, task_number, eisenhower_urgency, eisenhower_importance,
            tenant_id, created_by_id, deleted_at, created_at, updated_at
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

/// Duplicate a task including assignees and labels
pub async fn duplicate_task(
    pool: &PgPool,
    source_task_id: Uuid,
    created_by_id: Uuid,
) -> Result<Task, TaskQueryError> {
    // Get the source task
    let source = sqlx::query_as::<_, Task>(
        r#"
        SELECT
            id, title, description, priority, due_date, start_date,
            estimated_hours, board_id, column_id, group_id, position,
            milestone_id, task_number, eisenhower_urgency, eisenhower_importance,
            tenant_id, created_by_id, deleted_at, created_at, updated_at
        FROM tasks
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(source_task_id)
    .fetch_optional(pool)
    .await?
    .ok_or(TaskQueryError::NotFound)?;

    // Get position after the source task
    let last_position = sqlx::query_scalar::<_, String>(
        r#"
        SELECT position
        FROM tasks
        WHERE column_id = $1 AND deleted_at IS NULL
        ORDER BY position DESC
        LIMIT 1
        "#,
    )
    .bind(source.column_id)
    .fetch_optional(pool)
    .await?;

    let position = generate_key_between(last_position.as_deref(), None);

    let new_id = Uuid::new_v4();
    let new_title = format!("Copy of {}", source.title);

    // Insert the duplicate task with auto-assigned task_number
    let task = sqlx::query_as::<_, Task>(
        r#"
        INSERT INTO tasks (id, title, description, priority, due_date, start_date,
                          estimated_hours, board_id, column_id, group_id, position,
                          milestone_id, task_number, eisenhower_urgency, eisenhower_importance,
                          tenant_id, created_by_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                COALESCE((SELECT MAX(task_number) FROM tasks WHERE board_id = $8), 0) + 1,
                $13, $14, $15, $16)
        RETURNING
            id, title, description, priority, due_date, start_date,
            estimated_hours, board_id, column_id, group_id, position,
            milestone_id, task_number, eisenhower_urgency, eisenhower_importance,
            tenant_id, created_by_id, deleted_at, created_at, updated_at
        "#,
    )
    .bind(new_id)
    .bind(&new_title)
    .bind(&source.description)
    .bind(&source.priority)
    .bind(source.due_date)
    .bind(source.start_date)
    .bind(source.estimated_hours)
    .bind(source.board_id)
    .bind(source.column_id)
    .bind(source.group_id)
    .bind(&position)
    .bind(source.milestone_id)
    .bind(source.eisenhower_urgency)
    .bind(source.eisenhower_importance)
    .bind(source.tenant_id)
    .bind(created_by_id)
    .fetch_one(pool)
    .await?;

    // Copy assignees
    sqlx::query(
        r#"
        INSERT INTO task_assignees (id, task_id, user_id)
        SELECT gen_random_uuid(), $2, user_id
        FROM task_assignees
        WHERE task_id = $1
        ON CONFLICT (task_id, user_id) DO NOTHING
        "#,
    )
    .bind(source_task_id)
    .bind(new_id)
    .execute(pool)
    .await?;

    // Copy labels
    sqlx::query(
        r#"
        INSERT INTO task_labels (id, task_id, label_id)
        SELECT gen_random_uuid(), $2, label_id
        FROM task_labels
        WHERE task_id = $1
        ON CONFLICT (task_id, label_id) DO NOTHING
        "#,
    )
    .bind(source_task_id)
    .bind(new_id)
    .execute(pool)
    .await?;

    // Copy subtasks
    sqlx::query(
        r#"
        INSERT INTO tasks (id, title, description, priority, board_id, column_id,
                          position, tenant_id, created_by_id)
        SELECT gen_random_uuid(), title, description, priority, board_id, column_id,
               position, tenant_id, $3
        FROM tasks
        WHERE parent_task_id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(source_task_id)
    .bind(new_id)
    .bind(created_by_id)
    .execute(pool)
    .await
    .ok(); // Subtask copy is best-effort — table may not have parent_task_id

    Ok(task)
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
