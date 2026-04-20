//! Shared trash query logic for workspace and admin trash endpoints.
//!
//! Provides a `TrashScope` enum to scope trash operations by either workspace
//! or tenant, with shared functions for listing, restoring, and deleting
//! soft-deleted items.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::state::AppState;
use taskbolt_services::minio::{MinioConfig, MinioService};
use taskbolt_services::trash_bin::{
    permanently_delete, restore_from_trash, TrashEntityType, TRASH_RETENTION_DAYS,
};

// ============================================================================
// Scope
// ============================================================================

/// Determines how trash queries are scoped.
#[derive(Debug, Clone)]
pub enum TrashScope {
    /// Workspace-scoped: boards + tasks belonging to a specific workspace.
    Workspace(Uuid),
    /// Tenant-scoped: all boards + tasks + workspaces belonging to a tenant.
    Tenant(Uuid),
}

// ============================================================================
// DTOs
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct TrashQuery {
    pub entity_type: Option<String>,
    pub cursor: Option<String>,
    #[serde(default = "default_page_size")]
    pub page_size: i64,
}

fn default_page_size() -> i64 {
    20
}

#[derive(Debug, Serialize)]
pub struct TrashItem {
    pub entity_type: String,
    pub entity_id: Uuid,
    pub name: String,
    pub deleted_at: DateTime<Utc>,
    pub deleted_by_name: Option<String>,
    /// Days remaining until permanent deletion (used by workspace trash UI).
    pub days_remaining: i32,
    /// Alias for days_remaining (used by admin trash UI).
    pub days_until_permanent_delete: i64,
}

#[derive(Debug, Serialize)]
pub struct TrashListResponse {
    pub items: Vec<TrashItem>,
    pub next_cursor: Option<String>,
}

#[strict_dto_derive::strict_dto]
#[derive(Debug)]
pub struct RestoreRequest {
    pub entity_type: String,
    pub entity_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct TrashOpResponse {
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct EmptyTrashResponse {
    pub success: bool,
    pub deleted_count: usize,
    pub message: String,
}

// ============================================================================
// Internal row type for raw SQL results
// ============================================================================

#[derive(Debug, sqlx::FromRow)]
struct TrashRow {
    entity_type: String,
    entity_id: Uuid,
    name: String,
    deleted_at: DateTime<Utc>,
}

// ============================================================================
// Shared functions
// ============================================================================

/// List soft-deleted items within the given scope, with cursor pagination
/// and optional entity_type filter. Retains only items from the last 30 days.
pub async fn list_trash(
    pool: &PgPool,
    scope: &TrashScope,
    query: &TrashQuery,
) -> Result<TrashListResponse> {
    let page_size = query.page_size.clamp(1, 100);
    let fetch_limit = page_size + 1;
    let thirty_days_ago = Utc::now() - chrono::Duration::days(TRASH_RETENTION_DAYS);

    let cursor_time: Option<DateTime<Utc>> = query
        .cursor
        .as_ref()
        .and_then(|c| DateTime::parse_from_rfc3339(c).ok())
        .map(|dt| dt.with_timezone(&Utc));

    let entity_filter = query.entity_type.as_deref();

    let rows = match scope {
        TrashScope::Workspace(workspace_id) => {
            list_workspace_trash_rows(
                pool,
                *workspace_id,
                entity_filter,
                cursor_time,
                thirty_days_ago,
                fetch_limit,
            )
            .await?
        }
        TrashScope::Tenant(tenant_id) => {
            list_tenant_trash_rows(
                pool,
                *tenant_id,
                entity_filter,
                cursor_time,
                thirty_days_ago,
                fetch_limit,
            )
            .await?
        }
    };

    let has_more = rows.len() > page_size as usize;
    let rows: Vec<_> = rows.into_iter().take(page_size as usize).collect();

    let now = Utc::now();
    let items: Vec<TrashItem> = rows
        .iter()
        .map(|r| {
            let days_since = (now - r.deleted_at).num_days();
            let remaining = (30 - days_since).max(0);
            TrashItem {
                entity_type: r.entity_type.clone(),
                entity_id: r.entity_id,
                name: r.name.clone(),
                deleted_at: r.deleted_at,
                deleted_by_name: None,
                days_remaining: remaining as i32,
                days_until_permanent_delete: remaining,
            }
        })
        .collect();

    let next_cursor = if has_more {
        rows.last().map(|r| r.deleted_at.to_rfc3339())
    } else {
        None
    };

    Ok(TrashListResponse { items, next_cursor })
}

/// Restore a soft-deleted item. Verifies the item belongs to the given scope.
pub async fn restore_item(
    pool: &PgPool,
    scope: &TrashScope,
    entity_type_str: &str,
    entity_id: Uuid,
    user_id: Uuid,
) -> Result<TrashOpResponse> {
    let entity_type = parse_entity_type(entity_type_str, scope)?;
    verify_scope(pool, scope, &entity_type, entity_id).await?;

    restore_from_trash(pool, &entity_type, entity_id, user_id)
        .await
        .map_err(|e| AppError::InternalError(format!("Failed to restore: {}", e)))?;

    Ok(TrashOpResponse {
        success: true,
        message: format!("{} restored successfully", entity_type.as_str()),
    })
}

/// Permanently delete a trashed item. Verifies the item belongs to the given scope.
pub async fn delete_item(
    state: &AppState,
    scope: &TrashScope,
    entity_type_str: &str,
    entity_id: Uuid,
) -> Result<TrashOpResponse> {
    let entity_type = parse_entity_type(entity_type_str, scope)?;
    verify_scope(&state.db, scope, &entity_type, entity_id).await?;

    let minio = create_minio_service(state).await;
    permanently_delete(&state.db, &minio, &entity_type, entity_id)
        .await
        .map_err(|e| AppError::InternalError(format!("Failed to delete: {}", e)))?;

    Ok(TrashOpResponse {
        success: true,
        message: format!("{} permanently deleted", entity_type.as_str()),
    })
}

/// Empty all trash for a tenant. Admin-only operation.
pub async fn empty_trash(state: &AppState, tenant_id: Uuid) -> Result<EmptyTrashResponse> {
    let minio = create_minio_service(state).await;
    let mut deleted_count: usize = 0;

    // Delete in FK-safe order: tasks first, then boards, then workspaces
    let task_ids: Vec<Uuid> = sqlx::query_scalar!(
        r#"SELECT id FROM tasks WHERE tenant_id = $1 AND deleted_at IS NOT NULL"#,
        tenant_id
    )
    .fetch_all(&state.db)
    .await?;

    for task_id in task_ids {
        if let Err(e) = permanently_delete(&state.db, &minio, &TrashEntityType::Task, task_id).await
        {
            tracing::warn!(task_id = %task_id, error = %e, "Failed to delete task");
        } else {
            deleted_count += 1;
        }
    }

    let board_ids: Vec<Uuid> = sqlx::query_scalar(
        r#"SELECT id FROM projects WHERE tenant_id = $1 AND deleted_at IS NOT NULL"#,
    )
    .bind(tenant_id)
    .fetch_all(&state.db)
    .await?;

    for board_id in board_ids {
        if let Err(e) =
            permanently_delete(&state.db, &minio, &TrashEntityType::Board, board_id).await
        {
            tracing::warn!(board_id = %board_id, error = %e, "Failed to delete board");
        } else {
            deleted_count += 1;
        }
    }

    let workspace_ids: Vec<Uuid> = sqlx::query_scalar!(
        r#"SELECT id FROM workspaces WHERE tenant_id = $1 AND deleted_at IS NOT NULL"#,
        tenant_id
    )
    .fetch_all(&state.db)
    .await?;

    for ws_id in workspace_ids {
        if let Err(e) =
            permanently_delete(&state.db, &minio, &TrashEntityType::Workspace, ws_id).await
        {
            tracing::warn!(workspace_id = %ws_id, error = %e, "Failed to delete workspace");
        } else {
            deleted_count += 1;
        }
    }

    Ok(EmptyTrashResponse {
        success: true,
        deleted_count,
        message: format!("Permanently deleted {} items", deleted_count),
    })
}

// ============================================================================
// Internal helpers
// ============================================================================

/// Parse entity type string, restricting valid types based on scope.
/// Workspace scope only supports "board" and "task".
/// Tenant scope also supports "workspace".
fn parse_entity_type(s: &str, scope: &TrashScope) -> Result<TrashEntityType> {
    let entity_type = TrashEntityType::from_str(s).ok_or_else(|| {
        let valid = match scope {
            TrashScope::Workspace(_) => "'board' or 'task'",
            TrashScope::Tenant(_) => "'board', 'task', or 'workspace'",
        };
        AppError::BadRequest(format!("Invalid entity type. Use {}.", valid))
    })?;

    // Workspace scope does not support workspace-level trash
    if matches!(scope, TrashScope::Workspace(_))
        && matches!(entity_type, TrashEntityType::Workspace)
    {
        return Err(AppError::BadRequest(
            "Invalid entity type. Use 'board' or 'task'.".into(),
        ));
    }

    Ok(entity_type)
}

/// Verify that an entity belongs to the given scope.
async fn verify_scope(
    pool: &PgPool,
    scope: &TrashScope,
    entity_type: &TrashEntityType,
    entity_id: Uuid,
) -> Result<()> {
    let exists = match scope {
        TrashScope::Workspace(workspace_id) => {
            verify_workspace_scope(pool, entity_type, entity_id, *workspace_id).await?
        }
        TrashScope::Tenant(tenant_id) => {
            verify_tenant_scope(pool, entity_type, entity_id, *tenant_id).await?
        }
    };

    if !exists {
        let label = match entity_type {
            TrashEntityType::Board => "Board",
            TrashEntityType::Task => "Task",
            TrashEntityType::Workspace => "Workspace",
        };
        return Err(AppError::NotFound(format!("{} not found in trash", label)));
    }

    Ok(())
}

async fn verify_workspace_scope(
    pool: &PgPool,
    entity_type: &TrashEntityType,
    entity_id: Uuid,
    workspace_id: Uuid,
) -> Result<bool> {
    let exists: bool = match entity_type {
        TrashEntityType::Board => sqlx::query_scalar(
            r#"SELECT EXISTS(
                    SELECT 1 FROM projects
                    WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NOT NULL
                )"#,
        )
        .bind(entity_id)
        .bind(workspace_id)
        .fetch_one(pool)
        .await
        .map_err(AppError::from)?,
        TrashEntityType::Task => sqlx::query_scalar(
            r#"SELECT EXISTS(
                    SELECT 1 FROM tasks t
                    JOIN projects b ON b.id = t.project_id
                    WHERE t.id = $1 AND b.workspace_id = $2 AND t.deleted_at IS NOT NULL
                )"#,
        )
        .bind(entity_id)
        .bind(workspace_id)
        .fetch_one(pool)
        .await
        .map_err(AppError::from)?,
        TrashEntityType::Workspace => {
            // Should not reach here due to parse_entity_type guard
            return Ok(false);
        }
    };
    Ok(exists)
}

async fn verify_tenant_scope(
    pool: &PgPool,
    entity_type: &TrashEntityType,
    entity_id: Uuid,
    tenant_id: Uuid,
) -> Result<bool> {
    let exists: bool = match entity_type {
        TrashEntityType::Task => {
            sqlx::query_scalar!(
                r#"SELECT EXISTS(SELECT 1 FROM tasks WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NOT NULL) as "exists!""#,
                entity_id,
                tenant_id
            )
            .fetch_one(pool)
            .await?
        }
        TrashEntityType::Board => {
            sqlx::query_scalar!(
                r#"SELECT EXISTS(SELECT 1 FROM projects WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NOT NULL) as "exists!""#,
                entity_id,
                tenant_id
            )
            .fetch_one(pool)
            .await?
        }
        TrashEntityType::Workspace => {
            sqlx::query_scalar!(
                r#"SELECT EXISTS(SELECT 1 FROM workspaces WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NOT NULL) as "exists!""#,
                entity_id,
                tenant_id
            )
            .fetch_one(pool)
            .await?
        }
    };
    Ok(exists)
}

/// List trash rows scoped to a workspace (boards + tasks only).
async fn list_workspace_trash_rows(
    pool: &PgPool,
    workspace_id: Uuid,
    entity_filter: Option<&str>,
    cursor_time: Option<DateTime<Utc>>,
    cutoff: DateTime<Utc>,
    fetch_limit: i64,
) -> Result<Vec<TrashRow>> {
    let rows: Vec<TrashRow> = sqlx::query_as(
        r#"
        (
            SELECT 'board' as entity_type, b.id as entity_id, b.name, b.deleted_at
            FROM projects b
            WHERE b.workspace_id = $1
              AND b.deleted_at IS NOT NULL
              AND b.deleted_at > $2
              AND ($3::text IS NULL OR $3 = 'board')
              AND ($4::timestamptz IS NULL OR b.deleted_at < $4)
        )
        UNION ALL
        (
            SELECT 'task' as entity_type, t.id as entity_id, t.title as name, t.deleted_at
            FROM tasks t
            JOIN projects bo ON bo.id = t.project_id
            WHERE bo.workspace_id = $1
              AND t.deleted_at IS NOT NULL
              AND t.deleted_at > $2
              AND ($3::text IS NULL OR $3 = 'task')
              AND ($4::timestamptz IS NULL OR t.deleted_at < $4)
        )
        ORDER BY deleted_at DESC
        LIMIT $5
        "#,
    )
    .bind(workspace_id)
    .bind(cutoff)
    .bind(entity_filter)
    .bind(cursor_time)
    .bind(fetch_limit)
    .fetch_all(pool)
    .await
    .map_err(AppError::from)?;

    Ok(rows)
}

/// List trash rows scoped to a tenant (boards + tasks + workspaces).
async fn list_tenant_trash_rows(
    pool: &PgPool,
    tenant_id: Uuid,
    entity_filter: Option<&str>,
    cursor_time: Option<DateTime<Utc>>,
    cutoff: DateTime<Utc>,
    fetch_limit: i64,
) -> Result<Vec<TrashRow>> {
    let rows: Vec<TrashRow> = sqlx::query_as(
        r#"
        (
            SELECT 'board' as entity_type, b.id as entity_id, b.name, b.deleted_at
            FROM projects b
            WHERE b.tenant_id = $1
              AND b.deleted_at IS NOT NULL
              AND b.deleted_at > $2
              AND ($3::text IS NULL OR $3 = 'board')
              AND ($4::timestamptz IS NULL OR b.deleted_at < $4)
        )
        UNION ALL
        (
            SELECT 'task' as entity_type, t.id as entity_id, t.title as name, t.deleted_at
            FROM tasks t
            WHERE t.tenant_id = $1
              AND t.deleted_at IS NOT NULL
              AND t.deleted_at > $2
              AND ($3::text IS NULL OR $3 = 'task')
              AND ($4::timestamptz IS NULL OR t.deleted_at < $4)
        )
        UNION ALL
        (
            SELECT 'workspace' as entity_type, w.id as entity_id, w.name, w.deleted_at
            FROM workspaces w
            WHERE w.tenant_id = $1
              AND w.deleted_at IS NOT NULL
              AND w.deleted_at > $2
              AND ($3::text IS NULL OR $3 = 'workspace')
              AND ($4::timestamptz IS NULL OR w.deleted_at < $4)
        )
        ORDER BY deleted_at DESC
        LIMIT $5
        "#,
    )
    .bind(tenant_id)
    .bind(cutoff)
    .bind(entity_filter)
    .bind(cursor_time)
    .bind(fetch_limit)
    .fetch_all(pool)
    .await
    .map_err(AppError::from)?;

    Ok(rows)
}

/// Create a MinioService from AppState config.
async fn create_minio_service(state: &AppState) -> MinioService {
    MinioService::new(MinioConfig {
        endpoint: state.config.minio_endpoint.clone(),
        public_url: state.config.minio_public_url.clone(),
        access_key: state.config.minio_access_key.clone(),
        secret_key: state.config.minio_secret_key.clone(),
        bucket: state.config.minio_bucket.clone(),
    })
    .await
}
