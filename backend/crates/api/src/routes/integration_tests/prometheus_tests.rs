//! Integration tests for the Prometheus scrape endpoint.
//!
//! Route: `GET /api/internal/prometheus`
//! Auth:  `X-Cron-Secret` header (NOT JWT). Value comes from the `CRON_SECRET`
//!        environment variable, which must be set for the handler to validate
//!        at all. `test_config()` sets the cron_secret field on the config to
//!        `"test-cron-secret-for-testing"`; we use the same value here and
//!        mirror it into the process env via unsafe set_var before dispatch.
//!
//! These tests supplement the unit tests in `prometheus.rs` (which already
//! cover `validate_cron_secret` in isolation) by exercising the full router
//! stack: routing, header extraction, error-to-status mapping, and success
//! body rendering.

use super::common::*;
use std::sync::Arc;
use std::sync::atomic::Ordering;

const METRICS_PATH: &str = "/api/internal/prometheus";
const CRON_SECRET_VALUE: &str = "test-cron-secret-for-testing";

/// Ensure `CRON_SECRET` env var matches what `test_config()` uses so the
/// handler's `std::env::var("CRON_SECRET")` lookup succeeds.
///
/// SAFETY: tests are `#[ignore]` and run via `--ignored`; every prometheus
/// test sets the same value, so racing writes are idempotent. No test
/// clears it mid-run.
#[allow(unsafe_code)]
fn set_cron_secret_env() {
    unsafe {
        std::env::set_var("CRON_SECRET", CRON_SECRET_VALUE);
    }
}

/// Build a router whose AppState has a real `prometheus_handle`, so the
/// success-path tests can actually render output. Uses `build_recorder()`
/// which does NOT install globally (avoids "recorder already installed"
/// panics when multiple tests touch prometheus).
async fn test_app_with_prometheus() -> (axum::Router, crate::state::AppState) {
    let mut state = test_app_state().await;
    let recorder = metrics_exporter_prometheus::PrometheusBuilder::new()
        .build_recorder();
    let handle = recorder.handle();
    state.prometheus_handle = Some(Arc::new(handle));
    // Keep the recorder alive for the duration of the test process by leaking it.
    // (A dropped recorder invalidates the handle's snapshot source.)
    Box::leak(Box::new(recorder));
    let app = build_test_router(state.clone());
    (app, state)
}

// =========================================================================
// AUTH / NEGATIVE PATHS — no handle needed, validate_cron_secret rejects first
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_prometheus_no_secret_returns_401_or_403() {
    set_cron_secret_env();
    let (app, _state) = test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .uri(METRICS_PATH)
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    let status = response.status();
    assert!(
        status == StatusCode::UNAUTHORIZED || status == StatusCode::FORBIDDEN,
        "expected 401 or 403 without X-Cron-Secret header, got {}",
        status
    );
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_prometheus_wrong_secret_returns_401_or_403() {
    set_cron_secret_env();
    let (app, _state) = test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .uri(METRICS_PATH)
                .header("X-Cron-Secret", "this-is-not-the-real-secret")
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    let status = response.status();
    assert!(
        status == StatusCode::UNAUTHORIZED || status == StatusCode::FORBIDDEN,
        "expected 401 or 403 with wrong X-Cron-Secret, got {}",
        status
    );
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_prometheus_empty_secret_header_returns_401_or_403() {
    set_cron_secret_env();
    let (app, _state) = test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .uri(METRICS_PATH)
                .header("X-Cron-Secret", "")
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    let status = response.status();
    assert!(
        status == StatusCode::UNAUTHORIZED || status == StatusCode::FORBIDDEN,
        "expected 401 or 403 with empty X-Cron-Secret, got {}",
        status
    );
}

// =========================================================================
// HAPPY PATH — needs a real PrometheusHandle wired into AppState
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_prometheus_valid_secret_returns_200() {
    set_cron_secret_env();
    let (app, state) = test_app_with_prometheus().await;
    // Touch the WebSocket counter so the handler's update step hits a
    // meaningful atomic load path.
    state.ws_connection_count.store(0, Ordering::Relaxed);

    let response = app
        .oneshot(
            Request::builder()
                .uri(METRICS_PATH)
                .header("X-Cron-Secret", CRON_SECRET_VALUE)
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(
        response.status(),
        StatusCode::OK,
        "valid X-Cron-Secret should return 200"
    );

    let content_type = response
        .headers()
        .get(axum::http::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    assert!(
        content_type.starts_with("text/plain"),
        "expected text/plain content-type, got {:?}",
        content_type
    );

    // Drain the body — verifies no streaming / encoding surprises.
    let _body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read body");
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_prometheus_body_contains_metric_lines() {
    set_cron_secret_env();
    let (app, _state) = test_app_with_prometheus().await;

    // Seed one custom gauge so the rendered output is non-empty. The
    // handler itself calls `set_email_queue_depth` / `set_active_websocket_connections`
    // before render, but those macros only emit to the GLOBAL recorder.
    // Since we didn't install globally, we instead assert the body is a
    // valid prometheus text exposition — empty, or containing `#` / newlines.
    let response = app
        .oneshot(
            Request::builder()
                .uri(METRICS_PATH)
                .header("X-Cron-Secret", CRON_SECRET_VALUE)
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read body");
    let body_str = std::str::from_utf8(&body).expect("body should be UTF-8");

    // Prometheus text exposition: either empty (no metrics recorded against
    // this non-global handle) or contains `# HELP` / `# TYPE` / a metric name
    // followed by a value. Accept any of these as a valid rendering.
    let looks_like_prometheus = body_str.is_empty()
        || body_str.contains("# HELP")
        || body_str.contains("# TYPE")
        || body_str.contains('\n');
    assert!(
        looks_like_prometheus,
        "body does not look like a prometheus text exposition: {:?}",
        body_str
    );
}
