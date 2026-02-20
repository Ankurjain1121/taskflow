use axum::{
    extract::{Path, Query, State},
    middleware::from_fn_with_state,
    routing::{delete, get, post, put},
    Json, Router,
};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::auth_middleware;
use crate::state::AppState;
use taskflow_db::queries::webhooks::{
    create_webhook, delete_webhook, get_webhook_deliveries, list_webhooks, update_webhook,
    CreateWebhookInput, UpdateWebhookInput, WebhookQueryError,
};

/// Map WebhookQueryError to AppError
fn map_webhook_error(e: WebhookQueryError) -> AppError {
    match e {
        WebhookQueryError::NotFound => AppError::NotFound("Webhook not found".into()),
        WebhookQueryError::NotBoardMember => AppError::Forbidden("Not a board member".into()),
        WebhookQueryError::Database(e) => AppError::SqlxError(e),
    }
}

/// GET /api/boards/{board_id}/webhooks
async fn list_webhooks_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(board_id): Path<Uuid>,
) -> Result<Json<Vec<taskflow_db::models::Webhook>>> {
    let webhooks = list_webhooks(&state.db, board_id, tenant.user_id)
        .await
        .map_err(map_webhook_error)?;

    Ok(Json(webhooks))
}

/// POST /api/boards/{board_id}/webhooks
async fn create_webhook_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(board_id): Path<Uuid>,
    Json(body): Json<CreateWebhookInput>,
) -> Result<Json<taskflow_db::models::Webhook>> {
    let webhook = create_webhook(&state.db, board_id, body, tenant.user_id, tenant.tenant_id)
        .await
        .map_err(map_webhook_error)?;

    Ok(Json(webhook))
}

/// PUT /api/webhooks/{id}
async fn update_webhook_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(webhook_id): Path<Uuid>,
    Json(body): Json<UpdateWebhookInput>,
) -> Result<Json<taskflow_db::models::Webhook>> {
    let webhook = update_webhook(&state.db, webhook_id, body, tenant.user_id)
        .await
        .map_err(map_webhook_error)?;

    Ok(Json(webhook))
}

/// DELETE /api/webhooks/{id}
async fn delete_webhook_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(webhook_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    delete_webhook(&state.db, webhook_id, tenant.user_id)
        .await
        .map_err(map_webhook_error)?;

    Ok(Json(json!({ "success": true })))
}

#[derive(Deserialize)]
struct DeliveriesQuery {
    #[serde(default = "default_limit")]
    limit: i64,
}

fn default_limit() -> i64 {
    20
}

/// GET /api/webhooks/{id}/deliveries
async fn get_deliveries_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(webhook_id): Path<Uuid>,
    Query(query): Query<DeliveriesQuery>,
) -> Result<Json<Vec<taskflow_db::models::WebhookDelivery>>> {
    let deliveries = get_webhook_deliveries(&state.db, webhook_id, tenant.user_id, query.limit)
        .await
        .map_err(map_webhook_error)?;

    Ok(Json(deliveries))
}

/// Create the webhook router
pub fn webhook_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/boards/{board_id}/webhooks", get(list_webhooks_handler))
        .route("/boards/{board_id}/webhooks", post(create_webhook_handler))
        .route("/webhooks/{id}", put(update_webhook_handler))
        .route("/webhooks/{id}", delete(delete_webhook_handler))
        .route("/webhooks/{id}/deliveries", get(get_deliveries_handler))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
