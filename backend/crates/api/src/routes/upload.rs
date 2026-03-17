use axum::{extract::State, middleware::from_fn_with_state, routing::post, Json, Router};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::{AuthUserExtractor, ManagerOrAdmin};
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;
use taskflow_services::{MinioConfig, MinioService};

const MAX_AVATAR_SIZE: i64 = 5_242_880; // 5MB
const ALLOWED_IMAGE_MIMES: &[&str] = &["image/jpeg", "image/png", "image/webp"];

#[derive(Debug, Deserialize)]
pub struct UploadRequest {
    pub file_name: String,
    pub file_size: i64,
    pub mime_type: String,
}

#[derive(Debug, Serialize)]
pub struct UploadResponse {
    pub upload_url: String,
    pub storage_key: String,
}

#[derive(Debug, Deserialize)]
pub struct ConfirmRequest {
    pub storage_key: String,
}

fn validate_image_upload(body: &UploadRequest) -> Result<()> {
    if body.file_size <= 0 || body.file_size > MAX_AVATAR_SIZE {
        return Err(AppError::BadRequest(format!(
            "File size must be between 1 byte and {} bytes (5MB)",
            MAX_AVATAR_SIZE
        )));
    }
    if !ALLOWED_IMAGE_MIMES.contains(&body.mime_type.as_str()) {
        return Err(AppError::BadRequest(
            "Only image/jpeg, image/png, and image/webp are allowed".into(),
        ));
    }
    Ok(())
}

/// POST /api/uploads/avatar
async fn upload_avatar(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Json(body): Json<UploadRequest>,
) -> Result<Json<UploadResponse>> {
    validate_image_upload(&body)?;

    let ext = body.file_name.rsplit('.').next().unwrap_or("bin");
    let storage_key = format!("avatars/{}/{}.{}", auth.0.user_id, Uuid::new_v4(), ext);

    let minio = create_minio_service_async(&state).await;
    let upload_url = minio
        .presigned_put_url(&storage_key, &body.mime_type, 600)
        .await
        .map_err(|e| AppError::InternalError(format!("Failed to generate upload URL: {}", e)))?;

    Ok(Json(UploadResponse {
        upload_url,
        storage_key,
    }))
}

/// POST /api/uploads/avatar/confirm
async fn confirm_avatar(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Json(body): Json<ConfirmRequest>,
) -> Result<Json<serde_json::Value>> {
    // Ownership check: storage_key MUST start with avatars/{user_id}/
    let expected_prefix = format!("avatars/{}/", auth.0.user_id);
    if !body.storage_key.starts_with(&expected_prefix) {
        return Err(AppError::Forbidden(
            "Invalid storage key for this user".into(),
        ));
    }

    // Verify object exists in MinIO
    let minio = create_minio_service_async(&state).await;
    minio
        .stat_object(&body.storage_key)
        .await
        .map_err(|e| AppError::BadRequest(format!("Upload not found or incomplete: {}", e)))?;

    // Build the public URL for the avatar
    let avatar_url = format!(
        "{}/{}/{}",
        state.config.minio_public_url, state.config.minio_bucket, body.storage_key
    );

    // Update user's avatar_url
    sqlx::query("UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2")
        .bind(&avatar_url)
        .bind(auth.0.user_id)
        .execute(&state.db)
        .await?;

    Ok(Json(serde_json::json!({ "avatar_url": avatar_url })))
}

/// POST /api/uploads/workspace-logo
async fn upload_workspace_logo(
    State(state): State<AppState>,
    manager: ManagerOrAdmin,
    Json(body): Json<UploadLogoRequest>,
) -> Result<Json<UploadResponse>> {
    validate_image_upload(&body.upload)?;

    let ext = body.upload.file_name.rsplit('.').next().unwrap_or("bin");
    let storage_key = format!("logos/{}/{}.{}", body.workspace_id, Uuid::new_v4(), ext);

    // Verify workspace membership
    let is_member =
        taskflow_db::queries::is_workspace_member(&state.db, body.workspace_id, manager.0.user_id)
            .await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a workspace member".into()));
    }

    let minio = create_minio_service_async(&state).await;
    let upload_url = minio
        .presigned_put_url(&storage_key, &body.upload.mime_type, 600)
        .await
        .map_err(|e| AppError::InternalError(format!("Failed to generate upload URL: {}", e)))?;

    Ok(Json(UploadResponse {
        upload_url,
        storage_key,
    }))
}

/// POST /api/uploads/workspace-logo/confirm
async fn confirm_workspace_logo(
    State(state): State<AppState>,
    manager: ManagerOrAdmin,
    Json(body): Json<ConfirmLogoRequest>,
) -> Result<Json<serde_json::Value>> {
    // Ownership check: storage_key MUST start with logos/{workspace_id}/
    let expected_prefix = format!("logos/{}/", body.workspace_id);
    if !body.storage_key.starts_with(&expected_prefix) {
        return Err(AppError::Forbidden(
            "Invalid storage key for this workspace".into(),
        ));
    }

    // Verify workspace membership
    let is_member =
        taskflow_db::queries::is_workspace_member(&state.db, body.workspace_id, manager.0.user_id)
            .await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a workspace member".into()));
    }

    let minio = create_minio_service_async(&state).await;
    minio
        .stat_object(&body.storage_key)
        .await
        .map_err(|e| AppError::BadRequest(format!("Upload not found or incomplete: {}", e)))?;

    let logo_url = format!(
        "{}/{}/{}",
        state.config.minio_public_url, state.config.minio_bucket, body.storage_key
    );

    sqlx::query("UPDATE workspaces SET logo_url = $1, updated_at = NOW() WHERE id = $2")
        .bind(&logo_url)
        .bind(body.workspace_id)
        .execute(&state.db)
        .await?;

    Ok(Json(serde_json::json!({ "logo_url": logo_url })))
}

#[derive(Debug, Deserialize)]
pub struct UploadLogoRequest {
    pub workspace_id: Uuid,
    #[serde(flatten)]
    pub upload: UploadRequest,
}

#[derive(Debug, Deserialize)]
pub struct ConfirmLogoRequest {
    pub workspace_id: Uuid,
    pub storage_key: String,
}

async fn create_minio_service_async(state: &AppState) -> MinioService {
    let config = MinioConfig {
        endpoint: state.config.minio_endpoint.clone(),
        public_url: state.config.minio_public_url.clone(),
        access_key: state.config.minio_access_key.clone(),
        secret_key: state.config.minio_secret_key.clone(),
        bucket: state.config.minio_bucket.clone(),
    };
    MinioService::new(config).await
}

pub fn upload_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/uploads/avatar", post(upload_avatar))
        .route("/uploads/avatar/confirm", post(confirm_avatar))
        .route("/uploads/workspace-logo", post(upload_workspace_logo))
        .route(
            "/uploads/workspace-logo/confirm",
            post(confirm_workspace_logo),
        )
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
