//! Position query functions for role-based recurring task assignment

use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{
    HolderSummary, Position, PositionHolder, PositionWithHolders, RecurringTaskConfig,
};

/// List all positions for a board with holders and recurring task count
pub async fn list_positions(
    pool: &PgPool,
    board_id: Uuid,
) -> Result<Vec<PositionWithHolders>, sqlx::Error> {
    // Fetch all positions for the board
    let positions = sqlx::query_as::<_, Position>(
        r#"
        SELECT id, name, description, project_id, fallback_position_id,
               tenant_id, created_by_id, created_at, updated_at
        FROM positions
        WHERE project_id = $1
        ORDER BY name ASC
        "#,
    )
    .bind(board_id)
    .fetch_all(pool)
    .await?;

    if positions.is_empty() {
        return Ok(vec![]);
    }

    let position_ids: Vec<Uuid> = positions.iter().map(|p| p.id).collect();

    // Batch-fetch all holders for these positions
    let holders = sqlx::query_as::<_, HolderWithPositionId>(
        r#"
        SELECT ph.position_id, ph.user_id, u.name, u.email, u.avatar_url, ph.assigned_at
        FROM position_holders ph
        INNER JOIN users u ON ph.user_id = u.id
        WHERE ph.position_id = ANY($1)
          AND u.deleted_at IS NULL
        ORDER BY ph.assigned_at ASC
        "#,
    )
    .bind(&position_ids)
    .fetch_all(pool)
    .await?;

    // Batch-fetch recurring task counts per position
    let counts = sqlx::query_as::<_, PositionRecurringCount>(
        r#"
        SELECT position_id, COUNT(*)::bigint AS count
        FROM recurring_task_configs
        WHERE position_id = ANY($1)
        GROUP BY position_id
        "#,
    )
    .bind(&position_ids)
    .fetch_all(pool)
    .await?;

    // Batch-fetch fallback position names
    let fallback_ids: Vec<Uuid> = positions
        .iter()
        .filter_map(|p| p.fallback_position_id)
        .collect();

    let fallback_names = if fallback_ids.is_empty() {
        vec![]
    } else {
        sqlx::query_as::<_, IdName>(
            r#"
            SELECT id, name FROM positions WHERE id = ANY($1)
            "#,
        )
        .bind(&fallback_ids)
        .fetch_all(pool)
        .await?
    };

    // Assemble the result
    let result = positions
        .into_iter()
        .map(|p| {
            let pos_holders: Vec<HolderSummary> = holders
                .iter()
                .filter(|h| h.position_id == p.id)
                .map(|h| HolderSummary {
                    user_id: h.user_id,
                    name: h.name.clone(),
                    email: h.email.clone(),
                    avatar_url: h.avatar_url.clone(),
                    assigned_at: h.assigned_at,
                })
                .collect();

            let recurring_task_count = counts
                .iter()
                .find(|c| c.position_id == p.id)
                .map(|c| c.count)
                .unwrap_or(0);

            let fallback_position_name = p.fallback_position_id.and_then(|fid| {
                fallback_names
                    .iter()
                    .find(|f| f.id == fid)
                    .map(|f| f.name.clone())
            });

            PositionWithHolders {
                id: p.id,
                name: p.name,
                description: p.description,
                project_id: p.project_id,
                fallback_position_id: p.fallback_position_id,
                fallback_position_name,
                tenant_id: p.tenant_id,
                created_by_id: p.created_by_id,
                created_at: p.created_at,
                updated_at: p.updated_at,
                holders: pos_holders,
                recurring_task_count,
            }
        })
        .collect();

    Ok(result)
}

/// Get a single position by ID
pub async fn get_position(pool: &PgPool, id: Uuid) -> Result<Option<Position>, sqlx::Error> {
    sqlx::query_as::<_, Position>(
        r#"
        SELECT id, name, description, project_id, fallback_position_id,
               tenant_id, created_by_id, created_at, updated_at
        FROM positions
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

/// Create a new position
pub async fn create_position(
    pool: &PgPool,
    name: &str,
    description: Option<&str>,
    fallback_position_id: Option<Uuid>,
    board_id: Uuid,
    tenant_id: Uuid,
    created_by_id: Uuid,
) -> Result<Position, sqlx::Error> {
    sqlx::query_as::<_, Position>(
        r#"
        INSERT INTO positions (name, description, fallback_position_id, project_id, tenant_id, created_by_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, name, description, project_id, fallback_position_id,
                  tenant_id, created_by_id, created_at, updated_at
        "#,
    )
    .bind(name)
    .bind(description)
    .bind(fallback_position_id)
    .bind(board_id)
    .bind(tenant_id)
    .bind(created_by_id)
    .fetch_one(pool)
    .await
}

/// Update a position
pub async fn update_position(
    pool: &PgPool,
    id: Uuid,
    name: Option<&str>,
    description: Option<&str>,
    fallback_position_id: Option<Option<Uuid>>,
) -> Result<Option<Position>, sqlx::Error> {
    sqlx::query_as::<_, Position>(
        r#"
        UPDATE positions
        SET name = COALESCE($2, name),
            description = COALESCE($3, description),
            fallback_position_id = CASE WHEN $4 THEN $5 ELSE fallback_position_id END,
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, name, description, project_id, fallback_position_id,
                  tenant_id, created_by_id, created_at, updated_at
        "#,
    )
    .bind(id)
    .bind(name)
    .bind(description)
    .bind(fallback_position_id.is_some()) // $4: whether to update fallback
    .bind(fallback_position_id.flatten()) // $5: the new value (or null)
    .fetch_optional(pool)
    .await
}

/// Delete a position
pub async fn delete_position(pool: &PgPool, id: Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        r#"
        DELETE FROM positions WHERE id = $1
        "#,
    )
    .bind(id)
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}

/// List holders of a position with user details
pub async fn list_holders(
    pool: &PgPool,
    position_id: Uuid,
) -> Result<Vec<HolderSummary>, sqlx::Error> {
    sqlx::query_as::<_, HolderSummary>(
        r#"
        SELECT ph.user_id, u.name, u.email, u.avatar_url, ph.assigned_at
        FROM position_holders ph
        INNER JOIN users u ON ph.user_id = u.id
        WHERE ph.position_id = $1
          AND u.deleted_at IS NULL
        ORDER BY ph.assigned_at ASC
        "#,
    )
    .bind(position_id)
    .fetch_all(pool)
    .await
}

/// Add a holder to a position
pub async fn add_holder(
    pool: &PgPool,
    position_id: Uuid,
    user_id: Uuid,
) -> Result<PositionHolder, sqlx::Error> {
    sqlx::query_as::<_, PositionHolder>(
        r#"
        INSERT INTO position_holders (position_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (position_id, user_id) DO UPDATE SET assigned_at = position_holders.assigned_at
        RETURNING id, position_id, user_id, assigned_at
        "#,
    )
    .bind(position_id)
    .bind(user_id)
    .fetch_one(pool)
    .await
}

/// Remove a holder from a position
pub async fn remove_holder(
    pool: &PgPool,
    position_id: Uuid,
    user_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        r#"
        DELETE FROM position_holders WHERE position_id = $1 AND user_id = $2
        "#,
    )
    .bind(position_id)
    .bind(user_id)
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}

/// List recurring task configs linked to a position
pub async fn list_recurring_tasks_for_position(
    pool: &PgPool,
    position_id: Uuid,
) -> Result<Vec<RecurringTaskConfig>, sqlx::Error> {
    sqlx::query_as::<_, RecurringTaskConfig>(
        r#"
        SELECT id, task_id, pattern, cron_expression, interval_days,
               next_run_at, last_run_at, is_active, max_occurrences,
               occurrences_created, project_id, tenant_id, created_by_id,
               created_at, updated_at, end_date, skip_weekends,
               days_of_week, day_of_month, creation_mode, position_id,
               task_template
        FROM recurring_task_configs
        WHERE position_id = $1
        ORDER BY created_at ASC
        "#,
    )
    .bind(position_id)
    .fetch_all(pool)
    .await
}

/// Resolve assignees for a position using the 4-level fallback chain:
/// 1. Position holders
/// 2. Fallback position holders
/// 3. Workspace admin/owner
/// 4. Company admin (tenant-level)
///
/// Always returns at least one UUID (company admin is guaranteed).
pub async fn resolve_assignees(
    pool: &PgPool,
    position_id: Uuid,
    board_id: Uuid,
    tenant_id: Uuid,
) -> Result<Vec<Uuid>, sqlx::Error> {
    // Step 1: Direct position holders
    let holder_ids = sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT ph.user_id
        FROM position_holders ph
        INNER JOIN users u ON ph.user_id = u.id
        WHERE ph.position_id = $1
          AND u.deleted_at IS NULL
        "#,
    )
    .bind(position_id)
    .fetch_all(pool)
    .await?;

    if !holder_ids.is_empty() {
        return Ok(holder_ids);
    }

    // Step 2: Fallback position holders
    let fallback_id = sqlx::query_scalar::<_, Option<Uuid>>(
        r#"
        SELECT fallback_position_id FROM positions WHERE id = $1
        "#,
    )
    .bind(position_id)
    .fetch_optional(pool)
    .await?
    .flatten();

    if let Some(fid) = fallback_id {
        let fallback_holder_ids = sqlx::query_scalar::<_, Uuid>(
            r#"
            SELECT ph.user_id
            FROM position_holders ph
            INNER JOIN users u ON ph.user_id = u.id
            WHERE ph.position_id = $1
              AND u.deleted_at IS NULL
            "#,
        )
        .bind(fid)
        .fetch_all(pool)
        .await?;

        if !fallback_holder_ids.is_empty() {
            return Ok(fallback_holder_ids);
        }
    }

    // Step 3: Workspace admin/owner (via board -> workspace)
    let ws_admin_id = sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT wm.user_id
        FROM workspace_members wm
        INNER JOIN projects b ON b.workspace_id = wm.workspace_id
        WHERE b.id = $1
          AND wm.role::text IN ('owner', 'admin')
        ORDER BY
            CASE wm.role::text WHEN 'owner' THEN 0 ELSE 1 END,
            wm.joined_at ASC
        LIMIT 1
        "#,
    )
    .bind(board_id)
    .fetch_optional(pool)
    .await?;

    if let Some(admin_id) = ws_admin_id {
        return Ok(vec![admin_id]);
    }

    // Step 4: Company admin (tenant-level) - guaranteed to exist
    let company_admin_id = sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT id FROM users
        WHERE role::text = 'admin'
          AND tenant_id = $1
          AND deleted_at IS NULL
        ORDER BY created_at ASC
        LIMIT 1
        "#,
    )
    .bind(tenant_id)
    .fetch_one(pool)
    .await?;

    // Auto-add company admin as board member if not already
    sqlx::query(
        r#"
        INSERT INTO project_members (project_id, user_id, role)
        VALUES ($1, $2, 'editor')
        ON CONFLICT (project_id, user_id) DO NOTHING
        "#,
    )
    .bind(board_id)
    .bind(company_admin_id)
    .execute(pool)
    .await?;

    Ok(vec![company_admin_id])
}

// -- Internal helper structs for batch queries --

#[derive(sqlx::FromRow)]
struct HolderWithPositionId {
    pub position_id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub email: String,
    pub avatar_url: Option<String>,
    pub assigned_at: chrono::DateTime<chrono::Utc>,
}

#[derive(sqlx::FromRow)]
struct PositionRecurringCount {
    pub position_id: Uuid,
    pub count: i64,
}

#[derive(sqlx::FromRow)]
struct IdName {
    pub id: Uuid,
    pub name: String,
}
