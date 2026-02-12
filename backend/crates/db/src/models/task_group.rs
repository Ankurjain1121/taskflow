use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct TaskGroup {
    pub id: Uuid,
    pub board_id: Uuid,
    pub name: String,
    pub color: String,
    pub position: String,
    pub collapsed: bool,
    pub tenant_id: Uuid,
    pub created_by_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Deserialize, Debug)]
pub struct CreateTaskGroupRequest {
    pub board_id: Uuid,
    pub name: String,
    #[serde(default = "default_color")]
    pub color: String,
    pub position: String,
}

#[derive(Deserialize, Debug)]
pub struct UpdateTaskGroupRequest {
    pub name: Option<String>,
    pub color: Option<String>,
    pub position: Option<String>,
    pub collapsed: Option<bool>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct TaskGroupWithStats {
    pub group: TaskGroup,
    pub task_count: i64,
    pub completed_count: i64,
    pub estimated_hours: Option<f64>,
}

fn default_color() -> String {
    "#6366f1".to_string()
}
