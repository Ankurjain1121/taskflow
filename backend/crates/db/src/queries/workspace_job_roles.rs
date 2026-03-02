use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::WorkspaceJobRole;

/// Input for creating a job role
#[derive(Debug, Deserialize)]
pub struct CreateJobRoleInput {
    pub name: String,
    pub color: Option<String>,
    pub description: Option<String>,
}

/// Input for updating a job role
#[derive(Debug, Deserialize)]
pub struct UpdateJobRoleInput {
    pub name: Option<String>,
    pub color: Option<String>,
    pub description: Option<String>,
}

/// Job role info for member display
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MemberJobRoleInfo {
    pub role_id: Uuid,
    pub role_name: String,
    pub role_color: Option<String>,
    pub assigned_at: DateTime<Utc>,
}

/// List all job roles for a workspace
pub async fn list_job_roles(
    pool: &PgPool,
    workspace_id: Uuid,
) -> Result<Vec<WorkspaceJobRole>, sqlx::Error> {
    sqlx::query_as::<_, WorkspaceJobRole>(
        r#"
        SELECT id, workspace_id, name, color, description, created_at, updated_at
        FROM workspace_job_roles
        WHERE workspace_id = $1
        ORDER BY name ASC
        "#,
    )
    .bind(workspace_id)
    .fetch_all(pool)
    .await
}

/// Create a new job role
pub async fn create_job_role(
    pool: &PgPool,
    workspace_id: Uuid,
    input: CreateJobRoleInput,
) -> Result<WorkspaceJobRole, sqlx::Error> {
    sqlx::query_as::<_, WorkspaceJobRole>(
        r#"
        INSERT INTO workspace_job_roles (id, workspace_id, name, color, description)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, workspace_id, name, color, description, created_at, updated_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(workspace_id)
    .bind(&input.name)
    .bind(&input.color)
    .bind(&input.description)
    .fetch_one(pool)
    .await
}

/// Update a job role
pub async fn update_job_role(
    pool: &PgPool,
    role_id: Uuid,
    input: UpdateJobRoleInput,
) -> Result<WorkspaceJobRole, sqlx::Error> {
    sqlx::query_as::<_, WorkspaceJobRole>(
        r#"
        UPDATE workspace_job_roles
        SET
            name = COALESCE($2, name),
            color = COALESCE($3, color),
            description = COALESCE($4, description),
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, workspace_id, name, color, description, created_at, updated_at
        "#,
    )
    .bind(role_id)
    .bind(&input.name)
    .bind(&input.color)
    .bind(&input.description)
    .fetch_one(pool)
    .await
}

/// Delete a job role
pub async fn delete_job_role(pool: &PgPool, role_id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM workspace_job_roles WHERE id = $1")
        .bind(role_id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Assign a job role to a workspace member
pub async fn assign_role_to_member(
    pool: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
    job_role_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO workspace_member_job_roles (id, workspace_id, user_id, job_role_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, job_role_id) DO NOTHING
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(workspace_id)
    .bind(user_id)
    .bind(job_role_id)
    .execute(pool)
    .await?;
    Ok(())
}

/// Remove a job role from a workspace member
pub async fn remove_role_from_member(
    pool: &PgPool,
    user_id: Uuid,
    job_role_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        DELETE FROM workspace_member_job_roles
        WHERE user_id = $1 AND job_role_id = $2
        "#,
    )
    .bind(user_id)
    .bind(job_role_id)
    .execute(pool)
    .await?;
    Ok(())
}

/// Get all job roles for a specific member
pub async fn get_member_roles(
    pool: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<MemberJobRoleInfo>, sqlx::Error> {
    sqlx::query_as::<_, MemberJobRoleInfo>(
        r#"
        SELECT
            jr.id as role_id,
            jr.name as role_name,
            jr.color as role_color,
            mjr.assigned_at
        FROM workspace_member_job_roles mjr
        JOIN workspace_job_roles jr ON jr.id = mjr.job_role_id
        WHERE mjr.workspace_id = $1 AND mjr.user_id = $2
        ORDER BY jr.name ASC
        "#,
    )
    .bind(workspace_id)
    .bind(user_id)
    .fetch_all(pool)
    .await
}

/// Get all user IDs that have a specific role (for automation actions)
pub async fn get_members_with_role(pool: &PgPool, role_id: Uuid) -> Result<Vec<Uuid>, sqlx::Error> {
    sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT user_id FROM workspace_member_job_roles WHERE job_role_id = $1
        "#,
    )
    .bind(role_id)
    .fetch_all(pool)
    .await
}

/// Get job roles for all members in a workspace (batch for member list UI)
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MemberRoleBatch {
    pub user_id: Uuid,
    pub role_id: Uuid,
    pub role_name: String,
    pub role_color: Option<String>,
}

pub async fn get_roles_for_all_members(
    pool: &PgPool,
    workspace_id: Uuid,
) -> Result<Vec<MemberRoleBatch>, sqlx::Error> {
    sqlx::query_as::<_, MemberRoleBatch>(
        r#"
        SELECT
            mjr.user_id,
            jr.id as role_id,
            jr.name as role_name,
            jr.color as role_color
        FROM workspace_member_job_roles mjr
        JOIN workspace_job_roles jr ON jr.id = mjr.job_role_id
        WHERE mjr.workspace_id = $1
        ORDER BY jr.name ASC
        "#,
    )
    .bind(workspace_id)
    .fetch_all(pool)
    .await
}
