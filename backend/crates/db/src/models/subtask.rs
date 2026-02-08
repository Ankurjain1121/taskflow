use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct Subtask {
    pub id: Uuid,
    pub title: String,
    pub is_completed: bool,
    pub position: String,
    pub task_id: Uuid,
    pub created_by_id: Uuid,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
