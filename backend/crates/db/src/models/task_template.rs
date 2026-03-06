use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct TaskTemplate {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub scope: String,
    pub project_id: Option<Uuid>,
    pub tenant_id: Uuid,
    pub created_by_id: Uuid,
    pub task_title: String,
    pub task_description: Option<String>,
    pub task_priority: Option<String>,
    pub task_estimated_hours: Option<f64>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct TaskTemplateSubtask {
    pub id: Uuid,
    pub template_id: Uuid,
    pub title: String,
    pub position: i32,
}

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct TaskTemplateLabel {
    pub id: Uuid,
    pub template_id: Uuid,
    pub label_id: Uuid,
}

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct TaskTemplateCustomField {
    pub id: Uuid,
    pub template_id: Uuid,
    pub field_id: Uuid,
    pub value: Option<String>,
}
