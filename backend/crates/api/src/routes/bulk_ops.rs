//! Bulk operations routes: preview, execute, undo, list.

use axum::{
    extract::{Path, State},
    middleware::from_fn_with_state,
    routing::{get, post},
    Json, Router,
};
use redis::AsyncCommands;
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::auth_middleware;
use crate::state::AppState;
use taskflow_db::queries::bulk_operations::{self, BulkAction, TaskSnapshot};

/// Request body shared by preview and execute endpoints.
#[derive(Deserialize)]
pub struct BulkOperationRequest {
    pub task_ids: Vec<Uuid>,
    pub action: BulkAction,
}

/// POST /projects/{project_id}/bulk-operations/preview
async fn preview_handler(
    State(state): State<AppState>,
    ctx: TenantContext,
    Path(project_id): Path<Uuid>,
    Json(req): Json<BulkOperationRequest>,
) -> Result<Json<serde_json::Value>> {
    let summary = bulk_operations::preview_bulk_operation(
        &state.db,
        project_id,
        ctx.user_id,
        &req.action,
        &req.task_ids,
    )
    .await
    .map_err(map_bulk_error)?;

    Ok(Json(json!(summary)))
}

/// POST /projects/{project_id}/bulk-operations/execute
async fn execute_handler(
    State(state): State<AppState>,
    ctx: TenantContext,
    Path(project_id): Path<Uuid>,
    Json(req): Json<BulkOperationRequest>,
) -> Result<Json<serde_json::Value>> {
    // Snapshot tasks before applying changes
    let snapshot = bulk_operations::snapshot_tasks(&state.db, &req.task_ids, project_id)
        .await
        .map_err(map_bulk_error)?;

    let op = bulk_operations::execute_bulk_operation(
        &state.db,
        project_id,
        ctx.tenant_id,
        ctx.user_id,
        &req.action,
        &req.task_ids,
    )
    .await
    .map_err(map_bulk_error)?;

    // Store snapshot in Redis with 1-hour TTL
    store_undo_snapshot(&state.redis, &op.id, &snapshot).await;

    Ok(Json(json!({
        "operation_id": op.id,
        "action_type": op.action_type,
        "tasks_affected": op.task_count,
        "can_undo": true,
    })))
}

/// POST /projects/{project_id}/bulk-operations/{op_id}/undo
async fn undo_handler(
    State(state): State<AppState>,
    ctx: TenantContext,
    Path((_project_id, op_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>> {
    // Retrieve snapshot from Redis
    let snapshot: Vec<TaskSnapshot> = retrieve_undo_snapshot(&state.redis, &op_id)
        .await
        .ok_or_else(|| AppError::NotFound("Undo data has expired or is unavailable".to_string()))?;

    let restored = bulk_operations::undo_bulk_operation(&state.db, op_id, ctx.user_id, &snapshot)
        .await
        .map_err(map_bulk_error)?;

    // Remove the Redis snapshot (one-time undo)
    delete_undo_snapshot(&state.redis, &op_id).await;

    Ok(Json(json!({ "restored": restored })))
}

/// GET /projects/{project_id}/bulk-operations
async fn list_handler(
    State(state): State<AppState>,
    ctx: TenantContext,
    Path(project_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    let ops = bulk_operations::list_bulk_operations(&state.db, project_id, ctx.user_id)
        .await
        .map_err(map_bulk_error)?;

    Ok(Json(json!({ "operations": ops })))
}

/// Build the bulk operations router.
pub fn bulk_ops_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route(
            "/projects/{project_id}/bulk-operations/preview",
            post(preview_handler),
        )
        .route(
            "/projects/{project_id}/bulk-operations/execute",
            post(execute_handler),
        )
        .route(
            "/projects/{project_id}/bulk-operations/{op_id}/undo",
            post(undo_handler),
        )
        .route("/projects/{project_id}/bulk-operations", get(list_handler))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}

// ─── Redis snapshot helpers ────────────────────────────────────────

async fn store_undo_snapshot(
    redis: &redis::aio::ConnectionManager,
    operation_id: &Uuid,
    snapshot: &[TaskSnapshot],
) {
    let key = format!("undo:{}", operation_id);
    if let Ok(json) = serde_json::to_string(snapshot) {
        let mut conn = redis.clone();
        let _: std::result::Result<(), _> = conn.set_ex(&key, json, 3600u64).await;
    }
}

async fn retrieve_undo_snapshot(
    redis: &redis::aio::ConnectionManager,
    operation_id: &Uuid,
) -> Option<Vec<TaskSnapshot>> {
    let key = format!("undo:{}", operation_id);
    let mut conn = redis.clone();
    let result: Option<String> = conn.get(&key).await.ok()?;
    result.and_then(|s| serde_json::from_str(&s).ok())
}

async fn delete_undo_snapshot(redis: &redis::aio::ConnectionManager, operation_id: &Uuid) {
    let key = format!("undo:{}", operation_id);
    let mut conn = redis.clone();
    let _: std::result::Result<(), _> = conn.del(&key).await;
}

// ─── Error mapping ─────────────────────────────────────────────

fn map_bulk_error(e: taskflow_db::queries::TaskQueryError) -> AppError {
    match e {
        taskflow_db::queries::TaskQueryError::NotProjectMember => {
            AppError::Forbidden("Not a project member".into())
        }
        taskflow_db::queries::TaskQueryError::Database(e) => AppError::SqlxError(e),
        taskflow_db::queries::TaskQueryError::Other(msg) if msg.contains("limited to") => {
            AppError::BadRequest(msg)
        }
        taskflow_db::queries::TaskQueryError::Other(msg) if msg.contains("expired") => {
            AppError::NotFound(msg)
        }
        taskflow_db::queries::TaskQueryError::Other(msg)
            if msg.contains("not found") || msg.contains("Not found") =>
        {
            AppError::NotFound(msg)
        }
        _ => AppError::InternalError(format!("{}", e)),
    }
}
