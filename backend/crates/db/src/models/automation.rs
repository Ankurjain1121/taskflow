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
    MemberJoined,
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
    AssignToRoleMembers,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_automation_trigger_serde_roundtrip() {
        let triggers = [
            AutomationTrigger::TaskMoved,
            AutomationTrigger::TaskCreated,
            AutomationTrigger::TaskAssigned,
            AutomationTrigger::TaskPriorityChanged,
            AutomationTrigger::TaskDueDatePassed,
            AutomationTrigger::TaskCompleted,
            AutomationTrigger::SubtaskCompleted,
            AutomationTrigger::CommentAdded,
            AutomationTrigger::CustomFieldChanged,
            AutomationTrigger::LabelChanged,
            AutomationTrigger::DueDateApproaching,
            AutomationTrigger::MemberJoined,
        ];
        for trigger in triggers {
            let json = serde_json::to_string(&trigger).unwrap();
            let deserialized: AutomationTrigger = serde_json::from_str(&json).unwrap();
            assert_eq!(trigger, deserialized);
        }
    }

    #[test]
    fn test_automation_action_type_serde_roundtrip() {
        let actions = [
            AutomationActionType::MoveTask,
            AutomationActionType::AssignTask,
            AutomationActionType::SetPriority,
            AutomationActionType::SendNotification,
            AutomationActionType::AddLabel,
            AutomationActionType::SetMilestone,
            AutomationActionType::CreateSubtask,
            AutomationActionType::AddComment,
            AutomationActionType::SetDueDate,
            AutomationActionType::SetCustomField,
            AutomationActionType::SendWebhook,
            AutomationActionType::AssignToRoleMembers,
        ];
        for action in actions {
            let json = serde_json::to_string(&action).unwrap();
            let deserialized: AutomationActionType = serde_json::from_str(&json).unwrap();
            assert_eq!(action, deserialized);
        }
    }

    #[test]
    fn test_automation_rule_serde_roundtrip() {
        let now = Utc::now();
        let rule = AutomationRule {
            id: Uuid::new_v4(),
            name: "Move on complete".to_string(),
            board_id: Uuid::new_v4(),
            trigger: AutomationTrigger::TaskCompleted,
            trigger_config: serde_json::json!({"target_column_id": Uuid::new_v4()}),
            is_active: true,
            tenant_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            created_at: now,
            updated_at: now,
            conditions: None,
            execution_count: 5,
            last_triggered_at: Some(now),
        };
        let json = serde_json::to_string(&rule).unwrap();
        let deserialized: AutomationRule = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, rule.id);
        assert_eq!(deserialized.name, "Move on complete");
        assert!(deserialized.is_active);
        assert_eq!(deserialized.execution_count, 5);
    }

    #[test]
    fn test_automation_action_serde_roundtrip() {
        let action = AutomationAction {
            id: Uuid::new_v4(),
            rule_id: Uuid::new_v4(),
            action_type: AutomationActionType::SetPriority,
            action_config: serde_json::json!({"priority": "high"}),
            position: 1,
        };
        let json = serde_json::to_string(&action).unwrap();
        let deserialized: AutomationAction = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, action.id);
        assert_eq!(deserialized.action_type, AutomationActionType::SetPriority);
        assert_eq!(deserialized.position, 1);
    }

    #[test]
    fn test_automation_log_serde_roundtrip() {
        let now = Utc::now();
        let log = AutomationLog {
            id: Uuid::new_v4(),
            rule_id: Uuid::new_v4(),
            task_id: Some(Uuid::new_v4()),
            triggered_at: now,
            status: "success".to_string(),
            details: Some(serde_json::json!({"actions_executed": 2})),
        };
        let json = serde_json::to_string(&log).unwrap();
        let deserialized: AutomationLog = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.status, "success");
        assert!(deserialized.task_id.is_some());
        assert!(deserialized.details.is_some());
    }

    #[test]
    fn test_automation_trigger_equality() {
        assert_eq!(AutomationTrigger::TaskMoved, AutomationTrigger::TaskMoved);
        assert_ne!(AutomationTrigger::TaskMoved, AutomationTrigger::TaskCreated);
    }

    #[test]
    fn test_automation_action_type_equality() {
        assert_eq!(
            AutomationActionType::MoveTask,
            AutomationActionType::MoveTask
        );
        assert_ne!(
            AutomationActionType::MoveTask,
            AutomationActionType::AssignTask
        );
    }
}
