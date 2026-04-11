//! Project-level budget summary endpoint (Phase 2.6).
//!
//! Exposes a single read-only GET that aggregates budget fields and logged
//! hours for every task in a project. Write operations happen via the normal
//! task create/update endpoints.

use axum::{
    Json, Router,
    extract::{Path, State},
    middleware::from_fn_with_state,
    routing::get,
};
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;

use taskbolt_db::queries::{BudgetSummaryError, ProjectBudgetSummary, get_project_budget_summary};

use super::common::verify_project_membership;

/// GET /api/projects/{project_id}/budget-summary
async fn get_budget_summary_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(project_id): Path<Uuid>,
) -> Result<Json<ProjectBudgetSummary>> {
    // Extra check via the shared helper (honours SuperAdmin/workspace admin
    // bypass), matching the rest of the route layer. The DB query also does
    // a direct `project_members` check as a defence-in-depth belt-and-braces.
    verify_project_membership(&state.db, project_id, tenant.user_id, &tenant.role).await?;

    let summary = get_project_budget_summary(&state.db, project_id, tenant.user_id)
        .await
        .map_err(|e| match e {
            BudgetSummaryError::NotProjectMember => {
                AppError::Forbidden("Not a project member".into())
            }
            BudgetSummaryError::Database(e) => AppError::SqlxError(e),
        })?;

    Ok(Json(summary))
}

pub fn project_budget_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route(
            "/projects/{project_id}/budget-summary",
            get(get_budget_summary_handler),
        )
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
