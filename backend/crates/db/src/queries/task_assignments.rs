use sqlx::PgPool;
use uuid::Uuid;

use crate::models::TaskAssignee;

use super::tasks::TaskQueryError;

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
