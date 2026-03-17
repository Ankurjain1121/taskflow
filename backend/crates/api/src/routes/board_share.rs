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
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;
use taskflow_db::queries::board_shares::{
    access_shared_board, create_board_share, delete_board_share, list_board_shares,
    toggle_board_share, BoardShareQueryError, CreateBoardShareInput,
};

/// Map BoardShareQueryError to AppError
fn map_share_error(e: BoardShareQueryError) -> AppError {
    match e {
        BoardShareQueryError::NotFound => AppError::NotFound("Project share not found".into()),
        BoardShareQueryError::NotBoardMember => AppError::Forbidden("Not a project member".into()),
        BoardShareQueryError::InvalidToken => AppError::NotFound("Invalid share token".into()),
        BoardShareQueryError::Expired => AppError::BadRequest("Share link has expired".into()),
        BoardShareQueryError::Inactive => AppError::BadRequest("Share link is inactive".into()),
        BoardShareQueryError::InvalidPassword => AppError::Unauthorized("Invalid password".into()),
        BoardShareQueryError::Database(e) => AppError::SqlxError(e),
    }
}

/// GET /api/projects/{board_id}/shares
async fn list_shares_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(board_id): Path<Uuid>,
) -> Result<Json<Vec<taskflow_db::models::BoardShare>>> {
    let shares = list_board_shares(&state.db, board_id, tenant.user_id)
        .await
        .map_err(map_share_error)?;

    Ok(Json(shares))
}

/// POST /api/projects/{board_id}/shares
async fn create_share_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(board_id): Path<Uuid>,
    Json(body): Json<CreateBoardShareInput>,
) -> Result<Json<taskflow_db::models::BoardShare>> {
    let share = create_board_share(&state.db, board_id, body, tenant.user_id, tenant.tenant_id)
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
    delete_board_share(&state.db, share_id, tenant.user_id)
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
) -> Result<Json<taskflow_db::models::BoardShare>> {
    let share = toggle_board_share(&state.db, share_id, body.is_active, tenant.user_id)
        .await
        .map_err(map_share_error)?;

    Ok(Json(share))
}

/// GET /api/shared/{token} (public - no auth, password-less access)
async fn access_shared_board_handler(
    State(state): State<AppState>,
    Path(token): Path<String>,
) -> Result<Json<taskflow_db::queries::board_shares::SharedBoardAccess>> {
    let access = access_shared_board(&state.db, &token, None)
        .await
        .map_err(map_share_error)?;

    Ok(Json(access))
}

#[derive(Deserialize)]
struct AccessShareBody {
    password: Option<String>,
}

/// POST /api/shared/{token}/access (public - no auth, password in body)
async fn access_shared_board_post_handler(
    State(state): State<AppState>,
    Path(token): Path<String>,
    Json(body): Json<AccessShareBody>,
) -> Result<Json<taskflow_db::queries::board_shares::SharedBoardAccess>> {
    let access = access_shared_board(&state.db, &token, body.password.as_deref())
        .await
        .map_err(map_share_error)?;

    Ok(Json(access))
}

/// Create the project share router (auth-protected routes)
pub fn project_share_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/projects/{board_id}/shares", get(list_shares_handler))
        .route("/projects/{board_id}/shares", post(create_share_handler))
        .route("/shares/{id}", delete(delete_share_handler))
        .route("/shares/{id}", put(toggle_share_handler))
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}

/// Create the public shared project router (no auth)
pub fn shared_project_public_router() -> Router<AppState> {
    Router::new()
        .route("/shared/{token}", get(access_shared_board_handler))
        .route(
            "/shared/{token}/access",
            post(access_shared_board_post_handler),
        )
}
