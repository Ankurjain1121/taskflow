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
