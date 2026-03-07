use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::models::common::CustomFieldType;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct BoardCustomField {
    pub id: Uuid,
    pub project_id: Uuid,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_board_custom_field_serde_roundtrip() {
        let now = Utc::now();
        let field = BoardCustomField {
            id: Uuid::new_v4(),
            project_id: Uuid::new_v4(),
            name: "Story Points".to_string(),
            field_type: CustomFieldType::Number,
            options: None,
            is_required: false,
            position: 0,
            tenant_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            created_at: now,
            updated_at: now,
        };
        let json = serde_json::to_string(&field).unwrap();
        let deserialized: BoardCustomField = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.name, "Story Points");
        assert_eq!(deserialized.field_type, CustomFieldType::Number);
        assert!(!deserialized.is_required);
    }

    #[test]
    fn test_board_custom_field_with_dropdown_options() {
        let now = Utc::now();
        let field = BoardCustomField {
            id: Uuid::new_v4(),
            project_id: Uuid::new_v4(),
            name: "Status".to_string(),
            field_type: CustomFieldType::Dropdown,
            options: Some(serde_json::json!(["Open", "Closed", "Pending"])),
            is_required: true,
            position: 1,
            tenant_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            created_at: now,
            updated_at: now,
        };
        let json = serde_json::to_string(&field).unwrap();
        let deserialized: BoardCustomField = serde_json::from_str(&json).unwrap();
        assert!(deserialized.is_required);
        assert!(deserialized.options.is_some());
        let opts = deserialized.options.unwrap();
        assert_eq!(opts.as_array().unwrap().len(), 3);
    }

    #[test]
    fn test_task_custom_field_value_serde_roundtrip() {
        let now = Utc::now();
        let value = TaskCustomFieldValue {
            id: Uuid::new_v4(),
            task_id: Uuid::new_v4(),
            field_id: Uuid::new_v4(),
            value_text: Some("Hello".to_string()),
            value_number: None,
            value_date: None,
            value_bool: None,
            created_at: now,
            updated_at: now,
        };
        let json = serde_json::to_string(&value).unwrap();
        let deserialized: TaskCustomFieldValue = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.value_text, Some("Hello".to_string()));
        assert!(deserialized.value_number.is_none());
    }
}
