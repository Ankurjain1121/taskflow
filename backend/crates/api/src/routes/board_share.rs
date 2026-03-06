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
use taskflow_db::queries::board_shares::{
    access_shared_board, create_board_share, delete_board_share, list_board_shares,
    toggle_board_share, BoardShareQueryError, CreateBoardShareInput,
};

/// Map BoardShareQueryError to AppError
fn map_share_error(e: BoardShareQueryError) -> AppError {
    match e {
        BoardShareQueryError::NotFound => AppError::NotFound("Board share not found".into()),
        BoardShareQueryError::NotBoardMember => AppError::Forbidden("Not a board member".into()),
        BoardShareQueryError::InvalidToken => AppError::NotFound("Invalid share token".into()),
        BoardShareQueryError::Expired => AppError::BadRequest("Share link has expired".into()),
        BoardShareQueryError::Inactive => AppError::BadRequest("Share link is inactive".into()),
        BoardShareQueryError::InvalidPassword => AppError::Unauthorized("Invalid password".into()),
        BoardShareQueryError::Database(e) => AppError::SqlxError(e),
    }
}

/// GET /api/boards/{board_id}/shares
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

/// POST /api/boards/{board_id}/shares
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

#[derive(Deserialize)]
struct AccessShareRequest {
    password: Option<String>,
}

/// GET /api/shared/{token} (public - no auth)
async fn access_shared_board_handler(
    State(state): State<AppState>,
    Path(token): Path<String>,
    axum::extract::Query(query): axum::extract::Query<AccessShareRequest>,
) -> Result<Json<taskflow_db::queries::board_shares::SharedBoardAccess>> {
    let access = access_shared_board(&state.db, &token, query.password.as_deref())
        .await
        .map_err(map_share_error)?;

    Ok(Json(access))
}

/// Create the board share router (auth-protected routes)
pub fn board_share_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/boards/{board_id}/shares", get(list_shares_handler))
        .route("/boards/{board_id}/shares", post(create_share_handler))
        .route("/shares/{id}", delete(delete_share_handler))
        .route("/shares/{id}", put(toggle_share_handler))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}

/// Create the public shared board router (no auth)
pub fn shared_board_public_router() -> Router<AppState> {
    Router::new().route("/shared/{token}", get(access_shared_board_handler))
}
