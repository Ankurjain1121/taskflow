use axum::{
    Json, Router,
    extract::{Path, State},
    middleware::from_fn_with_state,
    routing::{delete, get, post, put},
};
use serde_json::json;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::{StrictJson, TenantContext};
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;
use taskbolt_db::models::{CreateTaskGroupRequest, UpdateTaskGroupRequest};
use taskbolt_db::queries::membership::verify_project_membership as db_verify_project_membership;
use taskbolt_db::queries::{
    create_task_group, get_task_group_by_id, list_task_groups_by_board,
    list_task_groups_with_stats, soft_delete_task_group, toggle_task_group_collapse,
    update_task_group_color, update_task_group_name, update_task_group_position,
};

pub fn task_group_routes(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/projects/{board_id}/groups", get(list_groups))
        .route(
            "/projects/{board_id}/groups/stats",
            get(list_groups_with_stats_handler),
        )
        .route("/projects/{board_id}/groups", post(create_group))
        .route("/groups/{id}", get(get_group))
        .route("/groups/{id}", put(update_group))
        .route("/groups/{id}/collapse", put(toggle_collapse))
        .route("/groups/{id}", delete(delete_group))
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}

/// Verify board membership using the canonical membership check
/// (explicit project member OR workspace member OR org admin/super_admin on
/// non-private workspace).
async fn verify_board_access(pool: &sqlx::PgPool, board_id: Uuid, user_id: Uuid) -> Result<bool> {
    db_verify_project_membership(pool, board_id, user_id)
        .await
        .map_err(AppError::from)
}

/// Verify group access by resolving the group's project_id, then checking
/// project membership via the canonical helper.
async fn verify_group_access(pool: &sqlx::PgPool, group_id: Uuid, user_id: Uuid) -> Result<bool> {
    let project_id: Option<Uuid> = sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT p.id FROM task_lists tl
        JOIN projects p ON tl.project_id = p.id
        WHERE tl.id = $1 AND tl.deleted_at IS NULL AND p.deleted_at IS NULL
        "#,
    )
    .bind(group_id)
    .fetch_optional(pool)
    .await?;

    let Some(pid) = project_id else {
        return Ok(false);
    };

    db_verify_project_membership(pool, pid, user_id)
        .await
        .map_err(AppError::from)
}

/// List task groups for a board
async fn list_groups(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(board_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    if !verify_board_access(&state.db, board_id, tenant.user_id).await? {
        return Err(AppError::Forbidden(
            "You don't have access to this board".to_string(),
        ));
    }

    let groups = list_task_groups_by_board(&state.db, board_id).await?;
    Ok(Json(json!(groups)))
}

/// List task groups with statistics
async fn list_groups_with_stats_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(board_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    if !verify_board_access(&state.db, board_id, tenant.user_id).await? {
        return Err(AppError::Forbidden(
            "You don't have access to this board".to_string(),
        ));
    }

    let groups = list_task_groups_with_stats(&state.db, board_id).await?;
    Ok(Json(json!(groups)))
}

/// Get a specific task group
async fn get_group(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    if !verify_group_access(&state.db, id, tenant.user_id).await? {
        return Err(AppError::Forbidden(
            "You don't have access to this task group".to_string(),
        ));
    }

    let group = get_task_group_by_id(&state.db, id)
        .await?
        .ok_or(AppError::NotFound("Task group not found".to_string()))?;

    Ok(Json(json!(group)))
}

/// Create a new task group
async fn create_group(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(board_id): Path<Uuid>,
    StrictJson(req): StrictJson<CreateTaskGroupRequest>,
) -> Result<Json<serde_json::Value>> {
    if !verify_board_access(&state.db, board_id, tenant.user_id).await? {
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
    .await?;

    Ok(Json(json!(group)))
}

/// Update a task group
async fn update_group(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(id): Path<Uuid>,
    StrictJson(req): StrictJson<UpdateTaskGroupRequest>,
) -> Result<Json<serde_json::Value>> {
    if !verify_group_access(&state.db, id, tenant.user_id).await? {
        return Err(AppError::Forbidden(
            "You don't have access to this task group".to_string(),
        ));
    }

    let mut group = get_task_group_by_id(&state.db, id)
        .await?
        .ok_or(AppError::NotFound("Task group not found".to_string()))?;

    if let Some(name) = req.name {
        group = update_task_group_name(&state.db, id, &name)
            .await?
            .ok_or(AppError::NotFound("Task group not found".to_string()))?;
    }

    if let Some(color) = req.color {
        group = update_task_group_color(&state.db, id, &color)
            .await?
            .ok_or(AppError::NotFound("Task group not found".to_string()))?;
    }

    if let Some(position) = req.position {
        group = update_task_group_position(&state.db, id, &position)
            .await?
            .ok_or(AppError::NotFound("Task group not found".to_string()))?;
    }

    if let Some(collapsed) = req.collapsed {
        group = toggle_task_group_collapse(&state.db, id, collapsed)
            .await?
            .ok_or(AppError::NotFound("Task group not found".to_string()))?;
    }

    Ok(Json(json!(group)))
}

/// Toggle collapse state
async fn toggle_collapse(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(id): Path<Uuid>,
    Json(req): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>> {
    let collapsed = req
        .get("collapsed")
        .and_then(serde_json::Value::as_bool)
        .ok_or(AppError::BadRequest(
            "Missing 'collapsed' field".to_string(),
        ))?;

    if !verify_group_access(&state.db, id, tenant.user_id).await? {
        return Err(AppError::Forbidden(
            "You don't have access to this task group".to_string(),
        ));
    }

    let group = toggle_task_group_collapse(&state.db, id, collapsed)
        .await?
        .ok_or(AppError::NotFound("Task group not found".to_string()))?;

    Ok(Json(json!(group)))
}

/// Delete a task group (soft delete, moves tasks to "Ungrouped")
async fn delete_group(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    if !verify_group_access(&state.db, id, tenant.user_id).await? {
        return Err(AppError::Forbidden(
            "You don't have access to this task group".to_string(),
        ));
    }

    let group = get_task_group_by_id(&state.db, id)
        .await?
        .ok_or(AppError::NotFound("Task group not found".to_string()))?;

    if group.name == "Ungrouped" {
        return Err(AppError::BadRequest(
            "Cannot delete the Ungrouped group".to_string(),
        ));
    }

    soft_delete_task_group(&state.db, id).await?;

    Ok(Json(json!({ "success": true })))
}
