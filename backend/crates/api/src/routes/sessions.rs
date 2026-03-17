use axum::{
    extract::{Path, State},
    middleware::from_fn_with_state,
    routing::{delete, get},
    Json, Router,
};
use serde::Serialize;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::AuthUserExtractor;
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct SessionInfo {
    pub id: Uuid,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub device_name: Option<String>,
    pub last_active_at: Option<chrono::DateTime<chrono::Utc>>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub is_current: bool,
}

#[derive(Debug, sqlx::FromRow)]
struct SessionRow {
    id: Uuid,
    ip_address: Option<String>,
    user_agent: Option<String>,
    device_name: Option<String>,
    last_active_at: Option<chrono::DateTime<chrono::Utc>>,
    created_at: chrono::DateTime<chrono::Utc>,
}

/// GET /api/users/me/sessions
async fn list_sessions(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
) -> Result<Json<Vec<SessionInfo>>> {
    let rows = sqlx::query_as::<_, SessionRow>(
        r#"
        SELECT id, ip_address, user_agent, device_name, last_active_at, created_at
        FROM refresh_tokens
        WHERE user_id = $1
          AND revoked_at IS NULL
          AND expires_at > NOW()
        ORDER BY created_at DESC
        "#,
    )
    .bind(auth.0.user_id)
    .fetch_all(&state.db)
    .await?;

    let current_token_id = auth.0.token_id;
    let sessions: Vec<SessionInfo> = rows
        .into_iter()
        .map(|r| SessionInfo {
            id: r.id,
            ip_address: r.ip_address,
            user_agent: r.user_agent,
            device_name: r.device_name,
            last_active_at: r.last_active_at,
            created_at: r.created_at,
            is_current: r.id == current_token_id,
        })
        .collect();

    Ok(Json(sessions))
}

/// DELETE /api/users/me/sessions/:id
async fn revoke_session(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(session_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    // Verify the session belongs to this user before revoking (prevents IDOR)
    let result = sqlx::query(
        r#"
        UPDATE refresh_tokens
        SET revoked_at = NOW()
        WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
        "#,
    )
    .bind(session_id)
    .bind(auth.0.user_id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Session not found".into()));
    }

    // Audit log
    log_session_action(
        &state.db,
        auth.0.user_id,
        auth.0.tenant_id,
        "session_revoked",
    )
    .await;

    Ok(Json(serde_json::json!({ "success": true })))
}

/// DELETE /api/users/me/sessions
/// Revoke all sessions except current
async fn revoke_all_other_sessions(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
) -> Result<Json<serde_json::Value>> {
    let current_token_id = auth.0.token_id;

    let result = sqlx::query(
        r#"
        UPDATE refresh_tokens
        SET revoked_at = NOW()
        WHERE user_id = $1
          AND id != $2
          AND revoked_at IS NULL
        "#,
    )
    .bind(auth.0.user_id)
    .bind(current_token_id)
    .execute(&state.db)
    .await?;

    log_session_action(
        &state.db,
        auth.0.user_id,
        auth.0.tenant_id,
        "all_other_sessions_revoked",
    )
    .await;

    Ok(Json(
        serde_json::json!({ "success": true, "revoked_count": result.rows_affected() }),
    ))
}

async fn log_session_action(pool: &sqlx::PgPool, user_id: Uuid, tenant_id: Uuid, action: &str) {
    let metadata = serde_json::json!({ "action": action });
    let _ = sqlx::query(
        r#"
        INSERT INTO activity_log (id, action, entity_type, entity_id, user_id, metadata, tenant_id)
        VALUES ($1, 'updated', 'session', $2, $2, $3, $4)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(metadata)
    .bind(tenant_id)
    .execute(pool)
    .await;
}

pub fn sessions_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/users/me/sessions", get(list_sessions))
        .route("/users/me/sessions", delete(revoke_all_other_sessions))
        .route("/users/me/sessions/{id}", delete(revoke_session))
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
