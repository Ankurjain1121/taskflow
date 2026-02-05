use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct Tenant {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub plan: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
