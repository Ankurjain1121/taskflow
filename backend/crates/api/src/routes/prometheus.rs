//! Prometheus metrics scrape endpoint
//!
//! Exposes application metrics in Prometheus text exposition format at
//! `GET /api/internal/prometheus`. Protected by `X-Cron-Secret` header
//! to prevent unauthorized access.

use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::routing::get;
use axum::{extract::State, Router};
use std::sync::atomic::Ordering;

use crate::errors::{AppError, Result};
use crate::state::AppState;

/// Validate the X-Cron-Secret header (reuses the same secret as cron endpoints).
fn validate_cron_secret(headers: &HeaderMap) -> Result<()> {
    let expected_secret = std::env::var("CRON_SECRET").unwrap_or_default();

    if expected_secret.is_empty() {
        return Err(AppError::InternalError(
            "CRON_SECRET environment variable not set".into(),
        ));
    }

    let provided_secret = headers
        .get("X-Cron-Secret")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    // Constant-time comparison to prevent timing attacks
    let a = provided_secret.as_bytes();
    let b = expected_secret.as_bytes();
    let matches = a.len() == b.len()
        && a.iter()
            .zip(b.iter())
            .fold(0u8, |acc, (x, y)| acc | (x ^ y))
            == 0;
    if !matches {
        return Err(AppError::Unauthorized("Invalid cron secret".into()));
    }

    Ok(())
}

/// GET /api/internal/prometheus
///
/// Returns all application metrics in Prometheus text exposition format.
/// Before rendering, updates gauge metrics (email queue depth, WebSocket connections)
/// from their live sources.
async fn prometheus_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse> {
    validate_cron_secret(&headers)?;

    // Update gauge metrics from live sources before rendering

    // 1. Email queue depth from Redis LLEN
    let queue_depth: f64 = {
        let mut conn = state.redis.clone();
        redis::cmd("LLEN")
            .arg("taskbolt:email:queue")
            .query_async::<i64>(&mut conn)
            .await
            .unwrap_or(0) as f64
    };
    crate::services::app_metrics::set_email_queue_depth(queue_depth);

    // 2. Active WebSocket connections from atomic counter
    let ws_count = state.ws_connection_count.load(Ordering::Relaxed) as f64;
    crate::services::app_metrics::set_active_websocket_connections(ws_count);

    // 3. Render the Prometheus metrics output
    let handle = state
        .prometheus_handle
        .as_ref()
        .ok_or_else(|| AppError::InternalError("Prometheus recorder not initialized".into()))?;

    let output = handle.render();

    Ok((
        StatusCode::OK,
        [(
            axum::http::header::CONTENT_TYPE,
            "text/plain; version=0.0.4; charset=utf-8",
        )],
        output,
    ))
}

/// Router for the Prometheus scrape endpoint (no auth middleware — uses X-Cron-Secret).
pub fn prometheus_router() -> Router<AppState> {
    Router::new().route("/internal/prometheus", get(prometheus_handler))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    #[test]
    fn test_validate_cron_secret_empty_env() {
        // When CRON_SECRET is not set, validation should fail
        unsafe { std::env::remove_var("CRON_SECRET") };
        let headers = HeaderMap::new();
        let result = validate_cron_secret(&headers);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_cron_secret_mismatch() {
        unsafe { std::env::set_var("CRON_SECRET", "correct-secret") };
        let mut headers = HeaderMap::new();
        headers.insert("X-Cron-Secret", HeaderValue::from_static("wrong-secret"));
        let result = validate_cron_secret(&headers);
        assert!(result.is_err());
        unsafe { std::env::remove_var("CRON_SECRET") };
    }

    #[test]
    fn test_validate_cron_secret_matches() {
        unsafe { std::env::set_var("CRON_SECRET", "test-secret-123") };
        let mut headers = HeaderMap::new();
        headers.insert("X-Cron-Secret", HeaderValue::from_static("test-secret-123"));
        let result = validate_cron_secret(&headers);
        assert!(result.is_ok());
        unsafe { std::env::remove_var("CRON_SECRET") };
    }
}
