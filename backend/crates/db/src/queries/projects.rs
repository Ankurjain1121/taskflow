//! Project query functions (formerly boards)

use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{
    BoardMemberRole, Project, ProjectMember, ProjectStatus, TaskList, TaskPriority,
};

/// List projects in a workspace that the user has access to
pub async fn list_projects_by_workspace(
    pool: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<Project>, sqlx::Error> {
    sqlx::query_as::<_, Project>(
        r#"
        SELECT b.id, b.name, b.description, b.slack_webhook_url, b.prefix,
               b.workspace_id, b.tenant_id, b.created_by_id,
               b.background_color, b.is_sample, b.deleted_at, b.created_at, b.updated_at
        FROM projects b
        INNER JOIN project_members bm ON b.id = bm.project_id
        WHERE b.workspace_id = $1
          AND bm.user_id = $2
          AND b.deleted_at IS NULL
        ORDER BY b.created_at DESC
        LIMIT 200
        "#,
    )
    .bind(workspace_id)
    .bind(user_id)
    .fetch_all(pool)
    .await
}

// Alias for backward compat
pub async fn list_boards_by_workspace(
    pool: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<Project>, sqlx::Error> {
    list_projects_by_workspace(pool, workspace_id, user_id).await
}

/// Project with task lists and statuses for detailed view
#[derive(serde::Serialize, Clone, Debug)]
pub struct ProjectWithTaskLists {
    #[serde(flatten)]
    pub project: Project,
    pub task_lists: Vec<TaskList>,
    pub statuses: Vec<ProjectStatus>,
}

// Keep old name for backward compat within crate
pub type BoardWithColumns = ProjectWithTaskLists;

/// Get a project by ID with its task lists and statuses (verify membership)
pub async fn get_project_by_id(
    pool: &PgPool,
    id: Uuid,
    user_id: Uuid,
) -> Result<Option<ProjectWithTaskLists>, sqlx::Error> {
    let project = sqlx::query_as::<_, Project>(
        r#"
        SELECT b.id, b.name, b.description, b.slack_webhook_url, b.prefix,
               b.workspace_id, b.tenant_id, b.created_by_id,
               b.background_color, b.is_sample, b.deleted_at, b.created_at, b.updated_at
        FROM projects b
        INNER JOIN project_members bm ON b.id = bm.project_id
        WHERE b.id = $1
          AND bm.user_id = $2
          AND b.deleted_at IS NULL
        "#,
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    match project {
        Some(p) => {
            let task_lists = sqlx::query_as::<_, TaskList>(
                r#"
                SELECT id, project_id, name, color, position, is_default, collapsed,
                       tenant_id, created_by_id, created_at, updated_at, deleted_at
                FROM task_lists
                WHERE project_id = $1 AND deleted_at IS NULL
                ORDER BY position ASC
                "#,
            )
            .bind(id)
            .fetch_all(pool)
            .await?;

            let statuses = sqlx::query_as::<_, ProjectStatus>(
                r#"
                SELECT id, project_id, name, color, type, position, is_default, tenant_id, created_at,
                       allowed_transitions
                FROM project_statuses
                WHERE project_id = $1
                ORDER BY position ASC
                "#,
            )
            .bind(id)
            .fetch_all(pool)
            .await?;

            Ok(Some(ProjectWithTaskLists {
                project: p,
                task_lists,
                statuses,
            }))
        }
        None => Ok(None),
    }
}

// Alias for backward compat
pub async fn get_board_by_id(
    pool: &PgPool,
    id: Uuid,
    user_id: Uuid,
) -> Result<Option<ProjectWithTaskLists>, sqlx::Error> {
    get_project_by_id(pool, id, user_id).await
}

// Status functions are in project_statuses.rs module

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
        r#"
        INSERT INTO projects (name, description, workspace_id, tenant_id, created_by_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, description, slack_webhook_url, prefix, workspace_id, tenant_id,
                  created_by_id, background_color, is_sample, deleted_at, created_at, updated_at
        "#,
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
        r#"
        INSERT INTO project_members (project_id, user_id, role)
        VALUES ($1, $2, 'owner')
        "#,
    )
    .bind(project.id)
    .bind(created_by_id)
    .execute(&mut *tx)
    .await?;

    // Create default task list
    let task_list = sqlx::query_as::<_, TaskList>(
        r#"
        INSERT INTO task_lists (project_id, name, color, position, is_default, tenant_id, created_by_id)
        VALUES ($1, 'General', '#6366f1', 'a0', true, $2, $3)
        RETURNING id, project_id, name, color, position, is_default, collapsed,
                  tenant_id, created_by_id, created_at, updated_at, deleted_at
        "#,
    )
    .bind(project.id)
    .bind(tenant_id)
    .bind(created_by_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    // Seed default statuses then list them (outside transaction since we committed)
    super::project_statuses::seed_default_statuses(pool, project.id, tenant_id).await?;
    let statuses = super::project_statuses::list_project_statuses(pool, project.id).await?;

    Ok(ProjectWithTaskLists {
        project,
        task_lists: vec![task_list],
        statuses,
    })
}

// Alias for backward compat
pub async fn create_board(
    pool: &PgPool,
    name: &str,
    description: Option<&str>,
    workspace_id: Uuid,
    tenant_id: Uuid,
    created_by_id: Uuid,
) -> Result<ProjectWithTaskLists, sqlx::Error> {
    create_project(
        pool,
        name,
        description,
        workspace_id,
        tenant_id,
        created_by_id,
    )
    .await
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
                r#"
                UPDATE projects
                SET name = COALESCE($2, name),
                    description = COALESCE($3, description),
                    background_color = $4
                WHERE id = $1
                  AND deleted_at IS NULL
                RETURNING id, name, description, slack_webhook_url, prefix, workspace_id, tenant_id,
                          created_by_id, background_color, is_sample, deleted_at, created_at, updated_at
                "#,
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
                r#"
                UPDATE projects
                SET name = COALESCE($2, name),
                    description = COALESCE($3, description)
                WHERE id = $1
                  AND deleted_at IS NULL
                RETURNING id, name, description, slack_webhook_url, prefix, workspace_id, tenant_id,
                          created_by_id, background_color, is_sample, deleted_at, created_at, updated_at
                "#,
            )
            .bind(id)
            .bind(name)
            .bind(description)
            .fetch_optional(pool)
            .await
        }
    }
}

pub async fn update_board(
    pool: &PgPool,
    id: Uuid,
    name: Option<&str>,
    description: Option<&str>,
    background_color: Option<Option<&str>>,
) -> Result<Option<Project>, sqlx::Error> {
    update_project(pool, id, name, description, background_color).await
}

/// Soft-delete a project
pub async fn soft_delete_project(pool: &PgPool, id: Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        r#"
        UPDATE projects
        SET deleted_at = NOW()
        WHERE id = $1
          AND deleted_at IS NULL
        "#,
    )
    .bind(id)
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}

pub async fn soft_delete_board(pool: &PgPool, id: Uuid) -> Result<bool, sqlx::Error> {
    soft_delete_project(pool, id).await
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

pub async fn add_board_member(
    pool: &PgPool,
    board_id: Uuid,
    user_id: Uuid,
    role: BoardMemberRole,
) -> Result<ProjectMember, sqlx::Error> {
    add_project_member(pool, board_id, user_id, role).await
}

/// Update a project member's role
pub async fn update_project_member_role(
    pool: &PgPool,
    project_id: Uuid,
    user_id: Uuid,
    role: BoardMemberRole,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        r#"
        UPDATE project_members
        SET role = $3
        WHERE project_id = $1 AND user_id = $2
        "#,
    )
    .bind(project_id)
    .bind(user_id)
    .bind(role)
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}

pub async fn update_board_member_role(
    pool: &PgPool,
    board_id: Uuid,
    user_id: Uuid,
    role: BoardMemberRole,
) -> Result<bool, sqlx::Error> {
    update_project_member_role(pool, board_id, user_id, role).await
}

/// Remove a user from a project
pub async fn remove_project_member(
    pool: &PgPool,
    project_id: Uuid,
    user_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        r#"
        DELETE FROM project_members
        WHERE project_id = $1 AND user_id = $2
        "#,
    )
    .bind(project_id)
    .bind(user_id)
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}

pub async fn remove_board_member(
    pool: &PgPool,
    board_id: Uuid,
    user_id: Uuid,
) -> Result<bool, sqlx::Error> {
    remove_project_member(pool, board_id, user_id).await
}

/// Project member with user info
#[derive(sqlx::FromRow, serde::Serialize, Clone, Debug)]
pub struct ProjectMemberWithUser {
    pub id: Uuid,
    pub project_id: Uuid,
    pub user_id: Uuid,
    pub role: BoardMemberRole,
    pub joined_at: chrono::DateTime<chrono::Utc>,
    pub name: String,
    pub email: String,
    pub avatar_url: Option<String>,
}

pub type BoardMemberWithUser = ProjectMemberWithUser;

/// List all members of a project with user info
pub async fn list_project_members(
    pool: &PgPool,
    project_id: Uuid,
) -> Result<Vec<ProjectMemberWithUser>, sqlx::Error> {
    sqlx::query_as::<_, ProjectMemberWithUser>(
        r#"
        SELECT bm.id, bm.project_id, bm.user_id, bm.role,
               bm.joined_at, u.name, u.email, u.avatar_url
        FROM project_members bm
        INNER JOIN users u ON bm.user_id = u.id
        WHERE bm.project_id = $1
          AND u.deleted_at IS NULL
        ORDER BY bm.joined_at ASC
        "#,
    )
    .bind(project_id)
    .fetch_all(pool)
    .await
}

pub async fn list_board_members(
    pool: &PgPool,
    board_id: Uuid,
) -> Result<Vec<ProjectMemberWithUser>, sqlx::Error> {
    list_project_members(pool, board_id).await
}

/// Check if a user is a member of a project
pub async fn is_project_member(
    pool: &PgPool,
    project_id: Uuid,
    user_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM project_members
            WHERE project_id = $1 AND user_id = $2
        )
        "#,
    )
    .bind(project_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    Ok(result)
}

pub async fn is_board_member(
    pool: &PgPool,
    board_id: Uuid,
    user_id: Uuid,
) -> Result<bool, sqlx::Error> {
    is_project_member(pool, board_id, user_id).await
}

/// Get project member role
pub async fn get_project_member_role(
    pool: &PgPool,
    project_id: Uuid,
    user_id: Uuid,
) -> Result<Option<BoardMemberRole>, sqlx::Error> {
    sqlx::query_scalar::<_, BoardMemberRole>(
        r#"
        SELECT role as "role: BoardMemberRole"
        FROM project_members
        WHERE project_id = $1 AND user_id = $2
        "#,
    )
    .bind(project_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await
}

pub async fn get_board_member_role(
    pool: &PgPool,
    board_id: Uuid,
    user_id: Uuid,
) -> Result<Option<BoardMemberRole>, sqlx::Error> {
    get_project_member_role(pool, board_id, user_id).await
}

/// Get project without membership check (for internal use)
pub async fn get_project_internal(pool: &PgPool, id: Uuid) -> Result<Option<Project>, sqlx::Error> {
    sqlx::query_as::<_, Project>(
        r#"
        SELECT id, name, description, slack_webhook_url, prefix,
               workspace_id, tenant_id, created_by_id,
               background_color, is_sample, deleted_at, created_at, updated_at
        FROM projects
        WHERE id = $1
          AND deleted_at IS NULL
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn get_board_internal(pool: &PgPool, id: Uuid) -> Result<Option<Project>, sqlx::Error> {
    get_project_internal(pool, id).await
}

// ============================================================================
// Project Full (batch) query types and functions
// ============================================================================

/// A task row enriched with badge counts for the project full response
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TaskWithBadgesRow {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub priority: TaskPriority,
    pub due_date: Option<DateTime<Utc>>,
    pub status_id: Option<Uuid>,
    pub position: String,
    pub task_list_id: Option<Uuid>,
    pub milestone_id: Option<Uuid>,
    pub created_by_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub subtask_total: i64,
    pub subtask_completed: i64,
    pub has_running_timer: bool,
    pub comment_count: i64,
    pub parent_task_id: Option<Uuid>,
}

/// Assignee info returned for a project's tasks
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct BoardTaskAssignee {
    pub task_id: Uuid,
    pub user_id: Uuid,
    pub display_name: String,
    pub avatar_url: Option<String>,
}

/// Label info returned for a project's tasks
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct BoardTaskLabel {
    pub task_id: Uuid,
    pub label_id: Uuid,
    pub name: String,
    pub color: String,
}

/// Result of paginated task queries: rows + total count
pub struct PaginatedTasks {
    pub tasks: Vec<TaskWithBadgesRow>,
    pub total_count: i64,
}

/// Fetch tasks for a project with badge counts (subtasks, timers, comments).
/// Supports optional pagination via limit/offset. Returns total count for pagination metadata.
pub async fn list_project_tasks_with_badges(
    pool: &PgPool,
    project_id: Uuid,
    user_id: Uuid,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<PaginatedTasks, sqlx::Error> {
    let limit_val = limit.unwrap_or(1000).clamp(1, 1000);
    let offset_val = offset.unwrap_or(0).max(0);

    // Get total count first (respects visibility filtering)
    let total_count: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*)
        FROM tasks t
        LEFT JOIN task_lists tl ON tl.id = t.task_list_id
        WHERE t.project_id = $1 AND t.deleted_at IS NULL AND t.parent_task_id IS NULL
          AND (
            -- No role assigned yet (pre-migration) = full access
            NOT EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = t.project_id AND pm.user_id = $2 AND pm.role_id IS NOT NULL)
            OR
            -- Role has can_view_all_tasks capability
            (SELECT wr.capabilities->>'can_view_all_tasks' = 'true'
             FROM workspace_roles wr
             JOIN project_members pm ON pm.role_id = wr.id
             WHERE pm.project_id = t.project_id AND pm.user_id = $2)
            OR
            -- Effective visibility is public (default)
            COALESCE(tl.effective_visibility, 'public') = 'public'
            OR
            -- User is assigned to this task
            EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $2)
          )
        "#,
    )
    .bind(project_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    let tasks = sqlx::query_as::<_, TaskWithBadgesRow>(
        r#"
        SELECT
            t.id,
            t.title,
            t.description,
            t.priority,
            t.due_date,
            t.status_id,
            t.position,
            t.task_list_id,
            t.milestone_id,
            t.created_by_id,
            t.created_at,
            t.updated_at,
            t.parent_task_id,
            COALESCE(sub.total, 0) AS "subtask_total",
            COALESCE(sub.completed, 0) AS "subtask_completed",
            COALESCE(tmr.has_running, false) AS "has_running_timer",
            COALESCE(cmt.cnt, 0) AS "comment_count"
        FROM tasks t
        LEFT JOIN task_lists tl ON tl.id = t.task_list_id
        LEFT JOIN LATERAL (
            SELECT COUNT(*)::bigint AS total,
                   COUNT(*) FILTER (WHERE child.status_id IN (
                       SELECT ps.id FROM project_statuses ps WHERE ps.project_id = t.project_id
                       AND ps.type = 'done'
                   ))::bigint AS completed
            FROM tasks child
            WHERE child.parent_task_id = t.id AND child.deleted_at IS NULL
        ) sub ON true
        LEFT JOIN LATERAL (
            SELECT EXISTS(
                SELECT 1 FROM time_entries te
                WHERE te.task_id = t.id AND te.is_running = true
            ) AS has_running
        ) tmr ON true
        LEFT JOIN LATERAL (
            SELECT COUNT(*)::bigint AS cnt
            FROM comments c
            WHERE c.task_id = t.id AND c.deleted_at IS NULL
        ) cmt ON true
        WHERE t.project_id = $1 AND t.deleted_at IS NULL AND t.parent_task_id IS NULL
          AND (
            NOT EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = t.project_id AND pm.user_id = $4 AND pm.role_id IS NOT NULL)
            OR
            (SELECT wr.capabilities->>'can_view_all_tasks' = 'true'
             FROM workspace_roles wr
             JOIN project_members pm ON pm.role_id = wr.id
             WHERE pm.project_id = t.project_id AND pm.user_id = $4)
            OR
            COALESCE(tl.effective_visibility, 'public') = 'public'
            OR
            EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $4)
          )
        ORDER BY t.position ASC
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(project_id)
    .bind(limit_val)
    .bind(offset_val)
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(PaginatedTasks { tasks, total_count })
}

pub async fn list_board_tasks_with_badges(
    pool: &PgPool,
    board_id: Uuid,
    user_id: Uuid,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<PaginatedTasks, sqlx::Error> {
    list_project_tasks_with_badges(pool, board_id, user_id, limit, offset).await
}

/// Fetch assignees for tasks in a project (capped at 5000 rows)
pub async fn list_project_task_assignees(
    pool: &PgPool,
    project_id: Uuid,
) -> Result<Vec<BoardTaskAssignee>, sqlx::Error> {
    sqlx::query_as::<_, BoardTaskAssignee>(
        r#"
        SELECT
            ta.task_id,
            ta.user_id,
            u.name AS display_name,
            u.avatar_url
        FROM task_assignees ta
        JOIN tasks t ON t.id = ta.task_id
        JOIN users u ON u.id = ta.user_id
        WHERE t.project_id = $1
          AND t.deleted_at IS NULL
          AND u.deleted_at IS NULL
        LIMIT 5000
        "#,
    )
    .bind(project_id)
    .fetch_all(pool)
    .await
}

pub async fn list_board_task_assignees(
    pool: &PgPool,
    board_id: Uuid,
) -> Result<Vec<BoardTaskAssignee>, sqlx::Error> {
    list_project_task_assignees(pool, board_id).await
}

/// Fetch labels for tasks in a project (capped at 5000 rows)
pub async fn list_project_task_labels(
    pool: &PgPool,
    project_id: Uuid,
) -> Result<Vec<BoardTaskLabel>, sqlx::Error> {
    sqlx::query_as::<_, BoardTaskLabel>(
        r#"
        SELECT
            tl.task_id,
            l.id AS label_id,
            l.name,
            l.color
        FROM task_labels tl
        JOIN labels l ON l.id = tl.label_id
        JOIN tasks t ON t.id = tl.task_id
        WHERE t.project_id = $1
          AND t.deleted_at IS NULL
        LIMIT 5000
        "#,
    )
    .bind(project_id)
    .fetch_all(pool)
    .await
}

pub async fn list_board_task_labels(
    pool: &PgPool,
    board_id: Uuid,
) -> Result<Vec<BoardTaskLabel>, sqlx::Error> {
    list_project_task_labels(pool, board_id).await
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
        r#"
        INSERT INTO projects (name, description, workspace_id, tenant_id, created_by_id, background_color)
        SELECT $2, description, workspace_id, tenant_id, $3, background_color
        FROM projects WHERE id = $1 AND deleted_at IS NULL
        RETURNING id, name, description, slack_webhook_url, prefix,
                  workspace_id, tenant_id, created_by_id,
                  background_color, is_sample, deleted_at, created_at, updated_at
        "#,
    )
    .bind(source_id)
    .bind(new_name)
    .bind(user_id)
    .fetch_one(&mut *tx)
    .await?;

    // 2. Copy statuses
    sqlx::query(
        r#"
        INSERT INTO project_statuses (id, project_id, name, color, type, position, is_default, tenant_id)
        SELECT gen_random_uuid(), $2, name, color, type, position, is_default, tenant_id
        FROM project_statuses WHERE project_id = $1
        "#,
    )
    .bind(source_id)
    .bind(new_project.id)
    .execute(&mut *tx)
    .await?;

    // 3. Copy task lists
    let new_task_lists = sqlx::query_as::<_, TaskList>(
        r#"
        INSERT INTO task_lists (project_id, name, color, position, is_default, tenant_id, created_by_id)
        SELECT $2, name, color, position, is_default, tenant_id, $3
        FROM task_lists WHERE project_id = $1 AND deleted_at IS NULL
        ORDER BY position ASC
        RETURNING id, project_id, name, color, position, is_default, collapsed,
                  tenant_id, created_by_id, created_at, updated_at, deleted_at
        "#,
    )
    .bind(source_id)
    .bind(new_project.id)
    .bind(user_id)
    .fetch_all(&mut *tx)
    .await?;

    // 4. Copy tasks (optional) — map old status to new status by name
    if include_tasks {
        sqlx::query(
            r#"
            INSERT INTO tasks (title, description, priority, due_date, position, project_id,
                               status_id, created_by_id, tenant_id)
            SELECT t.title, t.description, t.priority, t.due_date, t.position, $2,
                   ns.id, $3, t.tenant_id
            FROM tasks t
            LEFT JOIN project_statuses os ON os.id = t.status_id
            LEFT JOIN project_statuses ns ON ns.project_id = $2 AND ns.name = os.name
            WHERE t.project_id = $1 AND t.deleted_at IS NULL AND t.parent_task_id IS NULL
            "#,
        )
        .bind(source_id)
        .bind(new_project.id)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;
    }

    // 5. Add user as Owner
    sqlx::query(
        r#"
        INSERT INTO project_members (project_id, user_id, role)
        VALUES ($1, $2, 'owner')
        "#,
    )
    .bind(new_project.id)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    let statuses = super::project_statuses::list_project_statuses(pool, new_project.id).await?;

    Ok(ProjectWithTaskLists {
        project: new_project,
        task_lists: new_task_lists,
        statuses,
    })
}

pub async fn duplicate_board(
    pool: &PgPool,
    source_id: Uuid,
    new_name: &str,
    include_tasks: bool,
    user_id: Uuid,
) -> Result<ProjectWithTaskLists, sqlx::Error> {
    duplicate_project(pool, source_id, new_name, include_tasks, user_id).await
}
