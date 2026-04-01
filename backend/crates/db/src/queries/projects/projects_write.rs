//! Project write query functions (create, update, delete, duplicate, member management)

use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{BoardMemberRole, Project, ProjectMember, TaskList};

use super::projects_read::ProjectWithTaskLists;

/// Create a new project with default statuses and a default task list
pub async fn create_project(
    pool: &PgPool,
    name: &str,
    description: Option<&str>,
    workspace_id: Uuid,
    tenant_id: Uuid,
    created_by_id: Uuid,
) -> Result<ProjectWithTaskLists, sqlx::Error> {
    let mut tx = pool.begin().await?;

    // Create project
    let project = sqlx::query_as::<_, Project>(
        r"
        INSERT INTO projects (name, description, workspace_id, tenant_id, created_by_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, description, slack_webhook_url, prefix, workspace_id, tenant_id,
                  created_by_id, background_color, is_sample, deleted_at, created_at, updated_at
        ",
    )
    .bind(name)
    .bind(description)
    .bind(workspace_id)
    .bind(tenant_id)
    .bind(created_by_id)
    .fetch_one(&mut *tx)
    .await?;

    // Add creator as project member with owner role
    sqlx::query(
        r"
        INSERT INTO project_members (project_id, user_id, role)
        VALUES ($1, $2, 'owner')
        ",
    )
    .bind(project.id)
    .bind(created_by_id)
    .execute(&mut *tx)
    .await?;

    // Create default task list
    let task_list = sqlx::query_as::<_, TaskList>(
        r"
        INSERT INTO task_lists (project_id, name, color, position, is_default, tenant_id, created_by_id)
        VALUES ($1, 'General', '#6366f1', 'a0', true, $2, $3)
        RETURNING id, project_id, name, color, position, is_default, collapsed,
                  tenant_id, created_by_id, created_at, updated_at, deleted_at
        ",
    )
    .bind(project.id)
    .bind(tenant_id)
    .bind(created_by_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    // Seed default statuses then list them (outside transaction since we committed)
    crate::queries::project_statuses::seed_default_statuses(pool, project.id, tenant_id).await?;
    let statuses =
        crate::queries::project_statuses::list_project_statuses(pool, project.id).await?;

    Ok(ProjectWithTaskLists {
        project,
        task_lists: vec![task_list],
        statuses,
    })
}

/// Update project name, description, and background color
pub async fn update_project(
    pool: &PgPool,
    id: Uuid,
    name: Option<&str>,
    description: Option<&str>,
    background_color: Option<Option<&str>>,
) -> Result<Option<Project>, sqlx::Error> {
    match background_color {
        Some(color) => {
            sqlx::query_as::<_, Project>(
                r"
                UPDATE projects
                SET name = COALESCE($2, name),
                    description = COALESCE($3, description),
                    background_color = $4
                WHERE id = $1
                  AND deleted_at IS NULL
                RETURNING id, name, description, slack_webhook_url, prefix, workspace_id, tenant_id,
                          created_by_id, background_color, is_sample, deleted_at, created_at, updated_at
                ",
            )
            .bind(id)
            .bind(name)
            .bind(description)
            .bind(color)
            .fetch_optional(pool)
            .await
        }
        None => {
            sqlx::query_as::<_, Project>(
                r"
                UPDATE projects
                SET name = COALESCE($2, name),
                    description = COALESCE($3, description)
                WHERE id = $1
                  AND deleted_at IS NULL
                RETURNING id, name, description, slack_webhook_url, prefix, workspace_id, tenant_id,
                          created_by_id, background_color, is_sample, deleted_at, created_at, updated_at
                ",
            )
            .bind(id)
            .bind(name)
            .bind(description)
            .fetch_optional(pool)
            .await
        }
    }
}

/// Soft-delete a project
pub async fn soft_delete_project(pool: &PgPool, id: Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        r"
        UPDATE projects
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

/// Add a user to a project
pub async fn add_project_member(
    pool: &PgPool,
    project_id: Uuid,
    user_id: Uuid,
    role: BoardMemberRole,
) -> Result<ProjectMember, sqlx::Error> {
    sqlx::query_as::<_, ProjectMember>(
        r#"
        INSERT INTO project_members (project_id, user_id, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (project_id, user_id) DO UPDATE SET role = $3
        RETURNING id, project_id, user_id, role as "role: _", joined_at, billing_rate_cents
        "#,
    )
    .bind(project_id)
    .bind(user_id)
    .bind(role)
    .fetch_one(pool)
    .await
}

/// Update a project member's role
pub async fn update_project_member_role(
    pool: &PgPool,
    project_id: Uuid,
    user_id: Uuid,
    role: BoardMemberRole,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        r"
        UPDATE project_members
        SET role = $3
        WHERE project_id = $1 AND user_id = $2
        ",
    )
    .bind(project_id)
    .bind(user_id)
    .bind(role)
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}

/// Remove a user from a project
pub async fn remove_project_member(
    pool: &PgPool,
    project_id: Uuid,
    user_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        r"
        DELETE FROM project_members
        WHERE project_id = $1 AND user_id = $2
        ",
    )
    .bind(project_id)
    .bind(user_id)
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}

/// Duplicate a project with its statuses, task lists and optionally its tasks.
/// Returns the new project with task lists.
pub async fn duplicate_project(
    pool: &PgPool,
    source_id: Uuid,
    new_name: &str,
    include_tasks: bool,
    user_id: Uuid,
) -> Result<ProjectWithTaskLists, sqlx::Error> {
    let mut tx = pool.begin().await?;

    // 1. Copy the project
    let new_project = sqlx::query_as::<_, Project>(
        r"
        INSERT INTO projects (name, description, workspace_id, tenant_id, created_by_id, background_color)
        SELECT $2, description, workspace_id, tenant_id, $3, background_color
        FROM projects WHERE id = $1 AND deleted_at IS NULL
        RETURNING id, name, description, slack_webhook_url, prefix,
                  workspace_id, tenant_id, created_by_id,
                  background_color, is_sample, deleted_at, created_at, updated_at
        ",
    )
    .bind(source_id)
    .bind(new_name)
    .bind(user_id)
    .fetch_one(&mut *tx)
    .await?;

    // 2. Copy statuses
    sqlx::query(
        r"
        INSERT INTO project_statuses (id, project_id, name, color, type, position, is_default, tenant_id)
        SELECT gen_random_uuid(), $2, name, color, type, position, is_default, tenant_id
        FROM project_statuses WHERE project_id = $1
        ",
    )
    .bind(source_id)
    .bind(new_project.id)
    .execute(&mut *tx)
    .await?;

    // 3. Copy task lists
    let new_task_lists = sqlx::query_as::<_, TaskList>(
        r"
        INSERT INTO task_lists (project_id, name, color, position, is_default, tenant_id, created_by_id)
        SELECT $2, name, color, position, is_default, tenant_id, $3
        FROM task_lists WHERE project_id = $1 AND deleted_at IS NULL
        ORDER BY position ASC
        RETURNING id, project_id, name, color, position, is_default, collapsed,
                  tenant_id, created_by_id, created_at, updated_at, deleted_at
        ",
    )
    .bind(source_id)
    .bind(new_project.id)
    .bind(user_id)
    .fetch_all(&mut *tx)
    .await?;

    // 4. Copy tasks (optional) -- map old status to new status by name
    if include_tasks {
        sqlx::query(
            r"
            INSERT INTO tasks (title, description, priority, due_date, position, project_id,
                               status_id, created_by_id, tenant_id)
            SELECT t.title, t.description, t.priority, t.due_date, t.position, $2,
                   ns.id, $3, t.tenant_id
            FROM tasks t
            LEFT JOIN project_statuses os ON os.id = t.status_id
            LEFT JOIN project_statuses ns ON ns.project_id = $2 AND ns.name = os.name
            WHERE t.project_id = $1 AND t.deleted_at IS NULL AND t.parent_task_id IS NULL
            ",
        )
        .bind(source_id)
        .bind(new_project.id)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;
    }

    // 5. Add user as Owner
    sqlx::query(
        r"
        INSERT INTO project_members (project_id, user_id, role)
        VALUES ($1, $2, 'owner')
        ",
    )
    .bind(new_project.id)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    let statuses =
        crate::queries::project_statuses::list_project_statuses(pool, new_project.id).await?;

    Ok(ProjectWithTaskLists {
        project: new_project,
        task_lists: new_task_lists,
        statuses,
    })
}
