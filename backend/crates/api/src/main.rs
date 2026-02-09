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
use axum::http::header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE};
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;

use crate::config::Config;
use crate::middleware::auth_middleware;
use crate::routes::{
    activity_log_router, admin_audit_router, admin_trash_router, admin_users_router,
    attachment_router, board_columns_router, board_router, board_templates_router, column_router,
    comment_router, cron_router, custom_field_router, dashboard_router, health_handler,
    liveness_handler, my_tasks_router, notification_preferences_router, notification_router,
    onboarding_router, readiness_handler, recurring_router, reports_router, search_router,
    subtask_router, dependency_router, milestone_router, task_router, team_overview_router,
    time_entry_router, workspace_boards_router, workspace_router,
    project_template_router, automation_router, import_export_router,
    board_share_router, shared_board_public_router, webhook_router,
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
        .allow_headers([AUTHORIZATION, ACCEPT, CONTENT_TYPE])
        .allow_credentials(true);

    // Build protected routes (require auth)
    let protected_routes = Router::new()
        .route("/auth/sign-out", axum::routing::post(routes::auth::sign_out_handler))
        .route("/auth/me", get(routes::auth::me_handler))
        .route("/invitations", axum::routing::post(routes::invitation::create_handler))
        .route("/invitations", get(routes::invitation::list_handler))
        .route("/invitations/bulk", axum::routing::post(routes::invitation::bulk_create_handler))
        .route("/invitations/all", get(routes::invitation::list_all_handler))
        .route("/invitations/{id}", axum::routing::delete(routes::invitation::delete_handler))
        .route("/invitations/{id}/resend", axum::routing::post(routes::invitation::resend_handler))
        .layer(from_fn_with_state(state.clone(), auth_middleware));

    // Build public routes
    let public_routes = Router::new()
        .route("/auth/sign-in", axum::routing::post(routes::auth::sign_in_handler))
        .route("/auth/sign-up", axum::routing::post(routes::auth::sign_up_handler))
        .route("/auth/refresh", axum::routing::post(routes::auth::refresh_handler))
        .route("/auth/forgot-password", axum::routing::post(routes::auth::forgot_password_handler))
        .route("/auth/reset-password", axum::routing::post(routes::auth::reset_password_handler))
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
        .nest("/api", task_router(state.clone()))
        .nest("/api", subtask_router(state.clone()))
        .nest("/api", dependency_router(state.clone()))
        .nest("/api", milestone_router(state.clone()))
        .nest("/api", attachment_router(state.clone()))
        // Comment routes
        .nest("/api", comment_router(state.clone()))
        // Activity log routes
        .nest("/api", activity_log_router(state.clone()))
        // Workspace routes
        .nest("/api/workspaces", workspace_router(state.clone()))
        .nest("/api/workspaces/{workspace_id}/boards", workspace_boards_router(state.clone()))
        // Board routes
        .nest("/api/board-templates", board_templates_router(state.clone()))
        .nest("/api/boards", board_router(state.clone()))
        .nest("/api/boards/{board_id}/columns", board_columns_router(state.clone()))
        // Column routes
        .nest("/api/columns", column_router(state.clone()))
        // Notification routes
        .nest("/api", notification_router(state.clone()))
        .nest("/api", notification_preferences_router(state.clone()))
        // Cron routes (no auth middleware - uses X-Cron-Secret)
        .nest("/api", cron_router())
        // Onboarding routes
        .nest("/api/onboarding", onboarding_router(state.clone()))
        // Team overview routes (nested under workspace)
        .nest("/api/workspaces/{workspace_id}", team_overview_router(state.clone()))
        // My tasks routes
        .nest("/api/my-tasks", my_tasks_router(state.clone()))
        // Dashboard routes
        .nest("/api/dashboard", dashboard_router(state.clone()))
        // Admin routes (require Admin role)
        .nest("/api", admin_audit_router(state.clone()))
        .nest("/api", admin_users_router(state.clone()))
        .nest("/api", admin_trash_router(state.clone()))
        // Reports routes
        .nest("/api", reports_router(state.clone()))
        // Search routes
        .nest("/api", search_router(state.clone()))
        // Phase 3: Recurring tasks
        .nest("/api", recurring_router(state.clone()))
        // Phase 3: Custom fields
        .nest("/api", custom_field_router(state.clone()))
        // Phase 3: Time tracking
        .nest("/api", time_entry_router(state.clone()))
        // Phase 4: Project templates
        .nest("/api", project_template_router(state.clone()))
        // Phase 4: Workflow automation
        .nest("/api", automation_router(state.clone()))
        // Phase 4: Import/export
        .nest("/api", import_export_router(state.clone()))
        // Phase 4: Client portal (board shares)
        .nest("/api", board_share_router(state.clone()))
        .nest("/api", shared_board_public_router())
        // Phase 4: Webhooks
        .nest("/api", webhook_router(state.clone()))
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
