#![allow(clippy::needless_raw_string_hashes)]
mod config;
mod errors;
pub mod extractors;
mod jobs;
pub mod middleware;
mod router;
pub mod routes;
pub mod services;
mod state;
#[cfg(test)]
mod test_helpers;
pub mod ws;

use crate::config::Config;
use crate::state::AppState;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Load config
    let config = Config::from_env()?;

    // Initialize Sentry error tracking (skips gracefully if SENTRY_DSN not set)
    let _sentry_guard = std::env::var("SENTRY_DSN").ok().and_then(|dsn| {
        if dsn.is_empty() {
            return None;
        }
        Some(sentry::init((
            dsn,
            sentry::ClientOptions {
                release: sentry::release_name!(),
                environment: Some(
                    std::env::var("SENTRY_ENVIRONMENT")
                        .unwrap_or_else(|_| "production".to_string())
                        .into(),
                ),
                traces_sample_rate: 0.1,
                ..Default::default()
            },
        )))
    });

    // Set up tracing
    // Use JSON format when RUST_LOG_FORMAT=json, otherwise use the default human-readable format.
    let env_filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| "info,sqlx=warn,tower_http=debug".into());

    let use_json = std::env::var("RUST_LOG_FORMAT")
        .map(|v| v.eq_ignore_ascii_case("json"))
        .unwrap_or(false);

    if use_json {
        tracing_subscriber::fmt()
            .json()
            .with_env_filter(env_filter)
            .init();
    } else {
        tracing_subscriber::fmt().with_env_filter(env_filter).init();
    }

    tracing::info!("Starting TaskBolt API on {}:{}", config.host, config.port);

    // Build app state
    let state = AppState::new(config.clone()).await?;

    // Build router
    let app = router::build_router(state.clone(), &config)?;

    // Spawn background jobs
    jobs::spawn_background_jobs(&state, &config).await;

    // Bind and serve
    let addr = format!("{}:{}", config.host, config.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    tracing::info!("Listening on {}", addr);

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

async fn shutdown_signal() {
    use tokio::signal::unix::{signal, SignalKind};
    let mut sigterm = signal(SignalKind::terminate()).expect("Failed to listen for SIGTERM");
    tokio::select! {
        _ = tokio::signal::ctrl_c() => {
            tracing::info!("SIGINT received, shutting down");
        }
        _ = sigterm.recv() => {
            tracing::info!("SIGTERM received, shutting down");
        }
    }
}

#[cfg(test)]
mod middleware_hardening_tests {
    use axum::body::Body;
    use axum::extract::DefaultBodyLimit;
    use axum::http::{Request, StatusCode};
    use axum::{routing::post, Router};
    use tower::ServiceExt;
    use tower_http::timeout::TimeoutLayer;

    use std::time::Duration;

    /// Echo handler that reads the full body.
    async fn echo_handler(body: axum::body::Bytes) -> axum::body::Bytes {
        body
    }

    /// Slow handler that sleeps longer than the default timeout.
    async fn slow_handler() -> &'static str {
        tokio::time::sleep(Duration::from_secs(5)).await;
        "done"
    }

    #[tokio::test]
    async fn body_under_10mb_is_accepted() {
        let app = Router::new()
            .route("/test", post(echo_handler))
            .layer(DefaultBodyLimit::max(10 * 1024 * 1024));

        let body = vec![0u8; 1024]; // 1 KB
        let req = Request::builder()
            .method("POST")
            .uri("/test")
            .body(Body::from(body))
            .unwrap();

        let response = app.oneshot(req).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn body_over_10mb_is_rejected() {
        let app = Router::new()
            .route("/test", post(echo_handler))
            .layer(DefaultBodyLimit::max(10 * 1024 * 1024));

        let body = vec![0u8; 11 * 1024 * 1024]; // 11 MB
        let req = Request::builder()
            .method("POST")
            .uri("/test")
            .body(Body::from(body))
            .unwrap();

        let response = app.oneshot(req).await.unwrap();
        assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
    }

    #[tokio::test]
    async fn import_route_accepts_up_to_50mb() {
        let app = Router::new()
            .route("/import", post(echo_handler))
            .layer(DefaultBodyLimit::max(50 * 1024 * 1024));

        // 15 MB should be accepted (under 50MB override)
        let body = vec![0u8; 15 * 1024 * 1024];
        let req = Request::builder()
            .method("POST")
            .uri("/import")
            .body(Body::from(body))
            .unwrap();

        let response = app.oneshot(req).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn import_route_rejects_over_50mb() {
        let app = Router::new()
            .route("/import", post(echo_handler))
            .layer(DefaultBodyLimit::max(50 * 1024 * 1024));

        let body = vec![0u8; 51 * 1024 * 1024]; // 51 MB
        let req = Request::builder()
            .method("POST")
            .uri("/import")
            .body(Body::from(body))
            .unwrap();

        let response = app.oneshot(req).await.unwrap();
        assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
    }

    #[tokio::test]
    async fn timeout_layer_returns_408_on_slow_handler() {
        let app =
            Router::new()
                .route("/slow", post(slow_handler))
                .layer(TimeoutLayer::with_status_code(
                    StatusCode::REQUEST_TIMEOUT,
                    Duration::from_millis(100),
                )); // 100ms timeout

        let req = Request::builder()
            .method("POST")
            .uri("/slow")
            .body(Body::empty())
            .unwrap();

        let response = app.oneshot(req).await.unwrap();
        // tower::timeout returns 408 Request Timeout via Axum's IntoResponse impl
        assert_eq!(response.status(), StatusCode::REQUEST_TIMEOUT);
    }

    #[tokio::test]
    async fn timeout_layer_allows_fast_handler() {
        let app =
            Router::new()
                .route("/fast", post(echo_handler))
                .layer(TimeoutLayer::with_status_code(
                    StatusCode::REQUEST_TIMEOUT,
                    Duration::from_secs(30),
                ));

        let req = Request::builder()
            .method("POST")
            .uri("/fast")
            .body(Body::from("hello"))
            .unwrap();

        let response = app.oneshot(req).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }
}
