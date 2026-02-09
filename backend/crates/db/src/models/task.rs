use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use super::common::TaskPriority;

/// NOTE: No `status` field — status is derived from the column's statusMapping
#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct Task {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub priority: TaskPriority,
    pub due_date: Option<DateTime<Utc>>,
    pub start_date: Option<DateTime<Utc>>,
    pub estimated_hours: Option<f64>,
    pub board_id: Uuid,
    pub column_id: Uuid,
    pub position: String,
    pub milestone_id: Option<Uuid>,
    pub tenant_id: Uuid,
    pub created_by_id: Uuid,
    pub deleted_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct TaskAssignee {
    pub id: Uuid,
    pub task_id: Uuid,
    pub user_id: Uuid,
    pub assigned_at: DateTime<Utc>,
}

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct Label {
    pub id: Uuid,
    pub name: String,
    pub color: String,
    pub board_id: Uuid,
}

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct TaskLabel {
    pub id: Uuid,
    pub task_id: Uuid,
    pub label_id: Uuid,
}
