use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct Comment {
    pub id: Uuid,
    pub content: String,
    pub task_id: Uuid,
    pub author_id: Uuid,
    pub parent_id: Option<Uuid>,
    pub mentioned_user_ids: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
