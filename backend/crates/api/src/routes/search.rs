use axum::{
    extract::{Query, State},
    middleware::from_fn_with_state,
    routing::get,
    Json, Router,
};
use serde::Deserialize;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::auth_middleware;
use crate::state::AppState;
use taskflow_db::queries::search;

#[derive(Deserialize)]
pub struct SearchQuery {
    pub q: String,
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    20
}

async fn search_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Query(params): Query<SearchQuery>,
) -> Result<Json<search::SearchResults>> {
    if params.q.trim().is_empty() {
        return Err(AppError::BadRequest("Search query is required".into()));
    }

    let limit = params.limit.min(50).max(1);
    let results = search::search_all(&state.db, tenant.tenant_id, &params.q, limit)
        .await
        .map_err(|e| AppError::SqlxError(e))?;

    Ok(Json(results))
}

pub fn search_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/search", get(search_handler))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
