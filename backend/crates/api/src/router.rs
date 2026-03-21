use std::time::Duration;

use axum::extract::DefaultBodyLimit;
use axum::http::header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE};
use axum::http::Method;
use axum::middleware::{from_fn, from_fn_with_state};
use axum::{routing::get, Router};
use tower_http::compression::CompressionLayer;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::timeout::TimeoutLayer;
use tower_http::trace::TraceLayer;

use crate::config::Config;
use crate::middleware::cache_headers_middleware;
use crate::middleware::metrics_middleware;
use crate::middleware::rate_limit::{
    rate_limit_layer, rate_limit_middleware, user_rate_limit_layer, user_rate_limit_middleware,
};
use crate::middleware::request_id::request_id_middleware;
use crate::middleware::security_headers_middleware;
use crate::middleware::{audit_middleware, auth_middleware, csrf_middleware};
use crate::routes::project_visibility_router;
use crate::routes::{
    activity_log_router, admin_audit_router, admin_trash_router, admin_users_router,
    archive_router, attachment_router, automation_router, automation_templates_router,
    batch_my_tasks_router, board_columns_router, board_positions_router, bulk_ops_router,
    charts_router, column_router, comment_router, cron_router, custom_field_router,
    dashboard_router, dependency_router, eisenhower_router, favorites_router,
    filter_presets_router, health_handler, liveness_handler, milestone_router, my_tasks_router,
    notification_preferences_router, notification_router, onboarding_router, personal_board_router,
    positions_router, project_router, project_share_router, project_template_router,
    project_templates_router, readiness_handler, recent_items_router, recurring_router,
    reports_router, saved_views_router, search_router, sessions_router,
    shared_project_public_router, subtask_router, task_group_routes, task_labels_router,
    task_router, task_snooze_router, task_template_router, team_overview_router, teams_router,
    tenant_router, time_entry_router, upload_router, user_preferences_router, webhook_router,
    workspace_api_keys_router, workspace_audit_router, workspace_export_router,
    workspace_job_roles_router, workspace_labels_router, workspace_projects_router,
    workspace_roles_router, workspace_router, workspace_tasks_router, workspace_teams_router,
    workspace_trash_router,
};
use crate::routes::{metrics_cron_router, metrics_router, portfolio_router, prometheus_router};
use crate::state::AppState;
use crate::ws::ws_handler;

pub fn build_router(state: AppState, config: &Config) -> Router {
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
        .allow_headers([
            AUTHORIZATION,
            ACCEPT,
            CONTENT_TYPE,
            axum::http::HeaderName::from_static("x-csrf-token"),
        ])
        .allow_credentials(true);

    // Build protected routes (require auth)
    let protected_routes = Router::new()
        .route(
            "/auth/sign-out",
            axum::routing::post(crate::routes::auth::sign_out_handler),
        )
        .route(
            "/auth/me",
            get(crate::routes::auth_profile::me_handler)
                .patch(crate::routes::auth_profile::update_profile_handler)
                .delete(crate::routes::auth_password::delete_account_handler),
        )
        .route(
            "/auth/change-password",
            axum::routing::post(crate::routes::auth_password::change_password_handler),
        )
        .route(
            "/auth/2fa/setup",
            axum::routing::post(crate::routes::totp::setup_handler),
        )
        .route(
            "/auth/2fa/verify",
            axum::routing::post(crate::routes::totp::verify_handler),
        )
        .route(
            "/auth/2fa/disable",
            axum::routing::post(crate::routes::totp::disable_handler),
        )
        .route(
            "/auth/2fa/status",
            axum::routing::get(crate::routes::totp::status_handler),
        )
        .route(
            "/invitations",
            axum::routing::post(crate::routes::invitation::create_handler),
        )
        .route(
            "/invitations",
            get(crate::routes::invitation::list_handler),
        )
        .route(
            "/invitations/bulk",
            axum::routing::post(crate::routes::invitation::bulk_create_handler),
        )
        .route(
            "/invitations/all",
            get(crate::routes::invitation::list_all_handler),
        )
        .route(
            "/invitations/{id}",
            axum::routing::delete(crate::routes::invitation::delete_handler),
        )
        .route(
            "/invitations/{id}/resend",
            axum::routing::post(crate::routes::invitation::resend_handler),
        )
        .route(
            "/health/detailed",
            get(crate::routes::detailed_health_handler),
        )
        .layer(from_fn_with_state(state.clone(), audit_middleware))
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware));

    // Rate-limited public routes (auth endpoints vulnerable to brute force)
    let rate_limited_auth = Router::new()
        .route(
            "/auth/sign-in",
            axum::routing::post(crate::routes::auth::sign_in_handler),
        )
        .route(
            "/auth/sign-up",
            axum::routing::post(crate::routes::auth::sign_up_handler),
        )
        .route(
            "/auth/forgot-password",
            axum::routing::post(crate::routes::auth_password::forgot_password_handler),
        )
        .route(
            "/auth/reset-password",
            axum::routing::post(crate::routes::auth_password::reset_password_handler),
        )
        .route(
            "/auth/2fa/challenge",
            axum::routing::post(crate::routes::totp::challenge_handler),
        )
        .layer(from_fn(rate_limit_middleware))
        .layer(rate_limit_layer(state.redis.clone(), 20, 60)); // 20 requests per 60 seconds per IP

    let rate_limited_invitations = Router::new()
        .route(
            "/invitations/accept",
            axum::routing::post(crate::routes::invitation::accept_handler),
        )
        .layer(from_fn(rate_limit_middleware))
        .layer(rate_limit_layer(state.redis.clone(), 5, 60)); // 5 requests per 60 seconds per IP

    // Rate-limited refresh/logout (30 req/60s per IP)
    let rate_limited_refresh = Router::new()
        .route(
            "/auth/refresh",
            axum::routing::post(crate::routes::auth::refresh_handler),
        )
        .route(
            "/auth/logout",
            axum::routing::post(crate::routes::auth::logout_handler),
        )
        .layer(from_fn(rate_limit_middleware))
        .layer(rate_limit_layer(state.redis.clone(), 30, 60)); // 30 req/60s per IP

    // Build public routes (no rate limiting beyond global)
    let public_routes = Router::new()
        .route(
            "/invitations/validate/{token}",
            get(crate::routes::invitation::validate_handler),
        )
        .route("/ws", get(ws_handler));

    // Build router
    Router::new()
        // Health check routes (no auth required)
        .route("/api/health", get(health_handler))
        .route("/api/health/live", get(liveness_handler))
        .route("/api/health/ready", get(readiness_handler))
        .nest("/api", protected_routes)
        .nest("/api", rate_limited_auth)
        .nest("/api", rate_limited_invitations)
        .nest("/api", rate_limited_refresh)
        .nest("/api", public_routes)
        .nest("/api", task_router(state.clone()))
        .nest("/api", task_labels_router(state.clone()))
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
        .nest("/api/workspaces", portfolio_router(state.clone()))
        .nest(
            "/api/workspaces/{workspace_id}/projects",
            workspace_projects_router(state.clone()),
        )
        // Workspace permission roles routes (custom RBAC roles)
        .nest(
            "/api/workspaces/{workspace_id}/permission-roles",
            workspace_roles_router(state.clone()),
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
        // Filter presets (per-user per-project)
        .nest(
            "/api/projects/{board_id}/filter-presets",
            filter_presets_router(state.clone()),
        )
        // Position routes (project-scoped)
        .nest(
            "/api/projects/{board_id}/positions",
            board_positions_router(state.clone()),
        )
        // Position routes (direct)
        .nest("/api/positions", positions_router(state.clone()))
        // Project routes
        .nest(
            "/api/project-blueprints",
            project_templates_router(state.clone()),
        )
        .nest("/api/projects", project_router(state.clone()))
        .nest(
            "/api/projects/{project_id}/visibility",
            project_visibility_router(state.clone()),
        )
        .nest(
            "/api/projects/{board_id}/columns",
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
        // Prometheus scrape endpoint (uses X-Cron-Secret)
        .nest("/api", prometheus_router())
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
        // Charts routes (burndown/burnup)
        .nest("/api", charts_router(state.clone()))
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
        .nest(
            "/api",
            automation_router(state.clone())
                .layer(from_fn(user_rate_limit_middleware))
                .layer(user_rate_limit_layer(state.redis.clone(), 20, 60)),
        )
        // Automation templates (Phase J)
        .nest("/api", automation_templates_router(state.clone()))
        // Bulk operations with undo (Phase J)
        .nest(
            "/api",
            bulk_ops_router(state.clone())
                .layer(from_fn(user_rate_limit_middleware))
                .layer(user_rate_limit_layer(state.redis.clone(), 10, 60)),
        )
        // Task templates
        .nest("/api", task_template_router(state.clone()))
        // Phase 4: Import/export (stricter rate limit: 10 req/min)
        .nest(
            "/api",
            crate::routes::export::export_router(state.clone())
                .layer(TimeoutLayer::with_status_code(
                    axum::http::StatusCode::REQUEST_TIMEOUT,
                    Duration::from_secs(120),
                ))
                .layer(from_fn(rate_limit_middleware))
                .layer(rate_limit_layer(state.redis.clone(), 10, 60)),
        )
        .nest(
            "/api",
            crate::routes::import::import_router(state.clone())
                .layer(DefaultBodyLimit::max(50 * 1024 * 1024))
                .layer(TimeoutLayer::with_status_code(
                    axum::http::StatusCode::REQUEST_TIMEOUT,
                    Duration::from_secs(120),
                ))
                .layer(from_fn(rate_limit_middleware))
                .layer(rate_limit_layer(state.redis.clone(), 10, 60)),
        )
        // Phase 4: Client portal (project shares)
        .nest("/api", project_share_router(state.clone()))
        .nest("/api", shared_project_public_router())
        // Phase 4: Webhooks
        .nest("/api", webhook_router(state.clone()))
        // Settings & Teams: User preferences, sessions, uploads, API keys
        .nest("/api", user_preferences_router(state.clone()))
        .nest("/api", sessions_router(state.clone()))
        .nest("/api", upload_router(state.clone()))
        .nest("/api", workspace_api_keys_router(state.clone()))
        // Phase 5: Favorites & Archive
        .nest("/api/favorites", favorites_router(state.clone()))
        .nest("/api", archive_router(state.clone()))
        // Unified Phase 2: New routes
        .nest("/api", saved_views_router(state.clone()))
        .nest("/api", workspace_tasks_router(state.clone()))
        .nest("/api", personal_board_router(state.clone()))
        .nest("/api", task_snooze_router(state.clone()))
        .nest("/api", batch_my_tasks_router(state.clone()))
        // Per-user rate limit (300 req/min per authenticated user)
        .layer(from_fn(user_rate_limit_middleware))
        .layer(user_rate_limit_layer(state.redis.clone(), 300, 60))
        // Global rate limit on all routes (200 req/min per IP — SPA makes ~15 calls per page)
        .layer(from_fn(rate_limit_middleware))
        .layer(rate_limit_layer(state.redis.clone(), 200, 60))
        // HTTP caching headers (Cache-Control)
        .layer(from_fn(cache_headers_middleware))
        .layer(from_fn(security_headers_middleware))
        .layer(from_fn(metrics_middleware))
        .layer(TraceLayer::new_for_http())
        .layer(from_fn(request_id_middleware))
        .layer(sentry_tower::NewSentryLayer::new_from_top())
        .layer(sentry_tower::SentryHttpLayer::new().enable_transaction())
        .layer(DefaultBodyLimit::max(10 * 1024 * 1024))
        .layer(TimeoutLayer::with_status_code(
            axum::http::StatusCode::REQUEST_TIMEOUT,
            Duration::from_secs(30),
        ))
        .layer(CompressionLayer::new())
        .layer(cors)
        .with_state(state)
}
