//! Project read query functions (list, get, search, membership checks)

use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{BoardMemberRole, Project, ProjectStatus, TaskList, TaskPriority};

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
    /// True if this member's access comes from workspace membership or org admin role,
    /// not from an explicit project_members row. Implicit members cannot be removed
    /// or have their role changed via project-level APIs.
    pub is_implicit: bool,
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

/// List all projects in a workspace.
///
/// Workspace membership is verified in the route handler — any workspace member
/// can see project names. Access to project DATA (tasks, boards) is gated by
/// `verify_project_membership()` which checks project_members + admin bypass.
pub async fn list_projects_by_workspace(
    pool: &PgPool,
    workspace_id: Uuid,
) -> Result<Vec<Project>, sqlx::Error> {
    sqlx::query_as::<_, Project>(
        r"
        SELECT p.id, p.name, p.description, p.slack_webhook_url, p.prefix,
               p.workspace_id, p.tenant_id, p.created_by_id,
               p.background_color, p.is_sample, p.project_group_id, p.deleted_at, p.created_at, p.updated_at
        FROM projects p
        WHERE p.workspace_id = $1
          AND p.deleted_at IS NULL
        ORDER BY p.created_at DESC
        LIMIT 200
        ",
    )
    .bind(workspace_id)
    .fetch_all(pool)
    .await
}

/// Get a project by ID with its task lists and statuses.
///
/// Verifies membership via `is_project_member` which honors implicit access
/// (workspace members + non-private-workspace org admins).
pub async fn get_project_by_id(
    pool: &PgPool,
    id: Uuid,
    user_id: Uuid,
) -> Result<Option<ProjectWithTaskLists>, sqlx::Error> {
    // Verify access first (explicit or implicit membership)
    if !is_project_member(pool, id, user_id).await? {
        return Ok(None);
    }

    let project = sqlx::query_as::<_, Project>(
        r"
        SELECT p.id, p.name, p.description, p.slack_webhook_url, p.prefix,
               p.workspace_id, p.tenant_id, p.created_by_id,
               p.background_color, p.is_sample, p.project_group_id, p.deleted_at, p.created_at, p.updated_at
        FROM projects p
        WHERE p.id = $1
          AND p.deleted_at IS NULL
        ",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;

    match project {
        Some(p) => {
            let task_lists = sqlx::query_as::<_, TaskList>(
                r"
                SELECT id, project_id, name, color, position, is_default, collapsed,
                       tenant_id, created_by_id, created_at, updated_at, deleted_at
                FROM task_lists
                WHERE project_id = $1 AND deleted_at IS NULL
                ORDER BY position ASC
                ",
            )
            .bind(id)
            .fetch_all(pool)
            .await?;

            let statuses = sqlx::query_as::<_, ProjectStatus>(
                r"
                SELECT id, project_id, name, color, type, position, is_default, tenant_id, created_at,
                       allowed_transitions
                FROM project_statuses
                WHERE project_id = $1
                ORDER BY position ASC
                ",
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

/// List all members of a project with user info.
///
/// Includes three groups via UNION ALL:
/// 1. Explicit project_members rows
/// 2. Workspace members not explicitly added (implicit) — workspace owner gets
///    'owner' role, everyone else gets 'editor'
/// 3. Org admins/super_admins (implicit) — only for non-private workspaces
pub async fn list_project_members(
    pool: &PgPool,
    project_id: Uuid,
) -> Result<Vec<ProjectMemberWithUser>, sqlx::Error> {
    sqlx::query_as::<_, ProjectMemberWithUser>(
        r"
        SELECT id, project_id, user_id, role, joined_at, name, email, avatar_url, is_implicit
        FROM (
            -- 1. Explicit project members
            SELECT pm.id, pm.project_id, pm.user_id, pm.role, pm.joined_at,
                   u.name, u.email, u.avatar_url,
                   false AS is_implicit
            FROM project_members pm
            INNER JOIN users u ON pm.user_id = u.id
            WHERE pm.project_id = $1
              AND u.deleted_at IS NULL

            UNION ALL

            -- 2. Workspace members not explicitly in project_members
            SELECT '00000000-0000-0000-0000-000000000000'::uuid AS id,
                   $1 AS project_id,
                   wm.user_id,
                   CASE WHEN wm.role = 'owner' THEN 'owner'::project_member_role
                        ELSE 'editor'::project_member_role END AS role,
                   wm.joined_at,
                   u.name, u.email, u.avatar_url,
                   true AS is_implicit
            FROM workspace_members wm
            INNER JOIN users u ON wm.user_id = u.id
            INNER JOIN projects p ON p.id = $1
            WHERE wm.workspace_id = p.workspace_id
              AND u.deleted_at IS NULL
              AND NOT EXISTS (
                  SELECT 1 FROM project_members pm2
                  WHERE pm2.project_id = $1 AND pm2.user_id = wm.user_id
              )

            UNION ALL

            -- 3. Org admins with implicit access (blocked on private workspaces)
            SELECT '00000000-0000-0000-0000-000000000000'::uuid AS id,
                   $1 AS project_id,
                   u.id AS user_id,
                   'editor'::project_member_role AS role,
                   u.created_at AS joined_at,
                   u.name, u.email, u.avatar_url,
                   true AS is_implicit
            FROM users u
            INNER JOIN projects p ON p.id = $1
            INNER JOIN workspaces w ON w.id = p.workspace_id
            WHERE u.role IN ('admin', 'super_admin')
              AND u.deleted_at IS NULL
              AND u.tenant_id = p.tenant_id
              AND w.visibility != 'private'
              AND NOT EXISTS (
                  SELECT 1 FROM workspace_members wm2
                  WHERE wm2.workspace_id = p.workspace_id AND wm2.user_id = u.id
              )
              AND NOT EXISTS (
                  SELECT 1 FROM project_members pm2
                  WHERE pm2.project_id = $1 AND pm2.user_id = u.id
              )
        ) combined
        ORDER BY is_implicit ASC, joined_at ASC
        ",
    )
    .bind(project_id)
    .fetch_all(pool)
    .await
}

/// Check if a user is a member of a project.
///
/// Returns true if the user has:
/// - An explicit project_members row, OR
/// - Workspace membership in the project's workspace (implicit), OR
/// - Global admin role AND the workspace is not private (implicit)
pub async fn is_project_member(
    pool: &PgPool,
    project_id: Uuid,
    user_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar::<_, bool>(
        r"
        SELECT EXISTS(
            -- Explicit project member
            SELECT 1 FROM project_members
            WHERE project_id = $1 AND user_id = $2

            UNION ALL

            -- Implicit: workspace member
            SELECT 1 FROM workspace_members wm
            INNER JOIN projects p ON p.id = $1
            WHERE wm.workspace_id = p.workspace_id
              AND wm.user_id = $2

            UNION ALL

            -- Implicit: org admin on non-private workspace
            SELECT 1 FROM users u
            INNER JOIN projects p ON p.id = $1
            INNER JOIN workspaces w ON w.id = p.workspace_id
            WHERE u.id = $2
              AND u.role = 'admin'
              AND u.deleted_at IS NULL
              AND w.visibility != 'private'
        )
        ",
    )
    .bind(project_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    Ok(result)
}

/// Get project member role.
///
/// Returns the highest-precedence role applicable to the user:
/// 1. Explicit project_members.role (takes precedence)
/// 2. Workspace owner → 'owner'
/// 3. Any workspace member → 'editor'
/// 4. Org admin on non-private workspace → 'editor'
pub async fn get_project_member_role(
    pool: &PgPool,
    project_id: Uuid,
    user_id: Uuid,
) -> Result<Option<BoardMemberRole>, sqlx::Error> {
    sqlx::query_scalar::<_, BoardMemberRole>(
        r#"
        SELECT role as "role: BoardMemberRole"
        FROM (
            -- Explicit project member (highest precedence)
            SELECT pm.role, 1 AS priority
            FROM project_members pm
            WHERE pm.project_id = $1 AND pm.user_id = $2

            UNION ALL

            -- Workspace owner → project owner
            SELECT 'owner'::project_member_role AS role, 2 AS priority
            FROM workspace_members wm
            INNER JOIN projects p ON p.id = $1
            WHERE wm.workspace_id = p.workspace_id
              AND wm.user_id = $2
              AND wm.role = 'owner'

            UNION ALL

            -- Any other workspace member → editor
            SELECT 'editor'::project_member_role AS role, 3 AS priority
            FROM workspace_members wm
            INNER JOIN projects p ON p.id = $1
            WHERE wm.workspace_id = p.workspace_id
              AND wm.user_id = $2

            UNION ALL

            -- Org admin on non-private workspace → editor
            SELECT 'editor'::project_member_role AS role, 4 AS priority
            FROM users u
            INNER JOIN projects p ON p.id = $1
            INNER JOIN workspaces w ON w.id = p.workspace_id
            WHERE u.id = $2
              AND u.role = 'admin'
              AND u.deleted_at IS NULL
              AND w.visibility != 'private'
        ) ranked
        ORDER BY priority ASC
        LIMIT 1
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
        r"
        SELECT id, name, description, slack_webhook_url, prefix,
               workspace_id, tenant_id, created_by_id,
               background_color, is_sample, project_group_id, deleted_at, created_at, updated_at
        FROM projects
        WHERE id = $1
          AND deleted_at IS NULL
        ",
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
        r"SELECT COUNT(*)
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
        ",
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
        r"
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
        ",
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
        r"
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
        ",
    )
    .bind(project_id)
    .fetch_all(pool)
    .await
}
