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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_project_template_serde_roundtrip() {
        let now = Utc::now();
        let template = ProjectTemplate {
            id: Uuid::new_v4(),
            name: "Agile Board".to_string(),
            description: Some("Standard agile workflow".to_string()),
            category: Some("engineering".to_string()),
            is_public: true,
            tenant_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            created_at: now,
            updated_at: now,
        };
        let json = serde_json::to_string(&template).unwrap();
        let deserialized: ProjectTemplate = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, template.id);
        assert_eq!(deserialized.name, "Agile Board");
        assert!(deserialized.is_public);
        assert_eq!(deserialized.category, Some("engineering".to_string()));
    }

    #[test]
    fn test_project_template_minimal() {
        let now = Utc::now();
        let template = ProjectTemplate {
            id: Uuid::new_v4(),
            name: "Blank".to_string(),
            description: None,
            category: None,
            is_public: false,
            tenant_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            created_at: now,
            updated_at: now,
        };
        let json = serde_json::to_string(&template).unwrap();
        let deserialized: ProjectTemplate = serde_json::from_str(&json).unwrap();
        assert!(deserialized.description.is_none());
        assert!(deserialized.category.is_none());
        assert!(!deserialized.is_public);
    }

    #[test]
    fn test_project_template_column_serde_roundtrip() {
        let col = ProjectTemplateColumn {
            id: Uuid::new_v4(),
            template_id: Uuid::new_v4(),
            name: "To Do".to_string(),
            position: 0,
            color: Some("#3B82F6".to_string()),
        };
        let json = serde_json::to_string(&col).unwrap();
        let deserialized: ProjectTemplateColumn = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.name, "To Do");
        assert_eq!(deserialized.position, 0);
        assert_eq!(deserialized.color, Some("#3B82F6".to_string()));
    }

    #[test]
    fn test_project_template_task_serde_roundtrip() {
        let task = ProjectTemplateTask {
            id: Uuid::new_v4(),
            template_id: Uuid::new_v4(),
            column_index: 1,
            title: "Review PR".to_string(),
            description: Some("Code review".to_string()),
            priority: TaskPriority::High,
            position: 0,
        };
        let json = serde_json::to_string(&task).unwrap();
        let deserialized: ProjectTemplateTask = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.title, "Review PR");
        assert_eq!(deserialized.column_index, 1);
        assert_eq!(deserialized.priority, TaskPriority::High);
    }
}
