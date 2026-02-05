mod config;
mod errors;
mod state;
pub mod routes;
pub mod middleware;
pub mod extractors;
pub mod ws;
pub mod services;

use axum::http::Method;
use axum::middleware::from_fn_with_state;
use axum::{Router, routing::get};
use tower_http::compression::CompressionLayer;
use tower_http::cors::{AllowOrigin, Any, CorsLayer};
use tower_http::trace::TraceLayer;

use crate::config::Config;
use crate::middleware::auth_middleware;
use crate::routes::{
    activity_log_router, admin_audit_router, admin_trash_router, admin_users_router,
    attachment_router, auth_router, board_columns_router, board_router, column_router,
    comment_router, cron_router, health_handler, invitation_router, liveness_handler,
    my_tasks_router, notification_preferences_router, notification_router, onboarding_router,
    readiness_handler, task_router, team_overview_router, workspace_boards_router,
    workspace_router,
};
use crate::state::AppState;
use crate::ws::ws_handler;


#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Load config
    let config = Config::from_env()?;

    // Set up tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,sqlx=warn,tower_http=debug".into()),
        )
        .init();

    tracing::info!("Starting TaskFlow API on {}:{}", config.host, config.port);

    // Build app state
    let state = AppState::new(config.clone()).await?;

    // Build CORS layer with configured origin
    let allowed_origin = config.app_url.parse::<axum::http::HeaderValue>()
        .expect("APP_URL must be a valid header value");
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::exact(allowed_origin))
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers(Any)
        .allow_credentials(true);

    // Build protected routes (require auth)
    let protected_routes = Router::new()
        .route("/auth/sign-out", axum::routing::post(routes::auth::sign_out_handler))
        .route("/auth/me", get(routes::auth::me_handler))
        .route("/invitations", axum::routing::post(routes::invitation::create_handler))
        .route("/invitations", get(routes::invitation::list_handler))
        .layer(from_fn_with_state(state.clone(), auth_middleware));

    // Build public routes
    let public_routes = Router::new()
        .route("/auth/sign-in", axum::routing::post(routes::auth::sign_in_handler))
        .route("/auth/refresh", axum::routing::post(routes::auth::refresh_handler))
        .route("/invitations/validate/{token}", get(routes::invitation::validate_handler))
        .route("/invitations/accept", axum::routing::post(routes::invitation::accept_handler))
        .route("/ws", get(ws_handler));

    // Build router
    let app = Router::new()
        // Health check routes (no auth required)
        .route("/api/health", get(health_handler))
        .route("/api/health/live", get(liveness_handler))
        .route("/api/health/ready", get(readiness_handler))
        .nest("/api", protected_routes)
        .nest("/api", public_routes)
        .nest("/api", task_router())
        .nest("/api", attachment_router())
        // Comment routes
        .nest("/api", comment_router())
        // Activity log routes
        .nest("/api", activity_log_router())
        // Workspace routes
        .nest("/api/workspaces", workspace_router())
        .nest("/api/workspaces/{workspace_id}/boards", workspace_boards_router())
        // Board routes
        .nest("/api/boards", board_router())
        .nest("/api/boards/{board_id}/columns", board_columns_router())
        // Column routes
        .nest("/api/columns", column_router())
        // Notification routes
        .nest("/api", notification_router())
        .nest("/api", notification_preferences_router())
        // Cron routes (no auth middleware - uses X-Cron-Secret)
        .nest("/api", cron_router())
        // Onboarding routes
        .nest("/api/onboarding", onboarding_router())
        // Team overview routes (nested under workspace)
        .nest("/api/workspaces/{workspace_id}", team_overview_router())
        // My tasks routes
        .nest("/api/my-tasks", my_tasks_router())
        // Admin routes (require Admin role)
        .nest("/api", admin_audit_router())
        .nest("/api", admin_users_router())
        .nest("/api", admin_trash_router())
        .layer(TraceLayer::new_for_http())
        .layer(CompressionLayer::new())
        .layer(cors)
        .with_state(state);

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
    tokio::signal::ctrl_c()
        .await
        .expect("Failed to listen for ctrl+c");
    tracing::info!("Shutdown signal received");
}
