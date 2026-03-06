use axum::{
    extract::{Query, State},
    middleware::from_fn_with_state,
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use uuid::Uuid;

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
    pub assignee: Option<String>,
    pub label: Option<String>,
    pub status: Option<String>,
    pub project_id: Option<String>,
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

    let project_id = params
        .project_id
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(|s| {
            Uuid::parse_str(s).map_err(|_| AppError::BadRequest("Invalid project_id UUID".into()))
        })
        .transpose()?;

    let filters = search::SearchFilters {
        assignee: params.assignee.filter(|s| !s.is_empty()),
        label: params.label.filter(|s| !s.is_empty()),
        status: params.status.filter(|s| !s.is_empty()),
        project_id,
    };

    let limit = params.limit.clamp(1, 50);
    let results = search::search_all(
        &state.db,
        tenant.tenant_id,
        tenant.user_id,
        &params.q,
        limit,
        &filters,
    )
    .await
    .map_err(AppError::SqlxError)?;

    Ok(Json(results))
}

pub fn search_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/search", get(search_handler))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
