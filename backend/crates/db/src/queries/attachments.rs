//! Database queries for attachment operations
//!
//! Provides CRUD operations for file attachments on tasks.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::Attachment;

/// Error type for attachment query operations
#[derive(Debug, thiserror::Error)]
pub enum AttachmentQueryError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Attachment not found")]
    NotFound,
    #[error("User is not a member of this board")]
    NotBoardMember,
    #[error("Permission denied")]
    PermissionDenied,
}

/// Attachment with uploader information for listing
#[derive(Debug, Serialize, Deserialize)]
pub struct AttachmentWithUploader {
    pub id: Uuid,
    pub file_name: String,
    pub file_size: i64,
    pub mime_type: String,
    pub storage_key: String,
    pub task_id: Uuid,
    pub uploaded_by_id: Uuid,
    pub created_at: DateTime<Utc>,
    // Uploader info
    pub uploader_name: String,
    pub uploader_avatar_url: Option<String>,
}

/// Result of deleting an attachment (returns storage_key for MinIO cleanup)
#[derive(Debug)]
pub struct DeletedAttachment {
    pub id: Uuid,
    pub storage_key: String,
    pub task_id: Uuid,
    pub file_name: String,
}

/// Create a new attachment record
pub async fn create_attachment(
    pool: &PgPool,
    task_id: Uuid,
    file_name: String,
    file_size: i64,
    mime_type: String,
    storage_key: String,
    uploaded_by_id: Uuid,
) -> Result<Attachment, AttachmentQueryError> {
    let id = Uuid::new_v4();

    let attachment = sqlx::query_as!(
        Attachment,
        r#"
        INSERT INTO attachments (id, file_name, file_size, mime_type, storage_key, task_id, uploaded_by_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, file_name, file_size, mime_type, storage_key, task_id, uploaded_by_id, created_at
        "#,
        id,
        file_name,
        file_size,
        mime_type,
        storage_key,
        task_id,
        uploaded_by_id
    )
    .fetch_one(pool)
    .await?;

    Ok(attachment)
}

/// List all attachments for a task with uploader information
pub async fn list_by_task(
    pool: &PgPool,
    task_id: Uuid,
) -> Result<Vec<AttachmentWithUploader>, AttachmentQueryError> {
    let attachments = sqlx::query_as!(
        AttachmentWithUploader,
        r#"
        SELECT
            a.id,
            a.file_name,
            a.file_size,
            a.mime_type,
            a.storage_key,
            a.task_id,
            a.uploaded_by_id,
            a.created_at,
            u.name as uploader_name,
            u.avatar_url as uploader_avatar_url
        FROM attachments a
        JOIN users u ON u.id = a.uploaded_by_id
        WHERE a.task_id = $1 AND a.deleted_at IS NULL
        ORDER BY a.created_at DESC
        "#,
        task_id
    )
    .fetch_all(pool)
    .await?;

    Ok(attachments)
}

/// Get an attachment by ID
pub async fn get_attachment_by_id(
    pool: &PgPool,
    id: Uuid,
) -> Result<Option<Attachment>, AttachmentQueryError> {
    let attachment = sqlx::query_as!(
        Attachment,
        r#"
        SELECT id, file_name, file_size, mime_type, storage_key, task_id, uploaded_by_id, created_at
        FROM attachments
        WHERE id = $1 AND deleted_at IS NULL
        "#,
        id
    )
    .fetch_optional(pool)
    .await?;

    Ok(attachment)
}

/// Get an attachment with uploader info by ID
pub async fn get_attachment_with_uploader(
    pool: &PgPool,
    id: Uuid,
) -> Result<Option<AttachmentWithUploader>, AttachmentQueryError> {
    let attachment = sqlx::query_as!(
        AttachmentWithUploader,
        r#"
        SELECT
            a.id,
            a.file_name,
            a.file_size,
            a.mime_type,
            a.storage_key,
            a.task_id,
            a.uploaded_by_id,
            a.created_at,
            u.name as uploader_name,
            u.avatar_url as uploader_avatar_url
        FROM attachments a
        JOIN users u ON u.id = a.uploaded_by_id
        WHERE a.id = $1 AND a.deleted_at IS NULL
        "#,
        id
    )
    .fetch_optional(pool)
    .await?;

    Ok(attachment)
}

/// Soft delete an attachment and return the storage key for MinIO cleanup
pub async fn delete_attachment(
    pool: &PgPool,
    id: Uuid,
) -> Result<DeletedAttachment, AttachmentQueryError> {
    let deleted = sqlx::query_as!(
        DeletedAttachment,
        r#"
        UPDATE attachments
        SET deleted_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id, storage_key, task_id, file_name
        "#,
        id
    )
    .fetch_optional(pool)
    .await?
    .ok_or(AttachmentQueryError::NotFound)?;

    Ok(deleted)
}

/// Get the board_id for a task (for authorization checks)
pub async fn get_task_board_id(pool: &PgPool, task_id: Uuid) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar!(
        r#"
        SELECT board_id FROM tasks WHERE id = $1 AND deleted_at IS NULL
        "#,
        task_id
    )
    .fetch_optional(pool)
    .await
}

/// Verify user is a member of the board that contains the task
pub async fn verify_task_board_membership(
    pool: &PgPool,
    task_id: Uuid,
    user_id: Uuid,
) -> Result<(bool, Option<Uuid>), sqlx::Error> {
    let result = sqlx::query!(
        r#"
        SELECT
            t.board_id,
            EXISTS(
                SELECT 1 FROM board_members bm
                WHERE bm.board_id = t.board_id AND bm.user_id = $2
            ) as "is_member!"
        FROM tasks t
        WHERE t.id = $1 AND t.deleted_at IS NULL
        "#,
        task_id,
        user_id
    )
    .fetch_optional(pool)
    .await?;

    match result {
        Some(r) => Ok((r.is_member, Some(r.board_id))),
        None => Ok((false, None)),
    }
}

/// Check if user can delete an attachment (is uploader, admin, or manager)
pub async fn can_delete_attachment(
    pool: &PgPool,
    attachment_id: Uuid,
    user_id: Uuid,
) -> Result<bool, sqlx::Error> {
    // Check if user is the uploader
    let is_uploader = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM attachments
            WHERE id = $1 AND uploaded_by_id = $2 AND deleted_at IS NULL
        ) as "exists!"
        "#,
        attachment_id,
        user_id
    )
    .fetch_one(pool)
    .await?;

    if is_uploader {
        return Ok(true);
    }

    // Check if user is admin or manager
    let is_admin_or_manager = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM users
            WHERE id = $1 AND role IN ('admin', 'manager')
        ) as "exists!"
        "#,
        user_id
    )
    .fetch_one(pool)
    .await?;

    Ok(is_admin_or_manager)
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_attachment_query_error_display() {
        use super::AttachmentQueryError;

        let err = AttachmentQueryError::NotFound;
        assert_eq!(err.to_string(), "Attachment not found");

        let err = AttachmentQueryError::NotBoardMember;
        assert_eq!(err.to_string(), "User is not a member of this board");
    }
}
