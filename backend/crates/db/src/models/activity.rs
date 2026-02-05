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
