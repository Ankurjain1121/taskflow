use sqlx::PgPool;
use uuid::Uuid;

/// Verify that a user is a member of a project.
/// Returns `true` if the user is a member, `false` otherwise.
///
/// This is the canonical membership check — all other modules should call this
/// instead of duplicating the query. Access is granted via any of:
///   1. Explicit `project_members` row
///   2. Implicit: user is a member of the project's workspace
///   3. Implicit: user has global `admin` or `super_admin` role and the
///      workspace is not `private`
/// Filter a list of user IDs to only those who are members of the given project.
///
/// Uses the same membership logic as `verify_project_membership` (explicit member,
/// workspace member, or tenant-scoped admin on non-private workspace).
pub async fn filter_project_members(
    pool: &PgPool,
    project_id: Uuid,
    user_ids: &[Uuid],
) -> Result<Vec<Uuid>, sqlx::Error> {
    if user_ids.is_empty() {
        return Ok(vec![]);
    }
    let rows = sqlx::query_scalar::<_, Uuid>(
        r"
        SELECT DISTINCT u_id FROM unnest($2::uuid[]) AS u_id
        WHERE EXISTS(
            SELECT 1 FROM project_members
            WHERE project_id = $1 AND user_id = u_id
        )
        OR EXISTS(
            SELECT 1 FROM workspace_members wm
            INNER JOIN projects p ON p.id = $1
            WHERE wm.workspace_id = p.workspace_id
              AND wm.user_id = u_id
        )
        OR EXISTS(
            SELECT 1 FROM users u
            INNER JOIN projects p ON p.id = $1
            INNER JOIN workspaces w ON w.id = p.workspace_id
            WHERE u.id = u_id
              AND u.role IN ('admin', 'super_admin')
              AND u.deleted_at IS NULL
              AND w.visibility != 'private'
              AND u.tenant_id = w.tenant_id
        )
        ",
    )
    .bind(project_id)
    .bind(user_ids)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn verify_project_membership(
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

            -- Implicit: org admin / super_admin on non-private workspace (same tenant)
            SELECT 1 FROM users u
            INNER JOIN projects p ON p.id = $1
            INNER JOIN workspaces w ON w.id = p.workspace_id
            WHERE u.id = $2
              AND u.role IN ('admin', 'super_admin')
              AND u.deleted_at IS NULL
              AND w.visibility != 'private'
              AND u.tenant_id = w.tenant_id
        )
        ",
    )
    .bind(project_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;
    Ok(result)
}
