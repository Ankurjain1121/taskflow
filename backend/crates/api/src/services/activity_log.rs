//! Activity Log Service
//!
//! Provides convenience methods for recording activity log entries for task mutations.
//! All methods use the ActivityAction enum matching the pgEnum from S01.

use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

use taskflow_db::models::ActivityAction;
use taskflow_db::queries::activity_log::{insert_activity_log, ActivityLogWithActor};

/// Error type for activity log service operations
#[derive(Debug, thiserror::Error)]
pub enum ActivityLogError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
}

/// Parameters for recording an activity log entry
pub struct RecordParams {
    pub task_id: Uuid,
    pub actor_id: Uuid,
    pub action: ActivityAction,
    pub metadata: Option<serde_json::Value>,
    pub tenant_id: Uuid,
}

/// Service for recording activity log entries
pub struct ActivityLogService;

impl ActivityLogService {
    /// Record a generic activity log entry
    ///
    /// # Arguments
    /// * `pool` - Database connection pool
    /// * `params` - Parameters for the log entry
    pub async fn record(
        pool: &PgPool,
        params: RecordParams,
    ) -> Result<ActivityLogWithActor, ActivityLogError> {
        let entry = insert_activity_log(
            pool,
            params.task_id,
            params.actor_id,
            params.action,
            params.metadata,
            params.tenant_id,
        )
        .await?;

        Ok(entry)
    }

    /// Record a task created event
    pub async fn record_created(
        pool: &PgPool,
        task_id: Uuid,
        actor_id: Uuid,
        tenant_id: Uuid,
    ) -> Result<ActivityLogWithActor, ActivityLogError> {
        Self::record(
            pool,
            RecordParams {
                task_id,
                actor_id,
                action: ActivityAction::Created,
                metadata: None,
                tenant_id,
            },
        )
        .await
    }

    /// Record a task moved event
    ///
    /// Stores from_column and to_column names in metadata
    pub async fn record_moved(
        pool: &PgPool,
        task_id: Uuid,
        actor_id: Uuid,
        tenant_id: Uuid,
        from_column: &str,
        to_column: &str,
    ) -> Result<ActivityLogWithActor, ActivityLogError> {
        Self::record(
            pool,
            RecordParams {
                task_id,
                actor_id,
                action: ActivityAction::Moved,
                metadata: Some(json!({
                    "from_column": from_column,
                    "to_column": to_column
                })),
                tenant_id,
            },
        )
        .await
    }

    /// Record a user assigned event
    ///
    /// Stores assignee_id and assignee_name in metadata
    pub async fn record_assigned(
        pool: &PgPool,
        task_id: Uuid,
        actor_id: Uuid,
        tenant_id: Uuid,
        assignee_id: Uuid,
        assignee_name: &str,
    ) -> Result<ActivityLogWithActor, ActivityLogError> {
        Self::record(
            pool,
            RecordParams {
                task_id,
                actor_id,
                action: ActivityAction::Assigned,
                metadata: Some(json!({
                    "assignee_id": assignee_id,
                    "assignee_name": assignee_name
                })),
                tenant_id,
            },
        )
        .await
    }

    /// Record a user unassigned event
    ///
    /// Stores previous_assignee_id and previous_assignee_name in metadata
    pub async fn record_unassigned(
        pool: &PgPool,
        task_id: Uuid,
        actor_id: Uuid,
        tenant_id: Uuid,
        previous_assignee_id: Uuid,
        previous_assignee_name: &str,
    ) -> Result<ActivityLogWithActor, ActivityLogError> {
        Self::record(
            pool,
            RecordParams {
                task_id,
                actor_id,
                action: ActivityAction::Unassigned,
                metadata: Some(json!({
                    "previous_assignee_id": previous_assignee_id,
                    "previous_assignee_name": previous_assignee_name
                })),
                tenant_id,
            },
        )
        .await
    }

    /// Record a comment added event
    ///
    /// Stores comment_id in metadata
    pub async fn record_commented(
        pool: &PgPool,
        task_id: Uuid,
        actor_id: Uuid,
        tenant_id: Uuid,
        comment_id: Uuid,
    ) -> Result<ActivityLogWithActor, ActivityLogError> {
        Self::record(
            pool,
            RecordParams {
                task_id,
                actor_id,
                action: ActivityAction::Commented,
                metadata: Some(json!({
                    "comment_id": comment_id
                })),
                tenant_id,
            },
        )
        .await
    }

    /// Record an attachment added event
    ///
    /// Stores file_name and file_size in metadata
    pub async fn record_attachment_added(
        pool: &PgPool,
        task_id: Uuid,
        actor_id: Uuid,
        tenant_id: Uuid,
        file_name: &str,
        file_size: i64,
    ) -> Result<ActivityLogWithActor, ActivityLogError> {
        Self::record(
            pool,
            RecordParams {
                task_id,
                actor_id,
                action: ActivityAction::Attached,
                metadata: Some(json!({
                    "file_name": file_name,
                    "file_size": file_size
                })),
                tenant_id,
            },
        )
        .await
    }

    /// Record an attachment removed event
    ///
    /// Stores file_name in metadata
    pub async fn record_attachment_removed(
        pool: &PgPool,
        task_id: Uuid,
        actor_id: Uuid,
        tenant_id: Uuid,
        file_name: &str,
    ) -> Result<ActivityLogWithActor, ActivityLogError> {
        Self::record(
            pool,
            RecordParams {
                task_id,
                actor_id,
                action: ActivityAction::Deleted,
                metadata: Some(json!({
                    "type": "attachment",
                    "file_name": file_name
                })),
                tenant_id,
            },
        )
        .await
    }

    /// Record a task updated event
    ///
    /// Generic update event with optional field changes in metadata
    pub async fn record_updated(
        pool: &PgPool,
        task_id: Uuid,
        actor_id: Uuid,
        tenant_id: Uuid,
        changed_fields: Option<serde_json::Value>,
    ) -> Result<ActivityLogWithActor, ActivityLogError> {
        Self::record(
            pool,
            RecordParams {
                task_id,
                actor_id,
                action: ActivityAction::Updated,
                metadata: changed_fields,
                tenant_id,
            },
        )
        .await
    }

    /// Record a status changed event
    pub async fn record_status_changed(
        pool: &PgPool,
        task_id: Uuid,
        actor_id: Uuid,
        tenant_id: Uuid,
        from_status: &str,
        to_status: &str,
    ) -> Result<ActivityLogWithActor, ActivityLogError> {
        Self::record(
            pool,
            RecordParams {
                task_id,
                actor_id,
                action: ActivityAction::StatusChanged,
                metadata: Some(json!({
                    "from_status": from_status,
                    "to_status": to_status
                })),
                tenant_id,
            },
        )
        .await
    }

    /// Record a priority changed event
    pub async fn record_priority_changed(
        pool: &PgPool,
        task_id: Uuid,
        actor_id: Uuid,
        tenant_id: Uuid,
        from_priority: &str,
        to_priority: &str,
    ) -> Result<ActivityLogWithActor, ActivityLogError> {
        Self::record(
            pool,
            RecordParams {
                task_id,
                actor_id,
                action: ActivityAction::PriorityChanged,
                metadata: Some(json!({
                    "from_priority": from_priority,
                    "to_priority": to_priority
                })),
                tenant_id,
            },
        )
        .await
    }

    /// Record a task deleted event
    pub async fn record_deleted(
        pool: &PgPool,
        task_id: Uuid,
        actor_id: Uuid,
        tenant_id: Uuid,
    ) -> Result<ActivityLogWithActor, ActivityLogError> {
        Self::record(
            pool,
            RecordParams {
                task_id,
                actor_id,
                action: ActivityAction::Deleted,
                metadata: None,
                tenant_id,
            },
        )
        .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_record_params_creation() {
        let params = RecordParams {
            task_id: Uuid::new_v4(),
            actor_id: Uuid::new_v4(),
            action: ActivityAction::Created,
            metadata: None,
            tenant_id: Uuid::new_v4(),
        };
        assert!(matches!(params.action, ActivityAction::Created));
    }

    #[test]
    fn test_record_params_with_metadata() {
        let metadata = json!({"key": "value"});
        let params = RecordParams {
            task_id: Uuid::new_v4(),
            actor_id: Uuid::new_v4(),
            action: ActivityAction::Updated,
            metadata: Some(metadata.clone()),
            tenant_id: Uuid::new_v4(),
        };
        assert!(params.metadata.is_some());
        assert_eq!(params.metadata.expect("metadata present")["key"], "value");
    }

    #[test]
    fn test_metadata_json_structure_moved() {
        let metadata = json!({
            "from_column": "To Do",
            "to_column": "In Progress"
        });
        assert_eq!(metadata["from_column"], "To Do");
        assert_eq!(metadata["to_column"], "In Progress");
    }

    #[test]
    fn test_metadata_json_structure_assigned() {
        let assignee_id = Uuid::new_v4();
        let metadata = json!({
            "assignee_id": assignee_id,
            "assignee_name": "Alice Johnson"
        });
        assert_eq!(metadata["assignee_name"], "Alice Johnson");
        assert_eq!(
            metadata["assignee_id"].as_str().expect("should be string"),
            assignee_id.to_string()
        );
    }

    #[test]
    fn test_metadata_json_structure_unassigned() {
        let prev_id = Uuid::new_v4();
        let metadata = json!({
            "previous_assignee_id": prev_id,
            "previous_assignee_name": "Bob Smith"
        });
        assert_eq!(metadata["previous_assignee_name"], "Bob Smith");
        assert_eq!(
            metadata["previous_assignee_id"]
                .as_str()
                .expect("should be string"),
            prev_id.to_string()
        );
    }

    #[test]
    fn test_metadata_json_structure_commented() {
        let comment_id = Uuid::new_v4();
        let metadata = json!({
            "comment_id": comment_id
        });
        assert_eq!(
            metadata["comment_id"].as_str().expect("should be string"),
            comment_id.to_string()
        );
    }

    #[test]
    fn test_metadata_json_structure_attachment_added() {
        let metadata = json!({
            "file_name": "report.pdf",
            "file_size": 1048576_i64
        });
        assert_eq!(metadata["file_name"], "report.pdf");
        assert_eq!(metadata["file_size"], 1048576);
    }

    #[test]
    fn test_metadata_json_structure_attachment_removed() {
        let metadata = json!({
            "type": "attachment",
            "file_name": "old-file.docx"
        });
        assert_eq!(metadata["type"], "attachment");
        assert_eq!(metadata["file_name"], "old-file.docx");
    }

    #[test]
    fn test_metadata_json_structure_status_changed() {
        let metadata = json!({
            "from_status": "open",
            "to_status": "closed"
        });
        assert_eq!(metadata["from_status"], "open");
        assert_eq!(metadata["to_status"], "closed");
    }

    #[test]
    fn test_metadata_json_structure_priority_changed() {
        let metadata = json!({
            "from_priority": "low",
            "to_priority": "high"
        });
        assert_eq!(metadata["from_priority"], "low");
        assert_eq!(metadata["to_priority"], "high");
    }

    #[test]
    fn test_activity_log_error_display() {
        let err = ActivityLogError::Database(sqlx::Error::RowNotFound);
        let msg = format!("{}", err);
        assert!(msg.contains("Database error"), "got: {}", msg);
    }

    #[test]
    fn test_activity_log_error_debug() {
        let err = ActivityLogError::Database(sqlx::Error::RowNotFound);
        let debug = format!("{:?}", err);
        assert!(debug.contains("Database"), "got: {}", debug);
    }

    #[test]
    fn test_record_params_all_actions() {
        let actions = vec![
            ActivityAction::Created,
            ActivityAction::Updated,
            ActivityAction::Deleted,
            ActivityAction::Moved,
            ActivityAction::Assigned,
            ActivityAction::Unassigned,
            ActivityAction::Commented,
            ActivityAction::Attached,
            ActivityAction::StatusChanged,
            ActivityAction::PriorityChanged,
        ];

        for action in actions {
            let params = RecordParams {
                task_id: Uuid::new_v4(),
                actor_id: Uuid::new_v4(),
                action,
                metadata: None,
                tenant_id: Uuid::new_v4(),
            };
            // Just verify the struct can be created with each action variant
            let _ = format!("{:?}", params.task_id);
        }
    }
}
