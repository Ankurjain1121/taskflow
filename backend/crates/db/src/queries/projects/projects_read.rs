//! Project read query functions (list, get, search, membership checks)

use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{
    BoardMemberRole, Project, ProjectStatus, TaskList, TaskPriority,
};

/// Project with task lists and statuses for detailed view
#[derive(serde::Serialize, Clone, Debug)]
pub struct ProjectWithTaskLists {
    #[serde(flatten)]
    pub project: Project,
    pub task_lists: Vec<TaskList>,
    pub statuses: Vec<ProjectStatus>,
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

/// List projects in a workspace that the user has access to
pub async fn list_projects_by_workspace(
    pool: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<Project>, sqlx::Error> {
    sqlx::query_as::<_, Project>(
        r#"
        SELECT p.id, p.name, p.description, p.slack_webhook_url, p.prefix,
               p.workspace_id, p.tenant_id, p.created_by_id,
               p.background_color, p.is_sample, p.deleted_at, p.created_at, p.updated_at
        FROM projects p
        INNER JOIN project_members pm ON p.id = pm.project_id
        WHERE p.workspace_id = $1
          AND pm.user_id = $2
          AND p.deleted_at IS NULL
        ORDER BY p.created_at DESC
        LIMIT 200
        "#,
    )
    .bind(workspace_id)
    .bind(user_id)
    .fetch_all(pool)
    .await
}

/// Get a project by ID with its task lists and statuses (verify membership)
pub async fn get_project_by_id(
    pool: &PgPool,
    id: Uuid,
    user_id: Uuid,
) -> Result<Option<ProjectWithTaskLists>, sqlx::Error> {
    let project = sqlx::query_as::<_, Project>(
        r#"
        SELECT p.id, p.name, p.description, p.slack_webhook_url, p.prefix,
               p.workspace_id, p.tenant_id, p.created_by_id,
               p.background_color, p.is_sample, p.deleted_at, p.created_at, p.updated_at
        FROM projects p
        INNER JOIN project_members pm ON p.id = pm.project_id
        WHERE p.id = $1
          AND pm.user_id = $2
          AND p.deleted_at IS NULL
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

/// List all members of a project with user info
pub async fn list_project_members(
    pool: &PgPool,
    project_id: Uuid,
) -> Result<Vec<ProjectMemberWithUser>, sqlx::Error> {
    sqlx::query_as::<_, ProjectMemberWithUser>(
        r#"
        SELECT pm.id, pm.project_id, pm.user_id, pm.role,
               pm.joined_at, u.name, u.email, u.avatar_url
        FROM project_members pm
        INNER JOIN users u ON pm.user_id = u.id
        WHERE pm.project_id = $1
          AND u.deleted_at IS NULL
        ORDER BY pm.joined_at ASC
        "#,
    )
    .bind(project_id)
    .fetch_all(pool)
    .await
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

