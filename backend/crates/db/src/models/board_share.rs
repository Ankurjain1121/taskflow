use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct BoardShare {
    pub id: Uuid,
    pub board_id: Uuid,
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
