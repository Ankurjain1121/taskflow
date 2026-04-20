//! Batch operations for my-tasks view
//!
//! Bulk update tasks from the my-tasks perspective with per-task RBAC.

use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::TaskPriority;

/// A single task update in a batch
#[derive(Debug, Deserialize)]
pub struct BatchTaskUpdate {
    pub task_id: Uuid,
    pub priority: Option<TaskPriority>,
    pub due_date: Option<Option<chrono::DateTime<chrono::Utc>>>,
    pub status_id: Option<Uuid>,
}

/// Input for batch my-tasks update
#[strict_dto_derive::strict_dto]
#[derive(Debug)]
pub struct BatchMyTasksInput {
    pub updates: Vec<BatchTaskUpdate>,
}

/// Result of a batch operation
#[derive(Debug, Serialize)]
pub struct BatchMyTasksResult {
    pub updated: usize,
    pub failed: Vec<BatchTaskFailure>,
}

/// A failed task update
#[derive(Debug, Serialize)]
pub struct BatchTaskFailure {
    pub task_id: Uuid,
    pub reason: String,
}

const MAX_BATCH_SIZE: usize = 50;

/// Execute batch updates on tasks, verifying RBAC per task
pub async fn batch_update_my_tasks(
    pool: &PgPool,
    user_id: Uuid,
    input: &BatchMyTasksInput,
) -> Result<BatchMyTasksResult, BatchMyTasksError> {
    if input.updates.len() > MAX_BATCH_SIZE {
        return Err(BatchMyTasksError::TooMany(format!(
            "Maximum {} tasks per batch",
            MAX_BATCH_SIZE
        )));
    }

    if input.updates.is_empty() {
        return Ok(BatchMyTasksResult {
            updated: 0,
            failed: Vec::new(),
        });
    }

    let mut updated = 0usize;
    let mut failed = Vec::new();

    for update in &input.updates {
        // Check RBAC: user must be a project member for this task
        let is_member = sqlx::query_scalar::<_, bool>(
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
        .bind(update.task_id)
        .fetch_one(pool)
        .await
        .map_err(BatchMyTasksError::Database)?;

        if !is_member {
            failed.push(BatchTaskFailure {
                task_id: update.task_id,
                reason: "Not a project member or task not found".to_string(),
            });
            continue;
        }

        // Execute individual field updates per task.
        // This is acceptable for max 50 tasks.
        if let Some(ref priority) = update.priority {
            let result = sqlx::query(
                "UPDATE tasks SET priority = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL",
            )
            .bind(priority)
            .bind(update.task_id)
            .execute(pool)
            .await;

            match result {
                Ok(_) => {}
                Err(e) => {
                    failed.push(BatchTaskFailure {
                        task_id: update.task_id,
                        reason: format!("Failed to update priority: {}", e),
                    });
                    continue;
                }
            }
        }

        if let Some(ref due_date) = update.due_date {
            let result = sqlx::query(
                "UPDATE tasks SET due_date = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL",
            )
            .bind(due_date)
            .bind(update.task_id)
            .execute(pool)
            .await;

            match result {
                Ok(_) => {}
                Err(e) => {
                    failed.push(BatchTaskFailure {
                        task_id: update.task_id,
                        reason: format!("Failed to update due_date: {}", e),
                    });
                    continue;
                }
            }
        }

        if let Some(status_id) = update.status_id {
            let result = sqlx::query(
                "UPDATE tasks SET status_id = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL",
            )
            .bind(status_id)
            .bind(update.task_id)
            .execute(pool)
            .await;

            match result {
                Ok(_) => {}
                Err(e) => {
                    failed.push(BatchTaskFailure {
                        task_id: update.task_id,
                        reason: format!("Failed to update status: {}", e),
                    });
                    continue;
                }
            }
        }

        updated += 1;
    }

    Ok(BatchMyTasksResult { updated, failed })
}

/// Error type for batch my-tasks operations
#[derive(Debug, thiserror::Error)]
pub enum BatchMyTasksError {
    #[error("Too many tasks: {0}")]
    TooMany(String),
    #[error(transparent)]
    Database(#[from] sqlx::Error),
}
