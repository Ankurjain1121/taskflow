use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use uuid::Uuid;

use super::common::TaskPriority;

#[derive(Clone, Debug, Serialize, Deserialize, TS)]
#[serde(tag = "type")]
#[ts(export, export_to = "../../../frontend/src/app/shared/types/")]
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
    pub updated_at: DateTime<Utc>,
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
        WsBoardEvent::export_all().expect("Failed to export WsBoardEvent");
        TaskBroadcast::export_all().expect("Failed to export TaskBroadcast");
        ColumnBroadcast::export_all().expect("Failed to export ColumnBroadcast");
    }
}
