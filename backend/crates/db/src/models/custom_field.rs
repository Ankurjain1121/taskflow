use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::models::common::CustomFieldType;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct BoardCustomField {
    pub id: Uuid,
    pub board_id: Uuid,
    pub name: String,
    pub field_type: CustomFieldType,
    pub options: Option<serde_json::Value>,
    pub is_required: bool,
    pub position: i32,
    pub tenant_id: Uuid,
    pub created_by_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct TaskCustomFieldValue {
    pub id: Uuid,
    pub task_id: Uuid,
    pub field_id: Uuid,
    pub value_text: Option<String>,
    pub value_number: Option<f64>,
    pub value_date: Option<DateTime<Utc>>,
    pub value_bool: Option<bool>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
