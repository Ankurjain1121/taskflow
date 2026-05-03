//! `POST /api/integrations/twenty/sync/enqueue`
//!
//! Tenant-scoped enqueue endpoint for the Twenty outbound sync queue.
//! Workspace member auth required. The body's `twenty_workspace_id` is
//! validated against `crm_workspace_links` for the caller's tenant — a member
//! cannot enqueue against another tenant's Twenty workspace.
//!
//! Idempotency: if `idempotency_key` is omitted, the server derives one from
//! `(tenant_id, entity_type, entity_id, operation, payload_hash)` so retries
//! of the same request collapse onto the same row.

use axum::{
    extract::State, http::StatusCode, middleware::from_fn_with_state, response::IntoResponse,
    routing::post, Json, Router,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use taskbolt_db::queries::crm_sync::{
    enqueue_job, validate_payload_fields, CrmSyncError, EnqueueOutcome, EnqueueRequest,
};

use crate::errors::{AppError, Result};
use crate::extractors::AuthUserExtractor;
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct EnqueueBody {
    pub entity_type: String,
    pub entity_id: Uuid,
    pub operation: String,
    pub payload: serde_json::Value,
    /// Optional. If absent, the server derives a stable key from the request shape.
    #[serde(default)]
    pub idempotency_key: Option<String>,
    /// Optional. Defaults to 5.
    #[serde(default)]
    pub max_retries: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct EnqueueResponse {
    pub job_id: Uuid,
    pub idempotency_key: String,
    pub deduplicated: bool,
}

pub fn twenty_sync_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/integrations/twenty/sync/enqueue", post(enqueue_handler))
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}

async fn enqueue_handler(
    State(state): State<AppState>,
    AuthUserExtractor(user): AuthUserExtractor,
    Json(body): Json<EnqueueBody>,
) -> Result<impl IntoResponse> {
    // Validate operation early.
    if body.operation != "upsert" && body.operation != "delete" {
        return Err(AppError::ValidationError(format!(
            "operation must be 'upsert' or 'delete', got '{}'",
            body.operation
        )));
    }
    // Validate entity_type early.
    if !matches!(body.entity_type.as_str(), "contact" | "company" | "deal") {
        return Err(AppError::ValidationError(format!(
            "entity_type must be one of contact|company|deal, got '{}'",
            body.entity_type
        )));
    }
    // Validate field allowlist (returns 422 on disallowed fields).
    if let Err(CrmSyncError::DisallowedField(field)) = validate_payload_fields(&body.payload) {
        return Err(AppError::ValidationError(format!(
            "field '{field}' is not in the outbound allowlist (only email, phone)"
        )));
    }

    // Resolve tenant_id → twenty_workspace_id via the workspace link.
    // Caller cannot specify another tenant's workspace.
    let link: Option<(String,)> =
        sqlx::query_as(r"SELECT twenty_workspace_id FROM crm_workspace_links WHERE tenant_id = $1")
            .bind(user.tenant_id)
            .fetch_optional(&state.db)
            .await?;

    let twenty_workspace_id = link.map(|(w,)| w).ok_or_else(|| {
        AppError::Forbidden("Twenty workspace is not linked for this tenant".into())
    })?;

    // Derive idempotency_key if absent: SHA256 over the normalized request shape.
    let idempotency_key = body.idempotency_key.unwrap_or_else(|| {
        let mut hasher = Sha256::new();
        hasher.update(user.tenant_id.as_bytes());
        hasher.update(body.entity_type.as_bytes());
        hasher.update(body.entity_id.as_bytes());
        hasher.update(body.operation.as_bytes());
        // Canonical JSON via serde — stable byte order across clients.
        let payload_canon =
            serde_json::to_string(&body.payload).unwrap_or_else(|_| "null".to_string());
        hasher.update(payload_canon.as_bytes());
        format!("auto:{}", hex::encode(hasher.finalize()))
    });

    let req = EnqueueRequest {
        tenant_id: user.tenant_id,
        twenty_workspace_id,
        entity_type: body.entity_type,
        entity_id: body.entity_id,
        operation: body.operation,
        payload: body.payload,
        idempotency_key: idempotency_key.clone(),
        max_retries: body.max_retries,
    };

    let (job_id, outcome) = enqueue_job(&state.db, &req)
        .await
        .map_err(map_enqueue_err)?;

    let resp = EnqueueResponse {
        job_id,
        idempotency_key,
        deduplicated: matches!(outcome, EnqueueOutcome::Existing),
    };

    let status = if resp.deduplicated {
        StatusCode::OK // existing job, idempotent return
    } else {
        StatusCode::ACCEPTED // freshly enqueued
    };

    Ok((status, Json(resp)))
}

fn map_enqueue_err(e: CrmSyncError) -> AppError {
    match e {
        CrmSyncError::DisallowedField(f) => {
            AppError::ValidationError(format!("field '{f}' is not in the outbound allowlist"))
        }
        CrmSyncError::InvalidEntityType(t) => {
            AppError::ValidationError(format!("invalid entity_type or operation: {t}"))
        }
        CrmSyncError::JobNotFound(id) => AppError::NotFound(format!("job {id} not found")),
        CrmSyncError::Database(e) => AppError::SqlxError(e),
    }
}
