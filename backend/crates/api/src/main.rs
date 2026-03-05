mod config;
mod errors;
pub mod extractors;
pub mod middleware;
pub mod routes;
pub mod services;
mod state;
#[cfg(test)]
mod test_helpers;
pub mod ws;

use std::time::Duration;

use axum::http::header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE};
use axum::http::Method;
use axum::middleware::{from_fn, from_fn_with_state};
use axum::{routing::get, Router};
use tower_http::compression::CompressionLayer;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;

use crate::config::Config;
use crate::middleware::auth_middleware;
use crate::middleware::cache_headers_middleware;
use crate::middleware::rate_limit::{
    rate_limit_layer, rate_limit_middleware, user_rate_limit_layer, user_rate_limit_middleware,
};
use crate::middleware::request_id::request_id_middleware;
use crate::routes::{
    activity_log_router, admin_audit_router, admin_trash_router, admin_users_router,
    archive_router, attachment_router, automation_router, automation_templates_router,
    board_columns_router, board_positions_router, board_router, board_share_router,
    board_templates_router, bulk_ops_router, column_router, comment_router, cron_router,
    custom_field_router, dashboard_router, dependency_router, eisenhower_router, favorites_router,
    filter_presets_router, health_handler, liveness_handler, milestone_router, my_tasks_router,
    notification_preferences_router, notification_router, onboarding_router, positions_router,
    project_template_router, readiness_handler, recent_items_router, recurring_router,
    reports_router, search_router, sessions_router, shared_board_public_router, subtask_router,
    task_group_routes, task_router, task_template_router, team_overview_router, teams_router,
    tenant_router, themes_router, time_entry_router, upload_router, user_preferences_router,
    webhook_router, workspace_api_keys_router, workspace_audit_router, workspace_boards_router,
    workspace_export_router, workspace_job_roles_router, workspace_labels_router, workspace_router,
    workspace_teams_router, workspace_trash_router,
};
use crate::routes::{metrics_cron_router, metrics_router};
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
    let allowed_origin = config
        .app_url
        .parse::<axum::http::HeaderValue>()
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
        .route(
            "/auth/sign-out",
            axum::routing::post(routes::auth::sign_out_handler),
        )
        .route(
            "/auth/me",
            get(routes::auth_profile::me_handler)
                .patch(routes::auth_profile::update_profile_handler)
                .delete(routes::auth_password::delete_account_handler),
        )
        .route(
            "/auth/change-password",
            axum::routing::post(routes::auth_password::change_password_handler),
        )
        .route(
            "/invitations",
            axum::routing::post(routes::invitation::create_handler),
        )
        .route("/invitations", get(routes::invitation::list_handler))
        .route(
            "/invitations/bulk",
            axum::routing::post(routes::invitation::bulk_create_handler),
        )
        .route(
            "/invitations/all",
            get(routes::invitation::list_all_handler),
        )
        .route(
            "/invitations/{id}",
            axum::routing::delete(routes::invitation::delete_handler),
        )
        .route(
            "/invitations/{id}/resend",
            axum::routing::post(routes::invitation::resend_handler),
        )
        .layer(from_fn_with_state(state.clone(), auth_middleware));

    // Rate-limited public routes (auth endpoints vulnerable to brute force)
    let rate_limited_auth = Router::new()
        .route(
            "/auth/sign-in",
            axum::routing::post(routes::auth::sign_in_handler),
        )
        .route(
            "/auth/sign-up",
            axum::routing::post(routes::auth::sign_up_handler),
        )
        .route(
            "/auth/forgot-password",
            axum::routing::post(routes::auth_password::forgot_password_handler),
        )
        .layer(from_fn(rate_limit_middleware))
        .layer(rate_limit_layer(5, 60)); // 5 requests per 60 seconds per IP

    let rate_limited_invitations = Router::new()
        .route(
            "/invitations/accept",
            axum::routing::post(routes::invitation::accept_handler),
        )
        .layer(from_fn(rate_limit_middleware))
        .layer(rate_limit_layer(5, 60)); // 5 requests per 60 seconds per IP

    // Build public routes (not rate-limited)
    let public_routes = Router::new()
        .route(
            "/auth/refresh",
            axum::routing::post(routes::auth::refresh_handler),
        )
        .route(
            "/auth/logout",
            axum::routing::post(routes::auth::logout_handler),
        )
        .route(
            "/auth/reset-password",
            axum::routing::post(routes::auth_password::reset_password_handler),
        )
        .route(
            "/invitations/validate/{token}",
            get(routes::invitation::validate_handler),
        )
        .route("/ws", get(ws_handler));

    // Build router
    let app = Router::new()
        // Health check routes (no auth required)
        .route("/api/health", get(health_handler))
        .route("/api/health/live", get(liveness_handler))
        .route("/api/health/ready", get(readiness_handler))
        .route("/api/health/detailed", get(routes::detailed_health_handler))
        .nest("/api", protected_routes)
        .nest("/api", rate_limited_auth)
        .nest("/api", rate_limited_invitations)
        .nest("/api", public_routes)
        .nest("/api", task_router(state.clone()))
        .nest("/api", subtask_router(state.clone()))
        .nest("/api", task_group_routes(state.clone()))
        .nest("/api", dependency_router(state.clone()))
        .nest("/api", milestone_router(state.clone()))
        .nest("/api", attachment_router(state.clone()))
        // Comment routes
        .nest("/api", comment_router(state.clone()))
        // Activity log routes
        .nest("/api", activity_log_router(state.clone()))
        // Tenant routes (org-level)
        .nest("/api/tenant", tenant_router(state.clone()))
        // Workspace routes
        .nest("/api/workspaces", workspace_router(state.clone()))
        .nest("/api/workspaces", workspace_job_roles_router(state.clone()))
        .nest(
            "/api/workspaces/{workspace_id}/boards",
            workspace_boards_router(state.clone()),
        )
        // Workspace labels routes
        .nest(
            "/api/workspaces/{workspace_id}/labels",
            workspace_labels_router(state.clone()),
        )
        // Workspace audit log routes
        .nest(
            "/api/workspaces/{workspace_id}",
            workspace_audit_router(state.clone()),
        )
        // Workspace trash routes
        .nest(
            "/api/workspaces/{workspace_id}",
            workspace_trash_router(state.clone()),
        )
        // Workspace export routes
        .nest(
            "/api/workspaces/{workspace_id}",
            workspace_export_router(state.clone()),
        )
        // Team routes (workspace-scoped)
        .nest(
            "/api/workspaces/{workspace_id}/teams",
            workspace_teams_router(state.clone()),
        )
        // Team routes (direct)
        .nest("/api/teams", teams_router(state.clone()))
        // Filter presets (per-user per-board)
        .nest(
            "/api/boards/{board_id}/filter-presets",
            filter_presets_router(state.clone()),
        )
        // Position routes (board-scoped)
        .nest(
            "/api/boards/{board_id}/positions",
            board_positions_router(state.clone()),
        )
        // Position routes (direct)
        .nest("/api/positions", positions_router(state.clone()))
        // Board routes
        .nest(
            "/api/board-templates",
            board_templates_router(state.clone()),
        )
        .nest("/api/boards", board_router(state.clone()))
        .nest(
            "/api/boards/{board_id}/columns",
            board_columns_router(state.clone()),
        )
        // Column routes
        .nest("/api/columns", column_router(state.clone()))
        // Notification routes
        .nest("/api", notification_router(state.clone()))
        .nest("/api", notification_preferences_router(state.clone()))
        // Cron routes (no auth middleware - uses X-Cron-Secret)
        .nest("/api", cron_router())
        .nest("/api", metrics_cron_router())
        // Metrics routes (auth required)
        .nest("/api", metrics_router(state.clone()))
        // Onboarding routes
        .nest("/api/onboarding", onboarding_router(state.clone()))
        // Team overview routes (nested under workspace)
        .nest(
            "/api/workspaces/{workspace_id}",
            team_overview_router(state.clone()),
        )
        // My tasks routes
        .nest("/api/my-tasks", my_tasks_router(state.clone()))
        // Eisenhower Matrix routes
        .nest("/api/eisenhower", eisenhower_router(state.clone()))
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
        // Recent items routes
        .nest("/api", recent_items_router(state.clone()))
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
        // Automation templates (Phase J)
        .nest("/api", automation_templates_router(state.clone()))
        // Bulk operations with undo (Phase J)
        .nest("/api", bulk_ops_router(state.clone()))
        // Task templates
        .nest("/api", task_template_router(state.clone()))
        // Phase 4: Import/export (stricter rate limit: 10 req/min)
        .nest(
            "/api",
            routes::export::export_router(state.clone())
                .layer(from_fn(rate_limit_middleware))
                .layer(rate_limit_layer(10, 60)),
        )
        .nest(
            "/api",
            routes::import::import_router(state.clone())
                .layer(from_fn(rate_limit_middleware))
                .layer(rate_limit_layer(10, 60)),
        )
        // Phase 4: Client portal (board shares)
        .nest("/api", board_share_router(state.clone()))
        .nest("/api", shared_board_public_router())
        // Phase 4: Webhooks
        .nest("/api", webhook_router(state.clone()))
        // Themes (public)
        .nest("/api", themes_router(state.clone()))
        // Settings & Teams: User preferences, sessions, uploads, API keys
        .nest("/api", user_preferences_router(state.clone()))
        .nest("/api", sessions_router(state.clone()))
        .nest("/api", upload_router(state.clone()))
        .nest("/api", workspace_api_keys_router(state.clone()))
        // Phase 5: Favorites & Archive
        .nest("/api/favorites", favorites_router(state.clone()))
        .nest("/api", archive_router(state.clone()))
        // Per-user rate limit (100 req/min per authenticated user)
        .layer(from_fn(user_rate_limit_middleware))
        .layer(user_rate_limit_layer(100, 60))
        // Global rate limit on all routes (60 req/min per IP)
        .layer(from_fn(rate_limit_middleware))
        .layer(rate_limit_layer(60, 60))
        // HTTP caching headers (Cache-Control)
        .layer(from_fn(cache_headers_middleware))
        .layer(TraceLayer::new_for_http())
        .layer(from_fn(request_id_middleware))
        .layer(CompressionLayer::new())
        .layer(cors)
        .with_state(state.clone());

    // Spawn background job: recurring task scheduler (every 10 minutes)
    let recurring_pool = state.db.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(600));
        // Skip the first immediate tick to let the server finish starting
        interval.tick().await;
        tracing::info!("Recurring task scheduler started (interval: 10 min)");
        loop {
            interval.tick().await;
            match taskflow_db::queries::recurring::get_due_configs(&recurring_pool).await {
                Ok(configs) => {
                    if configs.is_empty() {
                        tracing::debug!("Recurring scheduler: no configs due");
                        continue;
                    }
                    let total = configs.len();
                    let mut created = 0usize;
                    let mut errors = 0usize;
                    for config in &configs {
                        match taskflow_db::queries::recurring::create_recurring_instance(
                            &recurring_pool,
                            config,
                        )
                        .await
                        {
                            Ok(_) => created += 1,
                            Err(e) => {
                                tracing::error!(
                                    config_id = %config.id,
                                    "Recurring instance creation failed: {e}"
                                );
                                errors += 1;
                            }
                        }
                    }
                    tracing::info!(total, created, errors, "Recurring scheduler tick completed");
                }
                Err(e) => {
                    tracing::error!("Recurring scheduler: failed to fetch due configs: {e}");
                }
            }
        }
    });

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
