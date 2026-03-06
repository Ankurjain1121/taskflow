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
    pub projects_deleted: usize,
    pub tasks_deleted: usize,
    pub total_deleted: usize,
    pub errors: usize,
}

/// Clean up expired trash items (deleted > 30 days ago)
///
/// This function processes items in the following order to respect foreign key constraints:
/// 1. Workspaces (cascades to projects and tasks)
/// 2. Projects (cascades to tasks)
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
        projects_deleted: 0,
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

    // Process projects (that weren't part of deleted workspaces)
    loop {
        let project_ids: Vec<Uuid> = sqlx::query_scalar!(
            r#"
            SELECT id FROM projects
            WHERE deleted_at IS NOT NULL AND deleted_at < $1
            LIMIT $2
            "#,
            cutoff,
            batch_size
        )
        .fetch_all(pool)
        .await?;

        if project_ids.is_empty() {
            break;
        }

        for project_id in project_ids {
            match permanently_delete(pool, minio, &TrashEntityType::Project, project_id).await {
                Ok(()) => {
                    result.projects_deleted += 1;
                    result.total_deleted += 1;
                }
                Err(e) => {
                    tracing::error!(project_id = %project_id, error = %e, "Failed to delete expired project");
                    result.errors += 1;
                }
            }
        }
    }

    // Process tasks (that weren't part of deleted projects)
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
        projects = result.projects_deleted,
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
            projects_deleted: 5,
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
            projects_deleted: 10,
            tasks_deleted: 50,
            total_deleted: 63,
            errors: 0,
        };
        let json = serde_json::to_string(&result).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["workspaces_deleted"], 3);
        assert_eq!(parsed["projects_deleted"], 10);
        assert_eq!(parsed["tasks_deleted"], 50);
        assert_eq!(parsed["total_deleted"], 63);
        assert_eq!(parsed["errors"], 0);
    }

    #[test]
    fn test_trash_cleanup_result_zero_values() {
        let result = TrashCleanupResult {
            workspaces_deleted: 0,
            projects_deleted: 0,
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
            projects_deleted: 2,
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

    #[test]
    fn test_trash_cleanup_result_total_is_sum_of_parts() {
        let result = TrashCleanupResult {
            workspaces_deleted: 2,
            projects_deleted: 5,
            tasks_deleted: 20,
            total_deleted: 27,
            errors: 0,
        };
        assert_eq!(
            result.total_deleted,
            result.workspaces_deleted + result.projects_deleted + result.tasks_deleted,
            "total_deleted should equal sum of component counts"
        );
    }

    #[test]
    fn test_trash_cleanup_error_display_cleanup_variant() {
        let err = TrashCleanupError::Cleanup("permission denied".to_string());
        assert_eq!(format!("{}", err), "Cleanup error: permission denied");
    }

    #[test]
    fn test_trash_cleanup_error_debug_includes_variant() {
        let err = TrashCleanupError::Cleanup("some error".to_string());
        let debug = format!("{:?}", err);
        assert!(debug.contains("Cleanup"), "got: {}", debug);
        assert!(debug.contains("some error"), "got: {}", debug);
    }

    #[test]
    fn test_trash_retention_days_used_in_cutoff() {
        let now = Utc::now();
        let cutoff = now - Duration::days(TRASH_RETENTION_DAYS);
        // Cutoff should be approximately 30 days ago
        let diff_days = (now - cutoff).num_days();
        assert_eq!(diff_days, 30, "Cutoff should be exactly 30 days from now");
    }

    #[test]
    fn test_trash_cleanup_result_with_errors() {
        let result = TrashCleanupResult {
            workspaces_deleted: 1,
            projects_deleted: 3,
            tasks_deleted: 10,
            total_deleted: 14,
            errors: 5,
        };
        let json = serde_json::to_string(&result).expect("serialize");
        let parsed: serde_json::Value = serde_json::from_str(&json).expect("parse");
        assert_eq!(parsed["errors"], 5);
        assert_eq!(parsed["total_deleted"], 14);
    }
}
