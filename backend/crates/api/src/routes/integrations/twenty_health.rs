//! Twenty CRM integration health check endpoint
//!
//! Provides health status for the bundled Twenty CRM instance.
//! Supports caching for 30 seconds via Redis to reduce load.

use axum::{extract::State, middleware::from_fn_with_state, routing::get, Json, Router};
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use std::time::Duration;

use crate::errors::{AppError, Result};
use crate::extractors::AdminUser;
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TwentyHealthResponse {
    pub twenty_reachable: bool,
    pub last_sync_at: Option<String>,
    pub api_key_valid: bool,
}

/// GET /api/integrations/twenty/health
///
/// Check the health status of the bundled Twenty CRM instance.
/// Returns cached result if available (30-second TTL via Redis).
/// Requires Admin role.
async fn twenty_health_handler(
    State(mut state): State<AppState>,
    AdminUser(_): AdminUser,
) -> Result<Json<TwentyHealthResponse>> {
    let cache_key = "twenty_health_status";

    // Try to get from Redis cache first.
    // On Redis failure we log a warning and fall through to a live check — never panic.
    match state.redis.get::<_, String>(cache_key).await {
        Ok(cached) => {
            if let Ok(response) = serde_json::from_str::<TwentyHealthResponse>(&cached) {
                tracing::debug!("Returning cached Twenty health check");
                if response.twenty_reachable {
                    return Ok(Json(response));
                }
                return Err(AppError::ServiceUnavailable(
                    "Twenty CRM is currently unreachable (cached)".into(),
                ));
            }
        }
        Err(e) => {
            tracing::warn!(error = %e, "Redis unavailable for Twenty health cache; falling back to live check");
        }
    }

    // Not cached or cache expired, perform actual check
    let twenty_internal_url = std::env::var("TWENTY_INTERNAL_URL")
        .unwrap_or_else(|_| "http://twenty-server:3000".to_string());

    let client = reqwest::Client::new();
    let health_check_url = format!("{}/healthz", twenty_internal_url);

    let response = match client
        .get(&health_check_url)
        .timeout(Duration::from_secs(5))
        .send()
        .await
    {
        Ok(resp) => {
            let is_healthy = resp.status().is_success();
            TwentyHealthResponse {
                twenty_reachable: is_healthy,
                last_sync_at: None,
                api_key_valid: true,
            }
        }
        Err(e) => {
            tracing::warn!(error = %e, "Twenty health check failed");
            TwentyHealthResponse {
                twenty_reachable: false,
                last_sync_at: None,
                api_key_valid: false,
            }
        }
    };

    // Cache the result in Redis for 30 seconds
    if let Ok(serialized) = serde_json::to_string(&response) {
        let _: std::result::Result<(), redis::RedisError> =
            state.redis.set_ex(cache_key, serialized, 30u64).await;
    } else {
        tracing::warn!("Failed to serialize TwentyHealthResponse for cache; skipping cache write");
    }

    if response.twenty_reachable {
        Ok(Json(response))
    } else {
        Err(AppError::ServiceUnavailable(
            "Twenty CRM is currently unreachable".into(),
        ))
    }
}

/// Build the integrations router
pub fn integrations_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/integrations/twenty/health", get(twenty_health_handler))
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
