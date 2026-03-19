use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct WorkspaceApiKey {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub name: String,
    #[serde(skip_serializing)]
    pub key_hash: String,
    pub key_prefix: String,
    pub created_by_id: Uuid,
    pub last_used_at: Option<DateTime<Utc>>,
    pub expires_at: Option<DateTime<Utc>>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_api_key() -> WorkspaceApiKey {
        let now = Utc::now();
        WorkspaceApiKey {
            id: Uuid::new_v4(),
            workspace_id: Uuid::new_v4(),
            name: "CI/CD Key".to_string(),
            key_hash: "sha256:abcdef1234567890".to_string(),
            key_prefix: "tf_live_abc".to_string(),
            created_by_id: Uuid::new_v4(),
            last_used_at: Some(now),
            expires_at: Some(now),
            revoked_at: None,
            created_at: now,
        }
    }

    #[test]
    fn test_workspace_api_key_hash_skip_serializing() {
        let key = make_api_key();
        let json = serde_json::to_string(&key).unwrap();
        assert!(
            !json.contains("key_hash"),
            "key_hash must be excluded from serialization"
        );
        assert!(
            !json.contains("sha256:abcdef"),
            "key hash content must not leak"
        );
    }

    #[test]
    fn test_workspace_api_key_serde_fields() {
        let key = make_api_key();
        let parsed: serde_json::Value = serde_json::to_value(&key).unwrap();
        assert_eq!(parsed["name"], "CI/CD Key");
        assert_eq!(parsed["key_prefix"], "tf_live_abc");
        assert!(parsed.get("key_hash").is_none());
        assert!(parsed.get("last_used_at").is_some());
        assert!(parsed.get("expires_at").is_some());
    }

    #[test]
    fn test_workspace_api_key_revoked() {
        let now = Utc::now();
        let key = WorkspaceApiKey {
            id: Uuid::new_v4(),
            workspace_id: Uuid::new_v4(),
            name: "Revoked Key".to_string(),
            key_hash: "hash".to_string(),
            key_prefix: "tf_test_".to_string(),
            created_by_id: Uuid::new_v4(),
            last_used_at: None,
            expires_at: None,
            revoked_at: Some(now),
            created_at: now,
        };
        let json = serde_json::to_string(&key).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert!(parsed["revoked_at"].is_string());
        assert!(parsed["last_used_at"].is_null());
        assert!(parsed["expires_at"].is_null());
    }

    #[test]
    fn test_workspace_api_key_clone() {
        let key = make_api_key();
        let cloned = key.clone();
        assert_eq!(cloned.id, key.id);
        assert_eq!(cloned.name, key.name);
        assert_eq!(cloned.key_prefix, key.key_prefix);
    }
}
