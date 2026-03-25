//! Role-Based Access Control (RBAC) permission system
//!
//! Defines permissions and maps them to user roles.

use std::collections::HashSet;

use taskbolt_db::models::{UserRole, WorkspaceMemberRole};
use taskbolt_db::models::workspace_role::Capabilities;
use thiserror::Error;

/// All available permissions in the system
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Permission {
    // Workspace permissions
    WorkspaceCreate,
    WorkspaceDelete,
    WorkspaceManageMembers,

    // Board permissions
    BoardCreate,
    BoardDelete,
    BoardUpdate,

    // Task permissions
    TaskCreate,
    TaskUpdate,
    TaskDelete,
    TaskAssign,
    TaskView,

    // Comment permissions
    CommentCreate,
    CommentDeleteOwn,
    CommentDeleteAny,

    // Admin permissions
    AdminAccess,
    AdminManageUsers,
    AdminViewAuditLog,
}

/// Error returned when a permission check fails
#[derive(Debug, Error)]
pub enum AuthError {
    #[error("Permission denied: {0:?} is required")]
    PermissionDenied(Permission),

    #[error("Insufficient role: {required:?} or higher required, got {actual:?}")]
    InsufficientRole {
        required: UserRole,
        actual: UserRole,
    },
}

/// Returns the set of permissions granted to a specific role
pub fn permissions_for_role(role: &UserRole) -> HashSet<Permission> {
    let mut perms = HashSet::new();

    match role {
        UserRole::SuperAdmin | UserRole::Admin => {
            // SuperAdmin and Admin have ALL permissions
            perms.insert(Permission::WorkspaceCreate);
            perms.insert(Permission::WorkspaceDelete);
            perms.insert(Permission::WorkspaceManageMembers);
            perms.insert(Permission::BoardCreate);
            perms.insert(Permission::BoardDelete);
            perms.insert(Permission::BoardUpdate);
            perms.insert(Permission::TaskCreate);
            perms.insert(Permission::TaskUpdate);
            perms.insert(Permission::TaskDelete);
            perms.insert(Permission::TaskAssign);
            perms.insert(Permission::TaskView);
            perms.insert(Permission::CommentCreate);
            perms.insert(Permission::CommentDeleteOwn);
            perms.insert(Permission::CommentDeleteAny);
            perms.insert(Permission::AdminAccess);
            perms.insert(Permission::AdminManageUsers);
            perms.insert(Permission::AdminViewAuditLog);
        }
        UserRole::Manager => {
            // Manager has all except Admin* permissions
            perms.insert(Permission::WorkspaceCreate);
            perms.insert(Permission::WorkspaceDelete);
            perms.insert(Permission::WorkspaceManageMembers);
            perms.insert(Permission::BoardCreate);
            perms.insert(Permission::BoardDelete);
            perms.insert(Permission::BoardUpdate);
            perms.insert(Permission::TaskCreate);
            perms.insert(Permission::TaskUpdate);
            perms.insert(Permission::TaskDelete);
            perms.insert(Permission::TaskAssign);
            perms.insert(Permission::TaskView);
            perms.insert(Permission::CommentCreate);
            perms.insert(Permission::CommentDeleteOwn);
            perms.insert(Permission::CommentDeleteAny);
        }
        UserRole::Member => {
            // Member has limited permissions
            perms.insert(Permission::TaskView);
            perms.insert(Permission::TaskUpdate);
            perms.insert(Permission::TaskCreate);
            perms.insert(Permission::CommentCreate);
            perms.insert(Permission::CommentDeleteOwn);
            perms.insert(Permission::BoardCreate);
        }
    }

    perms
}

/// Check if a role has a specific permission
pub fn has_permission(role: &UserRole, permission: &Permission) -> bool {
    permissions_for_role(role).contains(permission)
}

/// Require a specific permission, returning an error if not granted
pub fn require_permission(role: &UserRole, permission: &Permission) -> Result<(), AuthError> {
    if has_permission(role, permission) {
        Ok(())
    } else {
        Err(AuthError::PermissionDenied(*permission))
    }
}

/// Check if a user can manage a workspace (change roles, settings, etc.)
///
/// Returns true if the user is a global Admin, or if they are a workspace Owner/Admin.
pub fn can_manage_workspace(global_role: &UserRole, ws_role: Option<&WorkspaceMemberRole>) -> bool {
    matches!(global_role, UserRole::SuperAdmin | UserRole::Admin)
        || matches!(
            ws_role,
            Some(WorkspaceMemberRole::Owner | WorkspaceMemberRole::Admin)
        )
}

/// Check if a user has at least the specified role level
pub fn has_role_level(actual: &UserRole, required: &UserRole) -> bool {
    match (actual, required) {
        // SuperAdmin is the highest level
        (UserRole::SuperAdmin, _) => true,
        // Admin is second highest
        (UserRole::Admin, UserRole::SuperAdmin) => false,
        (UserRole::Admin, _) => true,
        // Manager is mid-level
        (UserRole::Manager, UserRole::Manager | UserRole::Member) => true,
        (UserRole::Manager, _) => false,
        // Member is lowest level
        (UserRole::Member, UserRole::Member) => true,
        (UserRole::Member, _) => false,
    }
}

/// Returns the capability set implied by an org-level user role.
///
/// SuperAdmin/Admin → full capabilities.
/// Manager → everything except billing and role management.
/// Member → create tasks, edit own tasks, export.
pub fn capabilities_for_user_role(role: &UserRole) -> Capabilities {
    match role {
        UserRole::SuperAdmin | UserRole::Admin => Capabilities::full(),
        UserRole::Manager => Capabilities {
            can_manage_billing: false,
            can_manage_roles: false,
            ..Capabilities::full()
        },
        UserRole::Member => Capabilities {
            can_create_tasks: true,
            can_edit_own_tasks: true,
            can_export: true,
            ..Capabilities::default()
        },
    }
}

/// Require at least the specified role level
pub fn require_role_level(actual: &UserRole, required: &UserRole) -> Result<(), AuthError> {
    if has_role_level(actual, required) {
        Ok(())
    } else {
        Err(AuthError::InsufficientRole {
            required: *required,
            actual: *actual,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_super_admin_has_all_permissions() {
        let super_admin_perms = permissions_for_role(&UserRole::SuperAdmin);
        assert!(super_admin_perms.contains(&Permission::AdminAccess));
        assert!(super_admin_perms.contains(&Permission::AdminManageUsers));
        assert!(super_admin_perms.contains(&Permission::AdminViewAuditLog));
        assert!(super_admin_perms.contains(&Permission::WorkspaceDelete));
        assert!(super_admin_perms.contains(&Permission::TaskView));
    }

    #[test]
    fn test_admin_has_all_permissions() {
        let admin_perms = permissions_for_role(&UserRole::Admin);
        assert!(admin_perms.contains(&Permission::AdminAccess));
        assert!(admin_perms.contains(&Permission::AdminManageUsers));
        assert!(admin_perms.contains(&Permission::AdminViewAuditLog));
        assert!(admin_perms.contains(&Permission::WorkspaceDelete));
        assert!(admin_perms.contains(&Permission::TaskView));
    }

    #[test]
    fn test_manager_no_admin_permissions() {
        let manager_perms = permissions_for_role(&UserRole::Manager);
        assert!(!manager_perms.contains(&Permission::AdminAccess));
        assert!(!manager_perms.contains(&Permission::AdminManageUsers));
        assert!(!manager_perms.contains(&Permission::AdminViewAuditLog));
        assert!(manager_perms.contains(&Permission::WorkspaceDelete));
        assert!(manager_perms.contains(&Permission::TaskView));
    }

    #[test]
    fn test_member_limited_permissions() {
        let member_perms = permissions_for_role(&UserRole::Member);
        assert!(member_perms.contains(&Permission::TaskView));
        assert!(member_perms.contains(&Permission::TaskUpdate));
        assert!(member_perms.contains(&Permission::TaskCreate));
        assert!(member_perms.contains(&Permission::CommentCreate));
        assert!(member_perms.contains(&Permission::CommentDeleteOwn));
        assert!(member_perms.contains(&Permission::BoardCreate));

        assert!(!member_perms.contains(&Permission::WorkspaceDelete));
        assert!(!member_perms.contains(&Permission::AdminAccess));
        assert!(!member_perms.contains(&Permission::CommentDeleteAny));
    }

    #[test]
    fn test_has_permission() {
        assert!(has_permission(&UserRole::Admin, &Permission::AdminAccess));
        assert!(!has_permission(
            &UserRole::Manager,
            &Permission::AdminAccess
        ));
        assert!(!has_permission(&UserRole::Member, &Permission::AdminAccess));

        assert!(has_permission(&UserRole::Member, &Permission::TaskView));
    }

    #[test]
    fn test_require_permission() {
        assert!(require_permission(&UserRole::Admin, &Permission::AdminAccess).is_ok());
        assert!(require_permission(&UserRole::Manager, &Permission::AdminAccess).is_err());
    }

    #[test]
    fn test_role_levels() {
        // SuperAdmin >= everything
        assert!(has_role_level(&UserRole::SuperAdmin, &UserRole::SuperAdmin));
        assert!(has_role_level(&UserRole::SuperAdmin, &UserRole::Admin));
        assert!(has_role_level(&UserRole::SuperAdmin, &UserRole::Manager));
        assert!(has_role_level(&UserRole::SuperAdmin, &UserRole::Member));

        // Admin >= everything except SuperAdmin
        assert!(!has_role_level(&UserRole::Admin, &UserRole::SuperAdmin));
        assert!(has_role_level(&UserRole::Admin, &UserRole::Admin));
        assert!(has_role_level(&UserRole::Admin, &UserRole::Manager));
        assert!(has_role_level(&UserRole::Admin, &UserRole::Member));

        // Manager >= Manager, Member
        assert!(!has_role_level(&UserRole::Manager, &UserRole::SuperAdmin));
        assert!(!has_role_level(&UserRole::Manager, &UserRole::Admin));
        assert!(has_role_level(&UserRole::Manager, &UserRole::Manager));
        assert!(has_role_level(&UserRole::Manager, &UserRole::Member));

        // Member >= Member only
        assert!(!has_role_level(&UserRole::Member, &UserRole::SuperAdmin));
        assert!(!has_role_level(&UserRole::Member, &UserRole::Admin));
        assert!(!has_role_level(&UserRole::Member, &UserRole::Manager));
        assert!(has_role_level(&UserRole::Member, &UserRole::Member));
    }

    #[test]
    fn test_member_cannot_delete_boards() {
        assert!(
            !has_permission(&UserRole::Member, &Permission::BoardDelete),
            "Member should not have BoardDelete permission"
        );
    }

    #[test]
    fn test_member_cannot_manage_workspace_members() {
        assert!(
            !has_permission(&UserRole::Member, &Permission::WorkspaceManageMembers),
            "Member should not have WorkspaceManageMembers permission"
        );
    }

    #[test]
    fn test_manager_has_all_task_permissions() {
        let task_perms = [
            Permission::TaskCreate,
            Permission::TaskUpdate,
            Permission::TaskDelete,
            Permission::TaskAssign,
            Permission::TaskView,
        ];

        for perm in &task_perms {
            assert!(
                has_permission(&UserRole::Manager, perm),
                "Manager should have {:?} permission",
                perm
            );
        }
    }

    #[test]
    fn test_require_role_level_errors() {
        let result = require_role_level(&UserRole::Member, &UserRole::Admin);
        assert!(result.is_err());

        let err = result.unwrap_err();
        match err {
            AuthError::InsufficientRole { required, actual } => {
                assert_eq!(required, UserRole::Admin);
                assert_eq!(actual, UserRole::Member);
            }
            _ => panic!("Expected InsufficientRole error, got {:?}", err),
        }
    }

    #[test]
    fn test_permission_count_per_role() {
        let super_admin_perms = permissions_for_role(&UserRole::SuperAdmin);
        let admin_perms = permissions_for_role(&UserRole::Admin);
        let manager_perms = permissions_for_role(&UserRole::Manager);
        let member_perms = permissions_for_role(&UserRole::Member);

        assert_eq!(
            super_admin_perms.len(),
            17,
            "SuperAdmin should have 17 permissions"
        );
        assert_eq!(admin_perms.len(), 17, "Admin should have 17 permissions");
        assert_eq!(
            manager_perms.len(),
            14,
            "Manager should have 14 permissions"
        );
        assert_eq!(member_perms.len(), 6, "Member should have 6 permissions");
    }

    // ========================================================================
    // can_manage_workspace tests
    // ========================================================================

    #[test]
    fn test_can_manage_workspace_global_super_admin() {
        // Global super_admin can manage any workspace regardless of workspace role
        assert!(can_manage_workspace(&UserRole::SuperAdmin, None));
        assert!(can_manage_workspace(
            &UserRole::SuperAdmin,
            Some(&WorkspaceMemberRole::Member)
        ));
    }

    #[test]
    fn test_can_manage_workspace_global_admin() {
        // Global admin can manage any workspace regardless of workspace role
        assert!(can_manage_workspace(&UserRole::Admin, None));
        assert!(can_manage_workspace(
            &UserRole::Admin,
            Some(&WorkspaceMemberRole::Member)
        ));
        assert!(can_manage_workspace(
            &UserRole::Admin,
            Some(&WorkspaceMemberRole::Viewer)
        ));
    }

    #[test]
    fn test_can_manage_workspace_owner() {
        assert!(can_manage_workspace(
            &UserRole::Member,
            Some(&WorkspaceMemberRole::Owner)
        ));
        assert!(can_manage_workspace(
            &UserRole::Manager,
            Some(&WorkspaceMemberRole::Owner)
        ));
    }

    #[test]
    fn test_can_manage_workspace_ws_admin() {
        assert!(can_manage_workspace(
            &UserRole::Member,
            Some(&WorkspaceMemberRole::Admin)
        ));
        assert!(can_manage_workspace(
            &UserRole::Manager,
            Some(&WorkspaceMemberRole::Admin)
        ));
    }

    #[test]
    fn test_cannot_manage_workspace_member_or_viewer() {
        assert!(!can_manage_workspace(
            &UserRole::Member,
            Some(&WorkspaceMemberRole::Member)
        ));
        assert!(!can_manage_workspace(
            &UserRole::Member,
            Some(&WorkspaceMemberRole::Viewer)
        ));
        assert!(!can_manage_workspace(
            &UserRole::Manager,
            Some(&WorkspaceMemberRole::Member)
        ));
        assert!(!can_manage_workspace(
            &UserRole::Manager,
            Some(&WorkspaceMemberRole::Viewer)
        ));
    }

    #[test]
    fn test_cannot_manage_workspace_no_ws_role_non_admin() {
        assert!(!can_manage_workspace(&UserRole::Member, None));
        assert!(!can_manage_workspace(&UserRole::Manager, None));
    }

    // ========================================================================
    // Role hierarchy superset property
    // ========================================================================

    #[test]
    fn test_super_admin_permissions_superset_of_admin() {
        let super_admin_perms = permissions_for_role(&UserRole::SuperAdmin);
        let admin_perms = permissions_for_role(&UserRole::Admin);
        for perm in &admin_perms {
            assert!(
                super_admin_perms.contains(perm),
                "SuperAdmin should have all Admin permissions, missing {:?}",
                perm
            );
        }
    }

    #[test]
    fn test_admin_permissions_superset_of_manager() {
        let admin_perms = permissions_for_role(&UserRole::Admin);
        let manager_perms = permissions_for_role(&UserRole::Manager);
        for perm in &manager_perms {
            assert!(
                admin_perms.contains(perm),
                "Admin should have all Manager permissions, missing {:?}",
                perm
            );
        }
    }

    #[test]
    fn test_manager_permissions_superset_of_member() {
        let manager_perms = permissions_for_role(&UserRole::Manager);
        let member_perms = permissions_for_role(&UserRole::Member);
        for perm in &member_perms {
            assert!(
                manager_perms.contains(perm),
                "Manager should have all Member permissions, missing {:?}",
                perm
            );
        }
    }

    // ========================================================================
    // AuthError display messages
    // ========================================================================

    #[test]
    fn test_auth_error_permission_denied_display() {
        let err = AuthError::PermissionDenied(Permission::AdminAccess);
        let msg = format!("{}", err);
        assert!(
            msg.contains("Permission denied"),
            "Error should mention permission denied: {}",
            msg
        );
    }

    #[test]
    fn test_auth_error_insufficient_role_display() {
        let err = AuthError::InsufficientRole {
            required: UserRole::Admin,
            actual: UserRole::Member,
        };
        let msg = format!("{}", err);
        assert!(
            msg.contains("Insufficient role"),
            "Error should mention insufficient role: {}",
            msg
        );
    }

    // ========================================================================
    // require_role_level success cases
    // ========================================================================

    #[test]
    fn test_require_role_level_succeeds() {
        assert!(require_role_level(&UserRole::SuperAdmin, &UserRole::SuperAdmin).is_ok());
        assert!(require_role_level(&UserRole::SuperAdmin, &UserRole::Admin).is_ok());
        assert!(require_role_level(&UserRole::Admin, &UserRole::Admin).is_ok());
        assert!(require_role_level(&UserRole::Admin, &UserRole::Member).is_ok());
        assert!(require_role_level(&UserRole::Manager, &UserRole::Member).is_ok());
        assert!(require_role_level(&UserRole::Member, &UserRole::Member).is_ok());
    }

    // ========================================================================
    // Member cannot delete or assign tasks
    // ========================================================================

    #[test]
    fn test_member_cannot_delete_tasks() {
        assert!(!has_permission(&UserRole::Member, &Permission::TaskDelete));
    }

    #[test]
    fn test_member_cannot_assign_tasks() {
        assert!(!has_permission(&UserRole::Member, &Permission::TaskAssign));
    }

    // ========================================================================
    // capabilities_for_user_role tests
    // ========================================================================

    #[test]
    fn test_superadmin_all_caps() {
        let caps = capabilities_for_user_role(&UserRole::SuperAdmin);
        assert!(caps.can_view_all_tasks);
        assert!(caps.can_create_tasks);
        assert!(caps.can_edit_own_tasks);
        assert!(caps.can_edit_all_tasks);
        assert!(caps.can_delete_tasks);
        assert!(caps.can_manage_members);
        assert!(caps.can_manage_project_settings);
        assert!(caps.can_manage_automations);
        assert!(caps.can_export);
        assert!(caps.can_manage_billing);
        assert!(caps.can_invite_members);
        assert!(caps.can_manage_roles);
    }

    #[test]
    fn test_admin_all_caps() {
        let caps = capabilities_for_user_role(&UserRole::Admin);
        assert_eq!(caps, Capabilities::full());
    }

    #[test]
    fn test_manager_no_billing_or_roles() {
        let caps = capabilities_for_user_role(&UserRole::Manager);
        assert!(caps.can_view_all_tasks);
        assert!(caps.can_create_tasks);
        assert!(!caps.can_manage_billing);
        assert!(!caps.can_manage_roles);
    }

    #[test]
    fn test_member_minimal_caps() {
        let caps = capabilities_for_user_role(&UserRole::Member);
        assert!(caps.can_create_tasks);
        assert!(caps.can_edit_own_tasks);
        assert!(caps.can_export);
        // Should NOT have:
        assert!(!caps.can_view_all_tasks);
        assert!(!caps.can_edit_all_tasks);
        assert!(!caps.can_delete_tasks);
        assert!(!caps.can_manage_members);
        assert!(!caps.can_manage_project_settings);
        assert!(!caps.can_manage_automations);
        assert!(!caps.can_manage_billing);
        assert!(!caps.can_invite_members);
        assert!(!caps.can_manage_roles);
    }
}
