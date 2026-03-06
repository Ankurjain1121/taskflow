//! Bulk operation audit model for tracking and undo support.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct BulkOperation {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub board_id: Uuid,
    pub user_id: Uuid,
    pub action_type: String,
    pub action_config: serde_json::Value,
    pub affected_task_ids: Vec<Uuid>,
    pub changes_summary: serde_json::Value,
    pub task_count: i32,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bulk_operation_serde_roundtrip() {
        let now = Utc::now();
        let op = BulkOperation {
            id: Uuid::new_v4(),
            workspace_id: Uuid::new_v4(),
            board_id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            action_type: "bulk_update".to_string(),
            action_config: serde_json::json!({"priority": "high"}),
            affected_task_ids: vec![Uuid::new_v4(), Uuid::new_v4()],
            changes_summary: serde_json::json!({"updated": 2}),
            task_count: 2,
            created_at: now,
            expires_at: now,
        };
        let json = serde_json::to_string(&op).expect("serialize");
        let deserialized: BulkOperation = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(deserialized.id, op.id);
        assert_eq!(deserialized.action_type, "bulk_update");
        assert_eq!(deserialized.task_count, 2);
        assert_eq!(deserialized.affected_task_ids.len(), 2);
    }

    #[test]
    fn test_bulk_operation_clone() {
        let now = Utc::now();
        let op = BulkOperation {
            id: Uuid::new_v4(),
            workspace_id: Uuid::new_v4(),
            board_id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            action_type: "bulk_delete".to_string(),
            action_config: serde_json::json!({}),
            affected_task_ids: vec![],
            changes_summary: serde_json::json!({}),
            task_count: 0,
            created_at: now,
            expires_at: now,
        };
        let cloned = op.clone();
        assert_eq!(cloned.id, op.id);
        assert_eq!(cloned.action_type, op.action_type);
    }
}
