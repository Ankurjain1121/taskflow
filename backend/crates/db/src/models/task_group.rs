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

#[cfg(test)]
mod tests {
    use super::*;

    fn make_task_list() -> TaskList {
        let now = Utc::now();
        TaskList {
            id: Uuid::new_v4(),
            project_id: Uuid::new_v4(),
            name: "Backlog".to_string(),
            color: Some("#6366f1".to_string()),
            position: "a0".to_string(),
            is_default: true,
            collapsed: Some(false),
            tenant_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            created_at: Some(now),
            updated_at: Some(now),
            deleted_at: None,
        }
    }

    #[test]
    fn test_task_list_serde_roundtrip() {
        let list = make_task_list();
        let json = serde_json::to_string(&list).unwrap();
        let deserialized: TaskList = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, list.id);
        assert_eq!(deserialized.name, "Backlog");
        assert!(deserialized.is_default);
        assert_eq!(deserialized.collapsed, Some(false));
        assert!(deserialized.deleted_at.is_none());
    }

    #[test]
    fn test_task_list_soft_deleted() {
        let now = Utc::now();
        let list = TaskList {
            id: Uuid::new_v4(),
            project_id: Uuid::new_v4(),
            name: "Deleted List".to_string(),
            color: None,
            position: "b0".to_string(),
            is_default: false,
            collapsed: None,
            tenant_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            created_at: Some(now),
            updated_at: Some(now),
            deleted_at: Some(now),
        };
        let json = serde_json::to_string(&list).unwrap();
        let deserialized: TaskList = serde_json::from_str(&json).unwrap();
        assert!(deserialized.deleted_at.is_some());
        assert!(!deserialized.is_default);
    }

    #[test]
    fn test_default_color() {
        assert_eq!(default_color(), "#6366f1");
    }

    #[test]
    fn test_create_task_list_request_deserialize() {
        let project_id = Uuid::new_v4();
        let json = format!(
            r#"{{"project_id": "{}", "name": "Sprint 1", "position": "a0"}}"#,
            project_id
        );
        let req: CreateTaskListRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(req.name, "Sprint 1");
        assert_eq!(req.project_id, project_id);
        assert_eq!(req.color, "#6366f1", "Should use default color");
    }

    #[test]
    fn test_create_task_list_request_with_color() {
        let project_id = Uuid::new_v4();
        let json = format!(
            r##"{{"project_id": "{}", "name": "Custom", "color": "#ff0000", "position": "b1"}}"##,
            project_id
        );
        let req: CreateTaskListRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(req.color, "#ff0000");
    }

    #[test]
    fn test_update_task_list_request_partial() {
        let json = r#"{"name": "Renamed"}"#;
        let req: UpdateTaskListRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.name, Some("Renamed".to_string()));
        assert!(req.color.is_none());
        assert!(req.position.is_none());
        assert!(req.collapsed.is_none());
    }

    #[test]
    fn test_task_list_with_stats_serde() {
        let list = make_task_list();
        let stats = TaskListWithStats {
            list,
            task_count: 10,
            completed_count: 3,
            estimated_hours: Some(24.5),
        };
        let json = serde_json::to_string(&stats).unwrap();
        let deserialized: TaskListWithStats = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.task_count, 10);
        assert_eq!(deserialized.completed_count, 3);
        assert_eq!(deserialized.estimated_hours, Some(24.5));
    }

    #[test]
    fn test_task_group_alias() {
        // Verify type aliases work
        let list = make_task_list();
        let _group: &TaskGroup = &list;
    }
}
