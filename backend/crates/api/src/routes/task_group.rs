use axum::{
    extract::{Path, State},
    middleware::from_fn_with_state,
    routing::{delete, get, post, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::auth_middleware;
use crate::state::AppState;
use taskflow_db::models::{CreateTaskGroupRequest, TaskGroup, TaskGroupWithStats, UpdateTaskGroupRequest};
use taskflow_db::queries::{
    create_task_group, get_task_group_by_id, list_task_groups_by_board,
    list_task_groups_with_stats, soft_delete_task_group, toggle_task_group_collapse,
    update_task_group_color, update_task_group_name, update_task_group_position,
};

pub fn task_group_routes(state: AppState) -> Router {
    Router::new()
        .route("/boards/:board_id/groups", get(list_groups))
        .route("/boards/:board_id/groups/stats", get(list_groups_with_stats))
        .route("/boards/:board_id/groups", post(create_group))
        .route("/groups/:id", get(get_group))
        .route("/groups/:id", put(update_group))
        .route("/groups/:id/collapse", put(toggle_collapse))
        .route("/groups/:id", delete(delete_group))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
        .with_state(state)
}

/// List task groups for a board
async fn list_groups(
    State(state): State<AppState>,
    _tenant: TenantContext,
    Path(board_id): Path<Uuid>,
) -> Result<Json<Vec<TaskGroup>>> {
    let groups = list_task_groups_by_board(&state.db, board_id)
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    Ok(Json(groups))
}

/// List task groups with statistics
async fn list_groups_with_stats(
    State(state): State<AppState>,
    _tenant: TenantContext,
    Path(board_id): Path<Uuid>,
) -> Result<Json<Vec<TaskGroupWithStats>>> {
    let groups = list_task_groups_with_stats(&state.db, board_id)
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    Ok(Json(groups))
}

/// Get a specific task group
async fn get_group(
    State(state): State<AppState>,
    _tenant: TenantContext,
    Path(id): Path<Uuid>,
) -> Result<Json<TaskGroup>> {
    let group = get_task_group_by_id(&state.db, id)
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?
        .ok_or(AppError::NotFound("Task group not found".to_string()))?;

    Ok(Json(group))
}

/// Create a new task group
async fn create_group(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(board_id): Path<Uuid>,
    Json(req): Json<CreateTaskGroupRequest>,
) -> Result<Json<TaskGroup>> {
    // Verify board exists and user has access
    let board_exists = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM boards b
            JOIN board_members bm ON b.id = bm.board_id
            WHERE b.id = $1 AND bm.user_id = $2 AND b.deleted_at IS NULL
        )
        "#,
        board_id,
        tenant.user_id
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| AppError::DatabaseError(e.to_string()))?
    .unwrap_or(false);

    if !board_exists {
        return Err(AppError::Forbidden(
            "You don't have access to this board".to_string(),
        ));
    }

    let group = create_task_group(
        &state.db,
        board_id,
        &req.name,
        &req.color,
        &req.position,
        tenant.tenant_id,
        tenant.user_id,
    )
    .await
    .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    Ok(Json(group))
}

/// Update a task group
async fn update_group(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateTaskGroupRequest>,
) -> Result<Json<TaskGroup>> {
    // Verify group exists and user has access
    let has_access = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM task_groups tg
            JOIN boards b ON tg.board_id = b.id
            JOIN board_members bm ON b.id = bm.board_id
            WHERE tg.id = $1 AND bm.user_id = $2 AND tg.deleted_at IS NULL
        )
        "#,
        id,
        tenant.user_id
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| AppError::DatabaseError(e.to_string()))?
    .unwrap_or(false);

    if !has_access {
        return Err(AppError::Forbidden(
            "You don't have access to this task group".to_string(),
        ));
    }

    let mut group = get_task_group_by_id(&state.db, id)
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?
        .ok_or(AppError::NotFound("Task group not found".to_string()))?;

    // Update fields based on request
    if let Some(name) = req.name {
        group = update_task_group_name(&state.db, id, &name)
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?
            .ok_or(AppError::NotFound("Task group not found".to_string()))?;
    }

    if let Some(color) = req.color {
        group = update_task_group_color(&state.db, id, &color)
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?
            .ok_or(AppError::NotFound("Task group not found".to_string()))?;
    }

    if let Some(position) = req.position {
        group = update_task_group_position(&state.db, id, &position)
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?
            .ok_or(AppError::NotFound("Task group not found".to_string()))?;
    }

    if let Some(collapsed) = req.collapsed {
        group = toggle_task_group_collapse(&state.db, id, collapsed)
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?
            .ok_or(AppError::NotFound("Task group not found".to_string()))?;
    }

    Ok(Json(group))
}

/// Toggle collapse state
async fn toggle_collapse(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(id): Path<Uuid>,
    Json(req): Json<serde_json::Value>,
) -> Result<Json<TaskGroup>> {
    let collapsed = req
        .get("collapsed")
        .and_then(|v| v.as_bool())
        .ok_or(AppError::BadRequest("Missing 'collapsed' field".to_string()))?;

    // Verify access
    let has_access = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM task_groups tg
            JOIN boards b ON tg.board_id = b.id
            JOIN board_members bm ON b.id = bm.board_id
            WHERE tg.id = $1 AND bm.user_id = $2 AND tg.deleted_at IS NULL
        )
        "#,
        id,
        tenant.user_id
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| AppError::DatabaseError(e.to_string()))?
    .unwrap_or(false);

    if !has_access {
        return Err(AppError::Forbidden(
            "You don't have access to this task group".to_string(),
        ));
    }

    let group = toggle_task_group_collapse(&state.db, id, collapsed)
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?
        .ok_or(AppError::NotFound("Task group not found".to_string()))?;

    Ok(Json(group))
}

/// Delete a task group (soft delete, moves tasks to "Ungrouped")
async fn delete_group(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    // Verify access
    let has_access = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM task_groups tg
            JOIN boards b ON tg.board_id = b.id
            JOIN board_members bm ON b.id = bm.board_id
            WHERE tg.id = $1 AND bm.user_id = $2 AND tg.deleted_at IS NULL
        )
        "#,
        id,
        tenant.user_id
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| AppError::DatabaseError(e.to_string()))?
    .unwrap_or(false);

    if !has_access {
        return Err(AppError::Forbidden(
            "You don't have access to this task group".to_string(),
        ));
    }

    // Prevent deletion of "Ungrouped" group
    let group = get_task_group_by_id(&state.db, id)
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?
        .ok_or(AppError::NotFound("Task group not found".to_string()))?;

    if group.name == "Ungrouped" {
        return Err(AppError::BadRequest(
            "Cannot delete the Ungrouped group".to_string(),
        ));
    }

    soft_delete_task_group(&state.db, id)
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    Ok(Json(json!({ "success": true })))
}
