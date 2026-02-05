use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use super::common::BoardMemberRole;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct Board {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub slack_webhook_url: Option<String>,
    pub workspace_id: Uuid,
    pub tenant_id: Uuid,
    pub created_by_id: Uuid,
    pub deleted_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct BoardMember {
    pub id: Uuid,
    pub board_id: Uuid,
    pub user_id: Uuid,
    pub role: BoardMemberRole,
    pub joined_at: DateTime<Utc>,
}

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct BoardColumn {
    pub id: Uuid,
    pub name: String,
    pub board_id: Uuid,
    pub position: String,
    pub color: Option<String>,
    pub status_mapping: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}
