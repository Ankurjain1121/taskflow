//! Workspace query functions

use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{UserPublic, Workspace, WorkspaceMember};

/// List workspaces for a user (by membership)
pub async fn list_workspaces_for_user(
    pool: &PgPool,
    user_id: Uuid,
    tenant_id: Uuid,
) -> Result<Vec<Workspace>, sqlx::Error> {
    sqlx::query_as!(
        Workspace,
        r#"
        SELECT w.id, w.name, w.description, w.tenant_id, w.created_by_id,
               w.deleted_at, w.created_at, w.updated_at
        FROM workspaces w
        INNER JOIN workspace_members wm ON w.id = wm.workspace_id
        WHERE wm.user_id = $1
          AND w.tenant_id = $2
          AND w.deleted_at IS NULL
        ORDER BY w.created_at DESC
        "#,
        user_id,
        tenant_id
    )
    .fetch_all(pool)
    .await
}

/// Workspace with members for detailed view
#[derive(serde::Serialize, Clone, Debug)]
pub struct WorkspaceWithMembers {
    #[serde(flatten)]
    pub workspace: Workspace,
    pub members: Vec<WorkspaceMemberInfo>,
}

#[derive(serde::Serialize, Clone, Debug)]
pub struct WorkspaceMemberInfo {
    pub user_id: Uuid,
    pub name: String,
    pub email: String,
    pub avatar_url: Option<String>,
    pub joined_at: chrono::DateTime<chrono::Utc>,
}

/// Get a workspace by ID with its members
pub async fn get_workspace_by_id(
    pool: &PgPool,
    id: Uuid,
    tenant_id: Uuid,
) -> Result<Option<WorkspaceWithMembers>, sqlx::Error> {
    let workspace = sqlx::query_as!(
        Workspace,
        r#"
        SELECT id, name, description, tenant_id, created_by_id,
               deleted_at, created_at, updated_at
        FROM workspaces
        WHERE id = $1
          AND tenant_id = $2
          AND deleted_at IS NULL
        "#,
        id,
        tenant_id
    )
    .fetch_optional(pool)
    .await?;

    match workspace {
        Some(ws) => {
            let members = sqlx::query_as!(
                WorkspaceMemberInfo,
                r#"
                SELECT wm.user_id, u.name, u.email, u.avatar_url, wm.joined_at
                FROM workspace_members wm
                INNER JOIN users u ON wm.user_id = u.id
                WHERE wm.workspace_id = $1
                  AND u.deleted_at IS NULL
                ORDER BY wm.joined_at ASC
                "#,
                id
            )
            .fetch_all(pool)
            .await?;

            Ok(Some(WorkspaceWithMembers {
                workspace: ws,
                members,
            }))
        }
        None => Ok(None),
    }
}

/// Create a new workspace and add creator as member
pub async fn create_workspace(
    pool: &PgPool,
    name: &str,
    description: Option<&str>,
    tenant_id: Uuid,
    created_by_id: Uuid,
) -> Result<Workspace, sqlx::Error> {
    let mut tx = pool.begin().await?;

    let workspace = sqlx::query_as!(
        Workspace,
        r#"
        INSERT INTO workspaces (name, description, tenant_id, created_by_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, description, tenant_id, created_by_id,
                  deleted_at, created_at, updated_at
        "#,
        name,
        description,
        tenant_id,
        created_by_id
    )
    .fetch_one(&mut *tx)
    .await?;

    // Add creator as workspace member
    sqlx::query!(
        r#"
        INSERT INTO workspace_members (workspace_id, user_id)
        VALUES ($1, $2)
        "#,
        workspace.id,
        created_by_id
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(workspace)
}

/// Update workspace name and description
pub async fn update_workspace(
    pool: &PgPool,
    id: Uuid,
    name: &str,
    description: Option<&str>,
) -> Result<Option<Workspace>, sqlx::Error> {
    sqlx::query_as!(
        Workspace,
        r#"
        UPDATE workspaces
        SET name = $2, description = $3
        WHERE id = $1
          AND deleted_at IS NULL
        RETURNING id, name, description, tenant_id, created_by_id,
                  deleted_at, created_at, updated_at
        "#,
        id,
        name,
        description
    )
    .fetch_optional(pool)
    .await
}

/// Soft-delete a workspace
pub async fn soft_delete_workspace(pool: &PgPool, id: Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        UPDATE workspaces
        SET deleted_at = NOW()
        WHERE id = $1
          AND deleted_at IS NULL
        "#,
        id
    )
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}

/// Search workspace members by name or email (ILIKE)
pub async fn search_workspace_members(
    pool: &PgPool,
    workspace_id: Uuid,
    query: &str,
    limit: i64,
) -> Result<Vec<UserPublic>, sqlx::Error> {
    let pattern = format!("%{}%", query);
    sqlx::query_as!(
        UserPublic,
        r#"
        SELECT u.id, u.email, u.name, u.avatar_url,
               u.role AS "role: _", u.tenant_id, u.onboarding_completed, u.created_at
        FROM users u
        INNER JOIN workspace_members wm ON u.id = wm.user_id
        WHERE wm.workspace_id = $1
          AND u.deleted_at IS NULL
          AND (u.name ILIKE $2 OR u.email ILIKE $2)
        ORDER BY u.name ASC
        LIMIT $3
        "#,
        workspace_id,
        pattern,
        limit
    )
    .fetch_all(pool)
    .await
}

/// Add a user to a workspace
pub async fn add_workspace_member(
    pool: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
) -> Result<WorkspaceMember, sqlx::Error> {
    sqlx::query_as!(
        WorkspaceMember,
        r#"
        INSERT INTO workspace_members (workspace_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (workspace_id, user_id) DO NOTHING
        RETURNING id, workspace_id, user_id, joined_at
        "#,
        workspace_id,
        user_id
    )
    .fetch_one(pool)
    .await
}

/// Remove a user from a workspace (also removes from board_members in that workspace)
pub async fn remove_workspace_member(
    pool: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let mut tx = pool.begin().await?;

    // Remove from board_members for all boards in this workspace
    sqlx::query!(
        r#"
        DELETE FROM board_members
        WHERE user_id = $1
          AND board_id IN (
              SELECT id FROM boards
              WHERE workspace_id = $2 AND deleted_at IS NULL
          )
        "#,
        user_id,
        workspace_id
    )
    .execute(&mut *tx)
    .await?;

    // Remove from workspace_members
    let result = sqlx::query!(
        r#"
        DELETE FROM workspace_members
        WHERE workspace_id = $1 AND user_id = $2
        "#,
        workspace_id,
        user_id
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(result.rows_affected() > 0)
}

/// Check if a user is a member of a workspace
pub async fn is_workspace_member(
    pool: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM workspace_members
            WHERE workspace_id = $1 AND user_id = $2
        ) AS "exists!"
        "#,
        workspace_id,
        user_id
    )
    .fetch_one(pool)
    .await?;

    Ok(result)
}
