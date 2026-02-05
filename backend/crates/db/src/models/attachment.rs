use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct Attachment {
    pub id: Uuid,
    pub file_name: String,
    pub file_size: i64,
    pub mime_type: String,
    pub storage_key: String,
    pub task_id: Uuid,
    pub uploaded_by_id: Uuid,
    pub created_at: DateTime<Utc>,
}
