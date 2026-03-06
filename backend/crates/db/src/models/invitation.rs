use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use super::common::UserRole;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct Invitation {
    pub id: Uuid,
    pub email: String,
    pub workspace_id: Uuid,
    pub role: UserRole,
    pub token: Uuid,
    pub invited_by_id: Uuid,
    pub expires_at: DateTime<Utc>,
    pub accepted_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub message: Option<String>,
    pub project_ids: Option<serde_json::Value>,
    pub job_title: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_invitation_serde_roundtrip() {
        let now = Utc::now();
        let invitation = Invitation {
            id: Uuid::new_v4(),
            email: "invite@example.com".to_string(),
            workspace_id: Uuid::new_v4(),
            role: UserRole::Member,
            token: Uuid::new_v4(),
            invited_by_id: Uuid::new_v4(),
            expires_at: now,
            accepted_at: None,
            created_at: now,
            message: Some("Welcome to the team!".to_string()),
            project_ids: Some(serde_json::json!([Uuid::new_v4()])),
            job_title: None,
        };
        let json = serde_json::to_string(&invitation).unwrap();
        let deserialized: Invitation = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.email, "invite@example.com");
        assert_eq!(deserialized.role, UserRole::Member);
        assert!(deserialized.accepted_at.is_none());
        assert!(deserialized.message.is_some());
        assert!(deserialized.project_ids.is_some());
    }

    #[test]
    fn test_invitation_accepted() {
        let now = Utc::now();
        let invitation = Invitation {
            id: Uuid::new_v4(),
            email: "accepted@example.com".to_string(),
            workspace_id: Uuid::new_v4(),
            role: UserRole::Admin,
            token: Uuid::new_v4(),
            invited_by_id: Uuid::new_v4(),
            expires_at: now,
            accepted_at: Some(now),
            created_at: now,
            message: None,
            project_ids: None,
            job_title: None,
        };
        let json = serde_json::to_string(&invitation).unwrap();
        let deserialized: Invitation = serde_json::from_str(&json).unwrap();
        assert!(deserialized.accepted_at.is_some());
        assert!(deserialized.message.is_none());
        assert!(deserialized.project_ids.is_none());
    }
}
