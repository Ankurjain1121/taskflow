use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{Capabilities, WorkspaceRole};

/// Input for creating a custom workspace role
#[derive(Debug, Deserialize)]
pub struct CreateWorkspaceRoleInput {
    pub name: String,
    pub description: Option<String>,
    pub capabilities: Capabilities,
    pub position: Option<i32>,
}

/// Input for updating a workspace role
#[derive(Debug, Deserialize)]
pub struct UpdateWorkspaceRoleInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub capabilities: Option<Capabilities>,
    pub position: Option<i32>,
}

/// Lightweight role info for display in member lists
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct WorkspaceRoleSummary {
    pub id: Uuid,
    pub name: String,
    pub is_system: bool,
    pub position: i32,
}

/// List all roles for a workspace, ordered by position
pub async fn list_workspace_roles(
    pool: &PgPool,
    workspace_id: Uuid,
) -> Result<Vec<WorkspaceRole>, sqlx::Error> {
    sqlx::query_as::<_, WorkspaceRole>(
        r"
        SELECT id, workspace_id, name, description, is_system, capabilities, position, created_at, updated_at
        FROM workspace_roles
        WHERE workspace_id = $1
        ORDER BY position ASC, name ASC
        ",
    )
    .bind(workspace_id)
    .fetch_all(pool)
    .await
}

/// Get a single role by ID
pub async fn get_workspace_role(
    pool: &PgPool,
    role_id: Uuid,
) -> Result<Option<WorkspaceRole>, sqlx::Error> {
    sqlx::query_as::<_, WorkspaceRole>(
        r"
        SELECT id, workspace_id, name, description, is_system, capabilities, position, created_at, updated_at
        FROM workspace_roles
        WHERE id = $1
        ",
    )
    .bind(role_id)
    .fetch_optional(pool)
    .await
}

/// Get a workspace role by workspace ID and role name
pub async fn get_workspace_role_by_name(
    pool: &PgPool,
    workspace_id: Uuid,
    name: &str,
) -> Result<Option<WorkspaceRole>, sqlx::Error> {
    sqlx::query_as::<_, WorkspaceRole>(
        r"
        SELECT id, workspace_id, name, description, is_system, capabilities, position, created_at, updated_at
        FROM workspace_roles
        WHERE workspace_id = $1 AND name = $2
        ",
    )
    .bind(workspace_id)
    .bind(name)
    .fetch_optional(pool)
    .await
}

/// Create a custom (non-system) role
pub async fn create_workspace_role(
    pool: &PgPool,
    workspace_id: Uuid,
    input: CreateWorkspaceRoleInput,
) -> Result<WorkspaceRole, sqlx::Error> {
    let capabilities_json =
        serde_json::to_value(&input.capabilities).unwrap_or_else(|_| serde_json::json!({}));
    let position = input.position.unwrap_or(99);

    sqlx::query_as::<_, WorkspaceRole>(
        r"
        INSERT INTO workspace_roles (id, workspace_id, name, description, is_system, capabilities, position)
        VALUES ($1, $2, $3, $4, false, $5, $6)
        RETURNING id, workspace_id, name, description, is_system, capabilities, position, created_at, updated_at
        ",
    )
    .bind(Uuid::new_v4())
    .bind(workspace_id)
    .bind(&input.name)
    .bind(&input.description)
    .bind(&capabilities_json)
    .bind(position)
    .fetch_one(pool)
    .await
}

/// Update an existing role (only non-system fields for system roles)
pub async fn update_workspace_role(
    pool: &PgPool,
    role_id: Uuid,
    input: UpdateWorkspaceRoleInput,
) -> Result<WorkspaceRole, sqlx::Error> {
    let capabilities_json = input
        .capabilities
        .as_ref()
        .and_then(|c| serde_json::to_value(c).ok());

    sqlx::query_as::<_, WorkspaceRole>(
        r"
        UPDATE workspace_roles
        SET
            name = COALESCE($2, name),
            description = COALESCE($3, description),
            capabilities = COALESCE($4, capabilities),
            position = COALESCE($5, position),
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, workspace_id, name, description, is_system, capabilities, position, created_at, updated_at
        ",
    )
    .bind(role_id)
    .bind(&input.name)
    .bind(&input.description)
    .bind(&capabilities_json)
    .bind(input.position)
    .fetch_one(pool)
    .await
}

/// Delete a custom role. System roles cannot be deleted.
pub async fn delete_workspace_role(pool: &PgPool, role_id: Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        r"
        DELETE FROM workspace_roles
        WHERE id = $1 AND is_system = false
        ",
    )
    .bind(role_id)
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}

/// Seed system roles for a single workspace.
/// Called when a new workspace is created.
pub async fn seed_system_roles(
    pool: &PgPool,
    workspace_id: Uuid,
) -> Result<Vec<WorkspaceRole>, sqlx::Error> {
    sqlx::query_as::<_, WorkspaceRole>(
        r"
        INSERT INTO workspace_roles (id, workspace_id, name, description, is_system, capabilities, position)
        VALUES
            ($1, $7, 'Owner',   'Full control over the workspace',          true, $2, 0),
            ($8, $7, 'Admin',   'Administer workspace settings and members', true, $3, 1),
            ($9, $7, 'Manager', 'Manage projects and team members',          true, $4, 2),
            ($10, $7, 'Member', 'Standard workspace member',                 true, $5, 3),
            ($11, $7, 'Viewer', 'Read-only access',                          true, $6, 4),
            ($12, $7, 'Guest',  'Limited access to specific projects',       true, '{}', 5)
        ON CONFLICT (workspace_id, name) DO NOTHING
        RETURNING id, workspace_id, name, description, is_system, capabilities, position, created_at, updated_at
        ",
    )
    .bind(Uuid::new_v4()) // $1 - Owner id
    .bind(serde_json::json!({                // $2 - Owner capabilities
        "can_view_all_tasks": true,
        "can_create_tasks": true,
        "can_edit_own_tasks": true,
        "can_edit_all_tasks": true,
        "can_delete_tasks": true,
        "can_manage_members": true,
        "can_manage_project_settings": true,
        "can_manage_automations": true,
        "can_export": true,
        "can_manage_billing": true,
        "can_invite_members": true,
        "can_manage_roles": true
    }))
    .bind(serde_json::json!({                // $3 - Admin capabilities
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
    }))
    .bind(serde_json::json!({                // $4 - Manager capabilities
        "can_view_all_tasks": true,
        "can_create_tasks": true,
        "can_edit_own_tasks": true,
        "can_edit_all_tasks": true,
        "can_delete_tasks": false,
        "can_manage_members": true,
        "can_manage_project_settings": false,
        "can_manage_automations": true,
        "can_export": true,
        "can_manage_billing": false,
        "can_invite_members": false,
        "can_manage_roles": false
    }))
    .bind(serde_json::json!({                // $5 - Member capabilities
        "can_view_all_tasks": false,
        "can_create_tasks": true,
        "can_edit_own_tasks": true,
        "can_edit_all_tasks": false,
        "can_delete_tasks": false,
        "can_manage_members": false,
        "can_manage_project_settings": false,
        "can_manage_automations": false,
        "can_export": true,
        "can_manage_billing": false,
        "can_invite_members": false,
        "can_manage_roles": false
    }))
    .bind(serde_json::json!({                // $6 - Viewer capabilities
        "can_view_all_tasks": false,
        "can_create_tasks": false,
        "can_edit_own_tasks": false,
        "can_edit_all_tasks": false,
        "can_delete_tasks": false,
        "can_manage_members": false,
        "can_manage_project_settings": false,
        "can_manage_automations": false,
        "can_export": false,
        "can_manage_billing": false,
        "can_invite_members": false,
        "can_manage_roles": false
    }))
    .bind(workspace_id) // $7
    .bind(Uuid::new_v4()) // $8 - Admin id
    .bind(Uuid::new_v4()) // $9 - Manager id
    .bind(Uuid::new_v4()) // $10 - Member id
    .bind(Uuid::new_v4()) // $11 - Viewer id
    .bind(Uuid::new_v4()) // $12 - Guest id
    .fetch_all(pool)
    .await
}
