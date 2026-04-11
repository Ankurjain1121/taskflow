//! Project groups — collections of projects within a workspace.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use crate::models::ProjectGroup;

#[derive(Debug, thiserror::Error)]
pub enum ProjectGroupQueryError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Not a workspace member")]
    NotWorkspaceMember,
    #[error("Project group not found")]
    NotFound,
    #[error("Invalid input: {0}")]
    Invalid(String),
}

#[derive(Debug, Deserialize, Default)]
pub struct CreateProjectGroupInput {
    pub name: String,
    pub color: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
pub struct UpdateProjectGroupInput {
    pub name: Option<String>,
    pub color: Option<String>,
    pub description: Option<String>,
}

/// A project group with a count of non-deleted projects assigned to it.
#[derive(Debug, Serialize, FromRow)]
pub struct ProjectGroupWithCount {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub color: String,
    pub position: String,
    pub description: Option<String>,
    pub created_by_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub project_count: i64,
}

async fn verify_workspace_member(
    pool: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar::<_, bool>(
        r"
        SELECT EXISTS(
            SELECT 1 FROM workspace_members
            WHERE workspace_id = $1 AND user_id = $2
        )
        ",
    )
    .bind(workspace_id)
    .bind(user_id)
    .fetch_one(pool)
    .await
}

/// List all groups in a workspace, each with its project count.
pub async fn list_project_groups(
    pool: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<ProjectGroupWithCount>, ProjectGroupQueryError> {
    if !verify_workspace_member(pool, workspace_id, user_id).await? {
        return Err(ProjectGroupQueryError::NotWorkspaceMember);
    }

    let rows = sqlx::query_as::<_, ProjectGroupWithCount>(
        r"
        SELECT
            g.id, g.workspace_id, g.tenant_id, g.name, g.color, g.position,
            g.description, g.created_by_id, g.created_at, g.updated_at,
            COALESCE(COUNT(p.id) FILTER (WHERE p.deleted_at IS NULL), 0) AS project_count
        FROM project_groups g
        LEFT JOIN projects p ON p.project_group_id = g.id
        WHERE g.workspace_id = $1
        GROUP BY g.id
        ORDER BY g.position ASC, g.created_at ASC
        ",
    )
    .bind(workspace_id)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

/// Get a single group by id.
pub async fn get_project_group(
    pool: &PgPool,
    id: Uuid,
    user_id: Uuid,
) -> Result<ProjectGroup, ProjectGroupQueryError> {
    let group = sqlx::query_as::<_, ProjectGroup>(
        r"
        SELECT id, workspace_id, tenant_id, name, color, position,
               description, created_by_id, created_at, updated_at
        FROM project_groups
        WHERE id = $1
        ",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or(ProjectGroupQueryError::NotFound)?;

    if !verify_workspace_member(pool, group.workspace_id, user_id).await? {
        return Err(ProjectGroupQueryError::NotWorkspaceMember);
    }

    Ok(group)
}

/// Get the workspace_id for a group (auth check helper).
pub async fn get_group_workspace_id(pool: &PgPool, id: Uuid) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar::<_, Uuid>("SELECT workspace_id FROM project_groups WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn create_project_group(
    pool: &PgPool,
    workspace_id: Uuid,
    tenant_id: Uuid,
    user_id: Uuid,
    input: CreateProjectGroupInput,
) -> Result<ProjectGroup, ProjectGroupQueryError> {
    if !verify_workspace_member(pool, workspace_id, user_id).await? {
        return Err(ProjectGroupQueryError::NotWorkspaceMember);
    }
    let name = input.name.trim();
    if name.is_empty() {
        return Err(ProjectGroupQueryError::Invalid(
            "name cannot be empty".into(),
        ));
    }
    let color = input.color.unwrap_or_else(|| "#BF7B54".to_string());

    let group = sqlx::query_as::<_, ProjectGroup>(
        r"
        INSERT INTO project_groups (workspace_id, tenant_id, name, color, description, created_by_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, workspace_id, tenant_id, name, color, position,
                  description, created_by_id, created_at, updated_at
        ",
    )
    .bind(workspace_id)
    .bind(tenant_id)
    .bind(name)
    .bind(&color)
    .bind(&input.description)
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    Ok(group)
}

pub async fn update_project_group(
    pool: &PgPool,
    id: Uuid,
    input: UpdateProjectGroupInput,
) -> Result<ProjectGroup, ProjectGroupQueryError> {
    let group = sqlx::query_as::<_, ProjectGroup>(
        r"
        UPDATE project_groups
        SET name = COALESCE($2, name),
            color = COALESCE($3, color),
            description = COALESCE($4, description),
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, workspace_id, tenant_id, name, color, position,
                  description, created_by_id, created_at, updated_at
        ",
    )
    .bind(id)
    .bind(input.name.as_deref())
    .bind(input.color.as_deref())
    .bind(input.description.as_deref())
    .fetch_optional(pool)
    .await?
    .ok_or(ProjectGroupQueryError::NotFound)?;

    Ok(group)
}

pub async fn delete_project_group(pool: &PgPool, id: Uuid) -> Result<(), ProjectGroupQueryError> {
    // FK on projects.project_group_id is ON DELETE SET NULL, so projects get
    // un-grouped automatically instead of being deleted.
    let rows = sqlx::query("DELETE FROM project_groups WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?
        .rows_affected();
    if rows == 0 {
        return Err(ProjectGroupQueryError::NotFound);
    }
    Ok(())
}

/// Assign a project to a group (or NULL to unassign).
pub async fn set_project_group(
    pool: &PgPool,
    project_id: Uuid,
    group_id: Option<Uuid>,
) -> Result<(), ProjectGroupQueryError> {
    let rows = sqlx::query(
        "UPDATE projects SET project_group_id = $2, updated_at = NOW()
         WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(project_id)
    .bind(group_id)
    .execute(pool)
    .await?
    .rows_affected();
    if rows == 0 {
        return Err(ProjectGroupQueryError::NotFound);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_input_minimal() {
        let input: CreateProjectGroupInput =
            serde_json::from_str(r#"{"name":"Q3 Launches"}"#).unwrap();
        assert_eq!(input.name, "Q3 Launches");
        assert!(input.color.is_none());
    }

    #[test]
    fn test_update_input_partial() {
        let input: UpdateProjectGroupInput =
            serde_json::from_str(r##"{"color":"#10B981"}"##).unwrap();
        assert!(input.name.is_none());
        assert_eq!(input.color.as_deref(), Some("#10B981"));
    }
}
