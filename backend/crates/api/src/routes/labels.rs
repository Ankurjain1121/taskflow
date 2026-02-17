use axum::{
    extract::{Path, State},
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use uuid::Uuid;

use taskflow_db::queries::labels as label_queries;
use taskflow_db::set_tenant_context;

use crate::errors::AppError;
use crate::middleware::AuthUser;
use crate::state::AppState;

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct CreateLabelRequest {
    pub name: String,
    pub color: String,
}

#[derive(Deserialize)]
pub struct UpdateLabelRequest {
    pub name: Option<String>,
    pub color: Option<String>,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// GET /api/boards/{board_id}/labels
async fn list_labels(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(board_id): Path<Uuid>,
) -> Result<Json<Vec<taskflow_db::models::Label>>, AppError> {
    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut *tx, auth_user.tenant_id).await?;

    let labels = label_queries::list_labels_by_board(&mut *tx, board_id).await?;

    tx.commit().await?;
    Ok(Json(labels))
}

/// POST /api/boards/{board_id}/labels
async fn create_label(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(board_id): Path<Uuid>,
    Json(payload): Json<CreateLabelRequest>,
) -> Result<Json<taskflow_db::models::Label>, AppError> {
    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut *tx, auth_user.tenant_id).await?;

    let label = label_queries::create_label(
        &mut *tx,
        board_id,
        &payload.name,
        &payload.color,
    )
    .await?;

    tx.commit().await?;
    Ok(Json(label))
}

/// PATCH /api/labels/{id}
async fn update_label(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateLabelRequest>,
) -> Result<Json<taskflow_db::models::Label>, AppError> {
    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut *tx, auth_user.tenant_id).await?;

    let label = label_queries::update_label(
        &mut *tx,
        id,
        payload.name.as_deref(),
        payload.color.as_deref(),
    )
    .await
    .map_err(|_| AppError::NotFound("Label not found".into()))?;

    tx.commit().await?;
    Ok(Json(label))
}

/// DELETE /api/labels/{id}
async fn delete_label(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut *tx, auth_user.tenant_id).await?;

    let deleted = label_queries::delete_label(&mut *tx, id).await?;
    if !deleted {
        return Err(AppError::NotFound("Label not found".into()));
    }

    tx.commit().await?;
    Ok(Json(serde_json::json!({"message": "Label deleted"})))
}

/// POST /api/tasks/{task_id}/labels/{label_id}
async fn add_label_to_task(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path((task_id, label_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, AppError> {
    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut *tx, auth_user.tenant_id).await?;

    label_queries::add_label_to_task(&mut *tx, task_id, label_id).await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({"message": "Label added to task"})))
}

/// DELETE /api/tasks/{task_id}/labels/{label_id}
async fn remove_label_from_task(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path((task_id, label_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, AppError> {
    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut *tx, auth_user.tenant_id).await?;

    label_queries::remove_label_from_task(&mut *tx, task_id, label_id).await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({"message": "Label removed from task"})))
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

pub fn label_routes() -> Router<AppState> {
    Router::new()
        .route(
            "/api/boards/{board_id}/labels",
            get(list_labels).post(create_label),
        )
        .route(
            "/api/labels/{id}",
            axum::routing::patch(update_label).delete(delete_label),
        )
        .route(
            "/api/tasks/{task_id}/labels/{label_id}",
            axum::routing::post(add_label_to_task).delete(remove_label_from_task),
        )
}
