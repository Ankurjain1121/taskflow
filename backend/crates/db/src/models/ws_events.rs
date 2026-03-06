use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use uuid::Uuid;

use super::common::TaskPriority;

#[derive(Clone, Debug, Serialize, Deserialize, TS)]
#[serde(tag = "type")]
#[ts(export, export_to = "../../../frontend/src/app/shared/types/")]
pub enum WsProjectEvent {
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
        column_id: Uuid,
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
#[ts(export, export_to = "../../../frontend/src/app/shared/types/")]
pub struct TaskBroadcast {
    pub id: Uuid,
    pub title: String,
    pub priority: TaskPriority,
    pub column_id: Uuid,
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
#[ts(export, export_to = "../../../frontend/src/app/shared/types/")]
pub struct ColumnBroadcast {
    pub id: Uuid,
    pub name: String,
    pub position: String,
    pub color: Option<String>,
    pub status_mapping: Option<serde_json::Value>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore] // Run with: cargo test -p taskflow-db -- export_types --ignored
    fn export_types() {
        WsProjectEvent::export_all().expect("Failed to export WsProjectEvent");
        TaskBroadcast::export_all().expect("Failed to export TaskBroadcast");
        ColumnBroadcast::export_all().expect("Failed to export ColumnBroadcast");
    }

    #[test]
    fn test_task_created_event_serde() {
        let now = Utc::now();
        let event = WsProjectEvent::TaskCreated {
            task: TaskBroadcast {
                id: Uuid::new_v4(),
                title: "New Task".to_string(),
                priority: TaskPriority::High,
                column_id: Uuid::new_v4(),
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
        let event = WsProjectEvent::TaskUpdated {
            task: TaskBroadcast {
                id: Uuid::new_v4(),
                title: "Updated Task".to_string(),
                priority: TaskPriority::Medium,
                column_id: Uuid::new_v4(),
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
        let deserialized: WsProjectEvent = serde_json::from_str(&json).unwrap();
        match deserialized {
            WsProjectEvent::TaskUpdated { task, .. } => {
                assert_eq!(task.title, "Updated Task");
            }
            _ => panic!("Expected TaskUpdated variant"),
        }
    }

    #[test]
    fn test_task_moved_event_serde() {
        let task_id = Uuid::new_v4();
        let column_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();
        let event = WsProjectEvent::TaskMoved {
            task_id,
            column_id,
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
        let event = WsProjectEvent::TaskDeleted {
            task_id,
            origin_user_id: user_id,
        };
        let json = serde_json::to_string(&event).unwrap();
        let deserialized: WsProjectEvent = serde_json::from_str(&json).unwrap();
        match deserialized {
            WsProjectEvent::TaskDeleted {
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
        let event = WsProjectEvent::ColumnCreated {
            column: ColumnBroadcast {
                id: Uuid::new_v4(),
                name: "New Column".to_string(),
                position: "a0".to_string(),
                color: Some("#ff0000".to_string()),
                status_mapping: None,
            },
            origin_user_id: Uuid::new_v4(),
        };
        let json = serde_json::to_string(&event).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["type"], "ColumnCreated");
        assert_eq!(parsed["column"]["name"], "New Column");
        assert_eq!(parsed["column"]["color"], "#ff0000");
    }

    #[test]
    fn test_column_updated_event_serde() {
        let event = WsProjectEvent::ColumnUpdated {
            column: ColumnBroadcast {
                id: Uuid::new_v4(),
                name: "Updated Column".to_string(),
                position: "a1".to_string(),
                color: None,
                status_mapping: Some(serde_json::json!({"done": true})),
            },
            origin_user_id: Uuid::new_v4(),
        };
        let json = serde_json::to_string(&event).unwrap();
        let deserialized: WsProjectEvent = serde_json::from_str(&json).unwrap();
        match deserialized {
            WsProjectEvent::ColumnUpdated { column, .. } => {
                assert_eq!(column.name, "Updated Column");
                assert!(column.status_mapping.is_some());
            }
            _ => panic!("Expected ColumnUpdated variant"),
        }
    }

    #[test]
    fn test_column_deleted_event_serde() {
        let col_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();
        let event = WsProjectEvent::ColumnDeleted {
            column_id: col_id,
            origin_user_id: user_id,
        };
        let json = serde_json::to_string(&event).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["type"], "ColumnDeleted");
    }

    #[test]
    fn test_task_broadcast_serde_roundtrip() {
        let now = Utc::now();
        let task = TaskBroadcast {
            id: Uuid::new_v4(),
            title: "Roundtrip Test".to_string(),
            priority: TaskPriority::Low,
            column_id: Uuid::new_v4(),
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
        let col = ColumnBroadcast {
            id: Uuid::new_v4(),
            name: "Backlog".to_string(),
            position: "a0".to_string(),
            color: Some("#94a3b8".to_string()),
            status_mapping: None,
        };
        let json = serde_json::to_string(&col).unwrap();
        let deserialized: ColumnBroadcast = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, col.id);
        assert_eq!(deserialized.name, col.name);
        assert_eq!(deserialized.color, Some("#94a3b8".to_string()));
        assert!(deserialized.status_mapping.is_none());
    }

    #[test]
    fn test_ws_project_event_tagged_union_type_field() {
        // Verify the serde tag="type" discriminator is present in all variants
        let now = Utc::now();
        let task = TaskBroadcast {
            id: Uuid::new_v4(),
            title: "T".to_string(),
            priority: TaskPriority::Low,
            column_id: Uuid::new_v4(),
            position: "a0".to_string(),
            assignee_ids: vec![],
            watcher_ids: vec![],
            updated_at: now,
            changed_fields: None,
            origin_user_name: None,
        };
        let col = ColumnBroadcast {
            id: Uuid::new_v4(),
            name: "C".to_string(),
            position: "a0".to_string(),
            color: None,
            status_mapping: None,
        };
        let uid = Uuid::new_v4();

        let variants: Vec<(&str, WsProjectEvent)> = vec![
            (
                "TaskCreated",
                WsProjectEvent::TaskCreated {
                    task: task.clone(),
                    origin_user_id: uid,
                },
            ),
            (
                "TaskUpdated",
                WsProjectEvent::TaskUpdated {
                    task: task.clone(),
                    origin_user_id: uid,
                },
            ),
            (
                "TaskMoved",
                WsProjectEvent::TaskMoved {
                    task_id: uid,
                    column_id: uid,
                    position: "a0".into(),
                    origin_user_id: uid,
                },
            ),
            (
                "TaskDeleted",
                WsProjectEvent::TaskDeleted {
                    task_id: uid,
                    origin_user_id: uid,
                },
            ),
            (
                "ColumnCreated",
                WsProjectEvent::ColumnCreated {
                    column: col.clone(),
                    origin_user_id: uid,
                },
            ),
            (
                "ColumnUpdated",
                WsProjectEvent::ColumnUpdated {
                    column: col.clone(),
                    origin_user_id: uid,
                },
            ),
            (
                "ColumnDeleted",
                WsProjectEvent::ColumnDeleted {
                    column_id: uid,
                    origin_user_id: uid,
                },
            ),
            (
                "PresenceUpdate",
                WsProjectEvent::PresenceUpdate {
                    project_id: uid,
                    user_ids: vec![uid],
                },
            ),
            (
                "TaskLocked",
                WsProjectEvent::TaskLocked {
                    task_id: uid,
                    user_id: uid,
                    user_name: "Test".to_string(),
                },
            ),
            (
                "TaskUnlocked",
                WsProjectEvent::TaskUnlocked {
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
