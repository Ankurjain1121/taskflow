//! Workspace query functions

use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{
    UserPublic, Workspace, WorkspaceMember, WorkspaceMemberRole, WorkspaceVisibility,
};

/// List workspaces for a user (by membership).
///
/// Global Admins see all non-private workspaces in their tenant (implicit membership),
/// plus private workspaces they are explicit members of.
pub async fn list_workspaces_for_user(
    pool: &PgPool,
    user_id: Uuid,
    tenant_id: Uuid,
    is_global_admin: bool,
) -> Result<Vec<Workspace>, sqlx::Error> {
    if is_global_admin {
        sqlx::query_as::<_, Workspace>(
            r"
            SELECT id, name, description, logo_url, visibility,
                   tenant_id, created_by_id, deleted_at, created_at, updated_at
            FROM workspaces
            WHERE tenant_id = $1
              AND deleted_at IS NULL
              AND (
                  visibility != 'private'
                  OR id IN (SELECT workspace_id FROM workspace_members WHERE user_id = $2)
              )
            ORDER BY created_at DESC
            ",
        )
        .bind(tenant_id)
        .bind(user_id)
        .fetch_all(pool)
        .await
    } else {
        sqlx::query_as::<_, Workspace>(
            r"
            SELECT w.id, w.name, w.description, w.logo_url, w.visibility,
                   w.tenant_id, w.created_by_id, w.deleted_at, w.created_at, w.updated_at
            FROM workspaces w
            INNER JOIN workspace_members wm ON w.id = wm.workspace_id
            WHERE wm.user_id = $1
              AND w.tenant_id = $2
              AND w.deleted_at IS NULL
            ORDER BY w.created_at DESC
            ",
        )
        .bind(user_id)
        .bind(tenant_id)
        .fetch_all(pool)
        .await
    }
}

/// Workspace with members for detailed view
#[derive(serde::Serialize, Clone, Debug)]
pub struct WorkspaceWithMembers {
    #[serde(flatten)]
    pub workspace: Workspace,
    pub members: Vec<WorkspaceMemberInfo>,
}

#[derive(sqlx::FromRow, serde::Serialize, Clone, Debug)]
pub struct WorkspaceMemberInfo {
    pub user_id: Uuid,
    pub name: String,
    pub email: String,
    pub avatar_url: Option<String>,
    pub job_title: Option<String>,
    pub department: Option<String>,
    pub role: WorkspaceMemberRole,
    pub joined_at: chrono::DateTime<chrono::Utc>,
    pub is_org_admin: bool,
    pub phone_number: Option<String>,
    pub last_login_at: Option<chrono::DateTime<chrono::Utc>>,
    pub is_implicit: bool,
}

/// Get a workspace by ID with its members
pub async fn get_workspace_by_id(
    pool: &PgPool,
    id: Uuid,
    tenant_id: Uuid,
) -> Result<Option<WorkspaceWithMembers>, sqlx::Error> {
    let workspace = sqlx::query_as::<_, Workspace>(
        r"
        SELECT id, name, description, logo_url, visibility, tenant_id, created_by_id,
               deleted_at, created_at, updated_at
        FROM workspaces
        WHERE id = $1
          AND tenant_id = $2
          AND deleted_at IS NULL
        ",
    )
    .bind(id)
    .bind(tenant_id)
    .fetch_optional(pool)
    .await?;

    match workspace {
        Some(ws) => {
            let members = sqlx::query_as::<_, WorkspaceMemberInfo>(
                r"
                SELECT user_id, name, email, avatar_url, job_title, department, role, joined_at, is_org_admin, phone_number, last_login_at, is_implicit
                FROM (
                    -- Explicit workspace members
                    SELECT wm.user_id, u.name, u.email, u.avatar_url, u.job_title, u.department,
                           wm.role, wm.joined_at,
                           (u.role = 'super_admin') AS is_org_admin,
                           u.phone_number, u.last_login_at,
                           false AS is_implicit
                    FROM workspace_members wm
                    INNER JOIN users u ON wm.user_id = u.id
                    WHERE wm.workspace_id = $1
                      AND u.deleted_at IS NULL

                    UNION ALL

                    -- Global admins who are NOT explicit members (implicit access)
                    -- Excluded for private workspaces
                    SELECT u.id AS user_id, u.name, u.email, u.avatar_url, u.job_title, u.department,
                           'admin'::workspace_member_role AS role, u.created_at AS joined_at,
                           (u.role = 'super_admin') AS is_org_admin,
                           u.phone_number, u.last_login_at,
                           true AS is_implicit
                    FROM users u
                    WHERE u.role IN ('admin', 'super_admin')
                      AND u.deleted_at IS NULL
                      AND u.tenant_id = $2
                      AND NOT EXISTS (
                          SELECT 1 FROM workspace_members wm2
                          WHERE wm2.workspace_id = $1 AND wm2.user_id = u.id
                      )
                      AND NOT EXISTS (
                          SELECT 1 FROM workspaces w
                          WHERE w.id = $1 AND w.visibility = 'private'
                      )
                ) combined
                ORDER BY is_org_admin DESC, joined_at ASC
                ",
            )
            .bind(id)
            .bind(ws.tenant_id)
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

/// Create a new workspace and add creator as owner
pub async fn create_workspace(
    pool: &PgPool,
    name: &str,
    description: Option<&str>,
    tenant_id: Uuid,
    created_by_id: Uuid,
) -> Result<Workspace, sqlx::Error> {
    let mut tx = pool.begin().await?;

    let workspace = sqlx::query_as::<_, Workspace>(
        r"
        INSERT INTO workspaces (name, description, tenant_id, created_by_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, description, logo_url, visibility, tenant_id, created_by_id,
                  deleted_at, created_at, updated_at
        ",
    )
    .bind(name)
    .bind(description)
    .bind(tenant_id)
    .bind(created_by_id)
    .fetch_one(&mut *tx)
    .await?;

    // Add creator as workspace owner
    sqlx::query(
        r"
        INSERT INTO workspace_members (workspace_id, user_id, role)
        VALUES ($1, $2, 'owner')
        ",
    )
    .bind(workspace.id)
    .bind(created_by_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    // Seed system automation templates for the new workspace (best-effort)
    let _ = crate::queries::automation_templates::seed_system_templates(pool, workspace.id).await;

    Ok(workspace)
}

/// Update workspace name, description, and optionally visibility
pub async fn update_workspace(
    pool: &PgPool,
    id: Uuid,
    name: &str,
    description: Option<&str>,
) -> Result<Option<Workspace>, sqlx::Error> {
    sqlx::query_as::<_, Workspace>(
        r"
        UPDATE workspaces
        SET name = $2, description = $3
        WHERE id = $1
          AND deleted_at IS NULL
        RETURNING id, name, description, logo_url, visibility, tenant_id, created_by_id,
                  deleted_at, created_at, updated_at
        ",
    )
    .bind(id)
    .bind(name)
    .bind(description)
    .fetch_optional(pool)
    .await
}

/// Update workspace visibility
pub async fn update_workspace_visibility(
    pool: &PgPool,
    id: Uuid,
    visibility: WorkspaceVisibility,
) -> Result<Option<Workspace>, sqlx::Error> {
    sqlx::query_as::<_, Workspace>(
        r"
        UPDATE workspaces
        SET visibility = $2
        WHERE id = $1
          AND deleted_at IS NULL
        RETURNING id, name, description, logo_url, visibility, tenant_id, created_by_id,
                  deleted_at, created_at, updated_at
        ",
    )
    .bind(id)
    .bind(visibility)
    .fetch_optional(pool)
    .await
}

/// Soft-delete a workspace
pub async fn soft_delete_workspace(pool: &PgPool, id: Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        r"
        UPDATE workspaces
        SET deleted_at = NOW()
        WHERE id = $1
          AND deleted_at IS NULL
        ",
    )
    .bind(id)
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}

/// Search workspace members by name or email (ILIKE).
///
/// Includes global admins who have implicit access to non-private workspaces.
pub async fn search_workspace_members(
    pool: &PgPool,
    workspace_id: Uuid,
    tenant_id: Uuid,
    query: &str,
    limit: i64,
) -> Result<Vec<UserPublic>, sqlx::Error> {
    let escaped = query
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_");
    let pattern = format!("%{}%", escaped);
    sqlx::query_as::<_, UserPublic>(
        r"
        SELECT DISTINCT u.id, u.email, u.name, u.avatar_url, u.job_title, u.department,
               u.role, u.tenant_id, u.onboarding_completed, u.created_at
        FROM users u
        WHERE u.deleted_at IS NULL
          AND (u.name ILIKE $3 OR u.email ILIKE $3)
          AND (
              EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = $1 AND wm.user_id = u.id)
              OR (
                  u.role IN ('admin', 'super_admin') AND u.tenant_id = $2
                  AND NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.id = $1 AND w.visibility = 'private')
              )
          )
        ORDER BY u.name ASC
        LIMIT $4
        ",
    )
    .bind(workspace_id)
    .bind(tenant_id)
    .bind(pattern)
    .bind(limit)
    .fetch_all(pool)
    .await
}

/// Add a user to a workspace with a role (defaults to member)
pub async fn add_workspace_member(
    pool: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
) -> Result<WorkspaceMember, sqlx::Error> {
    sqlx::query_as::<_, WorkspaceMember>(
        r"
        INSERT INTO workspace_members (workspace_id, user_id, role)
        VALUES ($1, $2, 'member')
        ON CONFLICT (workspace_id, user_id) DO UPDATE SET joined_at = workspace_members.joined_at
        RETURNING id, workspace_id, user_id, role, joined_at
        ",
    )
    .bind(workspace_id)
    .bind(user_id)
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

    // Remove from project_members for all projects in this workspace
    sqlx::query(
        r"
        DELETE FROM project_members
        WHERE user_id = $1
          AND project_id IN (
              SELECT id FROM projects
              WHERE workspace_id = $2 AND deleted_at IS NULL
          )
        ",
    )
    .bind(user_id)
    .bind(workspace_id)
    .execute(&mut *tx)
    .await?;

    // Remove from workspace_members
    let result = sqlx::query(
        r"
        DELETE FROM workspace_members
        WHERE workspace_id = $1 AND user_id = $2
        ",
    )
    .bind(workspace_id)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(result.rows_affected() > 0)
}

/// Check if a user is a member of a workspace.
///
/// Global Admins are treated as implicit members of non-private workspaces.
/// Private workspaces require explicit membership — admin role is ignored.
pub async fn is_workspace_member(
    pool: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let result: (bool,) = sqlx::query_as(
        r"
        SELECT EXISTS(
            -- Explicit workspace member
            SELECT 1 FROM workspace_members
            WHERE workspace_id = $1 AND user_id = $2
            UNION ALL
            -- Implicit admin access (only for non-private workspaces)
            SELECT 1 FROM users u
            WHERE u.id = $2
              AND u.role IN ('admin', 'super_admin')
              AND u.deleted_at IS NULL
              AND NOT EXISTS (
                  SELECT 1 FROM workspaces w
                  WHERE w.id = $1 AND w.visibility = 'private'
              )
        )
        ",
    )
    .bind(workspace_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    Ok(result.0)
}

/// Get a workspace member's role
pub async fn get_workspace_member_role(
    pool: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
) -> Result<Option<WorkspaceMemberRole>, sqlx::Error> {
    let row = sqlx::query_as::<_, (WorkspaceMemberRole,)>(
        r"
        SELECT role FROM workspace_members
        WHERE workspace_id = $1 AND user_id = $2
        ",
    )
    .bind(workspace_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|(role,)| role))
}

/// Update a workspace member's role
pub async fn update_workspace_member_role(
    pool: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
    role: WorkspaceMemberRole,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        r"
        UPDATE workspace_members
        SET role = $3
        WHERE workspace_id = $1 AND user_id = $2
        ",
    )
    .bind(workspace_id)
    .bind(user_id)
    .bind(role)
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}

/// List open workspaces the user is NOT already a member of (for discovery)
pub async fn list_open_workspaces(
    pool: &PgPool,
    tenant_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<Workspace>, sqlx::Error> {
    sqlx::query_as::<_, Workspace>(
        r"
        SELECT w.id, w.name, w.description, w.logo_url, w.visibility,
               w.tenant_id, w.created_by_id, w.deleted_at, w.created_at, w.updated_at
        FROM workspaces w
        WHERE w.tenant_id = $1
          AND w.visibility = 'open'
          AND w.deleted_at IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM workspace_members wm
              WHERE wm.workspace_id = w.id AND wm.user_id = $2
          )
        ORDER BY w.name ASC
        LIMIT 100
        ",
    )
    .bind(tenant_id)
    .bind(user_id)
    .fetch_all(pool)
    .await
}

/// Join an open workspace (adds user as member)
pub async fn join_open_workspace(
    pool: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
) -> Result<WorkspaceMember, sqlx::Error> {
    sqlx::query_as::<_, WorkspaceMember>(
        r"
        INSERT INTO workspace_members (workspace_id, user_id, role)
        VALUES ($1, $2, 'member')
        ON CONFLICT (workspace_id, user_id) DO UPDATE SET joined_at = workspace_members.joined_at
        RETURNING id, workspace_id, user_id, role, joined_at
        ",
    )
    .bind(workspace_id)
    .bind(user_id)
    .fetch_one(pool)
    .await
}

// ============================================================================
// Tenant-level queries
// ============================================================================

/// Tenant member with aggregated workspace count
#[derive(sqlx::FromRow, serde::Serialize, Clone, Debug)]
pub struct TenantMemberInfo {
    pub user_id: Uuid,
    pub name: String,
    pub email: String,
    pub avatar_url: Option<String>,
    pub job_title: Option<String>,
    pub department: Option<String>,
    pub role: crate::models::UserRole,
    pub workspace_count: i64,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// List all members in a tenant with their workspace count
pub async fn list_tenant_members(
    pool: &PgPool,
    tenant_id: Uuid,
) -> Result<Vec<TenantMemberInfo>, sqlx::Error> {
    sqlx::query_as::<_, TenantMemberInfo>(
        r"
        SELECT u.id AS user_id, u.name, u.email, u.avatar_url,
               u.job_title, u.department, u.role,
               COUNT(wm.workspace_id) AS workspace_count,
               u.created_at
        FROM users u
        LEFT JOIN workspace_members wm ON u.id = wm.user_id
            AND wm.workspace_id IN (
                SELECT id FROM workspaces WHERE tenant_id = $1 AND deleted_at IS NULL
            )
        WHERE u.tenant_id = $1
          AND u.deleted_at IS NULL
        GROUP BY u.id, u.name, u.email, u.avatar_url,
                 u.job_title, u.department, u.role, u.created_at
        ORDER BY u.name ASC
        LIMIT 500
        ",
    )
    .bind(tenant_id)
    .fetch_all(pool)
    .await
}

/// Workspace membership info for a specific user
#[derive(sqlx::FromRow, serde::Serialize, Clone, Debug)]
pub struct UserWorkspaceMembership {
    pub workspace_id: Uuid,
    pub workspace_name: String,
    pub role: crate::models::WorkspaceMemberRole,
    pub joined_at: chrono::DateTime<chrono::Utc>,
}

/// Get all workspaces a user belongs to within a tenant
pub async fn get_user_workspaces(
    pool: &PgPool,
    user_id: Uuid,
    tenant_id: Uuid,
) -> Result<Vec<UserWorkspaceMembership>, sqlx::Error> {
    sqlx::query_as::<_, UserWorkspaceMembership>(
        r"
        SELECT w.id AS workspace_id, w.name AS workspace_name,
               wm.role, wm.joined_at
        FROM workspace_members wm
        INNER JOIN workspaces w ON wm.workspace_id = w.id
        WHERE wm.user_id = $1
          AND w.tenant_id = $2
          AND w.deleted_at IS NULL
        ORDER BY w.name ASC
        ",
    )
    .bind(user_id)
    .bind(tenant_id)
    .fetch_all(pool)
    .await
}

/// Bulk-add existing tenant users to a workspace.
/// Returns the number of newly added members (skips existing via ON CONFLICT).
pub async fn bulk_add_workspace_members(
    pool: &PgPool,
    workspace_id: Uuid,
    user_ids: &[Uuid],
) -> Result<u64, sqlx::Error> {
    if user_ids.is_empty() {
        return Ok(0);
    }

    let result = sqlx::query(
        r"
        INSERT INTO workspace_members (workspace_id, user_id, role)
        SELECT $1, uid, 'member'::workspace_member_role
        FROM unnest($2::uuid[]) AS uid
        ON CONFLICT (workspace_id, user_id) DO NOTHING
        ",
    )
    .bind(workspace_id)
    .bind(user_ids)
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
}

/// Workspace matrix entry: workspace with membership status for a given user
#[derive(sqlx::FromRow, serde::Serialize, Clone, Debug)]
pub struct WorkspaceMatrixEntry {
    pub workspace_id: Uuid,
    pub workspace_name: String,
    pub is_member: bool,
    pub role: Option<WorkspaceMemberRole>,
    pub is_org_admin: bool,
}

/// Get the workspace matrix for a specific user within a tenant.
///
/// Returns all workspaces with whether the user is a member of each.
pub async fn get_user_workspace_matrix(
    pool: &PgPool,
    user_id: Uuid,
    tenant_id: Uuid,
) -> Result<Vec<WorkspaceMatrixEntry>, sqlx::Error> {
    // Check if user is a global admin
    let user_role: Option<(crate::models::UserRole,)> =
        sqlx::query_as("SELECT role FROM users WHERE id = $1 AND deleted_at IS NULL")
            .bind(user_id)
            .fetch_optional(pool)
            .await?;

    let is_admin = matches!(
        user_role,
        Some((crate::models::UserRole::SuperAdmin | crate::models::UserRole::Admin,))
    );

    sqlx::query_as::<_, WorkspaceMatrixEntry>(
        r"
        SELECT w.id AS workspace_id,
               w.name AS workspace_name,
               (wm.user_id IS NOT NULL OR ($3 AND w.visibility != 'private')) AS is_member,
               wm.role,
               $3 AS is_org_admin
        FROM workspaces w
        LEFT JOIN workspace_members wm ON w.id = wm.workspace_id AND wm.user_id = $1
        WHERE w.tenant_id = $2
          AND w.deleted_at IS NULL
        ORDER BY w.name ASC
        ",
    )
    .bind(user_id)
    .bind(tenant_id)
    .bind(is_admin)
    .fetch_all(pool)
    .await
}

/// Get workspace visibility
pub async fn get_workspace_visibility(
    pool: &PgPool,
    workspace_id: Uuid,
) -> Result<Option<WorkspaceVisibility>, sqlx::Error> {
    let row = sqlx::query_as::<_, (WorkspaceVisibility,)>(
        r"
        SELECT visibility FROM workspaces
        WHERE id = $1 AND deleted_at IS NULL
        ",
    )
    .bind(workspace_id)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|(v,)| v))
}
