use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(sqlx::Type, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, TS)]
#[sqlx(type_name = "user_role", rename_all = "snake_case")]
#[ts(export, export_to = "../../../frontend/src/app/shared/types/")]
pub enum UserRole {
    Admin,
    Manager,
    Member,
}

#[derive(sqlx::Type, Serialize, Deserialize, Clone, Debug, PartialEq, TS)]
#[sqlx(type_name = "board_member_role", rename_all = "snake_case")]
#[ts(export, export_to = "../../../frontend/src/app/shared/types/")]
pub enum BoardMemberRole {
    Viewer,
    Editor,
}

#[derive(sqlx::Type, Serialize, Deserialize, Clone, Debug, PartialEq, TS)]
#[sqlx(type_name = "task_priority", rename_all = "snake_case")]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "../../../frontend/src/app/shared/types/")]
pub enum TaskPriority {
    Urgent,
    High,
    Medium,
    Low,
}

#[derive(sqlx::Type, Serialize, Deserialize, Clone, Debug, PartialEq, TS)]
#[sqlx(type_name = "activity_action", rename_all = "snake_case")]
#[ts(export, export_to = "../../../frontend/src/app/shared/types/")]
pub enum ActivityAction {
    Created,
    Updated,
    Moved,
    Assigned,
    Unassigned,
    Commented,
    Attached,
    StatusChanged,
    PriorityChanged,
    Deleted,
}

#[derive(sqlx::Type, Serialize, Deserialize, Clone, Debug, PartialEq, TS)]
#[sqlx(type_name = "subscription_status", rename_all = "snake_case")]
#[ts(export, export_to = "../../../frontend/src/app/shared/types/")]
pub enum SubscriptionStatus {
    Active,
    Trialing,
    PastDue,
    Cancelled,
    Expired,
}

#[derive(sqlx::Type, Serialize, Deserialize, Clone, Debug, PartialEq, TS)]
#[sqlx(type_name = "dependency_type", rename_all = "snake_case")]
#[ts(export, export_to = "../../../frontend/src/app/shared/types/")]
pub enum DependencyType {
    Blocks,
    BlockedBy,
    Related,
}

#[derive(sqlx::Type, Serialize, Deserialize, Clone, Debug, PartialEq, TS)]
#[sqlx(type_name = "custom_field_type", rename_all = "snake_case")]
#[ts(export, export_to = "../../../frontend/src/app/shared/types/")]
pub enum CustomFieldType {
    Text,
    Number,
    Date,
    Dropdown,
    Checkbox,
}

#[derive(sqlx::Type, Serialize, Deserialize, Clone, Debug, PartialEq, TS)]
#[sqlx(type_name = "recurrence_pattern", rename_all = "snake_case")]
#[ts(export, export_to = "../../../frontend/src/app/shared/types/")]
pub enum RecurrencePattern {
    Daily,
    Weekly,
    Biweekly,
    Monthly,
    Custom,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_user_role_serde() {
        for variant in [UserRole::Admin, UserRole::Manager, UserRole::Member] {
            let json = serde_json::to_string(&variant).unwrap();
            let deserialized: UserRole = serde_json::from_str(&json).unwrap();
            assert_eq!(variant, deserialized);
        }
    }

    #[test]
    fn test_board_member_role_serde() {
        for variant in [BoardMemberRole::Viewer, BoardMemberRole::Editor] {
            let json = serde_json::to_string(&variant).unwrap();
            let deserialized: BoardMemberRole = serde_json::from_str(&json).unwrap();
            assert_eq!(variant, deserialized);
        }
    }

    #[test]
    fn test_task_priority_serde() {
        for variant in [
            TaskPriority::Urgent,
            TaskPriority::High,
            TaskPriority::Medium,
            TaskPriority::Low,
        ] {
            let json = serde_json::to_string(&variant).unwrap();
            let deserialized: TaskPriority = serde_json::from_str(&json).unwrap();
            assert_eq!(variant, deserialized);
        }
    }

    #[test]
    fn test_activity_action_serde() {
        for variant in [
            ActivityAction::Created,
            ActivityAction::Updated,
            ActivityAction::Moved,
            ActivityAction::Assigned,
            ActivityAction::Unassigned,
            ActivityAction::Commented,
            ActivityAction::Attached,
            ActivityAction::StatusChanged,
            ActivityAction::PriorityChanged,
            ActivityAction::Deleted,
        ] {
            let json = serde_json::to_string(&variant).unwrap();
            let deserialized: ActivityAction = serde_json::from_str(&json).unwrap();
            assert_eq!(variant, deserialized);
        }
    }

    #[test]
    fn test_subscription_status_serde() {
        for variant in [
            SubscriptionStatus::Active,
            SubscriptionStatus::Trialing,
            SubscriptionStatus::PastDue,
            SubscriptionStatus::Cancelled,
            SubscriptionStatus::Expired,
        ] {
            let json = serde_json::to_string(&variant).unwrap();
            let deserialized: SubscriptionStatus = serde_json::from_str(&json).unwrap();
            assert_eq!(variant, deserialized);
        }
    }

    #[test]
    fn test_dependency_type_serde() {
        for variant in [
            DependencyType::Blocks,
            DependencyType::BlockedBy,
            DependencyType::Related,
        ] {
            let json = serde_json::to_string(&variant).unwrap();
            let deserialized: DependencyType = serde_json::from_str(&json).unwrap();
            assert_eq!(variant, deserialized);
        }
    }

    #[test]
    fn test_custom_field_type_serde() {
        for variant in [
            CustomFieldType::Text,
            CustomFieldType::Number,
            CustomFieldType::Date,
            CustomFieldType::Dropdown,
            CustomFieldType::Checkbox,
        ] {
            let json = serde_json::to_string(&variant).unwrap();
            let deserialized: CustomFieldType = serde_json::from_str(&json).unwrap();
            assert_eq!(variant, deserialized);
        }
    }

    #[test]
    fn test_recurrence_pattern_serde() {
        for variant in [
            RecurrencePattern::Daily,
            RecurrencePattern::Weekly,
            RecurrencePattern::Biweekly,
            RecurrencePattern::Monthly,
            RecurrencePattern::Custom,
        ] {
            let json = serde_json::to_string(&variant).unwrap();
            let deserialized: RecurrencePattern = serde_json::from_str(&json).unwrap();
            assert_eq!(variant, deserialized);
        }
    }

    #[test]
    fn test_user_role_equality() {
        assert_eq!(UserRole::Admin, UserRole::Admin);
        assert_eq!(UserRole::Manager, UserRole::Manager);
        assert_eq!(UserRole::Member, UserRole::Member);
        assert_ne!(UserRole::Admin, UserRole::Member);
        assert_ne!(UserRole::Admin, UserRole::Manager);
        assert_ne!(UserRole::Manager, UserRole::Member);
    }

    #[test]
    fn test_task_priority_json_lowercase() {
        assert_eq!(serde_json::to_string(&TaskPriority::Urgent).unwrap(), "\"urgent\"");
        assert_eq!(serde_json::to_string(&TaskPriority::High).unwrap(), "\"high\"");
        assert_eq!(serde_json::to_string(&TaskPriority::Medium).unwrap(), "\"medium\"");
        assert_eq!(serde_json::to_string(&TaskPriority::Low).unwrap(), "\"low\"");

        // Also verify deserialization from lowercase
        let urgent: TaskPriority = serde_json::from_str("\"urgent\"").unwrap();
        assert_eq!(urgent, TaskPriority::Urgent);
    }
}
