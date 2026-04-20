use axum::{
    Json, Router,
    extract::{Path, Query, State},
    middleware::from_fn_with_state,
    routing::{get, post},
};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::{StrictJson, TenantContext};
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;

use super::common::{Capability, require_capability, verify_project_membership};
use taskbolt_db::models::{
    Issue, IssueClassification, IssueReproducibility, IssueResolutionType, IssueSeverity,
    IssueStatus,
};
use taskbolt_db::queries::issues::{
    CreateIssueInput, IssueFilters, IssueQueryError, IssueSummary, IssueWithDetails,
    ResolveIssueInput, UpdateIssueInput, create_issue, get_issue, get_issue_project_id,
    get_issue_summary, list_issues, reopen_issue, resolve_issue, soft_delete_issue, update_issue,
};

// ============================================
// Error mapping
// ============================================

fn map_issue_error(e: IssueQueryError) -> AppError {
    match e {
        IssueQueryError::NotProjectMember => AppError::Forbidden("Not a project member".into()),
        IssueQueryError::NotFound => AppError::NotFound("Issue not found".into()),
        IssueQueryError::Invalid(msg) => AppError::BadRequest(msg),
        IssueQueryError::Database(e) => AppError::SqlxError(e),
    }
}

// ============================================
// Request bodies
// ============================================

#[strict_dto_derive::strict_dto]
pub struct CreateIssueRequest {
    pub title: String,
    pub description: Option<String>,
    pub assignee_id: Option<Uuid>,
    pub severity: Option<IssueSeverity>,
    pub classification: Option<IssueClassification>,
    pub reproducibility: Option<IssueReproducibility>,
    pub module: Option<String>,
    pub affected_milestone_id: Option<Uuid>,
    pub release_milestone_id: Option<Uuid>,
    pub due_date: Option<DateTime<Utc>>,
    pub flag: Option<String>,
}

#[derive(Deserialize, Default)]
#[serde(default)]
pub struct UpdateIssueRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    #[serde(default, with = "crate::routes::helpers::double_option")]
    pub assignee_id: Option<Option<Uuid>>,
    pub status: Option<IssueStatus>,
    pub severity: Option<IssueSeverity>,
    pub classification: Option<IssueClassification>,
    #[serde(default, with = "crate::routes::helpers::double_option")]
    pub reproducibility: Option<Option<IssueReproducibility>>,
    #[serde(default, with = "crate::routes::helpers::double_option")]
    pub module: Option<Option<String>>,
    #[serde(default, with = "crate::routes::helpers::double_option")]
    pub affected_milestone_id: Option<Option<Uuid>>,
    #[serde(default, with = "crate::routes::helpers::double_option")]
    pub release_milestone_id: Option<Option<Uuid>>,
    #[serde(default, with = "crate::routes::helpers::double_option")]
    pub due_date: Option<Option<DateTime<Utc>>>,
    pub flag: Option<String>,
}

#[strict_dto_derive::strict_dto]
pub struct ResolveIssueRequest {
    pub resolution_type: IssueResolutionType,
    pub resolution_notes: Option<String>,
}

#[derive(Deserialize, Default)]
#[serde(default)]
pub struct ListIssuesQuery {
    pub status: Option<IssueStatus>,
    pub severity: Option<IssueSeverity>,
    pub assignee_id: Option<Uuid>,
    pub reporter_id: Option<Uuid>,
    pub classification: Option<IssueClassification>,
    pub search: Option<String>,
}

// ============================================
// Handlers
// ============================================

/// GET /api/projects/{project_id}/issues
async fn list_issues_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(project_id): Path<Uuid>,
    Query(q): Query<ListIssuesQuery>,
) -> Result<Json<Vec<IssueWithDetails>>> {
    let filters = IssueFilters {
        status: q.status,
        severity: q.severity,
        assignee_id: q.assignee_id,
        reporter_id: q.reporter_id,
        classification: q.classification,
        search: q.search,
    };

    let issues = list_issues(&state.db, project_id, tenant.user_id, filters)
        .await
        .map_err(map_issue_error)?;

    Ok(Json(issues))
}

/// GET /api/projects/{project_id}/issues/summary
async fn issues_summary_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(project_id): Path<Uuid>,
) -> Result<Json<IssueSummary>> {
    let summary = get_issue_summary(&state.db, project_id, tenant.user_id)
        .await
        .map_err(map_issue_error)?;
    Ok(Json(summary))
}

/// POST /api/projects/{project_id}/issues
async fn create_issue_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(project_id): Path<Uuid>,
    StrictJson(body): StrictJson<CreateIssueRequest>,
) -> Result<Json<Issue>> {
    if body.title.trim().is_empty() {
        return Err(AppError::BadRequest("title cannot be empty".into()));
    }

    verify_project_membership(&state.db, project_id, tenant.user_id, &tenant.role).await?;

    let input = CreateIssueInput {
        title: body.title,
        description: body.description,
        assignee_id: body.assignee_id,
        severity: body.severity,
        classification: body.classification,
        reproducibility: body.reproducibility,
        module: body.module,
        affected_milestone_id: body.affected_milestone_id,
        release_milestone_id: body.release_milestone_id,
        due_date: body.due_date,
        flag: body.flag,
    };

    let issue = create_issue(
        &state.db,
        project_id,
        input,
        tenant.tenant_id,
        tenant.user_id,
    )
    .await
    .map_err(map_issue_error)?;

    Ok(Json(issue))
}

/// GET /api/issues/{id}
async fn get_issue_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(issue_id): Path<Uuid>,
) -> Result<Json<IssueWithDetails>> {
    let issue = get_issue(&state.db, issue_id, tenant.user_id)
        .await
        .map_err(map_issue_error)?;
    Ok(Json(issue))
}

/// PUT /api/issues/{id}
async fn update_issue_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(issue_id): Path<Uuid>,
    Json(body): Json<UpdateIssueRequest>,
) -> Result<Json<Issue>> {
    let project_id = get_issue_project_id(&state.db, issue_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Issue not found".into()))?;

    verify_project_membership(&state.db, project_id, tenant.user_id, &tenant.role).await?;

    let input = UpdateIssueInput {
        title: body.title,
        description: body.description,
        assignee_id: body.assignee_id,
        status: body.status,
        severity: body.severity,
        classification: body.classification,
        reproducibility: body.reproducibility,
        module: body.module,
        affected_milestone_id: body.affected_milestone_id,
        release_milestone_id: body.release_milestone_id,
        due_date: body.due_date,
        flag: body.flag,
    };

    let issue = update_issue(&state.db, issue_id, input)
        .await
        .map_err(map_issue_error)?;

    Ok(Json(issue))
}

/// POST /api/issues/{id}/resolve
async fn resolve_issue_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(issue_id): Path<Uuid>,
    StrictJson(body): StrictJson<ResolveIssueRequest>,
) -> Result<Json<Issue>> {
    let project_id = get_issue_project_id(&state.db, issue_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Issue not found".into()))?;

    verify_project_membership(&state.db, project_id, tenant.user_id, &tenant.role).await?;

    let input = ResolveIssueInput {
        resolution_type: body.resolution_type,
        resolution_notes: body.resolution_notes,
    };

    let issue = resolve_issue(&state.db, issue_id, tenant.user_id, input)
        .await
        .map_err(map_issue_error)?;

    Ok(Json(issue))
}

/// POST /api/issues/{id}/reopen
async fn reopen_issue_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(issue_id): Path<Uuid>,
) -> Result<Json<Issue>> {
    let project_id = get_issue_project_id(&state.db, issue_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Issue not found".into()))?;

    verify_project_membership(&state.db, project_id, tenant.user_id, &tenant.role).await?;

    let issue = reopen_issue(&state.db, issue_id)
        .await
        .map_err(map_issue_error)?;
    Ok(Json(issue))
}

/// DELETE /api/issues/{id}
async fn delete_issue_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(issue_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    let project_id = get_issue_project_id(&state.db, issue_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Issue not found".into()))?;

    verify_project_membership(&state.db, project_id, tenant.user_id, &tenant.role).await?;
    require_capability(
        &state.db,
        tenant.user_id,
        &tenant.role,
        project_id,
        Capability::ManageProjectSettings,
    )
    .await?;

    soft_delete_issue(&state.db, issue_id)
        .await
        .map_err(map_issue_error)?;

    Ok(Json(json!({ "success": true })))
}

// ============================================
// Router
// ============================================

pub fn issue_router(state: AppState) -> Router<AppState> {
    Router::new()
        // Project-scoped list + create
        .route(
            "/projects/{project_id}/issues",
            get(list_issues_handler).post(create_issue_handler),
        )
        .route(
            "/projects/{project_id}/issues/summary",
            get(issues_summary_handler),
        )
        // Issue-specific routes
        .route(
            "/issues/{id}",
            get(get_issue_handler)
                .put(update_issue_handler)
                .delete(delete_issue_handler),
        )
        .route("/issues/{id}/resolve", post(resolve_issue_handler))
        .route("/issues/{id}/reopen", post(reopen_issue_handler))
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
