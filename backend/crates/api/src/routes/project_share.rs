use axum::{
    extract::{Path, State},
    middleware::from_fn_with_state,
    routing::{delete, get, post, put},
    Json, Router,
};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::auth_middleware;
use crate::state::AppState;
use taskflow_db::queries::project_shares::{
    access_shared_board, create_project_share, delete_project_share, list_project_shares,
    toggle_project_share, CreateProjectShareInput, ProjectShareQueryError,
};

/// Map ProjectShareQueryError to AppError
fn map_share_error(e: ProjectShareQueryError) -> AppError {
    match e {
        ProjectShareQueryError::NotFound => AppError::NotFound("Project share not found".into()),
        ProjectShareQueryError::NotProjectMember => {
            AppError::Forbidden("Not a project member".into())
        }
        ProjectShareQueryError::InvalidToken => AppError::NotFound("Invalid share token".into()),
        ProjectShareQueryError::Expired => AppError::BadRequest("Share link has expired".into()),
        ProjectShareQueryError::Inactive => AppError::BadRequest("Share link is inactive".into()),
        ProjectShareQueryError::InvalidPassword => {
            AppError::Unauthorized("Invalid password".into())
        }
        ProjectShareQueryError::Database(e) => AppError::SqlxError(e),
    }
}

/// GET /api/projects/{project_id}/shares
async fn list_shares_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Vec<taskflow_db::models::ProjectShare>>> {
    let shares = list_project_shares(&state.db, project_id, tenant.user_id)
        .await
        .map_err(map_share_error)?;

    Ok(Json(shares))
}

/// POST /api/projects/{project_id}/shares
async fn create_share_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(project_id): Path<Uuid>,
    Json(body): Json<CreateProjectShareInput>,
) -> Result<Json<taskflow_db::models::ProjectShare>> {
    let share = create_project_share(
        &state.db,
        project_id,
        body,
        tenant.user_id,
        tenant.tenant_id,
    )
    .await
    .map_err(map_share_error)?;

    Ok(Json(share))
}

/// DELETE /api/shares/{id}
async fn delete_share_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(share_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    delete_project_share(&state.db, share_id, tenant.user_id)
        .await
        .map_err(map_share_error)?;

    Ok(Json(json!({ "success": true })))
}

#[derive(Deserialize)]
struct ToggleShareRequest {
    is_active: bool,
}

/// PUT /api/shares/{id}
async fn toggle_share_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(share_id): Path<Uuid>,
    Json(body): Json<ToggleShareRequest>,
) -> Result<Json<taskflow_db::models::ProjectShare>> {
    let share = toggle_project_share(&state.db, share_id, body.is_active, tenant.user_id)
        .await
        .map_err(map_share_error)?;

    Ok(Json(share))
}

#[derive(Deserialize)]
struct AccessShareRequest {
    password: Option<String>,
}

/// GET /api/shared/{token} (public - no auth)
async fn access_shared_board_handler(
    State(state): State<AppState>,
    Path(token): Path<String>,
    axum::extract::Query(query): axum::extract::Query<AccessShareRequest>,
) -> Result<Json<taskflow_db::queries::project_shares::SharedProjectAccess>> {
    let access = access_shared_board(&state.db, &token, query.password.as_deref())
        .await
        .map_err(map_share_error)?;

    Ok(Json(access))
}

/// Create the project share router (auth-protected routes)
pub fn project_share_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/projects/{project_id}/shares", get(list_shares_handler))
        .route("/projects/{project_id}/shares", post(create_share_handler))
        .route("/shares/{id}", delete(delete_share_handler))
        .route("/shares/{id}", put(toggle_share_handler))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}

/// Create the public shared project router (no auth)
pub fn shared_project_public_router() -> Router<AppState> {
    Router::new().route("/shared/{token}", get(access_shared_board_handler))
}
