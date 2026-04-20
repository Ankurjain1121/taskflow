//! Attachment routes for file upload/download operations
//!
//! Provides endpoints for generating presigned URLs, confirming uploads,
//! listing attachments, and deleting files.

use axum::{
    Json, Router,
    extract::{Path, State},
    middleware::from_fn_with_state,
    routing::{delete, get, post},
};
use serde::Serialize;
use serde_json::json;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::{StrictJson, TenantContext};
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;

use taskbolt_db::models::ActivityAction;
use taskbolt_db::queries::attachments::{
    AttachmentWithUploader, can_delete_attachment, create_attachment, delete_attachment,
    get_attachment_by_id, get_attachment_with_uploader, list_by_task, verify_task_board_membership,
};
use taskbolt_services::{MinioConfig, MinioService};

/// Maximum file size allowed (10MB)
const MAX_FILE_SIZE: i64 = 10_485_760;

/// Allowed MIME types for file uploads
const ALLOWED_MIME_TYPES: &[&str] = &[
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "text/csv",
    "text/markdown",
    "application/zip",
    "application/gzip",
    "application/x-tar",
];

/// Request body for generating an upload URL
#[strict_dto_derive::strict_dto]
#[derive(Debug)]
#[serde(rename_all = "camelCase")]
pub struct GetUploadUrlRequest {
    pub file_name: String,
    pub file_size: i64,
    pub mime_type: String,
}

/// Response for upload URL generation
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GetUploadUrlResponse {
    pub upload_url: String,
    pub storage_key: String,
}

/// Request body for confirming an upload
#[strict_dto_derive::strict_dto]
#[derive(Debug)]
#[serde(rename_all = "camelCase")]
pub struct ConfirmUploadRequest {
    pub storage_key: String,
    pub file_name: String,
    pub file_size: i64,
    pub mime_type: String,
}

/// Response for download URL
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadUrlResponse {
    pub download_url: String,
}

/// POST /api/tasks/:task_id/attachments/upload-url
/// Generate a presigned PUT URL for uploading a file
async fn get_upload_url(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
    StrictJson(body): StrictJson<GetUploadUrlRequest>,
) -> Result<Json<GetUploadUrlResponse>> {
    // Validate file size
    if body.file_size > MAX_FILE_SIZE {
        return Err(AppError::BadRequest(format!(
            "File size {} bytes exceeds maximum allowed size of {} bytes (10MB)",
            body.file_size, MAX_FILE_SIZE
        )));
    }

    if body.file_size <= 0 {
        return Err(AppError::BadRequest("File size must be positive".into()));
    }

    // Validate MIME type against allowlist
    if !ALLOWED_MIME_TYPES.contains(&body.mime_type.as_str()) {
        return Err(AppError::BadRequest(format!(
            "File type '{}' is not allowed. Supported types: images, PDFs, documents, spreadsheets, presentations, text, and archives.",
            body.mime_type
        )));
    }

    // Verify board membership
    let (is_member, board_id) =
        verify_task_board_membership(&state.db, task_id, tenant.user_id).await?;

    if board_id.is_none() {
        return Err(AppError::NotFound("Task not found".into()));
    }

    if !is_member {
        return Err(AppError::Forbidden("Not a project member".into()));
    }

    // Generate unique storage key
    let file_uuid = Uuid::new_v4();
    let storage_key = format!("attachments/{}/{}-{}", task_id, file_uuid, body.file_name);

    // Create MinIO service and generate presigned URL
    let minio = create_minio_service(&state).await;
    let upload_url = minio
        .presigned_put_url(&storage_key, &body.mime_type, 600) // 10 minutes
        .await
        .map_err(|e| AppError::InternalError(format!("Failed to generate upload URL: {}", e)))?;

    Ok(Json(GetUploadUrlResponse {
        upload_url,
        storage_key,
    }))
}

/// POST /api/tasks/:task_id/attachments/confirm
/// Confirm an upload and create the attachment record
async fn confirm_upload(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
    StrictJson(body): StrictJson<ConfirmUploadRequest>,
) -> Result<Json<AttachmentWithUploader>> {
    // Validate MIME type against allowlist
    if !ALLOWED_MIME_TYPES.contains(&body.mime_type.as_str()) {
        return Err(AppError::BadRequest(format!(
            "File type '{}' is not allowed.",
            body.mime_type
        )));
    }

    // Verify board membership
    let (is_member, board_id) =
        verify_task_board_membership(&state.db, task_id, tenant.user_id).await?;

    if board_id.is_none() {
        return Err(AppError::NotFound("Task not found".into()));
    }

    if !is_member {
        return Err(AppError::Forbidden("Not a project member".into()));
    }

    // Verify the object exists in MinIO
    let minio = create_minio_service(&state).await;
    minio.stat_object(&body.storage_key).await.map_err(|e| {
        AppError::BadRequest(format!(
            "Upload not found or incomplete. Please upload the file first. Error: {}",
            e
        ))
    })?;

    // Create the attachment record
    let attachment = create_attachment(
        &state.db,
        task_id,
        body.file_name.clone(),
        body.file_size,
        body.mime_type.clone(),
        body.storage_key.clone(),
        tenant.user_id,
    )
    .await
    .map_err(|e| AppError::InternalError(format!("Failed to create attachment: {}", e)))?;

    // Record activity log
    record_attachment_activity(
        &state.db,
        ActivityAction::Attached,
        task_id,
        tenant.user_id,
        tenant.tenant_id,
        &body.file_name,
    )
    .await;

    // Fetch the attachment with uploader info
    let attachment_with_uploader = get_attachment_with_uploader(&state.db, attachment.id)
        .await
        .map_err(|e| AppError::InternalError(format!("Failed to fetch attachment: {}", e)))?
        .ok_or_else(|| AppError::InternalError("Attachment not found after creation".into()))?;

    Ok(Json(attachment_with_uploader))
}

/// GET /api/tasks/:task_id/attachments
/// List all attachments for a task
async fn list_attachments(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
) -> Result<Json<Vec<AttachmentWithUploader>>> {
    // Verify board membership
    let (is_member, board_id) =
        verify_task_board_membership(&state.db, task_id, tenant.user_id).await?;

    if board_id.is_none() {
        return Err(AppError::NotFound("Task not found".into()));
    }

    if !is_member {
        return Err(AppError::Forbidden("Not a project member".into()));
    }

    let attachments = list_by_task(&state.db, task_id)
        .await
        .map_err(|e| AppError::InternalError(format!("Failed to list attachments: {}", e)))?;

    Ok(Json(attachments))
}

/// GET /api/attachments/:id/download-url
/// Generate a presigned GET URL for downloading a file
async fn get_download_url(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(attachment_id): Path<Uuid>,
) -> Result<Json<DownloadUrlResponse>> {
    // Get the attachment
    let attachment = get_attachment_by_id(&state.db, attachment_id)
        .await
        .map_err(|e| AppError::InternalError(format!("Failed to fetch attachment: {}", e)))?
        .ok_or_else(|| AppError::NotFound("Attachment not found".into()))?;

    // Verify board membership via task
    let (is_member, board_id) =
        verify_task_board_membership(&state.db, attachment.task_id, tenant.user_id).await?;

    if board_id.is_none() {
        return Err(AppError::NotFound("Task not found".into()));
    }

    if !is_member {
        return Err(AppError::Forbidden("Not a project member".into()));
    }

    // Generate presigned download URL (1 hour expiry)
    let minio = create_minio_service(&state).await;
    let download_url = minio
        .presigned_get_url(&attachment.storage_key, 3600)
        .await
        .map_err(|e| AppError::InternalError(format!("Failed to generate download URL: {}", e)))?;

    Ok(Json(DownloadUrlResponse { download_url }))
}

/// DELETE /api/attachments/:id
/// Delete an attachment from MinIO and the database
async fn delete_attachment_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(attachment_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    // Get the attachment first
    let attachment = get_attachment_by_id(&state.db, attachment_id)
        .await
        .map_err(|e| AppError::InternalError(format!("Failed to fetch attachment: {}", e)))?
        .ok_or_else(|| AppError::NotFound("Attachment not found".into()))?;

    // Verify board membership via task
    let (is_member, board_id) =
        verify_task_board_membership(&state.db, attachment.task_id, tenant.user_id).await?;

    if board_id.is_none() {
        return Err(AppError::NotFound("Task not found".into()));
    }

    if !is_member {
        return Err(AppError::Forbidden("Not a project member".into()));
    }

    // Check if user can delete (uploader, admin, or manager)
    let can_delete = can_delete_attachment(&state.db, attachment_id, tenant.user_id)
        .await
        .map_err(|e| AppError::InternalError(format!("Failed to check permissions: {}", e)))?;

    if !can_delete {
        return Err(AppError::Forbidden(
            "Only the uploader, admin, or manager can delete this attachment".into(),
        ));
    }

    // Delete from database first
    let deleted = delete_attachment(&state.db, attachment_id)
        .await
        .map_err(|e| match e {
            taskbolt_db::queries::attachments::AttachmentQueryError::NotFound => {
                AppError::NotFound("Attachment not found".into())
            }
            _ => AppError::InternalError(format!("Failed to delete attachment: {}", e)),
        })?;

    // Delete from MinIO (handle gracefully if object is missing)
    let minio = create_minio_service(&state).await;
    if let Err(e) = minio.delete_object(&deleted.storage_key).await {
        tracing::warn!(
            "Failed to delete object '{}' from MinIO (may already be deleted): {}",
            deleted.storage_key,
            e
        );
    }

    // Record activity log
    record_attachment_activity(
        &state.db,
        ActivityAction::Deleted,
        deleted.task_id,
        tenant.user_id,
        tenant.tenant_id,
        &deleted.file_name,
    )
    .await;

    Ok(Json(json!({ "success": true })))
}

/// Create MinIO service from app state config
async fn create_minio_service(state: &AppState) -> MinioService {
    let config = MinioConfig {
        endpoint: state.config.minio_endpoint.clone(),
        public_url: state.config.minio_public_url.clone(),
        access_key: state.config.minio_access_key.clone(),
        secret_key: state.config.minio_secret_key.clone(),
        bucket: state.config.minio_bucket.clone(),
    };
    MinioService::new(config).await
}

/// Record attachment activity to the activity log
async fn record_attachment_activity(
    pool: &sqlx::PgPool,
    action: ActivityAction,
    task_id: Uuid,
    user_id: Uuid,
    tenant_id: Uuid,
    file_name: &str,
) {
    let metadata = json!({
        "file_name": file_name,
    });

    if let Err(e) = sqlx::query!(
        r#"
        INSERT INTO activity_log (id, action, entity_type, entity_id, user_id, metadata, tenant_id)
        VALUES ($1, $2, 'attachment', $3, $4, $5, $6)
        "#,
        Uuid::new_v4(),
        action as ActivityAction,
        task_id,
        user_id,
        metadata,
        tenant_id
    )
    .execute(pool)
    .await
    {
        tracing::error!("Failed to record attachment activity: {}", e);
    }
}

/// Create the attachment router
pub fn attachment_router(state: AppState) -> Router<AppState> {
    Router::new()
        // Task-scoped attachment routes
        .route(
            "/tasks/{task_id}/attachments/upload-url",
            post(get_upload_url),
        )
        .route("/tasks/{task_id}/attachments/confirm", post(confirm_upload))
        .route("/tasks/{task_id}/attachments", get(list_attachments))
        // Attachment-specific routes
        .route("/attachments/{id}/download-url", get(get_download_url))
        .route("/attachments/{id}", delete(delete_attachment_handler))
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
