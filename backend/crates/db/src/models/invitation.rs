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
}
