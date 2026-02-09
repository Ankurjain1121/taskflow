use axum::{
    extract::{Path, Query, State},
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
use taskflow_db::queries::reports::{get_board_report, BoardReport, ReportQueryError};

#[derive(Deserialize)]
pub struct ReportQuery {
    pub days: Option<i32>,
}

/// GET /api/boards/{board_id}/reports?days=30
async fn get_board_report_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(board_id): Path<Uuid>,
    Query(query): Query<ReportQuery>,
) -> Result<Json<BoardReport>> {
    let days_back = query.days.unwrap_or(30).min(365).max(1);

    let report = get_board_report(&state.db, board_id, tenant.user_id, days_back)
        .await
        .map_err(|e| match e {
            ReportQueryError::NotBoardMember => {
                AppError::Forbidden("Not a board member".into())
            }
            ReportQueryError::Database(e) => AppError::SqlxError(e),
        })?;

    Ok(Json(report))
}

pub fn reports_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/boards/{board_id}/reports", get(get_board_report_handler))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
