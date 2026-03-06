use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use super::common::ActivityAction;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct ActivityLog {
    pub id: Uuid,
    pub action: ActivityAction,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub user_id: Uuid,
    pub metadata: Option<serde_json::Value>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub tenant_id: Uuid,
    pub created_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_activity_log_serde_roundtrip() {
        let now = Utc::now();
        let log = ActivityLog {
            id: Uuid::new_v4(),
            action: ActivityAction::Created,
            entity_type: "task".to_string(),
            entity_id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            metadata: Some(serde_json::json!({"field": "title", "old": "A", "new": "B"})),
            ip_address: Some("192.168.1.1".to_string()),
            user_agent: Some("Mozilla/5.0".to_string()),
            tenant_id: Uuid::new_v4(),
            created_at: now,
        };
        let json = serde_json::to_string(&log).unwrap();
        let deserialized: ActivityLog = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, log.id);
        assert_eq!(deserialized.entity_type, "task");
        assert_eq!(deserialized.ip_address, Some("192.168.1.1".to_string()));
    }

    #[test]
    fn test_activity_log_with_none_fields() {
        let now = Utc::now();
        let log = ActivityLog {
            id: Uuid::new_v4(),
            action: ActivityAction::Deleted,
            entity_type: "board".to_string(),
            entity_id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            metadata: None,
            ip_address: None,
            user_agent: None,
            tenant_id: Uuid::new_v4(),
            created_at: now,
        };
        let json = serde_json::to_string(&log).unwrap();
        let deserialized: ActivityLog = serde_json::from_str(&json).unwrap();
        assert!(deserialized.metadata.is_none());
        assert!(deserialized.ip_address.is_none());
        assert!(deserialized.user_agent.is_none());
    }

    #[test]
    fn test_activity_log_json_field_names() {
        let now = Utc::now();
        let log = ActivityLog {
            id: Uuid::new_v4(),
            action: ActivityAction::Moved,
            entity_type: "task".to_string(),
            entity_id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            metadata: None,
            ip_address: None,
            user_agent: None,
            tenant_id: Uuid::new_v4(),
            created_at: now,
        };
        let json = serde_json::to_string(&log).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert!(parsed.get("id").is_some());
        assert!(parsed.get("action").is_some());
        assert!(parsed.get("entity_type").is_some());
        assert!(parsed.get("entity_id").is_some());
        assert!(parsed.get("user_id").is_some());
        assert!(parsed.get("tenant_id").is_some());
        assert!(parsed.get("created_at").is_some());
    }

    #[test]
    fn test_activity_log_clone() {
        let now = Utc::now();
        let log = ActivityLog {
            id: Uuid::new_v4(),
            action: ActivityAction::Commented,
            entity_type: "task".to_string(),
            entity_id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            metadata: Some(serde_json::json!({"comment": "hello"})),
            ip_address: Some("10.0.0.1".to_string()),
            user_agent: None,
            tenant_id: Uuid::new_v4(),
            created_at: now,
        };
        let cloned = log.clone();
        assert_eq!(cloned.id, log.id);
        assert_eq!(cloned.action, log.action);
        assert_eq!(cloned.metadata, log.metadata);
    }
}
