//! Trash cleanup job
//!
//! Automatically hard deletes items that have been in trash for more than 30 days.
//! Designed to be triggered daily via cron endpoint.

use chrono::{Duration, Utc};
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::minio::MinioService;
use crate::trash_bin::{permanently_delete, TrashEntityType, TRASH_RETENTION_DAYS};

/// Error type for trash cleanup operations
#[derive(Debug, thiserror::Error)]
pub enum TrashCleanupError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Cleanup error: {0}")]
    Cleanup(String),
}

/// Result of a trash cleanup operation
#[derive(Debug, Serialize)]
pub struct TrashCleanupResult {
    pub workspaces_deleted: usize,
    pub boards_deleted: usize,
    pub tasks_deleted: usize,
    pub total_deleted: usize,
    pub errors: usize,
}

/// Clean up expired trash items (deleted > 30 days ago)
///
/// This function processes items in the following order to respect foreign key constraints:
/// 1. Workspaces (cascades to boards and tasks)
/// 2. Boards (cascades to tasks)
/// 3. Tasks
///
/// Processes in batches of 100 items per entity type.
pub async fn cleanup_expired_trash(
    pool: &PgPool,
    minio: &MinioService,
) -> Result<TrashCleanupResult, TrashCleanupError> {
    let cutoff = Utc::now() - Duration::days(TRASH_RETENTION_DAYS);
    let batch_size = 100i64;

    let mut result = TrashCleanupResult {
        workspaces_deleted: 0,
        boards_deleted: 0,
        tasks_deleted: 0,
        total_deleted: 0,
        errors: 0,
    };

    // Process workspaces first
    loop {
        let workspace_ids: Vec<Uuid> = sqlx::query_scalar!(
            r#"
            SELECT id FROM workspaces
            WHERE deleted_at IS NOT NULL AND deleted_at < $1
            LIMIT $2
            "#,
            cutoff,
            batch_size
        )
        .fetch_all(pool)
        .await?;

        if workspace_ids.is_empty() {
            break;
        }

        for ws_id in workspace_ids {
            match permanently_delete(pool, minio, &TrashEntityType::Workspace, ws_id).await {
                Ok(()) => {
                    result.workspaces_deleted += 1;
                    result.total_deleted += 1;
                }
                Err(e) => {
                    tracing::error!(workspace_id = %ws_id, error = %e, "Failed to delete expired workspace");
                    result.errors += 1;
                }
            }
        }
    }

    // Process boards (that weren't part of deleted workspaces)
    loop {
        let board_ids: Vec<Uuid> = sqlx::query_scalar!(
            r#"
            SELECT id FROM boards
            WHERE deleted_at IS NOT NULL AND deleted_at < $1
            LIMIT $2
            "#,
            cutoff,
            batch_size
        )
        .fetch_all(pool)
        .await?;

        if board_ids.is_empty() {
            break;
        }

        for board_id in board_ids {
            match permanently_delete(pool, minio, &TrashEntityType::Board, board_id).await {
                Ok(()) => {
                    result.boards_deleted += 1;
                    result.total_deleted += 1;
                }
                Err(e) => {
                    tracing::error!(board_id = %board_id, error = %e, "Failed to delete expired board");
                    result.errors += 1;
                }
            }
        }
    }

    // Process tasks (that weren't part of deleted boards)
    loop {
        let task_ids: Vec<Uuid> = sqlx::query_scalar!(
            r#"
            SELECT id FROM tasks
            WHERE deleted_at IS NOT NULL AND deleted_at < $1
            LIMIT $2
            "#,
            cutoff,
            batch_size
        )
        .fetch_all(pool)
        .await?;

        if task_ids.is_empty() {
            break;
        }

        for task_id in task_ids {
            match permanently_delete(pool, minio, &TrashEntityType::Task, task_id).await {
                Ok(()) => {
                    result.tasks_deleted += 1;
                    result.total_deleted += 1;
                }
                Err(e) => {
                    tracing::error!(task_id = %task_id, error = %e, "Failed to delete expired task");
                    result.errors += 1;
                }
            }
        }
    }

    tracing::info!(
        workspaces = result.workspaces_deleted,
        boards = result.boards_deleted,
        tasks = result.tasks_deleted,
        total = result.total_deleted,
        errors = result.errors,
        "Trash cleanup completed"
    );

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_trash_cleanup_result_serialize() {
        let result = TrashCleanupResult {
            workspaces_deleted: 2,
            boards_deleted: 5,
            tasks_deleted: 20,
            total_deleted: 27,
            errors: 1,
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("\"total_deleted\":27"));
    }

    #[test]
    fn test_trash_cleanup_result_serialize_all_fields() {
        let result = TrashCleanupResult {
            workspaces_deleted: 3,
            boards_deleted: 10,
            tasks_deleted: 50,
            total_deleted: 63,
            errors: 0,
        };
        let json = serde_json::to_string(&result).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["workspaces_deleted"], 3);
        assert_eq!(parsed["boards_deleted"], 10);
        assert_eq!(parsed["tasks_deleted"], 50);
        assert_eq!(parsed["total_deleted"], 63);
        assert_eq!(parsed["errors"], 0);
    }

    #[test]
    fn test_trash_cleanup_result_zero_values() {
        let result = TrashCleanupResult {
            workspaces_deleted: 0,
            boards_deleted: 0,
            tasks_deleted: 0,
            total_deleted: 0,
            errors: 0,
        };
        let json = serde_json::to_string(&result).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["total_deleted"], 0);
    }

    #[test]
    fn test_trash_cleanup_result_debug() {
        let result = TrashCleanupResult {
            workspaces_deleted: 1,
            boards_deleted: 2,
            tasks_deleted: 3,
            total_deleted: 6,
            errors: 0,
        };
        let debug = format!("{:?}", result);
        assert!(debug.contains("TrashCleanupResult"), "got: {}", debug);
        assert!(debug.contains("workspaces_deleted"), "got: {}", debug);
    }

    #[test]
    fn test_trash_cleanup_error_display() {
        let err = TrashCleanupError::Cleanup("test cleanup failure".to_string());
        let msg = format!("{}", err);
        assert_eq!(msg, "Cleanup error: test cleanup failure");
    }

    #[test]
    fn test_trash_cleanup_error_database() {
        let err = TrashCleanupError::Database(sqlx::Error::RowNotFound);
        let msg = format!("{}", err);
        assert!(msg.contains("Database error"), "got: {}", msg);
    }
}
