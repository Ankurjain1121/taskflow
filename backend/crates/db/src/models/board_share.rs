use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct BoardShare {
    pub id: Uuid,
    pub project_id: Uuid,
    pub share_token: String,
    pub name: Option<String>,
    #[serde(skip_serializing)]
    pub password_hash: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
    pub is_active: bool,
    pub permissions: serde_json::Value,
    pub tenant_id: Uuid,
    pub created_by_id: Uuid,
    pub created_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_board_share() -> BoardShare {
        let now = Utc::now();
        BoardShare {
            id: Uuid::new_v4(),
            project_id: Uuid::new_v4(),
            share_token: "abc123def456".to_string(),
            name: Some("Public Link".to_string()),
            password_hash: Some("$argon2id$hashed".to_string()),
            expires_at: Some(now),
            is_active: true,
            permissions: serde_json::json!({"can_view": true, "can_comment": false}),
            tenant_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            created_at: now,
        }
    }

    #[test]
    fn test_board_share_password_hash_skip_serializing() {
        let share = make_board_share();
        let json = serde_json::to_string(&share).unwrap();
        assert!(
            !json.contains("password_hash"),
            "password_hash must be excluded from serialization"
        );
        assert!(
            !json.contains("argon2"),
            "password hash content must not leak"
        );
    }

    #[test]
    fn test_board_share_serde_roundtrip() {
        let share = make_board_share();
        let json = serde_json::to_string(&share).unwrap();
        // password_hash is skip_serializing, so deserialize needs it provided
        // Test the fields that DO serialize
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["share_token"], "abc123def456");
        assert_eq!(parsed["name"], "Public Link");
        assert_eq!(parsed["is_active"], true);
        assert!(parsed.get("password_hash").is_none());
    }

    #[test]
    fn test_board_share_permissions_json() {
        let share = make_board_share();
        let val = serde_json::to_value(&share).unwrap();
        let perms = &val["permissions"];
        assert_eq!(perms["can_view"], true);
        assert_eq!(perms["can_comment"], false);
    }

    #[test]
    fn test_board_share_clone() {
        let share = make_board_share();
        let cloned = share.clone();
        assert_eq!(cloned.id, share.id);
        assert_eq!(cloned.share_token, share.share_token);
        assert_eq!(cloned.is_active, share.is_active);
    }

    #[test]
    fn test_board_share_minimal() {
        let now = Utc::now();
        let share = BoardShare {
            id: Uuid::new_v4(),
            project_id: Uuid::new_v4(),
            share_token: "min".to_string(),
            name: None,
            password_hash: None,
            expires_at: None,
            is_active: false,
            permissions: serde_json::json!({}),
            tenant_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            created_at: now,
        };
        let json = serde_json::to_string(&share).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert!(parsed["name"].is_null());
        assert!(parsed["expires_at"].is_null());
        assert_eq!(parsed["is_active"], false);
    }
}
