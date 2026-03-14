use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use super::common::TaskPriority;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct ProjectTemplate {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub is_public: bool,
    pub tenant_id: Uuid,
    pub created_by_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct ProjectTemplateColumn {
    pub id: Uuid,
    pub template_id: Uuid,
    pub name: String,
    pub position: i32,
    pub color: Option<String>,
}

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct ProjectTemplateTask {
    pub id: Uuid,
    pub template_id: Uuid,
    pub column_index: i32,
    pub title: String,
    pub description: Option<String>,
    pub priority: TaskPriority,
    pub position: i32,
}
