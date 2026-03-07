use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct TaskList {
    pub id: Uuid,
    pub project_id: Uuid,
    pub name: String,
    pub color: Option<String>,
    pub position: String,
    pub is_default: bool,
    pub collapsed: Option<bool>,
    pub tenant_id: Uuid,
    pub created_by_id: Uuid,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub deleted_at: Option<DateTime<Utc>>,
}

// Alias for backward compat within crate
pub type TaskGroup = TaskList;

#[derive(Deserialize, Debug)]
pub struct CreateTaskListRequest {
    pub project_id: Uuid,
    pub name: String,
    #[serde(default = "default_color")]
    pub color: String,
    pub position: String,
}

// Alias for callers that still use old name
pub type CreateTaskGroupRequest = CreateTaskListRequest;

#[derive(Deserialize, Debug)]
pub struct UpdateTaskListRequest {
    pub name: Option<String>,
    pub color: Option<String>,
    pub position: Option<String>,
    pub collapsed: Option<bool>,
}

pub type UpdateTaskGroupRequest = UpdateTaskListRequest;

#[derive(Serialize, Deserialize, Debug)]
pub struct TaskListWithStats {
    pub list: TaskList,
    pub task_count: i64,
    pub completed_count: i64,
    pub estimated_hours: Option<f64>,
}

pub type TaskGroupWithStats = TaskListWithStats;

fn default_color() -> String {
    "#6366f1".to_string()
}
