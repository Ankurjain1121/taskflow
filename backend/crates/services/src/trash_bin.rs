//! Trash bin service for soft-deleted items
//!
//! Provides functionality for moving items to trash, restoring them, and permanent deletion.

use chrono::{DateTime, Duration, Utc};
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::minio::MinioService;

/// Retention period for trash items (30 days)
pub const TRASH_RETENTION_DAYS: i64 = 30;

/// Error type for trash bin operations
#[derive(Debug, thiserror::Error)]
pub enum TrashBinError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Entity not found: {0}")]
    NotFound(String),
    #[error("Invalid entity type: {0}")]
    InvalidEntityType(String),
    #[error("Storage error: {0}")]
    Storage(String),
}

/// Supported entity types for trash operations
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TrashEntityType {
    Task,
    Board,
    Workspace,
}

impl TrashEntityType {
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "task" | "tasks" => Some(Self::Task),
            "board" | "boards" => Some(Self::Board),
            "workspace" | "workspaces" => Some(Self::Workspace),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Task => "task",
            Self::Board => "board",
            Self::Workspace => "workspace",
        }
    }
}

/// Trash item for API responses
#[derive(Debug, Serialize)]
pub struct TrashItem {
    pub entity_type: String,
    pub entity_id: Uuid,
    pub name: String,
    pub deleted_at: DateTime<Utc>,
    pub deleted_by_id: Option<Uuid>,
    pub deleted_by_name: Option<String>,
    pub days_until_permanent_delete: i64,
}

/// Paginated trash items response
#[derive(Debug, Serialize)]
pub struct PaginatedTrashItems {
    pub items: Vec<TrashItem>,
    pub next_cursor: Option<String>,
}

/// Move an entity to trash by setting deleted_at
pub async fn move_to_trash(
    pool: &PgPool,
    entity_type: &TrashEntityType,
    entity_id: Uuid,
    user_id: Uuid,
) -> Result<(), TrashBinError> {
    let rows_affected = match entity_type {
        TrashEntityType::Task => {
            sqlx::query!(
                r#"
                UPDATE tasks
                SET deleted_at = NOW(), updated_at = NOW()
                WHERE id = $1 AND deleted_at IS NULL
                "#,
                entity_id
            )
            .execute(pool)
            .await?
            .rows_affected()
        }
        TrashEntityType::Board => {
            sqlx::query!(
                r#"
                UPDATE boards
                SET deleted_at = NOW(), updated_at = NOW()
                WHERE id = $1 AND deleted_at IS NULL
                "#,
                entity_id
            )
            .execute(pool)
            .await?
            .rows_affected()
        }
        TrashEntityType::Workspace => {
            sqlx::query!(
                r#"
                UPDATE workspaces
                SET deleted_at = NOW(), updated_at = NOW()
                WHERE id = $1 AND deleted_at IS NULL
                "#,
                entity_id
            )
            .execute(pool)
            .await?
            .rows_affected()
        }
    };

    if rows_affected == 0 {
        return Err(TrashBinError::NotFound(format!(
            "{} {} not found or already deleted",
            entity_type.as_str(),
            entity_id
        )));
    }

    tracing::info!(
        entity_type = entity_type.as_str(),
        entity_id = %entity_id,
        user_id = %user_id,
        "Entity moved to trash"
    );

    Ok(())
}

/// Restore an entity from trash by clearing deleted_at
pub async fn restore_from_trash(
    pool: &PgPool,
    entity_type: &TrashEntityType,
    entity_id: Uuid,
    user_id: Uuid,
) -> Result<(), TrashBinError> {
    let rows_affected = match entity_type {
        TrashEntityType::Task => {
            sqlx::query!(
                r#"
                UPDATE tasks
                SET deleted_at = NULL, updated_at = NOW()
                WHERE id = $1 AND deleted_at IS NOT NULL
                "#,
                entity_id
            )
            .execute(pool)
            .await?
            .rows_affected()
        }
        TrashEntityType::Board => {
            sqlx::query!(
                r#"
                UPDATE boards
                SET deleted_at = NULL, updated_at = NOW()
                WHERE id = $1 AND deleted_at IS NOT NULL
                "#,
                entity_id
            )
            .execute(pool)
            .await?
            .rows_affected()
        }
        TrashEntityType::Workspace => {
            sqlx::query!(
                r#"
                UPDATE workspaces
                SET deleted_at = NULL, updated_at = NOW()
                WHERE id = $1 AND deleted_at IS NOT NULL
                "#,
                entity_id
            )
            .execute(pool)
            .await?
            .rows_affected()
        }
    };

    if rows_affected == 0 {
        return Err(TrashBinError::NotFound(format!(
            "{} {} not found in trash",
            entity_type.as_str(),
            entity_id
        )));
    }

    tracing::info!(
        entity_type = entity_type.as_str(),
        entity_id = %entity_id,
        user_id = %user_id,
        "Entity restored from trash"
    );

    Ok(())
}

/// Permanently delete an entity and its associated data
pub async fn permanently_delete(
    pool: &PgPool,
    minio: &MinioService,
    entity_type: &TrashEntityType,
    entity_id: Uuid,
) -> Result<(), TrashBinError> {
    match entity_type {
        TrashEntityType::Task => {
            permanently_delete_task(pool, minio, entity_id).await?;
        }
        TrashEntityType::Board => {
            permanently_delete_board(pool, minio, entity_id).await?;
        }
        TrashEntityType::Workspace => {
            permanently_delete_workspace(pool, minio, entity_id).await?;
        }
    }

    tracing::info!(
        entity_type = entity_type.as_str(),
        entity_id = %entity_id,
        "Entity permanently deleted"
    );

    Ok(())
}

/// Permanently delete a task and its attachments
async fn permanently_delete_task(
    pool: &PgPool,
    minio: &MinioService,
    task_id: Uuid,
) -> Result<(), TrashBinError> {
    // Get attachments to delete from storage
    let attachments: Vec<String> = sqlx::query_scalar!(
        r#"SELECT storage_key FROM attachments WHERE task_id = $1"#,
        task_id
    )
    .fetch_all(pool)
    .await?;

    // Delete from storage
    for key in attachments {
        if let Err(e) = minio.delete_object(&key).await {
            tracing::warn!(storage_key = %key, error = %e, "Failed to delete attachment from storage");
        }
    }

    // Delete task (cascades to task_assignees, task_labels, comments, attachments, activity_log via FK)
    let rows = sqlx::query!(
        r#"DELETE FROM tasks WHERE id = $1 AND deleted_at IS NOT NULL"#,
        task_id
    )
    .execute(pool)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(TrashBinError::NotFound(format!("Task {} not found in trash", task_id)));
    }

    Ok(())
}

/// Permanently delete a board and its tasks
async fn permanently_delete_board(
    pool: &PgPool,
    minio: &MinioService,
    board_id: Uuid,
) -> Result<(), TrashBinError> {
    // Get all task IDs for this board
    let task_ids: Vec<Uuid> = sqlx::query_scalar!(
        r#"SELECT id FROM tasks WHERE board_id = $1"#,
        board_id
    )
    .fetch_all(pool)
    .await?;

    // Delete attachments from storage for all tasks
    let attachments: Vec<String> = sqlx::query_scalar!(
        r#"SELECT storage_key FROM attachments WHERE task_id = ANY($1)"#,
        &task_ids
    )
    .fetch_all(pool)
    .await?;

    for key in attachments {
        if let Err(e) = minio.delete_object(&key).await {
            tracing::warn!(storage_key = %key, error = %e, "Failed to delete attachment from storage");
        }
    }

    // Delete board (cascades to board_columns, board_members, tasks, labels)
    let rows = sqlx::query!(
        r#"DELETE FROM boards WHERE id = $1 AND deleted_at IS NOT NULL"#,
        board_id
    )
    .execute(pool)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(TrashBinError::NotFound(format!("Board {} not found in trash", board_id)));
    }

    Ok(())
}

/// Permanently delete a workspace and its boards
async fn permanently_delete_workspace(
    pool: &PgPool,
    minio: &MinioService,
    workspace_id: Uuid,
) -> Result<(), TrashBinError> {
    // Get all board IDs for this workspace
    let board_ids: Vec<Uuid> = sqlx::query_scalar!(
        r#"SELECT id FROM boards WHERE workspace_id = $1"#,
        workspace_id
    )
    .fetch_all(pool)
    .await?;

    // Get all task IDs for these boards
    let task_ids: Vec<Uuid> = sqlx::query_scalar!(
        r#"SELECT id FROM tasks WHERE board_id = ANY($1)"#,
        &board_ids
    )
    .fetch_all(pool)
    .await?;

    // Delete attachments from storage
    let attachments: Vec<String> = sqlx::query_scalar!(
        r#"SELECT storage_key FROM attachments WHERE task_id = ANY($1)"#,
        &task_ids
    )
    .fetch_all(pool)
    .await?;

    for key in attachments {
        if let Err(e) = minio.delete_object(&key).await {
            tracing::warn!(storage_key = %key, error = %e, "Failed to delete attachment from storage");
        }
    }

    // Delete workspace (cascades to workspace_members, boards -> board_columns, board_members, tasks, etc.)
    let rows = sqlx::query!(
        r#"DELETE FROM workspaces WHERE id = $1 AND deleted_at IS NOT NULL"#,
        workspace_id
    )
    .execute(pool)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(TrashBinError::NotFound(format!("Workspace {} not found in trash", workspace_id)));
    }

    Ok(())
}

/// Get trash items for a tenant
pub async fn get_trash_items(
    pool: &PgPool,
    tenant_id: Uuid,
    entity_type_filter: Option<&TrashEntityType>,
    cursor: Option<DateTime<Utc>>,
    page_size: i64,
) -> Result<PaginatedTrashItems, TrashBinError> {
    let now = Utc::now();
    let cutoff = now - Duration::days(TRASH_RETENTION_DAYS);
    let fetch_limit = page_size + 1;

    let mut items: Vec<TrashItem> = Vec::new();

    // Query tasks
    if entity_type_filter.is_none() || entity_type_filter == Some(&TrashEntityType::Task) {
        let tasks: Vec<TrashItem> = sqlx::query_as!(
            TrashItem,
            r#"
            SELECT
                'task' as "entity_type!",
                t.id as entity_id,
                t.title as name,
                t.deleted_at as "deleted_at!",
                NULL::uuid as deleted_by_id,
                NULL::text as deleted_by_name,
                EXTRACT(DAY FROM ($1::timestamptz + interval '30 days' - t.deleted_at))::bigint as "days_until_permanent_delete!"
            FROM tasks t
            WHERE t.tenant_id = $2
              AND t.deleted_at IS NOT NULL
              AND t.deleted_at > $3
              AND ($4::timestamptz IS NULL OR t.deleted_at < $4)
            ORDER BY t.deleted_at DESC
            LIMIT $5
            "#,
            now,
            tenant_id,
            cutoff,
            cursor,
            fetch_limit
        )
        .fetch_all(pool)
        .await?;
        items.extend(tasks);
    }

    // Query boards
    if entity_type_filter.is_none() || entity_type_filter == Some(&TrashEntityType::Board) {
        let boards: Vec<TrashItem> = sqlx::query_as!(
            TrashItem,
            r#"
            SELECT
                'board' as "entity_type!",
                b.id as entity_id,
                b.name as name,
                b.deleted_at as "deleted_at!",
                NULL::uuid as deleted_by_id,
                NULL::text as deleted_by_name,
                EXTRACT(DAY FROM ($1::timestamptz + interval '30 days' - b.deleted_at))::bigint as "days_until_permanent_delete!"
            FROM boards b
            WHERE b.tenant_id = $2
              AND b.deleted_at IS NOT NULL
              AND b.deleted_at > $3
              AND ($4::timestamptz IS NULL OR b.deleted_at < $4)
            ORDER BY b.deleted_at DESC
            LIMIT $5
            "#,
            now,
            tenant_id,
            cutoff,
            cursor,
            fetch_limit
        )
        .fetch_all(pool)
        .await?;
        items.extend(boards);
    }

    // Query workspaces
    if entity_type_filter.is_none() || entity_type_filter == Some(&TrashEntityType::Workspace) {
        let workspaces: Vec<TrashItem> = sqlx::query_as!(
            TrashItem,
            r#"
            SELECT
                'workspace' as "entity_type!",
                w.id as entity_id,
                w.name as name,
                w.deleted_at as "deleted_at!",
                NULL::uuid as deleted_by_id,
                NULL::text as deleted_by_name,
                EXTRACT(DAY FROM ($1::timestamptz + interval '30 days' - w.deleted_at))::bigint as "days_until_permanent_delete!"
            FROM workspaces w
            WHERE w.tenant_id = $2
              AND w.deleted_at IS NOT NULL
              AND w.deleted_at > $3
              AND ($4::timestamptz IS NULL OR w.deleted_at < $4)
            ORDER BY w.deleted_at DESC
            LIMIT $5
            "#,
            now,
            tenant_id,
            cutoff,
            cursor,
            fetch_limit
        )
        .fetch_all(pool)
        .await?;
        items.extend(workspaces);
    }

    // Sort by deleted_at DESC and limit
    items.sort_by(|a, b| b.deleted_at.cmp(&a.deleted_at));

    let has_more = items.len() > page_size as usize;
    let items: Vec<_> = items.into_iter().take(page_size as usize).collect();

    let next_cursor = if has_more {
        items.last().map(|item| item.deleted_at.to_rfc3339())
    } else {
        None
    };

    Ok(PaginatedTrashItems { items, next_cursor })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_trash_entity_type_from_str() {
        assert_eq!(TrashEntityType::from_str("task"), Some(TrashEntityType::Task));
        assert_eq!(TrashEntityType::from_str("tasks"), Some(TrashEntityType::Task));
        assert_eq!(TrashEntityType::from_str("BOARD"), Some(TrashEntityType::Board));
        assert_eq!(TrashEntityType::from_str("invalid"), None);
    }

    #[test]
    fn test_trash_entity_type_as_str() {
        assert_eq!(TrashEntityType::Task.as_str(), "task");
        assert_eq!(TrashEntityType::Board.as_str(), "board");
        assert_eq!(TrashEntityType::Workspace.as_str(), "workspace");
    }
}
