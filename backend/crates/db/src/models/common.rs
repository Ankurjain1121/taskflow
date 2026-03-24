use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(sqlx::Type, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, TS)]
#[sqlx(type_name = "user_role", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "../../../frontend/src/app/shared/types/")]
pub enum UserRole {
    SuperAdmin,
    Admin,
    Manager,
    Member,
}

#[derive(sqlx::Type, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, TS)]
#[sqlx(type_name = "workspace_member_role", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "../../../frontend/src/app/shared/types/")]
pub enum WorkspaceMemberRole {
    Owner,
    Admin,
    Member,
    Viewer,
}

#[derive(sqlx::Type, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, TS)]
#[sqlx(type_name = "workspace_visibility", rename_all = "snake_case")]
#[ts(export, export_to = "../../../frontend/src/app/shared/types/")]
pub enum WorkspaceVisibility {
    Open,
    Closed,
}

#[derive(sqlx::Type, Serialize, Deserialize, Clone, Debug, PartialEq, TS)]
#[sqlx(type_name = "project_member_role", rename_all = "snake_case")]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "../../../frontend/src/app/shared/types/")]
pub enum BoardMemberRole {
    Viewer,
    Editor,
    Owner,
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
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "../../../frontend/src/app/shared/types/")]
pub enum RecurrencePattern {
    Daily,
    Weekly,
    Biweekly,
    Monthly,
    Custom,
    Yearly,
    Weekdays,
    CustomWeekly,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_user_role_serde() {
        for variant in [
            UserRole::SuperAdmin,
            UserRole::Admin,
            UserRole::Manager,
            UserRole::Member,
        ] {
            let json = serde_json::to_string(&variant).unwrap();
            let deserialized: UserRole = serde_json::from_str(&json).unwrap();
            assert_eq!(variant, deserialized);
        }
    }

    #[test]
    fn test_board_member_role_serde() {
        for variant in [
            BoardMemberRole::Viewer,
            BoardMemberRole::Editor,
            BoardMemberRole::Owner,
        ] {
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
            RecurrencePattern::Yearly,
            RecurrencePattern::Weekdays,
            RecurrencePattern::CustomWeekly,
        ] {
            let json = serde_json::to_string(&variant).unwrap();
            let deserialized: RecurrencePattern = serde_json::from_str(&json).unwrap();
            assert_eq!(variant, deserialized);
        }
    }

    #[test]
    fn test_user_role_equality() {
        assert_eq!(UserRole::SuperAdmin, UserRole::SuperAdmin);
        assert_eq!(UserRole::Admin, UserRole::Admin);
        assert_eq!(UserRole::Manager, UserRole::Manager);
        assert_eq!(UserRole::Member, UserRole::Member);
        assert_ne!(UserRole::SuperAdmin, UserRole::Admin);
        assert_ne!(UserRole::Admin, UserRole::Member);
        assert_ne!(UserRole::Admin, UserRole::Manager);
        assert_ne!(UserRole::Manager, UserRole::Member);
    }

    #[test]
    fn test_task_priority_json_lowercase() {
        assert_eq!(
            serde_json::to_string(&TaskPriority::Urgent).unwrap(),
            "\"urgent\""
        );
        assert_eq!(
            serde_json::to_string(&TaskPriority::High).unwrap(),
            "\"high\""
        );
        assert_eq!(
            serde_json::to_string(&TaskPriority::Medium).unwrap(),
            "\"medium\""
        );
        assert_eq!(
            serde_json::to_string(&TaskPriority::Low).unwrap(),
            "\"low\""
        );

        // Also verify deserialization from lowercase
        let urgent: TaskPriority = serde_json::from_str("\"urgent\"").unwrap();
        assert_eq!(urgent, TaskPriority::Urgent);
    }

    #[test]
    fn test_task_priority_invalid_value_rejected() {
        let result: std::result::Result<TaskPriority, _> = serde_json::from_str("\"critical\"");
        assert!(result.is_err(), "Invalid priority should be rejected");
    }

    #[test]
    fn test_user_role_invalid_value_rejected() {
        let result: std::result::Result<UserRole, _> = serde_json::from_str("\"superduper\"");
        assert!(result.is_err(), "Invalid role should be rejected");
    }

    #[test]
    fn test_board_member_role_clone_and_debug() {
        let role = BoardMemberRole::Editor;
        let cloned = role.clone();
        assert_eq!(role, cloned);
        let debug = format!("{:?}", role);
        assert!(debug.contains("Editor"));
    }

    #[test]
    fn test_activity_action_debug_format() {
        let action = ActivityAction::StatusChanged;
        let debug = format!("{:?}", action);
        assert_eq!(debug, "StatusChanged");
    }

    #[test]
    fn test_dependency_type_clone_and_eq() {
        let dep = DependencyType::Blocks;
        let cloned = dep.clone();
        assert_eq!(dep, cloned);
        assert_ne!(dep, DependencyType::BlockedBy);
    }

    #[test]
    fn test_custom_field_type_clone_and_eq() {
        let field = CustomFieldType::Dropdown;
        let cloned = field.clone();
        assert_eq!(field, cloned);
        assert_ne!(field, CustomFieldType::Checkbox);
    }

    #[test]
    fn test_recurrence_pattern_clone_and_eq() {
        let pattern = RecurrencePattern::CustomWeekly;
        let cloned = pattern.clone();
        assert_eq!(pattern, cloned);
        assert_ne!(pattern, RecurrencePattern::Daily);
    }

    // ========================================================================
    // WorkspaceMemberRole tests
    // ========================================================================

    #[test]
    fn test_workspace_member_role_serde() {
        for variant in [
            WorkspaceMemberRole::Owner,
            WorkspaceMemberRole::Admin,
            WorkspaceMemberRole::Member,
            WorkspaceMemberRole::Viewer,
        ] {
            let json = serde_json::to_string(&variant).unwrap();
            let deserialized: WorkspaceMemberRole = serde_json::from_str(&json).unwrap();
            assert_eq!(variant, deserialized);
        }
    }

    #[test]
    fn test_workspace_member_role_invalid_value_rejected() {
        let result: std::result::Result<WorkspaceMemberRole, _> =
            serde_json::from_str("\"superowner\"");
        assert!(result.is_err(), "Invalid ws member role should be rejected");
    }

    // ========================================================================
    // WorkspaceVisibility tests
    // ========================================================================

    #[test]
    fn test_workspace_visibility_serde() {
        for variant in [WorkspaceVisibility::Open, WorkspaceVisibility::Closed] {
            let json = serde_json::to_string(&variant).unwrap();
            let deserialized: WorkspaceVisibility = serde_json::from_str(&json).unwrap();
            assert_eq!(variant, deserialized);
        }
    }

    #[test]
    fn test_workspace_visibility_invalid_value_rejected() {
        let result: std::result::Result<WorkspaceVisibility, _> =
            serde_json::from_str("\"private\"");
        assert!(result.is_err(), "Invalid visibility should be rejected");
    }

    #[test]
    fn test_workspace_visibility_clone_and_eq() {
        let vis = WorkspaceVisibility::Open;
        let cloned = vis;
        assert_eq!(vis, cloned);
        assert_ne!(vis, WorkspaceVisibility::Closed);
    }

    // ========================================================================
    // Board member role lowercase serde
    // ========================================================================

    #[test]
    fn test_board_member_role_json_lowercase() {
        assert_eq!(
            serde_json::to_string(&BoardMemberRole::Viewer).unwrap(),
            "\"viewer\""
        );
        assert_eq!(
            serde_json::to_string(&BoardMemberRole::Editor).unwrap(),
            "\"editor\""
        );
        assert_eq!(
            serde_json::to_string(&BoardMemberRole::Owner).unwrap(),
            "\"owner\""
        );
    }

    #[test]
    fn test_board_member_role_deserialize_from_lowercase() {
        let viewer: BoardMemberRole = serde_json::from_str("\"viewer\"").unwrap();
        assert_eq!(viewer, BoardMemberRole::Viewer);
    }

    #[test]
    fn test_board_member_role_invalid_value_rejected() {
        let result: std::result::Result<BoardMemberRole, _> = serde_json::from_str("\"moderator\"");
        assert!(
            result.is_err(),
            "Invalid board member role should be rejected"
        );
    }
}
