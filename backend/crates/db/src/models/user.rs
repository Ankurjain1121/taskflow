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
    pub created_at: DateTime<Utc>,
}
