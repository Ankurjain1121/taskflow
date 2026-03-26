use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use taskbolt_auth::rbac::capabilities_for_user_role;
use taskbolt_db::models::workspace_role::Capabilities;
use taskbolt_db::models::UserRole;

use crate::errors::{AppError, Result};

#[derive(Debug, Serialize)]
pub struct MessageResponse {
    pub message: String,
}

/// Verify that a user can access a project.
///
/// Access is granted if ANY of the following is true:
/// 1. The user has a global SuperAdmin or Admin role (org-level bypass)
/// 2. The user is a direct member of the project (project_members table)
/// 3. The user is a workspace Owner or Admin for the project's workspace
///
/// Returns `Ok(())` on success, or `Err(AppError::Forbidden)` otherwise.
pub async fn verify_project_membership(
    pool: &PgPool,
    project_id: Uuid,
    user_id: Uuid,
    role: &UserRole,
) -> Result<()> {
    // 1. SuperAdmin/Admin bypass (org level)
    if matches!(role, UserRole::SuperAdmin | UserRole::Admin) {
        return Ok(());
    }

    // 2. Check project_members first (fast indexed path)
    let is_member = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM project_members
            WHERE project_id = $1 AND user_id = $2
        ) as "exists!"
        "#,
        project_id,
        user_id
    )
    .fetch_one(pool)
    .await?;
    if is_member {
        return Ok(());
    }

    // 3. Fallback: workspace Owner/Admin override
    let is_ws_admin = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM projects p
            JOIN workspace_members wm ON wm.workspace_id = p.workspace_id AND wm.user_id = $2
            WHERE p.id = $1 AND p.deleted_at IS NULL AND wm.role IN ('owner', 'admin')
        ) as "exists!"
        "#,
        project_id,
        user_id
    )
    .fetch_one(pool)
    .await?;
    if is_ws_admin {
        return Ok(());
    }

    Err(AppError::Forbidden("Not a project member".into()))
}

/// The 12 workspace-level capabilities that can be checked.
#[derive(Debug, Clone, Copy)]
pub enum Capability {
    ViewAllTasks,
    CreateTasks,
    EditOwnTasks,
    EditAllTasks,
    DeleteTasks,
    ManageMembers,
    ManageProjectSettings,
    ManageAutomations,
    Export,
    ManageBilling,
    InviteMembers,
    ManageRoles,
}

impl Capability {
    /// Returns the capability name as it appears in the JSON blob.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::ViewAllTasks => "can_view_all_tasks",
            Self::CreateTasks => "can_create_tasks",
            Self::EditOwnTasks => "can_edit_own_tasks",
            Self::EditAllTasks => "can_edit_all_tasks",
            Self::DeleteTasks => "can_delete_tasks",
            Self::ManageMembers => "can_manage_members",
            Self::ManageProjectSettings => "can_manage_project_settings",
            Self::ManageAutomations => "can_manage_automations",
            Self::Export => "can_export",
            Self::ManageBilling => "can_manage_billing",
            Self::InviteMembers => "can_invite_members",
            Self::ManageRoles => "can_manage_roles",
        }
    }

    /// Check if this capability is granted in the given set.
    pub fn check(self, caps: &Capabilities) -> bool {
        match self {
            Self::ViewAllTasks => caps.can_view_all_tasks,
            Self::CreateTasks => caps.can_create_tasks,
            Self::EditOwnTasks => caps.can_edit_own_tasks,
            Self::EditAllTasks => caps.can_edit_all_tasks,
            Self::DeleteTasks => caps.can_delete_tasks,
            Self::ManageMembers => caps.can_manage_members,
            Self::ManageProjectSettings => caps.can_manage_project_settings,
            Self::ManageAutomations => caps.can_manage_automations,
            Self::Export => caps.can_export,
            Self::ManageBilling => caps.can_manage_billing,
            Self::InviteMembers => caps.can_invite_members,
            Self::ManageRoles => caps.can_manage_roles,
        }
    }
}

/// Resolve the effective permissions for a user in a workspace context.
///
/// The effective permissions are the intersection of:
/// 1. Org-level capabilities (from the user's global role)
/// 2. Workspace-level capabilities (from their workspace role)
///
/// SuperAdmin/Admin bypass: returns full capabilities.
pub async fn resolve_effective_permissions(
    pool: &PgPool,
    user_id: Uuid,
    role: &UserRole,
    workspace_id: Uuid,
) -> Result<Capabilities> {
    // SuperAdmin/Admin bypass
    if matches!(role, UserRole::SuperAdmin | UserRole::Admin) {
        return Ok(Capabilities::full());
    }

    let org_caps = capabilities_for_user_role(role);

    // Look up workspace role capabilities
    let ws_caps_row = sqlx::query_scalar!(
        r#"
        SELECT wr.capabilities
        FROM workspace_members wm
        JOIN workspace_roles wr ON wr.id = wm.role_id
        WHERE wm.workspace_id = $1 AND wm.user_id = $2
        "#,
        workspace_id,
        user_id
    )
    .fetch_optional(pool)
    .await?;

    let ws_caps = match ws_caps_row {
        Some(json_val) => serde_json::from_value::<Capabilities>(json_val).unwrap_or_default(),
        None => {
            // No workspace role assigned yet — fall back to org caps only
            return Ok(org_caps);
        }
    };

    Ok(org_caps.intersect(&ws_caps))
}

/// Require that the user has a specific capability in the workspace
/// that owns the given project.
///
/// Returns `Ok(())` if the user has the capability, or
/// `Err(AppError::PermissionDenied)` with a rich error message.
pub async fn require_capability(
    pool: &PgPool,
    user_id: Uuid,
    role: &UserRole,
    project_id: Uuid,
    cap: Capability,
) -> Result<()> {
    // SuperAdmin/Admin always pass
    if matches!(role, UserRole::SuperAdmin | UserRole::Admin) {
        return Ok(());
    }

    // Get workspace_id from project
    let workspace_id = sqlx::query_scalar!(
        r#"SELECT workspace_id FROM projects WHERE id = $1 AND deleted_at IS NULL"#,
        project_id
    )
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Project not found".into()))?;

    let caps = resolve_effective_permissions(pool, user_id, role, workspace_id).await?;

    if !cap.check(&caps) {
        // Get the workspace role name for the error message
        let role_name = sqlx::query_scalar!(
            r#"
            SELECT wr.name
            FROM workspace_members wm
            JOIN workspace_roles wr ON wr.id = wm.role_id
            WHERE wm.workspace_id = $1 AND wm.user_id = $2
            "#,
            workspace_id,
            user_id
        )
        .fetch_optional(pool)
        .await?
        .unwrap_or_else(|| "unknown".to_string());

        return Err(AppError::PermissionDenied {
            capability: cap.as_str().to_string(),
            denied_by: "workspace".to_string(),
            role_name,
        });
    }

    Ok(())
}
