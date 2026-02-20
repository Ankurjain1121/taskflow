//! Admin user management routes
//!
//! Provides endpoints for managing tenant users, including role updates and soft deletion.
//! All endpoints require Admin role.

use axum::{
    extract::{Path, Query, State},
    middleware::from_fn_with_state,
    routing::{delete, get, put},
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::AdminUser;
use crate::middleware::auth_middleware;
use crate::state::AppState;
use taskflow_db::models::UserRole;

/// Query parameters for user listing
#[derive(Debug, Deserialize)]
pub struct ListUsersQuery {
    /// Search by name or email
    pub search: Option<String>,
    /// Filter by role
    pub role: Option<String>,
}

/// User with workspace memberships
#[derive(Debug, Serialize)]
pub struct AdminUserView {
    pub id: Uuid,
    pub email: String,
    pub name: String,
    pub avatar_url: Option<String>,
    pub role: UserRole,
    pub onboarding_completed: bool,
    pub created_at: DateTime<Utc>,
    pub workspaces: Vec<WorkspaceMembership>,
}

/// Workspace membership info
#[derive(Debug, Serialize)]
pub struct WorkspaceMembership {
    pub workspace_id: Uuid,
    pub workspace_name: String,
    pub joined_at: DateTime<Utc>,
}

/// Request body for role update
#[derive(Debug, Deserialize)]
pub struct UpdateRoleRequest {
    pub role: UserRole,
}

/// Response for user operations
#[derive(Debug, Serialize)]
pub struct UserOperationResponse {
    pub success: bool,
    pub message: String,
}

/// Raw user row from database
#[derive(Debug)]
struct UserRow {
    id: Uuid,
    email: String,
    name: String,
    avatar_url: Option<String>,
    role: UserRole,
    onboarding_completed: bool,
    created_at: DateTime<Utc>,
}

/// GET /api/admin/users
///
/// List all users in the tenant with their workspace memberships.
/// Requires Admin role.
async fn list_users(
    State(state): State<AppState>,
    admin: AdminUser,
    Query(query): Query<ListUsersQuery>,
) -> Result<Json<Vec<AdminUserView>>> {
    let tenant_id = admin.0.tenant_id;

    // Parse role filter
    let role_filter: Option<UserRole> =
        query
            .role
            .as_ref()
            .and_then(|r| match r.to_lowercase().as_str() {
                "admin" => Some(UserRole::Admin),
                "manager" => Some(UserRole::Manager),
                "member" => Some(UserRole::Member),
                _ => None,
            });

    // Fetch users
    let users: Vec<UserRow> = sqlx::query_as!(
        UserRow,
        r#"
        SELECT
            id,
            email,
            name,
            avatar_url,
            role as "role: UserRole",
            onboarding_completed,
            created_at
        FROM users
        WHERE tenant_id = $1
          AND deleted_at IS NULL
          AND ($2::text IS NULL OR name ILIKE '%' || $2 || '%' OR email ILIKE '%' || $2 || '%')
          AND ($3::user_role IS NULL OR role = $3)
        ORDER BY created_at DESC
        "#,
        tenant_id,
        query.search,
        role_filter as Option<UserRole>
    )
    .fetch_all(&state.db)
    .await?;

    // Fetch workspace memberships for all users
    let user_ids: Vec<Uuid> = users.iter().map(|u| u.id).collect();

    let memberships: Vec<(Uuid, Uuid, String, DateTime<Utc>)> = sqlx::query_as(
        r#"
        SELECT
            wm.user_id,
            wm.workspace_id,
            w.name,
            wm.joined_at
        FROM workspace_members wm
        JOIN workspaces w ON w.id = wm.workspace_id
        WHERE wm.user_id = ANY($1)
          AND w.deleted_at IS NULL
        ORDER BY wm.joined_at DESC
        "#,
    )
    .bind(&user_ids)
    .fetch_all(&state.db)
    .await?;

    // Build response with memberships
    let result: Vec<AdminUserView> = users
        .into_iter()
        .map(|user| {
            let user_memberships: Vec<WorkspaceMembership> = memberships
                .iter()
                .filter(|(uid, _, _, _)| *uid == user.id)
                .map(|(_, ws_id, ws_name, joined_at)| WorkspaceMembership {
                    workspace_id: *ws_id,
                    workspace_name: ws_name.clone(),
                    joined_at: *joined_at,
                })
                .collect();

            AdminUserView {
                id: user.id,
                email: user.email,
                name: user.name,
                avatar_url: user.avatar_url,
                role: user.role,
                onboarding_completed: user.onboarding_completed,
                created_at: user.created_at,
                workspaces: user_memberships,
            }
        })
        .collect();

    Ok(Json(result))
}

/// PUT /api/admin/users/:id/role
///
/// Update a user's global role.
/// Prevents demoting the last admin in the tenant.
/// Requires Admin role.
async fn update_user_role(
    State(state): State<AppState>,
    admin: AdminUser,
    Path(user_id): Path<Uuid>,
    Json(body): Json<UpdateRoleRequest>,
) -> Result<Json<UserOperationResponse>> {
    let tenant_id = admin.0.tenant_id;
    let admin_id = admin.0.user_id;

    // Verify target user exists and belongs to same tenant
    let target_user: Option<(Uuid, UserRole)> = sqlx::query_as(
        r#"
        SELECT id, role as "role: UserRole"
        FROM users
        WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
        "#,
    )
    .bind(user_id)
    .bind(tenant_id)
    .fetch_optional(&state.db)
    .await?;

    let (_, current_role) =
        target_user.ok_or_else(|| AppError::NotFound("User not found".into()))?;

    // If demoting from admin, check if this is the last admin
    if current_role == UserRole::Admin && body.role != UserRole::Admin {
        let admin_count: i64 = sqlx::query_scalar!(
            r#"
            SELECT COUNT(*) as "count!"
            FROM users
            WHERE tenant_id = $1 AND role = 'admin' AND deleted_at IS NULL
            "#,
            tenant_id
        )
        .fetch_one(&state.db)
        .await?;

        if admin_count <= 1 {
            return Err(AppError::BadRequest(
                "Cannot demote the last admin. Promote another user to admin first.".into(),
            ));
        }
    }

    // Update the role
    sqlx::query!(
        r#"
        UPDATE users
        SET role = $1, updated_at = NOW()
        WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL
        "#,
        body.role as UserRole,
        user_id,
        tenant_id
    )
    .execute(&state.db)
    .await?;

    tracing::info!(
        admin_id = %admin_id,
        target_user_id = %user_id,
        old_role = ?current_role,
        new_role = ?body.role,
        "User role updated"
    );

    Ok(Json(UserOperationResponse {
        success: true,
        message: format!("User role updated to {:?}", body.role),
    }))
}

/// DELETE /api/admin/users/:id
///
/// Soft-delete a user and remove their workspace memberships.
/// Cannot delete yourself or the last admin.
/// Requires Admin role.
async fn delete_user(
    State(state): State<AppState>,
    admin: AdminUser,
    Path(user_id): Path<Uuid>,
) -> Result<Json<UserOperationResponse>> {
    let tenant_id = admin.0.tenant_id;
    let admin_id = admin.0.user_id;

    // Cannot delete yourself
    if user_id == admin_id {
        return Err(AppError::BadRequest("Cannot delete yourself".into()));
    }

    // Verify target user exists and belongs to same tenant
    let target_user: Option<(Uuid, UserRole)> = sqlx::query_as(
        r#"
        SELECT id, role as "role: UserRole"
        FROM users
        WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
        "#,
    )
    .bind(user_id)
    .bind(tenant_id)
    .fetch_optional(&state.db)
    .await?;

    let (_, user_role) = target_user.ok_or_else(|| AppError::NotFound("User not found".into()))?;

    // If deleting an admin, check if this is the last admin
    if user_role == UserRole::Admin {
        let admin_count: i64 = sqlx::query_scalar!(
            r#"
            SELECT COUNT(*) as "count!"
            FROM users
            WHERE tenant_id = $1 AND role = 'admin' AND deleted_at IS NULL
            "#,
            tenant_id
        )
        .fetch_one(&state.db)
        .await?;

        if admin_count <= 1 {
            return Err(AppError::BadRequest(
                "Cannot delete the last admin. Promote another user to admin first.".into(),
            ));
        }
    }

    // Start transaction
    let mut tx = state.db.begin().await?;

    // Remove workspace memberships
    sqlx::query!(
        r#"
        DELETE FROM workspace_members
        WHERE user_id = $1
        "#,
        user_id
    )
    .execute(&mut *tx)
    .await?;

    // Remove board memberships
    sqlx::query!(
        r#"
        DELETE FROM board_members
        WHERE user_id = $1
        "#,
        user_id
    )
    .execute(&mut *tx)
    .await?;

    // Soft-delete the user
    sqlx::query!(
        r#"
        UPDATE users
        SET deleted_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2
        "#,
        user_id,
        tenant_id
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    tracing::info!(
        admin_id = %admin_id,
        deleted_user_id = %user_id,
        "User soft-deleted"
    );

    Ok(Json(UserOperationResponse {
        success: true,
        message: "User deleted successfully".into(),
    }))
}

/// Create the admin users router
pub fn admin_users_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/admin/users", get(list_users))
        .route("/admin/users/{id}/role", put(update_user_role))
        .route("/admin/users/{id}", delete(delete_user))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_update_role_request_deserialize() {
        let json = r#"{"role": "Manager"}"#;
        let req: UpdateRoleRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.role, UserRole::Manager);
    }

    #[test]
    fn test_list_users_query_deserialize() {
        let json = r#"{"search": "john", "role": "admin"}"#;
        let query: ListUsersQuery = serde_json::from_str(json).unwrap();
        assert_eq!(query.search, Some("john".to_string()));
        assert_eq!(query.role, Some("admin".to_string()));
    }
}
