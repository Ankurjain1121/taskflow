use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Capabilities that a workspace role grants.
/// Each field maps to a permission check in the application layer.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct Capabilities {
    /// See all tasks regardless of assignment
    #[serde(default)]
    pub can_view_all_tasks: bool,
    /// Create new tasks
    #[serde(default)]
    pub can_create_tasks: bool,
    /// Edit tasks assigned to self
    #[serde(default)]
    pub can_edit_own_tasks: bool,
    /// Edit any task
    #[serde(default)]
    pub can_edit_all_tasks: bool,
    /// Delete tasks
    #[serde(default)]
    pub can_delete_tasks: bool,
    /// Add/remove project members
    #[serde(default)]
    pub can_manage_members: bool,
    /// Change project visibility, statuses
    #[serde(default)]
    pub can_manage_project_settings: bool,
    /// Create/edit automation rules
    #[serde(default)]
    pub can_manage_automations: bool,
    /// Export data (CSV, PDF)
    #[serde(default)]
    pub can_export: bool,
    /// Billing and subscription management
    #[serde(default)]
    pub can_manage_billing: bool,
    /// Invite new workspace members
    #[serde(default)]
    pub can_invite_members: bool,
    /// Create/edit custom roles
    #[serde(default)]
    pub can_manage_roles: bool,
}

/// A role definition scoped to a workspace.
/// System roles (is_system=true) are seeded automatically and cannot be deleted.
#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct WorkspaceRole {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub is_system: bool,
    /// Stored as JSONB in Postgres, decoded to `Capabilities`.
    pub capabilities: serde_json::Value,
    pub position: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl WorkspaceRole {
    /// Parse the JSONB capabilities column into a typed `Capabilities` struct.
    pub fn parsed_capabilities(&self) -> Capabilities {
        serde_json::from_value(self.capabilities.clone()).unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_capabilities_default() {
        let caps = Capabilities::default();
        assert!(!caps.can_view_all_tasks);
        assert!(!caps.can_create_tasks);
        assert!(!caps.can_edit_own_tasks);
        assert!(!caps.can_edit_all_tasks);
        assert!(!caps.can_delete_tasks);
        assert!(!caps.can_manage_members);
        assert!(!caps.can_manage_project_settings);
        assert!(!caps.can_manage_automations);
        assert!(!caps.can_export);
        assert!(!caps.can_manage_billing);
        assert!(!caps.can_invite_members);
        assert!(!caps.can_manage_roles);
    }

    #[test]
    fn test_capabilities_serde_roundtrip() {
        let caps = Capabilities {
            can_view_all_tasks: true,
            can_create_tasks: true,
            can_edit_own_tasks: true,
            can_edit_all_tasks: false,
            can_delete_tasks: false,
            can_manage_members: true,
            can_manage_project_settings: false,
            can_manage_automations: true,
            can_export: true,
            can_manage_billing: false,
            can_invite_members: false,
            can_manage_roles: false,
        };
        let json = serde_json::to_value(&caps).unwrap();
        let deserialized: Capabilities = serde_json::from_value(json).unwrap();
        assert_eq!(deserialized, caps);
    }

    #[test]
    fn test_capabilities_partial_json() {
        // Ensures forward-compatibility: missing keys default to false
        let json = serde_json::json!({
            "can_view_all_tasks": true,
            "can_create_tasks": true
        });
        let caps: Capabilities = serde_json::from_value(json).unwrap();
        assert!(caps.can_view_all_tasks);
        assert!(caps.can_create_tasks);
        assert!(!caps.can_edit_own_tasks);
        assert!(!caps.can_manage_billing);
    }

    #[test]
    fn test_workspace_role_parsed_capabilities() {
        let now = Utc::now();
        let role = WorkspaceRole {
            id: Uuid::new_v4(),
            workspace_id: Uuid::new_v4(),
            name: "Admin".to_string(),
            description: Some("Administrator".to_string()),
            is_system: true,
            capabilities: serde_json::json!({
                "can_view_all_tasks": true,
                "can_create_tasks": true,
                "can_edit_own_tasks": true,
                "can_edit_all_tasks": true,
                "can_delete_tasks": true,
                "can_manage_members": true,
                "can_manage_project_settings": true,
                "can_manage_automations": true,
                "can_export": true,
                "can_manage_billing": false,
                "can_invite_members": true,
                "can_manage_roles": true
            }),
            position: 1,
            created_at: now,
            updated_at: now,
        };
        let caps = role.parsed_capabilities();
        assert!(caps.can_view_all_tasks);
        assert!(!caps.can_manage_billing);
        assert!(caps.can_manage_roles);
    }

    #[test]
    fn test_workspace_role_serde_roundtrip() {
        let now = Utc::now();
        let role = WorkspaceRole {
            id: Uuid::new_v4(),
            workspace_id: Uuid::new_v4(),
            name: "Member".to_string(),
            description: None,
            is_system: true,
            capabilities: serde_json::json!({}),
            position: 3,
            created_at: now,
            updated_at: now,
        };
        let json = serde_json::to_string(&role).unwrap();
        let deserialized: WorkspaceRole = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, role.id);
        assert_eq!(deserialized.name, role.name);
        assert_eq!(deserialized.position, role.position);
    }
}
