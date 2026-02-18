use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgConnection;
use uuid::Uuid;

use crate::models::{Project, ProjectMember, ProjectMemberRole};
use crate::utils::generate_key_between;

/// Public user info joined with project membership details.
#[derive(sqlx::FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct ProjectMemberInfo {
    pub user_id: Uuid,
    pub name: String,
    pub email: String,
    pub avatar_url: Option<String>,
    pub role: ProjectMemberRole,
    pub joined_at: DateTime<Utc>,
}

/// List projects in a workspace that the user is a member of.
pub async fn list_projects_by_workspace(
    conn: &mut PgConnection,
    workspace_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<Project>, sqlx::Error> {
    sqlx::query_as::<_, Project>(
        "SELECT p.id, p.name, p.description, p.slack_webhook_url, \
                p.workspace_id, p.tenant_id, p.created_by_id, \
                p.color, p.icon, p.status, p.key_prefix, p.task_counter, \
                p.deleted_at, p.created_at, p.updated_at \
         FROM projects p \
         INNER JOIN project_members pm ON pm.project_id = p.id \
         WHERE p.workspace_id = $1 \
           AND pm.user_id = $2 \
           AND p.deleted_at IS NULL \
           AND p.status = 'active' \
         ORDER BY p.name",
    )
    .bind(workspace_id)
    .bind(user_id)
    .fetch_all(&mut *conn)
    .await
}

/// Get a single project by ID. Only returns if user is a member.
pub async fn get_project_by_id(
    conn: &mut PgConnection,
    id: Uuid,
    user_id: Uuid,
) -> Result<Option<Project>, sqlx::Error> {
    sqlx::query_as::<_, Project>(
        "SELECT p.id, p.name, p.description, p.slack_webhook_url, \
                p.workspace_id, p.tenant_id, p.created_by_id, \
                p.color, p.icon, p.status, p.key_prefix, p.task_counter, \
                p.deleted_at, p.created_at, p.updated_at \
         FROM projects p \
         INNER JOIN project_members pm ON pm.project_id = p.id \
         WHERE p.id = $1 \
           AND pm.user_id = $2 \
           AND p.deleted_at IS NULL",
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&mut *conn)
    .await
}

/// Check if a user is a member of a project.
pub async fn check_project_membership(
    conn: &mut PgConnection,
    project_id: Uuid,
    user_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let row: Option<(i64,)> = sqlx::query_as(
        "SELECT COUNT(*) FROM project_members WHERE project_id = $1 AND user_id = $2",
    )
    .bind(project_id)
    .bind(user_id)
    .fetch_optional(&mut *conn)
    .await?;

    Ok(row.map(|r| r.0 > 0).unwrap_or(false))
}

/// Generate a key_prefix from a project name (first 4 alpha chars, uppercase).
fn generate_key_prefix(name: &str) -> String {
    let alpha: String = name.chars().filter(|c| c.is_ascii_alphabetic()).collect();
    alpha[..alpha.len().min(4)].to_uppercase()
}

/// Create a project with 3 default columns and the creator as an Editor member.
/// Runs inside the caller's transaction.
pub async fn create_project(
    conn: &mut PgConnection,
    name: &str,
    description: Option<&str>,
    workspace_id: Uuid,
    tenant_id: Uuid,
    created_by_id: Uuid,
    color: Option<&str>,
    icon: Option<&str>,
) -> Result<Project, sqlx::Error> {
    let prefix = generate_key_prefix(name);

    let project = sqlx::query_as::<_, Project>(
        "INSERT INTO projects (name, description, workspace_id, tenant_id, created_by_id, \
                               color, icon, status, key_prefix) \
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, '#6366f1'), COALESCE($7, 'folder'), 'active', $8) \
         RETURNING id, name, description, slack_webhook_url, \
                   workspace_id, tenant_id, created_by_id, \
                   color, icon, status, key_prefix, task_counter, \
                   deleted_at, created_at, updated_at",
    )
    .bind(name)
    .bind(description)
    .bind(workspace_id)
    .bind(tenant_id)
    .bind(created_by_id)
    .bind(color)
    .bind(icon)
    .bind(&prefix)
    .fetch_one(&mut *conn)
    .await?;

    // Create 3 default columns with fractional index positions
    let pos_todo = generate_key_between(None, None); // "a0"
    let pos_in_progress = generate_key_between(Some(&pos_todo), None); // "a1"
    let pos_done = generate_key_between(Some(&pos_in_progress), None); // "a2"

    sqlx::query(
        "INSERT INTO project_columns (name, project_id, position, color, status_mapping) VALUES \
         ($1, $2, $3, $4, NULL), \
         ($5, $2, $6, $7, NULL), \
         ($8, $2, $9, $10, $11)",
    )
    .bind("To Do")
    .bind(project.id)
    .bind(&pos_todo)
    .bind("#6366f1")
    // In Progress
    .bind("In Progress")
    // project.id already bound as $2
    .bind(&pos_in_progress)
    .bind("#3b82f6")
    // Done
    .bind("Done")
    // project.id already bound as $2
    .bind(&pos_done)
    .bind("#22c55e")
    .bind(serde_json::json!({"done": true}))
    .execute(&mut *conn)
    .await?;

    // Add creator as project member with Editor role
    sqlx::query(
        "INSERT INTO project_members (project_id, user_id, role) \
         VALUES ($1, $2, $3::project_member_role)",
    )
    .bind(project.id)
    .bind(created_by_id)
    .bind(project_member_role_str(&ProjectMemberRole::Editor))
    .execute(&mut *conn)
    .await?;

    Ok(project)
}

/// Update a project's name, description, color, icon, and status.
pub async fn update_project(
    conn: &mut PgConnection,
    id: Uuid,
    name: &str,
    description: Option<&str>,
    color: Option<&str>,
    icon: Option<&str>,
) -> Result<Project, sqlx::Error> {
    sqlx::query_as::<_, Project>(
        "UPDATE projects \
         SET name = $2, description = $3, \
             color = COALESCE($4, color), \
             icon = COALESCE($5, icon), \
             updated_at = now() \
         WHERE id = $1 AND deleted_at IS NULL \
         RETURNING id, name, description, slack_webhook_url, \
                   workspace_id, tenant_id, created_by_id, \
                   color, icon, status, key_prefix, task_counter, \
                   deleted_at, created_at, updated_at",
    )
    .bind(id)
    .bind(name)
    .bind(description)
    .bind(color)
    .bind(icon)
    .fetch_one(&mut *conn)
    .await
}

/// Archive a project by setting status to 'archived'.
pub async fn archive_project(
    conn: &mut PgConnection,
    id: Uuid,
) -> Result<Project, sqlx::Error> {
    sqlx::query_as::<_, Project>(
        "UPDATE projects SET status = 'archived', updated_at = now() \
         WHERE id = $1 AND deleted_at IS NULL \
         RETURNING id, name, description, slack_webhook_url, \
                   workspace_id, tenant_id, created_by_id, \
                   color, icon, status, key_prefix, task_counter, \
                   deleted_at, created_at, updated_at",
    )
    .bind(id)
    .fetch_one(&mut *conn)
    .await
}

/// Soft-delete a project by setting deleted_at.
pub async fn soft_delete_project(
    conn: &mut PgConnection,
    id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE projects SET deleted_at = now() WHERE id = $1")
        .bind(id)
        .execute(&mut *conn)
        .await?;
    Ok(())
}

/// List members of a project with their public user info.
pub async fn list_project_members(
    conn: &mut PgConnection,
    project_id: Uuid,
) -> Result<Vec<ProjectMemberInfo>, sqlx::Error> {
    sqlx::query_as::<_, ProjectMemberInfo>(
        "SELECT u.id AS user_id, u.name, u.email, u.avatar_url, pm.role, pm.joined_at \
         FROM project_members pm \
         INNER JOIN users u ON u.id = pm.user_id \
         WHERE pm.project_id = $1 AND u.deleted_at IS NULL \
         ORDER BY pm.joined_at ASC",
    )
    .bind(project_id)
    .fetch_all(&mut *conn)
    .await
}

/// Add a user as a project member with a given role.
pub async fn add_project_member(
    conn: &mut PgConnection,
    project_id: Uuid,
    user_id: Uuid,
    role: ProjectMemberRole,
) -> Result<ProjectMember, sqlx::Error> {
    sqlx::query_as::<_, ProjectMember>(
        "INSERT INTO project_members (project_id, user_id, role) \
         VALUES ($1, $2, $3::project_member_role) \
         RETURNING id, project_id, user_id, role, joined_at",
    )
    .bind(project_id)
    .bind(user_id)
    .bind(project_member_role_str(&role))
    .fetch_one(&mut *conn)
    .await
}

/// Remove a user from a project.
pub async fn remove_project_member(
    conn: &mut PgConnection,
    project_id: Uuid,
    user_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM project_members WHERE project_id = $1 AND user_id = $2")
        .bind(project_id)
        .bind(user_id)
        .execute(&mut *conn)
        .await?;
    Ok(())
}

/// Convert ProjectMemberRole to the SQL enum string value.
fn project_member_role_str(role: &ProjectMemberRole) -> &'static str {
    match role {
        ProjectMemberRole::Owner => "owner",
        ProjectMemberRole::Manager => "manager",
        ProjectMemberRole::Viewer => "viewer",
        ProjectMemberRole::Editor => "editor",
    }
}
