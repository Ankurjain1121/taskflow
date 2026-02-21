use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(sqlx::Type, Serialize, Deserialize, Clone, Debug, PartialEq)]
#[sqlx(type_name = "automation_trigger", rename_all = "snake_case")]
pub enum AutomationTrigger {
    TaskMoved,
    TaskCreated,
    TaskAssigned,
    TaskPriorityChanged,
    TaskDueDatePassed,
    TaskCompleted,
    SubtaskCompleted,
    CommentAdded,
    CustomFieldChanged,
    LabelChanged,
    DueDateApproaching,
}

#[derive(sqlx::Type, Serialize, Deserialize, Clone, Debug, PartialEq)]
#[sqlx(type_name = "automation_action_type", rename_all = "snake_case")]
pub enum AutomationActionType {
    MoveTask,
    AssignTask,
    SetPriority,
    SendNotification,
    AddLabel,
    SetMilestone,
    CreateSubtask,
    AddComment,
    SetDueDate,
    SetCustomField,
    SendWebhook,
}

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct AutomationRule {
    pub id: Uuid,
    pub name: String,
    pub board_id: Uuid,
    pub trigger: AutomationTrigger,
    pub trigger_config: serde_json::Value,
    pub is_active: bool,
    pub tenant_id: Uuid,
    pub created_by_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub conditions: Option<serde_json::Value>,
    pub execution_count: i32,
    pub last_triggered_at: Option<DateTime<Utc>>,
}

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct AutomationAction {
    pub id: Uuid,
    pub rule_id: Uuid,
    pub action_type: AutomationActionType,
    pub action_config: serde_json::Value,
    pub position: i32,
}

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct AutomationLog {
    pub id: Uuid,
    pub rule_id: Uuid,
    pub task_id: Option<Uuid>,
    pub triggered_at: DateTime<Utc>,
    pub status: String,
    pub details: Option<serde_json::Value>,
}
