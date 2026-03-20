use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use super::common::UserRole;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub name: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub avatar_url: Option<String>,
    pub phone_number: Option<String>,
    pub job_title: Option<String>,
    pub department: Option<String>,
    pub bio: Option<String>,
    pub role: UserRole,
    pub tenant_id: Uuid,
    pub onboarding_completed: bool,
    pub last_login_at: Option<DateTime<Utc>>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Safe for API responses — no password_hash or deleted_at
#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct UserPublic {
    pub id: Uuid,
    pub email: String,
    pub name: String,
    pub avatar_url: Option<String>,
    pub job_title: Option<String>,
    pub department: Option<String>,
    pub role: UserRole,
    pub tenant_id: Uuid,
    pub onboarding_completed: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct RefreshToken {
    pub id: Uuid,
    pub user_id: Uuid,
    pub token_hash: String,
    pub expires_at: DateTime<Utc>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub device_name: Option<String>,
    pub last_active_at: Option<DateTime<Utc>>,
    pub persistent: bool,
    pub created_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_user() -> User {
        let now = Utc::now();
        User {
            id: Uuid::new_v4(),
            email: "test@example.com".to_string(),
            name: "Test User".to_string(),
            password_hash: "$argon2id$v=19$m=19456,t=2,p=1$hash".to_string(),
            avatar_url: Some("https://example.com/avatar.png".to_string()),
            phone_number: None,
            job_title: None,
            department: None,
            bio: None,
            role: UserRole::Member,
            tenant_id: Uuid::new_v4(),
            onboarding_completed: false,
            last_login_at: None,
            deleted_at: None,
            created_at: now,
            updated_at: now,
        }
    }

    #[test]
    fn test_user_password_hash_skip_serializing() {
        let user = make_user();
        let json = serde_json::to_string(&user).unwrap();
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
    fn test_user_serde_fields_present() {
        let user = make_user();
        let val = serde_json::to_value(&user).unwrap();
        assert_eq!(val["email"], "test@example.com");
        assert_eq!(val["name"], "Test User");
        assert_eq!(val["onboarding_completed"], false);
        assert!(val.get("password_hash").is_none());
    }

    #[test]
    fn test_user_public_serde_roundtrip() {
        let now = Utc::now();
        let user_pub = UserPublic {
            id: Uuid::new_v4(),
            email: "public@example.com".to_string(),
            name: "Public User".to_string(),
            avatar_url: None,
            job_title: None,
            department: None,
            role: UserRole::Admin,
            tenant_id: Uuid::new_v4(),
            onboarding_completed: true,
            created_at: now,
        };
        let json = serde_json::to_string(&user_pub).unwrap();
        let deserialized: UserPublic = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, user_pub.id);
        assert_eq!(deserialized.email, "public@example.com");
        assert_eq!(deserialized.role, UserRole::Admin);
        assert!(deserialized.onboarding_completed);
    }

    #[test]
    fn test_user_public_has_no_password_field() {
        let now = Utc::now();
        let user_pub = UserPublic {
            id: Uuid::new_v4(),
            email: "safe@example.com".to_string(),
            name: "Safe".to_string(),
            avatar_url: None,
            job_title: None,
            department: None,
            role: UserRole::Member,
            tenant_id: Uuid::new_v4(),
            onboarding_completed: false,
            created_at: now,
        };
        let json = serde_json::to_string(&user_pub).unwrap();
        assert!(
            !json.contains("password"),
            "UserPublic must not contain password fields"
        );
    }

    #[test]
    fn test_refresh_token_serde_roundtrip() {
        let now = Utc::now();
        let token = RefreshToken {
            id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            token_hash: "hashed_token_value".to_string(),
            expires_at: now,
            revoked_at: None,
            ip_address: Some("192.168.1.1".to_string()),
            user_agent: Some("TestAgent/1.0".to_string()),
            device_name: Some("Test Device".to_string()),
            last_active_at: Some(now),
            persistent: false,
            created_at: now,
        };
        let json = serde_json::to_string(&token).unwrap();
        let deserialized: RefreshToken = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, token.id);
        assert_eq!(deserialized.token_hash, "hashed_token_value");
        assert!(deserialized.revoked_at.is_none());
        assert_eq!(deserialized.device_name, Some("Test Device".to_string()));
    }

    #[test]
    fn test_user_clone() {
        let user = make_user();
        let cloned = user.clone();
        assert_eq!(cloned.id, user.id);
        assert_eq!(cloned.email, user.email);
        assert_eq!(cloned.role, user.role);
    }
}
