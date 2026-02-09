use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct Milestone {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub due_date: Option<DateTime<Utc>>,
    pub color: String,
    pub board_id: Uuid,
    pub tenant_id: Uuid,
    pub created_by_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
