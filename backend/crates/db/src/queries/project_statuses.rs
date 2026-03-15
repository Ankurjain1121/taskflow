//! Project status query functions

use sqlx::PgPool;
use uuid::Uuid;

use crate::models::ProjectStatus;

/// List all statuses for a project, ordered by position
pub async fn list_project_statuses(
    pool: &PgPool,
    project_id: Uuid,
) -> Result<Vec<ProjectStatus>, sqlx::Error> {
    sqlx::query_as!(
        ProjectStatus,
        r#"
        SELECT id, project_id, name, color,
               type as "status_type",
               position, is_default, tenant_id, created_at,
               allowed_transitions
        FROM project_statuses
        WHERE project_id = $1
        ORDER BY position ASC
        "#,
        project_id
    )
    .fetch_all(pool)
    .await
}

/// Get the default status for a project
pub async fn get_default_status(
    pool: &PgPool,
    project_id: Uuid,
) -> Result<Option<ProjectStatus>, sqlx::Error> {
    sqlx::query_as!(
        ProjectStatus,
        r#"
        SELECT id, project_id, name, color,
               type as "status_type",
               position, is_default, tenant_id, created_at,
               allowed_transitions
        FROM project_statuses
        WHERE project_id = $1 AND is_default = true
        LIMIT 1
        "#,
        project_id
    )
    .fetch_optional(pool)
    .await
}

/// Seed default statuses for a new project
pub async fn seed_default_statuses(
    pool: &PgPool,
    project_id: Uuid,
    tenant_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        INSERT INTO project_statuses (project_id, name, color, type, position, is_default, tenant_id)
        VALUES
          ($1, 'Open',        '#6B7280', 'not_started', 'a0', true,  $2),
          ($1, 'In Progress', '#3B82F6', 'active',       'b0', false, $2),
          ($1, 'On Hold',     '#F59E0B', 'active',       'c0', false, $2),
          ($1, 'Completed',   '#10B981', 'done',         'd0', false, $2),
          ($1, 'Cancelled',   '#EF4444', 'cancelled',    'e0', false, $2)
        ON CONFLICT (project_id, name) DO NOTHING
        "#,
        project_id,
        tenant_id
    )
    .execute(pool)
    .await?;
    Ok(())
}

/// Create a new status for a project
pub async fn create_project_status(
    pool: &PgPool,
    project_id: Uuid,
    name: &str,
    color: &str,
    type_str: &str,
    position: &str,
    tenant_id: Uuid,
) -> Result<ProjectStatus, sqlx::Error> {
    sqlx::query_as!(
        ProjectStatus,
        r#"
        INSERT INTO project_statuses (project_id, name, color, type, position, is_default, tenant_id)
        VALUES ($1, $2, $3, $4, $5, false, $6)
        RETURNING id, project_id, name, color,
                  type as "status_type",
                  position, is_default, tenant_id, created_at,
                  allowed_transitions
        "#,
        project_id,
        name,
        color,
        type_str,
        position,
        tenant_id
    )
    .fetch_one(pool)
    .await
}

/// Update a project status
pub async fn update_project_status(
    pool: &PgPool,
    id: Uuid,
    name: Option<&str>,
    color: Option<&str>,
    type_str: Option<&str>,
) -> Result<ProjectStatus, sqlx::Error> {
    sqlx::query_as!(
        ProjectStatus,
        r#"
        UPDATE project_statuses
        SET
          name     = COALESCE($2, name),
          color    = COALESCE($3, color),
          type     = COALESCE($4, type)
        WHERE id = $1
        RETURNING id, project_id, name, color,
                  type as "status_type",
                  position, is_default, tenant_id, created_at,
                  allowed_transitions
        "#,
        id,
        name,
        color,
        type_str
    )
    .fetch_one(pool)
    .await
}

/// Get allowed transitions for a status
pub async fn get_transitions(pool: &PgPool, id: Uuid) -> Result<Option<Vec<Uuid>>, sqlx::Error> {
    sqlx::query_scalar!(
        r#"SELECT allowed_transitions FROM project_statuses WHERE id = $1"#,
        id
    )
    .fetch_optional(pool)
    .await
    .map(|opt| opt.flatten())
}

/// Set allowed transitions for a status
pub async fn set_transitions(
    pool: &PgPool,
    id: Uuid,
    transitions: Option<&[Uuid]>,
) -> Result<ProjectStatus, sqlx::Error> {
    sqlx::query_as!(
        ProjectStatus,
        r#"
        UPDATE project_statuses
        SET allowed_transitions = $2
        WHERE id = $1
        RETURNING id, project_id, name, color,
                  type as "status_type",
                  position, is_default, tenant_id, created_at,
                  allowed_transitions
        "#,
        id,
        transitions
    )
    .fetch_one(pool)
    .await
}

/// Reorder a project status to a new position
pub async fn reorder_project_status(
    pool: &PgPool,
    id: Uuid,
    new_position: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "UPDATE project_statuses SET position = $2 WHERE id = $1",
        id,
        new_position
    )
    .execute(pool)
    .await?;
    Ok(())
}

/// Delete a project status, reassigning tasks to another status first
/// Returns error if this is the last status for the project
pub async fn delete_project_status(
    pool: &PgPool,
    id: Uuid,
    replace_with_status_id: Uuid,
) -> Result<(), sqlx::Error> {
    // Reassign tasks
    sqlx::query!(
        "UPDATE tasks SET status_id = $2 WHERE status_id = $1",
        id,
        replace_with_status_id
    )
    .execute(pool)
    .await?;

    // Delete the status
    sqlx::query!("DELETE FROM project_statuses WHERE id = $1", id)
        .execute(pool)
        .await?;

    Ok(())
}
