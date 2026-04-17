//! Task Snooze database queries
//!
//! Manages task snooze/unsnooze operations for the my-tasks view.

use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

/// A task snooze record
#[derive(Debug, Serialize, Clone, sqlx::FromRow)]
pub struct TaskSnooze {
    pub id: Uuid,
    pub user_id: Uuid,
    pub task_id: Uuid,
    pub snoozed_until: NaiveDate,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Input for snoozing a task
#[derive(Debug, Deserialize)]
pub struct SnoozeTaskInput {
    pub snoozed_until: NaiveDate,
}

/// Snooze a task for a user (upsert - updates if already snoozed)
pub async fn snooze_task(
    pool: &PgPool,
    user_id: Uuid,
    task_id: Uuid,
    input: &SnoozeTaskInput,
) -> Result<TaskSnooze, TaskSnoozeError> {
    // Validate the snooze date is in the future
    let today = chrono::Utc::now().date_naive();
    if input.snoozed_until <= today {
        return Err(TaskSnoozeError::InvalidDate(
            "Snooze date must be in the future".to_string(),
        ));
    }

    // Verify task exists and user has access
    let has_access = sqlx::query_scalar::<_, bool>(
        r"
        SELECT EXISTS(
            SELECT 1 FROM tasks t
            INNER JOIN projects p ON p.id = t.project_id
            INNER JOIN workspaces w ON w.id = p.workspace_id
            WHERE t.id = $2 AND t.deleted_at IS NULL
              AND (
                  EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = t.project_id AND pm.user_id = $1)
                  OR EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = p.workspace_id AND wm.user_id = $1)
                  OR (EXISTS (SELECT 1 FROM users u WHERE u.id = $1 AND u.role IN ('admin', 'super_admin') AND u.deleted_at IS NULL)
                      AND w.visibility != 'private')
              )
        )
        ",
    )
    .bind(user_id)
    .bind(task_id)
    .fetch_one(pool)
    .await
    .map_err(TaskSnoozeError::Database)?;

    if !has_access {
        return Err(TaskSnoozeError::TaskNotAccessible);
    }

    let snooze = sqlx::query_as::<_, TaskSnooze>(
        r"
        INSERT INTO task_snoozes (user_id, task_id, snoozed_until)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, task_id)
        DO UPDATE SET snoozed_until = $3, created_at = NOW()
        RETURNING id, user_id, task_id, snoozed_until, created_at
        ",
    )
    .bind(user_id)
    .bind(task_id)
    .bind(input.snoozed_until)
    .fetch_one(pool)
    .await
    .map_err(TaskSnoozeError::Database)?;

    Ok(snooze)
}

/// Unsnooze a task for a user
pub async fn unsnooze_task(
    pool: &PgPool,
    user_id: Uuid,
    task_id: Uuid,
) -> Result<(), TaskSnoozeError> {
    let result = sqlx::query("DELETE FROM task_snoozes WHERE user_id = $1 AND task_id = $2")
        .bind(user_id)
        .bind(task_id)
        .execute(pool)
        .await
        .map_err(TaskSnoozeError::Database)?;

    if result.rows_affected() == 0 {
        return Err(TaskSnoozeError::NotFound);
    }

    Ok(())
}

/// Error type for task snooze operations
#[derive(Debug, thiserror::Error)]
pub enum TaskSnoozeError {
    #[error("Snooze not found")]
    NotFound,
    #[error("Task not accessible")]
    TaskNotAccessible,
    #[error("Invalid date: {0}")]
    InvalidDate(String),
    #[error(transparent)]
    Database(#[from] sqlx::Error),
}
