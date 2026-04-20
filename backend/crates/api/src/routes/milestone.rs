use axum::{
    extract::{Path, State},
    middleware::from_fn_with_state,
    routing::{delete, get, post, put},
    Json, Router,
};
use serde_json::json;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::{StrictJson, TenantContext};
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;

use super::common::{require_capability, verify_project_membership, Capability};
use taskbolt_db::models::Milestone;
use taskbolt_db::queries::get_task_project_id;
use taskbolt_db::queries::milestones::{
    assign_task_to_milestone, create_milestone, delete_milestone, get_milestone,
    get_milestone_board_id, list_milestones, unassign_task_from_milestone, update_milestone,
    CreateMilestoneInput, MilestoneQueryError, MilestoneWithProgress, UpdateMilestoneInput,
};

/// Request body for creating a milestone (Phase)
#[strict_dto_derive::strict_dto]
pub struct CreateMilestoneRequest {
    pub name: String,
    pub description: Option<String>,
    pub due_date: Option<chrono::DateTime<chrono::Utc>>,
    pub color: Option<String>,
    pub owner_id: Option<Uuid>,
    pub start_date: Option<chrono::DateTime<chrono::Utc>>,
    pub flag: Option<String>,
}

/// Request body for updating a milestone (Phase)
#[strict_dto_derive::strict_dto]
pub struct UpdateMilestoneRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub due_date: Option<chrono::DateTime<chrono::Utc>>,
    pub color: Option<String>,
    pub owner_id: Option<Uuid>,
    pub start_date: Option<chrono::DateTime<chrono::Utc>>,
    pub flag: Option<String>,
    pub status: Option<String>,
}

/// Request body for assigning a task to a milestone
#[strict_dto_derive::strict_dto]
pub struct AssignMilestoneRequest {
    pub milestone_id: Uuid,
}

/// Map MilestoneQueryError to AppError
fn map_milestone_error(e: MilestoneQueryError) -> AppError {
    match e {
        MilestoneQueryError::NotBoardMember => AppError::Forbidden("Not a project member".into()),
        MilestoneQueryError::NotFound => AppError::NotFound("Milestone not found".into()),
        MilestoneQueryError::Database(e) => AppError::SqlxError(e),
    }
}

/// GET /api/boards/{board_id}/milestones
/// List all milestones for a board
async fn list_milestones_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(board_id): Path<Uuid>,
) -> Result<Json<Vec<MilestoneWithProgress>>> {
    let milestones = list_milestones(&state.db, board_id, tenant.user_id)
        .await
        .map_err(map_milestone_error)?;

    Ok(Json(milestones))
}

/// POST /api/boards/{board_id}/milestones
/// Create a new milestone
async fn create_milestone_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(board_id): Path<Uuid>,
    StrictJson(body): StrictJson<CreateMilestoneRequest>,
) -> Result<Json<Milestone>> {
    if body.name.trim().is_empty() {
        return Err(AppError::BadRequest("Name cannot be empty".into()));
    }

    verify_project_membership(&state.db, board_id, tenant.user_id, &tenant.role).await?;
    require_capability(
        &state.db,
        tenant.user_id,
        &tenant.role,
        board_id,
        Capability::ManageProjectSettings,
    )
    .await?;

    let input = CreateMilestoneInput {
        name: body.name,
        description: body.description,
        due_date: body.due_date,
        color: body.color,
        owner_id: body.owner_id,
        start_date: body.start_date,
        flag: body.flag,
    };

    let milestone = create_milestone(&state.db, board_id, input, tenant.tenant_id, tenant.user_id)
        .await
        .map_err(map_milestone_error)?;

    Ok(Json(milestone))
}

/// GET /api/milestones/{id}
/// Get a single milestone with progress
async fn get_milestone_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(milestone_id): Path<Uuid>,
) -> Result<Json<MilestoneWithProgress>> {
    let milestone = get_milestone(&state.db, milestone_id, tenant.user_id)
        .await
        .map_err(map_milestone_error)?;

    Ok(Json(milestone))
}

/// PUT /api/milestones/{id}
/// Update a milestone
async fn update_milestone_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(milestone_id): Path<Uuid>,
    StrictJson(body): StrictJson<UpdateMilestoneRequest>,
) -> Result<Json<Milestone>> {
    // Verify board membership through milestone -> board
    let board_id = get_milestone_board_id(&state.db, milestone_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Milestone not found".into()))?;

    verify_project_membership(&state.db, board_id, tenant.user_id, &tenant.role).await?;
    require_capability(
        &state.db,
        tenant.user_id,
        &tenant.role,
        board_id,
        Capability::ManageProjectSettings,
    )
    .await?;

    let input = UpdateMilestoneInput {
        name: body.name,
        description: body.description,
        due_date: body.due_date,
        color: body.color,
        owner_id: body.owner_id,
        start_date: body.start_date,
        flag: body.flag,
        status: body.status,
    };

    let milestone = update_milestone(&state.db, milestone_id, input)
        .await
        .map_err(map_milestone_error)?;

    Ok(Json(milestone))
}

/// DELETE /api/milestones/{id}
/// Delete a milestone
async fn delete_milestone_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(milestone_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    // Verify board membership through milestone -> board
    let board_id = get_milestone_board_id(&state.db, milestone_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Milestone not found".into()))?;

    verify_project_membership(&state.db, board_id, tenant.user_id, &tenant.role).await?;
    require_capability(
        &state.db,
        tenant.user_id,
        &tenant.role,
        board_id,
        Capability::ManageProjectSettings,
    )
    .await?;

    delete_milestone(&state.db, milestone_id)
        .await
        .map_err(map_milestone_error)?;

    Ok(Json(json!({ "success": true })))
}

/// POST /api/tasks/{task_id}/milestone
/// Assign a task to a milestone
async fn assign_milestone_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
    StrictJson(body): StrictJson<AssignMilestoneRequest>,
) -> Result<Json<serde_json::Value>> {
    // Verify board membership through task -> board
    let board_id = get_task_project_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    verify_project_membership(&state.db, board_id, tenant.user_id, &tenant.role).await?;

    assign_task_to_milestone(&state.db, task_id, body.milestone_id)
        .await
        .map_err(map_milestone_error)?;

    Ok(Json(json!({ "success": true })))
}

/// DELETE /api/tasks/{task_id}/milestone
/// Unassign a task from its milestone
async fn unassign_milestone_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    // Verify board membership through task -> board
    let board_id = get_task_project_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    verify_project_membership(&state.db, board_id, tenant.user_id, &tenant.role).await?;

    unassign_task_from_milestone(&state.db, task_id)
        .await
        .map_err(map_milestone_error)?;

    Ok(Json(json!({ "success": true })))
}

/// Create the milestone router
pub fn milestone_router(state: AppState) -> Router<AppState> {
    Router::new()
        // Board-scoped milestone routes
        .route(
            "/projects/{board_id}/milestones",
            get(list_milestones_handler),
        )
        .route(
            "/projects/{board_id}/milestones",
            post(create_milestone_handler),
        )
        // Milestone-specific routes
        .route("/milestones/{id}", get(get_milestone_handler))
        .route("/milestones/{id}", put(update_milestone_handler))
        .route("/milestones/{id}", delete(delete_milestone_handler))
        // Task-milestone assignment routes
        .route("/tasks/{task_id}/milestone", post(assign_milestone_handler))
        .route(
            "/tasks/{task_id}/milestone",
            delete(unassign_milestone_handler),
        )
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
