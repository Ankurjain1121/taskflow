use axum::{
    extract::{Query, State},
    middleware::from_fn_with_state,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::auth_middleware;
use crate::state::AppState;
use taskflow_db::queries::recent_items;

#[derive(Deserialize)]
pub struct RecentItemsQuery {
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    20
}

#[derive(Deserialize)]
pub struct UpsertRecentItemRequest {
    pub entity_type: String,
    pub entity_id: Uuid,
}

async fn list_recent_items_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Query(params): Query<RecentItemsQuery>,
) -> Result<Json<Vec<recent_items::RecentItem>>> {
    let limit = params.limit.clamp(1, 50);
    let items = recent_items::list_recent_items(&state.db, tenant.user_id, tenant.tenant_id, limit)
        .await
        .map_err(AppError::SqlxError)?;

    Ok(Json(items))
}

async fn upsert_recent_item_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Json(body): Json<UpsertRecentItemRequest>,
) -> Result<Json<serde_json::Value>> {
    // Validate entity_type
    if body.entity_type != "task" && body.entity_type != "project" {
        return Err(AppError::BadRequest(
            "entity_type must be 'task' or 'board'".into(),
        ));
    }

    recent_items::upsert_recent_item(
        &state.db,
        tenant.user_id,
        tenant.tenant_id,
        &body.entity_type,
        body.entity_id,
    )
    .await
    .map_err(AppError::SqlxError)?;

    Ok(Json(serde_json::json!({ "success": true })))
}

pub fn recent_items_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/recent-items", get(list_recent_items_handler))
        .route("/recent-items", post(upsert_recent_item_handler))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
