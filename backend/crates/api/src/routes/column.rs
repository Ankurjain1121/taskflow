//! Project Status REST endpoints (replaces board columns)
//!
//! Provides CRUD operations for project statuses.

use axum::{
    extract::{Path, State},
    middleware::from_fn_with_state,
    routing::{delete, get, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use taskflow_db::models::BoardMemberRole;
use taskflow_db::queries::{projects, project_statuses};
use taskflow_db::utils::generate_key_between;

use crate::errors::{AppError, Result};
use crate::extractors::AuthUserExtractor;
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::services::cache;
use crate::state::AppState;

use super::common::MessageResponse;

// ============================================================================
// Request/Response DTOs
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct CreateStatusRequest {
    pub name: String,
    pub color: Option<String>,
    #[serde(rename = "type")]
    pub status_type: Option<String>,
    pub insert_at: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct RenameStatusRequest {
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct ReorderStatusRequest {
    pub new_index: i32,
}

#[derive(Debug, Deserialize)]
pub struct UpdateStatusTypeRequest {
    #[serde(rename = "type")]
    pub status_type: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateStatusColorRequest {
    pub color: String,
}

#[derive(Debug, Deserialize)]
pub struct DeleteStatusRequest {
    pub replace_with_status_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTransitionsRequest {
    pub allowed: Option<Vec<Uuid>>,
}

#[derive(Debug, Serialize)]
pub struct StatusResponse {
    pub id: Uuid,
    pub name: String,
    pub project_id: Uuid,
    pub position: String,
    pub color: String,
    #[serde(rename = "type")]
    pub status_type: String,
    pub is_default: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub allowed_transitions: Option<Vec<Uuid>>,
}

#[derive(Debug, Serialize)]
pub struct TransitionsResponse {
    pub status_id: Uuid,
    pub allowed_transitions: Option<Vec<Uuid>>,
}

// ============================================================================
// Helper Functions
// ============================================================================

async fn require_editor_access(state: &AppState, project_id: Uuid, user_id: Uuid) -> Result<()> {
    let role = projects::get_board_member_role(&state.db, project_id, user_id).await?;
    match role {
        Some(BoardMemberRole::Owner | BoardMemberRole::Editor) => Ok(()),
        Some(BoardMemberRole::Viewer) => Err(AppError::Forbidden("Editor role required".into())),
        None => Err(AppError::NotFound(
            "Project not found or access denied".into(),
        )),
    }
}

async fn require_viewer_access(state: &AppState, project_id: Uuid, user_id: Uuid) -> Result<()> {
    let is_member = projects::is_board_member(&state.db, project_id, user_id).await?;
    if !is_member {
        return Err(AppError::NotFound(
            "Project not found or access denied".into(),
        ));
    }
    Ok(())
}

/// Look up the project_id for a given status_id
async fn get_project_id_for_status(state: &AppState, status_id: Uuid) -> Result<Uuid> {
    sqlx::query_scalar::<_, Uuid>("SELECT project_id FROM project_statuses WHERE id = $1")
        .bind(status_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Status not found".into()))
}

fn to_response(s: taskflow_db::models::ProjectStatus) -> StatusResponse {
    StatusResponse {
        id: s.id,
        name: s.name,
        project_id: s.project_id,
        position: s.position,
        color: s.color,
        status_type: s.status_type,
        is_default: s.is_default,
        created_at: s.created_at,
        allowed_transitions: s.allowed_transitions,
    }
}

// ============================================================================
// Route Handlers
// ============================================================================

/// GET /api/boards/:board_id/columns (now returns statuses)
async fn list_statuses(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Vec<StatusResponse>>> {
    require_viewer_access(&state, project_id, auth.0.user_id).await?;

    let statuses = project_statuses::list_project_statuses(&state.db, project_id).await?;

    let response: Vec<StatusResponse> = statuses.into_iter().map(to_response).collect();

    Ok(Json(response))
}

/// POST /api/boards/:board_id/columns (now creates a status)
async fn create_status(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(project_id): Path<Uuid>,
    Json(payload): Json<CreateStatusRequest>,
) -> Result<Json<StatusResponse>> {
    require_editor_access(&state, project_id, auth.0.user_id).await?;

    if payload.name.is_empty() {
        return Err(AppError::BadRequest("Status name is required".into()));
    }

    let existing = project_statuses::list_project_statuses(&state.db, project_id).await?;

    let position = if let Some(insert_at) = payload.insert_at {
        let insert_at = insert_at.max(0) as usize;
        if insert_at == 0 {
            let first_pos = existing.first().map(|s| s.position.as_str());
            generate_key_between(None, first_pos)
        } else if insert_at >= existing.len() {
            let last_pos = existing.last().map(|s| s.position.as_str());
            generate_key_between(last_pos, None)
        } else {
            let prev_pos = existing.get(insert_at - 1).map(|s| s.position.as_str());
            let next_pos = existing.get(insert_at).map(|s| s.position.as_str());
            generate_key_between(prev_pos, next_pos)
        }
    } else {
        let last_pos = existing.last().map(|s| s.position.as_str());
        generate_key_between(last_pos, None)
    };

    let color = payload.color.as_deref().unwrap_or("#6B7280");
    let status_type = payload.status_type.as_deref().unwrap_or("active");

    // Get tenant_id from project
    let project = projects::get_board_internal(&state.db, project_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Project not found".into()))?;

    let status = project_statuses::create_project_status(
        &state.db,
        project_id,
        &payload.name,
        color,
        status_type,
        &position,
        project.tenant_id,
    )
    .await?;

    // Invalidate project detail cache (statuses changed)
    cache::cache_del(&state.redis, &cache::project_detail_key(&project_id)).await;

    Ok(Json(to_response(status)))
}

/// PUT /api/columns/:id/name (now renames a status)
/// Fixed: auth check BEFORE write
async fn rename_status(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(id): Path<Uuid>,
    Json(payload): Json<RenameStatusRequest>,
) -> Result<Json<StatusResponse>> {
    if payload.name.is_empty() {
        return Err(AppError::BadRequest("Status name is required".into()));
    }

    // Auth BEFORE write
    let project_id = get_project_id_for_status(&state, id).await?;
    require_editor_access(&state, project_id, auth.0.user_id).await?;

    let status =
        project_statuses::update_project_status(&state.db, id, Some(&payload.name), None, None)
            .await
            .map_err(|_| AppError::NotFound("Status not found".into()))?;

    // Invalidate project detail cache (status renamed)
    cache::cache_del(&state.redis, &cache::project_detail_key(&project_id)).await;

    Ok(Json(to_response(status)))
}

/// PUT /api/columns/:id/position (now reorders a status)
async fn reorder_status(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(id): Path<Uuid>,
    Json(payload): Json<ReorderStatusRequest>,
) -> Result<Json<StatusResponse>> {
    let all_statuses_result = sqlx::query_as::<_, taskflow_db::models::ProjectStatus>(
        r#"
        SELECT id, project_id, name, color,
               type as "status_type",
               position, is_default, tenant_id, created_at,
               allowed_transitions
        FROM project_statuses
        WHERE project_id = (SELECT project_id FROM project_statuses WHERE id = $1)
        ORDER BY position ASC
        "#,
    )
    .bind(id)
    .fetch_all(&state.db)
    .await
    .map_err(|_| AppError::NotFound("Status not found".into()))?;

    let existing = all_statuses_result
        .iter()
        .find(|s| s.id == id)
        .ok_or_else(|| AppError::NotFound("Status not found".into()))?;

    require_editor_access(&state, existing.project_id, auth.0.user_id).await?;

    let new_index = payload.new_index.max(0) as usize;
    let current_index = all_statuses_result
        .iter()
        .position(|s| s.id == id)
        .ok_or_else(|| AppError::NotFound("Status not found".into()))?;

    if current_index == new_index {
        return Ok(Json(to_response(existing.clone())));
    }

    let new_position = if new_index == 0 {
        let first = all_statuses_result.first().filter(|s| s.id != id);
        generate_key_between(None, first.map(|s| s.position.as_str()))
    } else if new_index >= all_statuses_result.len() - 1 {
        let last = all_statuses_result.last().filter(|s| s.id != id);
        generate_key_between(last.map(|s| s.position.as_str()), None)
    } else {
        let filtered: Vec<_> = all_statuses_result.iter().filter(|s| s.id != id).collect();
        let target_index = new_index.min(filtered.len() - 1);
        if target_index == 0 {
            generate_key_between(None, filtered.first().map(|s| s.position.as_str()))
        } else {
            let prev = filtered.get(target_index - 1).map(|s| s.position.as_str());
            let next = filtered.get(target_index).map(|s| s.position.as_str());
            generate_key_between(prev, next)
        }
    };

    project_statuses::reorder_project_status(&state.db, id, &new_position).await?;

    // Fetch updated status
    let updated = project_statuses::update_project_status(&state.db, id, None, None, None)
        .await
        .map_err(|_| AppError::NotFound("Status not found".into()))?;

    // Invalidate project detail cache (status reordered)
    cache::cache_del(
        &state.redis,
        &cache::project_detail_key(&existing.project_id),
    )
    .await;

    Ok(Json(to_response(updated)))
}

/// PUT /api/columns/:id/status-mapping (now updates status type)
/// Fixed: auth check BEFORE write
async fn update_status_type(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateStatusTypeRequest>,
) -> Result<Json<StatusResponse>> {
    // Auth BEFORE write
    let project_id = get_project_id_for_status(&state, id).await?;
    require_editor_access(&state, project_id, auth.0.user_id).await?;

    let status = project_statuses::update_project_status(
        &state.db,
        id,
        None,
        None,
        Some(&payload.status_type),
    )
    .await
    .map_err(|_| AppError::NotFound("Status not found".into()))?;

    // Invalidate project detail cache (status type changed)
    cache::cache_del(&state.redis, &cache::project_detail_key(&project_id)).await;

    Ok(Json(to_response(status)))
}

/// PUT /api/columns/:id/color
/// Fixed: auth check BEFORE write
async fn update_color(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateStatusColorRequest>,
) -> Result<Json<StatusResponse>> {
    // Auth BEFORE write
    let project_id = get_project_id_for_status(&state, id).await?;
    require_editor_access(&state, project_id, auth.0.user_id).await?;

    let status =
        project_statuses::update_project_status(&state.db, id, None, Some(&payload.color), None)
            .await
            .map_err(|_| AppError::NotFound("Status not found".into()))?;

    // Invalidate project detail cache (status color changed)
    cache::cache_del(&state.redis, &cache::project_detail_key(&project_id)).await;

    Ok(Json(to_response(status)))
}

/// GET /api/columns/:id/transitions
async fn get_transitions(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(id): Path<Uuid>,
) -> Result<Json<TransitionsResponse>> {
    let project_id = get_project_id_for_status(&state, id).await?;
    require_viewer_access(&state, project_id, auth.0.user_id).await?;

    let transitions = project_statuses::get_transitions(&state.db, id).await?;

    Ok(Json(TransitionsResponse {
        status_id: id,
        allowed_transitions: transitions,
    }))
}

/// PUT /api/columns/:id/transitions
async fn update_transitions(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateTransitionsRequest>,
) -> Result<Json<StatusResponse>> {
    let project_id = get_project_id_for_status(&state, id).await?;
    require_editor_access(&state, project_id, auth.0.user_id).await?;

    let status = project_statuses::set_transitions(&state.db, id, payload.allowed.as_deref())
        .await
        .map_err(|_| AppError::NotFound("Status not found".into()))?;

    Ok(Json(to_response(status)))
}

/// DELETE /api/columns/:id
async fn delete_status(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(id): Path<Uuid>,
    Json(payload): Json<DeleteStatusRequest>,
) -> Result<Json<MessageResponse>> {
    // Look up status to find project_id
    let statuses = sqlx::query_as::<_, taskflow_db::models::ProjectStatus>(
        r#"
        SELECT id, project_id, name, color,
               type as "status_type",
               position, is_default, tenant_id, created_at,
               allowed_transitions
        FROM project_statuses
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Status not found".into()))?;

    require_editor_access(&state, statuses.project_id, auth.0.user_id).await?;

    if statuses.is_default {
        return Err(AppError::BadRequest(
            "Cannot delete the default status".into(),
        ));
    }

    project_statuses::delete_project_status(&state.db, id, payload.replace_with_status_id).await?;

    // Invalidate project detail and tasks cache (status deleted, tasks may have moved)
    cache::cache_del(
        &state.redis,
        &cache::project_detail_key(&statuses.project_id),
    )
    .await;
    cache::cache_del(
        &state.redis,
        &cache::project_tasks_key(&statuses.project_id),
    )
    .await;

    Ok(Json(MessageResponse {
        message: "Status deleted successfully".into(),
    }))
}

// ============================================================================
// Routers
// ============================================================================

/// Build the columns router for board-scoped routes
/// Routes: /api/boards/:board_id/columns (serves statuses)
pub fn board_columns_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/", get(list_statuses).post(create_status))
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}

/// Build the columns router for direct column/status routes
/// Routes: /api/columns/:id (serves statuses)
pub fn column_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/{id}", delete(delete_status))
        .route("/{id}/name", put(rename_status))
        .route("/{id}/position", put(reorder_status))
        .route("/{id}/status-mapping", put(update_status_type))
        .route("/{id}/color", put(update_color))
        .route(
            "/{id}/transitions",
            get(get_transitions).put(update_transitions),
        )
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
