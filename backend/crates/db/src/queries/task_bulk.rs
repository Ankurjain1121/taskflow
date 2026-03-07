use serde::Deserialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::TaskPriority;

use super::tasks::TaskQueryError;

/// Input for bulk updating tasks
#[derive(Debug, Deserialize)]
pub struct BulkUpdateInput {
    pub task_ids: Vec<Uuid>,
    pub status_id: Option<Uuid>,
    pub priority: Option<TaskPriority>,
    pub milestone_id: Option<Uuid>,
    pub clear_milestone: Option<bool>,
    pub task_list_id: Option<Uuid>,
    pub clear_task_list: Option<bool>,
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
        "SELECT EXISTS(SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2)",
    )
    .bind(board_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    if !is_member {
        return Err(TaskQueryError::NotProjectMember);
    }

    if input.task_ids.is_empty() {
        return Ok(0);
    }

    let mut updated: u64 = 0;

    // Update status if specified
    if let Some(status_id) = input.status_id {
        let result = sqlx::query(
            r#"
            UPDATE tasks SET status_id = $1, updated_at = now()
            WHERE id = ANY($2) AND project_id = $3 AND deleted_at IS NULL
            "#,
        )
        .bind(status_id)
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
            WHERE id = ANY($2) AND project_id = $3 AND deleted_at IS NULL
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
            WHERE id = ANY($1) AND project_id = $2 AND deleted_at IS NULL
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
            WHERE id = ANY($2) AND project_id = $3 AND deleted_at IS NULL
            "#,
        )
        .bind(milestone_id)
        .bind(&input.task_ids)
        .bind(board_id)
        .execute(pool)
        .await?;
        updated = result.rows_affected();
    }

    // Update task_list if specified
    if input.clear_task_list == Some(true) {
        let result = sqlx::query(
            r#"
            UPDATE tasks SET task_list_id = NULL, updated_at = now()
            WHERE id = ANY($1) AND project_id = $2 AND deleted_at IS NULL
            "#,
        )
        .bind(&input.task_ids)
        .bind(board_id)
        .execute(pool)
        .await?;
        updated = result.rows_affected();
    } else if let Some(task_list_id) = input.task_list_id {
        let result = sqlx::query(
            r#"
            UPDATE tasks SET task_list_id = $1, updated_at = now()
            WHERE id = ANY($2) AND project_id = $3 AND deleted_at IS NULL
            "#,
        )
        .bind(task_list_id)
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
        "SELECT EXISTS(SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2)",
    )
    .bind(board_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    if !is_member {
        return Err(TaskQueryError::NotProjectMember);
    }

    let result = sqlx::query(
        r#"
        UPDATE tasks SET deleted_at = now(), updated_at = now()
        WHERE id = ANY($1) AND project_id = $2 AND deleted_at IS NULL
        "#,
    )
    .bind(task_ids)
    .bind(board_id)
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
}
