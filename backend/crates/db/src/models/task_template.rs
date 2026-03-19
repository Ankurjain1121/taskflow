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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_task_template_serde_roundtrip() {
        let now = Utc::now();
        let template = TaskTemplate {
            id: Uuid::new_v4(),
            name: "Bug Report".to_string(),
            description: Some("Standard bug report template".to_string()),
            scope: "project".to_string(),
            project_id: Some(Uuid::new_v4()),
            tenant_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            task_title: "Bug: [title]".to_string(),
            task_description: Some("Steps to reproduce...".to_string()),
            task_priority: Some("high".to_string()),
            task_estimated_hours: Some(2.0),
            created_at: now,
            updated_at: now,
        };
        let json = serde_json::to_string(&template).unwrap();
        let deserialized: TaskTemplate = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.name, "Bug Report");
        assert_eq!(deserialized.scope, "project");
        assert_eq!(deserialized.task_title, "Bug: [title]");
        assert_eq!(deserialized.task_estimated_hours, Some(2.0));
    }

    #[test]
    fn test_task_template_workspace_scope() {
        let now = Utc::now();
        let template = TaskTemplate {
            id: Uuid::new_v4(),
            name: "Global Template".to_string(),
            description: None,
            scope: "workspace".to_string(),
            project_id: None,
            tenant_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            task_title: "Task".to_string(),
            task_description: None,
            task_priority: None,
            task_estimated_hours: None,
            created_at: now,
            updated_at: now,
        };
        let json = serde_json::to_string(&template).unwrap();
        let deserialized: TaskTemplate = serde_json::from_str(&json).unwrap();
        assert!(deserialized.project_id.is_none());
        assert!(deserialized.task_priority.is_none());
    }

    #[test]
    fn test_task_template_subtask_serde_roundtrip() {
        let subtask = TaskTemplateSubtask {
            id: Uuid::new_v4(),
            template_id: Uuid::new_v4(),
            title: "Write unit tests".to_string(),
            position: 0,
        };
        let json = serde_json::to_string(&subtask).unwrap();
        let deserialized: TaskTemplateSubtask = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.title, "Write unit tests");
        assert_eq!(deserialized.position, 0);
    }

    #[test]
    fn test_task_template_label_serde_roundtrip() {
        let label = TaskTemplateLabel {
            id: Uuid::new_v4(),
            template_id: Uuid::new_v4(),
            label_id: Uuid::new_v4(),
        };
        let json = serde_json::to_string(&label).unwrap();
        let deserialized: TaskTemplateLabel = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, label.id);
        assert_eq!(deserialized.label_id, label.label_id);
    }

    #[test]
    fn test_task_template_custom_field_serde_roundtrip() {
        let field = TaskTemplateCustomField {
            id: Uuid::new_v4(),
            template_id: Uuid::new_v4(),
            field_id: Uuid::new_v4(),
            value: Some("default_value".to_string()),
        };
        let json = serde_json::to_string(&field).unwrap();
        let deserialized: TaskTemplateCustomField = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.value, Some("default_value".to_string()));
    }

    #[test]
    fn test_task_template_custom_field_no_value() {
        let field = TaskTemplateCustomField {
            id: Uuid::new_v4(),
            template_id: Uuid::new_v4(),
            field_id: Uuid::new_v4(),
            value: None,
        };
        let json = serde_json::to_string(&field).unwrap();
        let deserialized: TaskTemplateCustomField = serde_json::from_str(&json).unwrap();
        assert!(deserialized.value.is_none());
    }
}
