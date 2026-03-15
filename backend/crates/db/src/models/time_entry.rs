use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct TimeEntry {
    pub id: Uuid,
    pub task_id: Uuid,
    pub user_id: Uuid,
    pub description: Option<String>,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub duration_minutes: Option<i32>,
    pub is_running: bool,
    pub project_id: Uuid,
    pub tenant_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub is_billable: bool,
}
