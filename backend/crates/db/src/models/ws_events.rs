use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use uuid::Uuid;

use super::common::TaskPriority;

#[derive(Clone, Debug, Serialize, Deserialize, TS)]
#[serde(tag = "type")]
#[ts(export)]
pub enum WsBoardEvent {
    TaskCreated {
        task: TaskBroadcast,
        origin_user_id: Uuid,
    },
    TaskUpdated {
        task: TaskBroadcast,
        origin_user_id: Uuid,
    },
    TaskMoved {
        task_id: Uuid,
        status_id: Option<Uuid>,
        position: String,
        origin_user_id: Uuid,
    },
    TaskDeleted {
        task_id: Uuid,
        origin_user_id: Uuid,
    },
    ColumnCreated {
        column: ColumnBroadcast,
        origin_user_id: Uuid,
    },
    ColumnUpdated {
        column: ColumnBroadcast,
        origin_user_id: Uuid,
    },
    ColumnDeleted {
        column_id: Uuid,
        origin_user_id: Uuid,
    },
    PresenceUpdate {
        project_id: Uuid,
        user_ids: Vec<Uuid>,
    },
    TaskLocked {
        task_id: Uuid,
        user_id: Uuid,
        user_name: String,
    },
    TaskUnlocked {
        task_id: Uuid,
        user_id: Uuid,
    },
}

#[derive(Clone, Debug, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct TaskBroadcast {
    pub id: Uuid,
    pub title: String,
    pub priority: TaskPriority,
    pub status_id: Option<Uuid>,
    pub position: String,
    pub assignee_ids: Vec<Uuid>,
    pub watcher_ids: Vec<Uuid>,
    pub updated_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub changed_fields: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub origin_user_name: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ColumnBroadcast {
    pub id: Uuid,
    pub name: String,
    pub position: String,
    pub color: String,
    pub status_type: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore = "Run with: cargo test -p taskbolt-db -- export_types --ignored"]
    fn export_types() {
        WsBoardEvent::export_all().expect("Failed to export WsBoardEvent");
        TaskBroadcast::export_all().expect("Failed to export TaskBroadcast");
        ColumnBroadcast::export_all().expect("Failed to export ColumnBroadcast");
    }

    #[test]
    fn test_task_created_event_serde() {
        let now = Utc::now();
        let event = WsBoardEvent::TaskCreated {
            task: TaskBroadcast {
                id: Uuid::new_v4(),
                title: "New Task".to_string(),
                priority: TaskPriority::High,
                status_id: Some(Uuid::new_v4()),
                position: "a0".to_string(),
                assignee_ids: vec![Uuid::new_v4()],
                watcher_ids: vec![],
                updated_at: now,
                changed_fields: None,
                origin_user_name: None,
            },
            origin_user_id: Uuid::new_v4(),
        };
        let json = serde_json::to_string(&event).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["type"], "TaskCreated");
        assert!(parsed["task"].is_object());
        assert!(parsed["origin_user_id"].is_string());
    }

    #[test]
    fn test_task_updated_event_serde() {
        let now = Utc::now();
        let event = WsBoardEvent::TaskUpdated {
            task: TaskBroadcast {
                id: Uuid::new_v4(),
                title: "Updated Task".to_string(),
                priority: TaskPriority::Medium,
                status_id: Some(Uuid::new_v4()),
                position: "a1".to_string(),
                assignee_ids: vec![],
                watcher_ids: vec![],
                updated_at: now,
                changed_fields: None,
                origin_user_name: None,
            },
            origin_user_id: Uuid::new_v4(),
        };
        let json = serde_json::to_string(&event).unwrap();
        let deserialized: WsBoardEvent = serde_json::from_str(&json).unwrap();
        match deserialized {
            WsBoardEvent::TaskUpdated { task, .. } => {
                assert_eq!(task.title, "Updated Task");
            }
            _ => panic!("Expected TaskUpdated variant"),
        }
    }

    #[test]
    fn test_task_moved_event_serde() {
        let task_id = Uuid::new_v4();
        let status_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();
        let event = WsBoardEvent::TaskMoved {
            task_id,
            status_id: Some(status_id),
            position: "b2".to_string(),
            origin_user_id: user_id,
        };
        let json = serde_json::to_string(&event).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["type"], "TaskMoved");
        assert_eq!(parsed["position"], "b2");
    }

    #[test]
    fn test_task_deleted_event_serde() {
        let task_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();
        let event = WsBoardEvent::TaskDeleted {
            task_id,
            origin_user_id: user_id,
        };
        let json = serde_json::to_string(&event).unwrap();
        let deserialized: WsBoardEvent = serde_json::from_str(&json).unwrap();
        match deserialized {
            WsBoardEvent::TaskDeleted {
                task_id: tid,
                origin_user_id: uid,
            } => {
                assert_eq!(tid, task_id);
                assert_eq!(uid, user_id);
            }
            _ => panic!("Expected TaskDeleted variant"),
        }
    }

    #[test]
    fn test_column_created_event_serde() {
        let event = WsBoardEvent::ColumnCreated {
            column: ColumnBroadcast {
                id: Uuid::new_v4(),
                name: "New Status".to_string(),
                position: "a0".to_string(),
                color: "#ff0000".to_string(),
                status_type: "active".to_string(),
            },
            origin_user_id: Uuid::new_v4(),
        };
        let json = serde_json::to_string(&event).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["type"], "ColumnCreated");
        assert_eq!(parsed["column"]["name"], "New Status");
    }

    #[test]
    fn test_task_broadcast_serde_roundtrip() {
        let now = Utc::now();
        let task = TaskBroadcast {
            id: Uuid::new_v4(),
            title: "Roundtrip Test".to_string(),
            priority: TaskPriority::Low,
            status_id: Some(Uuid::new_v4()),
            position: "z9".to_string(),
            assignee_ids: vec![Uuid::new_v4(), Uuid::new_v4()],
            watcher_ids: vec![],
            updated_at: now,
            changed_fields: None,
            origin_user_name: None,
        };
        let json = serde_json::to_string(&task).unwrap();
        let deserialized: TaskBroadcast = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, task.id);
        assert_eq!(deserialized.title, task.title);
        assert_eq!(deserialized.assignee_ids.len(), 2);
    }

    #[test]
    fn test_column_broadcast_serde_roundtrip() {
        let column = ColumnBroadcast {
            id: Uuid::new_v4(),
            name: "Open".to_string(),
            position: "a0".to_string(),
            color: "#94a3b8".to_string(),
            status_type: "not_started".to_string(),
        };
        let json = serde_json::to_string(&column).unwrap();
        let deserialized: ColumnBroadcast = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, column.id);
        assert_eq!(deserialized.name, column.name);
    }

    #[test]
    fn test_ws_board_event_tagged_union_type_field() {
        let now = Utc::now();
        let task = TaskBroadcast {
            id: Uuid::new_v4(),
            title: "T".to_string(),
            priority: TaskPriority::Low,
            status_id: Some(Uuid::new_v4()),
            position: "a0".to_string(),
            assignee_ids: vec![],
            watcher_ids: vec![],
            updated_at: now,
            changed_fields: None,
            origin_user_name: None,
        };
        let column = ColumnBroadcast {
            id: Uuid::new_v4(),
            name: "S".to_string(),
            position: "a0".to_string(),
            color: "#000".to_string(),
            status_type: "active".to_string(),
        };
        let uid = Uuid::new_v4();

        let variants: Vec<(&str, WsBoardEvent)> = vec![
            (
                "TaskCreated",
                WsBoardEvent::TaskCreated {
                    task: task.clone(),
                    origin_user_id: uid,
                },
            ),
            (
                "TaskUpdated",
                WsBoardEvent::TaskUpdated {
                    task: task.clone(),
                    origin_user_id: uid,
                },
            ),
            (
                "TaskMoved",
                WsBoardEvent::TaskMoved {
                    task_id: uid,
                    status_id: Some(uid),
                    position: "a0".into(),
                    origin_user_id: uid,
                },
            ),
            (
                "TaskDeleted",
                WsBoardEvent::TaskDeleted {
                    task_id: uid,
                    origin_user_id: uid,
                },
            ),
            (
                "ColumnCreated",
                WsBoardEvent::ColumnCreated {
                    column: column.clone(),
                    origin_user_id: uid,
                },
            ),
            (
                "ColumnUpdated",
                WsBoardEvent::ColumnUpdated {
                    column: column.clone(),
                    origin_user_id: uid,
                },
            ),
            (
                "ColumnDeleted",
                WsBoardEvent::ColumnDeleted {
                    column_id: uid,
                    origin_user_id: uid,
                },
            ),
            (
                "PresenceUpdate",
                WsBoardEvent::PresenceUpdate {
                    project_id: uid,
                    user_ids: vec![uid],
                },
            ),
            (
                "TaskLocked",
                WsBoardEvent::TaskLocked {
                    task_id: uid,
                    user_id: uid,
                    user_name: "Test".to_string(),
                },
            ),
            (
                "TaskUnlocked",
                WsBoardEvent::TaskUnlocked {
                    task_id: uid,
                    user_id: uid,
                },
            ),
        ];

        for (expected_type, event) in variants {
            let json = serde_json::to_string(&event).unwrap();
            let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
            assert_eq!(
                parsed["type"].as_str().unwrap(),
                expected_type,
                "Event variant type mismatch for {}",
                expected_type
            );
        }
    }
}
