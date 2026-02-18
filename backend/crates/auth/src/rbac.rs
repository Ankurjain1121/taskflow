//! Role-Based Access Control (RBAC) permission system
//!
//! Defines permissions and maps them to user roles.

use std::collections::HashSet;

use taskflow_db::models::UserRole;
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
        UserRole::Admin => {
            // Admin has ALL permissions
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

/// Check if a user has at least the specified role level
pub fn has_role_level(actual: &UserRole, required: &UserRole) -> bool {
    match (actual, required) {
        // Admin is the highest level
        (UserRole::Admin, _) => true,
        // Manager is mid-level
        (UserRole::Manager, UserRole::Manager) => true,
        (UserRole::Manager, UserRole::Member) => true,
        (UserRole::Manager, UserRole::Admin) => false,
        // Member is lowest level
        (UserRole::Member, UserRole::Member) => true,
        (UserRole::Member, _) => false,
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
        assert!(!has_permission(&UserRole::Manager, &Permission::AdminAccess));
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
        // Admin >= everything
        assert!(has_role_level(&UserRole::Admin, &UserRole::Admin));
        assert!(has_role_level(&UserRole::Admin, &UserRole::Manager));
        assert!(has_role_level(&UserRole::Admin, &UserRole::Member));

        // Manager >= Manager, Member
        assert!(!has_role_level(&UserRole::Manager, &UserRole::Admin));
        assert!(has_role_level(&UserRole::Manager, &UserRole::Manager));
        assert!(has_role_level(&UserRole::Manager, &UserRole::Member));

        // Member >= Member only
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
        let admin_perms = permissions_for_role(&UserRole::Admin);
        let manager_perms = permissions_for_role(&UserRole::Manager);
        let member_perms = permissions_for_role(&UserRole::Member);

        assert_eq!(admin_perms.len(), 17, "Admin should have 17 permissions");
        assert_eq!(manager_perms.len(), 14, "Manager should have 14 permissions");
        assert_eq!(member_perms.len(), 6, "Member should have 6 permissions");
    }
}
