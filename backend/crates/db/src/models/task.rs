use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use super::common::TaskPriority;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct Task {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub priority: TaskPriority,
    pub due_date: Option<DateTime<Utc>>,
    pub start_date: Option<DateTime<Utc>>,
    pub estimated_hours: Option<f64>,
    pub project_id: Uuid,
    pub task_list_id: Option<Uuid>,
    pub status_id: Option<Uuid>,
    pub position: String,
    pub milestone_id: Option<Uuid>,
    pub task_number: Option<i32>,
    pub eisenhower_urgency: Option<bool>,
    pub eisenhower_importance: Option<bool>,
    pub tenant_id: Uuid,
    pub created_by_id: Uuid,
    pub deleted_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub version: i32,
    pub parent_task_id: Option<Uuid>,
    pub depth: i16,
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
    pub project_id: Uuid,
}

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct TaskLabel {
    pub id: Uuid,
    pub task_id: Uuid,
    pub label_id: Uuid,
}

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct TaskWatcher {
    pub id: Uuid,
    pub task_id: Uuid,
    pub user_id: Uuid,
    pub watched_at: DateTime<Utc>,
}

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct TaskReminder {
    pub id: Uuid,
    pub task_id: Uuid,
    pub user_id: Uuid,
    pub remind_before_minutes: i32,
    pub is_sent: bool,
    pub sent_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
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
            project_id: Uuid::new_v4(),
            task_list_id: None,
            status_id: None,
            position: "a0".to_string(),
            milestone_id: None,
            task_number: Some(1),
            eisenhower_urgency: Some(true),
            eisenhower_importance: Some(false),
            tenant_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            deleted_at: None,
            created_at: now,
            updated_at: now,
            version: 1,
            parent_task_id: None,
            depth: 0,
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
    fn test_task_json_field_names() {
        let task = make_task();
        let json = serde_json::to_string(&task).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert!(parsed.get("id").is_some());
        assert!(parsed.get("project_id").is_some());
        assert!(parsed.get("task_list_id").is_some());
        assert!(parsed.get("status_id").is_some());
    }

    #[test]
    fn test_label_serde_roundtrip() {
        let label = Label {
            id: Uuid::new_v4(),
            name: "Bug".to_string(),
            color: "#ff0000".to_string(),
            project_id: Uuid::new_v4(),
        };
        let json = serde_json::to_string(&label).unwrap();
        let deserialized: Label = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.name, "Bug");
    }
}
