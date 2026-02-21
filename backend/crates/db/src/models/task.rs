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
    pub group_id: Option<Uuid>,
    pub position: String,
    pub milestone_id: Option<Uuid>,
    pub eisenhower_urgency: Option<bool>,
    pub eisenhower_importance: Option<bool>,
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

#[cfg(test)]
mod tests {
    use super::*;

    fn make_task() -> Task {
        let now = Utc::now();
        Task {
            id: Uuid::new_v4(),
            title: "Test Task".to_string(),
            description: Some("A description".to_string()),
            priority: TaskPriority::Medium,
            due_date: Some(now),
            start_date: None,
            estimated_hours: Some(2.5),
            board_id: Uuid::new_v4(),
            column_id: Uuid::new_v4(),
            group_id: None,
            position: "a0".to_string(),
            milestone_id: None,
            eisenhower_urgency: Some(true),
            eisenhower_importance: Some(false),
            tenant_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            deleted_at: None,
            created_at: now,
            updated_at: now,
        }
    }

    #[test]
    fn test_task_serde_roundtrip() {
        let task = make_task();
        let json = serde_json::to_string(&task).unwrap();
        let deserialized: Task = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, task.id);
        assert_eq!(deserialized.title, task.title);
        assert_eq!(deserialized.priority, task.priority);
        assert_eq!(deserialized.estimated_hours, Some(2.5));
    }

    #[test]
    fn test_task_with_none_optional_fields() {
        let now = Utc::now();
        let task = Task {
            id: Uuid::new_v4(),
            title: "Minimal".to_string(),
            description: None,
            priority: TaskPriority::Low,
            due_date: None,
            start_date: None,
            estimated_hours: None,
            board_id: Uuid::new_v4(),
            column_id: Uuid::new_v4(),
            group_id: None,
            position: "z9".to_string(),
            milestone_id: None,
            eisenhower_urgency: None,
            eisenhower_importance: None,
            tenant_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            deleted_at: None,
            created_at: now,
            updated_at: now,
        };
        let json = serde_json::to_string(&task).unwrap();
        let deserialized: Task = serde_json::from_str(&json).unwrap();
        assert!(deserialized.description.is_none());
        assert!(deserialized.due_date.is_none());
        assert!(deserialized.eisenhower_urgency.is_none());
    }

    #[test]
    fn test_task_json_field_names() {
        let task = make_task();
        let json = serde_json::to_string(&task).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert!(parsed.get("id").is_some());
        assert!(parsed.get("title").is_some());
        assert!(parsed.get("priority").is_some());
        assert!(parsed.get("board_id").is_some());
        assert!(parsed.get("column_id").is_some());
        assert!(parsed.get("position").is_some());
        assert!(parsed.get("tenant_id").is_some());
        assert!(parsed.get("created_by_id").is_some());
        assert!(parsed.get("eisenhower_urgency").is_some());
        assert!(parsed.get("eisenhower_importance").is_some());
    }

    #[test]
    fn test_task_clone() {
        let task = make_task();
        let cloned = task.clone();
        assert_eq!(cloned.id, task.id);
        assert_eq!(cloned.title, task.title);
        assert_eq!(cloned.priority, task.priority);
    }

    #[test]
    fn test_task_assignee_serde_roundtrip() {
        let now = Utc::now();
        let assignee = TaskAssignee {
            id: Uuid::new_v4(),
            task_id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            assigned_at: now,
        };
        let json = serde_json::to_string(&assignee).unwrap();
        let deserialized: TaskAssignee = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, assignee.id);
        assert_eq!(deserialized.task_id, assignee.task_id);
        assert_eq!(deserialized.user_id, assignee.user_id);
    }

    #[test]
    fn test_label_serde_roundtrip() {
        let label = Label {
            id: Uuid::new_v4(),
            name: "Bug".to_string(),
            color: "#ff0000".to_string(),
            board_id: Uuid::new_v4(),
        };
        let json = serde_json::to_string(&label).unwrap();
        let deserialized: Label = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.name, "Bug");
        assert_eq!(deserialized.color, "#ff0000");
    }

    #[test]
    fn test_task_label_serde_roundtrip() {
        let tl = TaskLabel {
            id: Uuid::new_v4(),
            task_id: Uuid::new_v4(),
            label_id: Uuid::new_v4(),
        };
        let json = serde_json::to_string(&tl).unwrap();
        let deserialized: TaskLabel = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, tl.id);
        assert_eq!(deserialized.task_id, tl.task_id);
        assert_eq!(deserialized.label_id, tl.label_id);
    }
}
