use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::Subtask;
use crate::utils::generate_key_between;

/// Error type for subtask query operations
#[derive(Debug, thiserror::Error)]
pub enum SubtaskQueryError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Subtask not found")]
    NotFound,
}

/// Progress info for subtask completion
#[derive(Debug, Serialize, Deserialize)]
pub struct SubtaskProgress {
    pub completed: i64,
    pub total: i64,
}

/// List all subtasks for a task, ordered by position
pub async fn list_subtasks_by_task(
    pool: &PgPool,
    task_id: Uuid,
) -> Result<Vec<Subtask>, SubtaskQueryError> {
    let subtasks = sqlx::query_as::<_, Subtask>(
        r#"
        SELECT
            id,
            title,
            is_completed,
            position,
            task_id,
            created_by_id,
            completed_at,
            created_at,
            updated_at
        FROM subtasks
        WHERE task_id = $1
        ORDER BY position ASC
        "#,
    )
    .bind(task_id)
    .fetch_all(pool)
    .await?;

    Ok(subtasks)
}

/// Create a new subtask with auto-generated position
pub async fn create_subtask(
    pool: &PgPool,
    task_id: Uuid,
    title: &str,
    created_by_id: Uuid,
) -> Result<Subtask, SubtaskQueryError> {
    // Get the last position to calculate the new one
    let last_position = sqlx::query_scalar::<_, String>(
        r#"
        SELECT position
        FROM subtasks
        WHERE task_id = $1
        ORDER BY position DESC
        LIMIT 1
        "#,
    )
    .bind(task_id)
    .fetch_optional(pool)
    .await?;

    let position = generate_key_between(last_position.as_deref(), None);

    let subtask_id = Uuid::new_v4();

    let subtask = sqlx::query_as::<_, Subtask>(
        r#"
        INSERT INTO subtasks (id, title, position, task_id, created_by_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING
            id,
            title,
            is_completed,
            position,
            task_id,
            created_by_id,
            completed_at,
            created_at,
            updated_at
        "#,
    )
    .bind(subtask_id)
    .bind(title)
    .bind(&position)
    .bind(task_id)
    .bind(created_by_id)
    .fetch_one(pool)
    .await?;

    Ok(subtask)
}

/// Update a subtask's title
pub async fn update_subtask(
    pool: &PgPool,
    subtask_id: Uuid,
    title: &str,
) -> Result<Subtask, SubtaskQueryError> {
    let subtask = sqlx::query_as::<_, Subtask>(
        r#"
        UPDATE subtasks
        SET title = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING
            id,
            title,
            is_completed,
            position,
            task_id,
            created_by_id,
            completed_at,
            created_at,
            updated_at
        "#,
    )
    .bind(subtask_id)
    .bind(title)
    .fetch_optional(pool)
    .await?
    .ok_or(SubtaskQueryError::NotFound)?;

    Ok(subtask)
}

/// Toggle a subtask's completion status
pub async fn toggle_subtask(pool: &PgPool, subtask_id: Uuid) -> Result<Subtask, SubtaskQueryError> {
    let subtask = sqlx::query_as::<_, Subtask>(
        r#"
        UPDATE subtasks
        SET
            is_completed = NOT is_completed,
            completed_at = CASE WHEN is_completed THEN NULL ELSE NOW() END,
            updated_at = NOW()
        WHERE id = $1
        RETURNING
            id,
            title,
            is_completed,
            position,
            task_id,
            created_by_id,
            completed_at,
            created_at,
            updated_at
        "#,
    )
    .bind(subtask_id)
    .fetch_optional(pool)
    .await?
    .ok_or(SubtaskQueryError::NotFound)?;

    Ok(subtask)
}

/// Delete a subtask
pub async fn delete_subtask(pool: &PgPool, subtask_id: Uuid) -> Result<(), SubtaskQueryError> {
    let rows_affected = sqlx::query(
        r#"
        DELETE FROM subtasks
        WHERE id = $1
        "#,
    )
    .bind(subtask_id)
    .execute(pool)
    .await?
    .rows_affected();

    if rows_affected == 0 {
        return Err(SubtaskQueryError::NotFound);
    }

    Ok(())
}

/// Reorder a subtask by updating its position
pub async fn reorder_subtask(
    pool: &PgPool,
    subtask_id: Uuid,
    new_position: &str,
) -> Result<Subtask, SubtaskQueryError> {
    let subtask = sqlx::query_as::<_, Subtask>(
        r#"
        UPDATE subtasks
        SET position = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING
            id,
            title,
            is_completed,
            position,
            task_id,
            created_by_id,
            completed_at,
            created_at,
            updated_at
        "#,
    )
    .bind(subtask_id)
    .bind(new_position)
    .fetch_optional(pool)
    .await?
    .ok_or(SubtaskQueryError::NotFound)?;

    Ok(subtask)
}

/// Get subtask completion progress for a task
pub async fn get_subtask_progress(
    pool: &PgPool,
    task_id: Uuid,
) -> Result<SubtaskProgress, SubtaskQueryError> {
    let total: i64 = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)
        FROM subtasks
        WHERE task_id = $1
        "#,
    )
    .bind(task_id)
    .fetch_one(pool)
    .await?;

    let completed: i64 = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)
        FROM subtasks
        WHERE task_id = $1 AND is_completed = true
        "#,
    )
    .bind(task_id)
    .fetch_one(pool)
    .await?;

    Ok(SubtaskProgress { completed, total })
}

/// Get the task_id for a subtask (for authorization checks)
pub async fn get_subtask_task_id(
    pool: &PgPool,
    subtask_id: Uuid,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT task_id FROM subtasks WHERE id = $1
        "#,
    )
    .bind(subtask_id)
    .fetch_optional(pool)
    .await
}
