//! Test helpers for API integration tests
//!
//! Provides utilities to build a fully wired test application,
//! generate JWT tokens, and set up test data.

#[cfg(test)]
pub mod helpers {
    use std::sync::Arc;

    use axum::http::header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE};
    use axum::http::Method;
    use axum::middleware::from_fn_with_state;
    use axum::{routing::get, Router};
    use dashmap::DashMap;
    use sqlx::PgPool;
    use tower_http::cors::{AllowOrigin, CorsLayer};
    use uuid::Uuid;

    use taskflow_auth::jwt::{issue_tokens, JwtKeys};
    use taskflow_db::models::UserRole;

    use crate::config::Config;
    use crate::middleware::auth_middleware;
    use crate::routes;
    use crate::state::AppState;

    /// Database URL for tests (same as DB integration tests).
    const TEST_DB_URL: &str =
        "postgresql://taskflow:REDACTED_PG_PASSWORD@localhost:5433/taskflow";

    /// A dummy argon2 hash used for test user passwords.
    pub const FAKE_HASH: &str = "$argon2id$v=19$m=19456,t=2,p=1$fake_salt$fake_hash_for_test";

    /// Build a test `Config` with sensible defaults that do NOT read env vars.
    pub fn test_config() -> Config {
        Config {
            app_database_url: TEST_DB_URL.to_string(),
            host: "127.0.0.1".to_string(),
            port: 0,
            jwt_secret: "test-jwt-secret-that-is-long-enough-for-hs256-validation".to_string(),
            jwt_refresh_secret: "test-jwt-refresh-secret-long-enough-for-hs256-validation"
                .to_string(),
            jwt_access_expiry_secs: 900,
            jwt_refresh_expiry_secs: 604_800,
            jwt_rsa_private_key: None,
            jwt_rsa_public_key: None,
            redis_url: "redis://localhost:6380".to_string(),
            minio_endpoint: "http://localhost:9000".to_string(),
            minio_public_url: "http://localhost:9000".to_string(),
            minio_access_key: "REDACTED_MINIO_ACCESS_KEY".to_string(),
            minio_secret_key: "REDACTED_MINIO_SECRET_KEY"
                .to_string(),
            minio_bucket: "task-attachments".to_string(),
            postal_api_url: "http://localhost:5000".to_string(),
            postal_api_key: String::new(),
            postal_from_address: "noreply@test.local".to_string(),
            postal_from_name: "TaskFlow".to_string(),
            novu_api_url: "http://localhost:3000".to_string(),
            novu_api_key: String::new(),
            lago_api_url: "http://localhost:3000".to_string(),
            lago_api_key: String::new(),
            waha_api_url: "http://localhost:3000".to_string(),
            waha_api_key: String::new(),
            app_url: "http://localhost:4200".to_string(),
        }
    }

    /// Connect to the test database pool.
    pub async fn test_pool() -> PgPool {
        PgPool::connect(TEST_DB_URL)
            .await
            .expect("Failed to connect to test database")
    }

    /// Build a real `AppState` backed by the test database and Redis.
    pub async fn test_app_state() -> AppState {
        let config = test_config();
        let db = test_pool().await;

        // Connect to Redis
        let redis_client =
            redis::Client::open(config.redis_url.as_str()).expect("Invalid Redis URL for test");
        let redis = redis_client
            .get_connection_manager()
            .await
            .expect("Failed to connect to Redis in test");

        // Build JWT keys (HS256 for tests)
        let jwt_keys = Arc::new(
            JwtKeys::from_config(&config.jwt_secret, &config.jwt_refresh_secret, None, None)
                .expect("Failed to create JWT keys"),
        );

        // Build a minimal S3 client (tests that need real S3 should be skipped)
        let s3_config = aws_sdk_s3::config::Builder::new()
            .endpoint_url(&config.minio_endpoint)
            .region(aws_sdk_s3::config::Region::new("us-east-1"))
            .credentials_provider(aws_sdk_s3::config::Credentials::new(
                &config.minio_access_key,
                &config.minio_secret_key,
                None,
                None,
                "minio-test",
            ))
            .force_path_style(true)
            .build();
        let s3_client = aws_sdk_s3::Client::from_conf(s3_config);

        let board_channels = Arc::new(DashMap::new());

        AppState {
            db,
            config: Arc::new(config),
            jwt_keys,
            redis,
            board_channels,
            s3_client,
        }
    }

    /// Generate a valid JWT access token for testing.
    pub fn test_jwt_token(state: &AppState, user_id: Uuid, tenant_id: Uuid) -> String {
        test_jwt_token_with_role(state, user_id, tenant_id, UserRole::Admin)
    }

    /// Generate a valid JWT access token with a specific role.
    pub fn test_jwt_token_with_role(
        state: &AppState,
        user_id: Uuid,
        tenant_id: Uuid,
        role: UserRole,
    ) -> String {
        let token_id = Uuid::new_v4();
        let pair = issue_tokens(
            user_id,
            tenant_id,
            role,
            token_id,
            &state.jwt_keys,
            state.config.jwt_access_expiry_secs,
            state.config.jwt_refresh_expiry_secs,
        )
        .expect("Failed to issue test JWT tokens");
        pair.access_token
    }

    /// Unique email to avoid test collisions.
    pub fn unique_email() -> String {
        format!("api-inttest-{}@example.com", Uuid::new_v4())
    }

    /// Create a test user with tenant. Returns (tenant_id, user_id).
    pub async fn setup_user(pool: &PgPool) -> (Uuid, Uuid) {
        let email = unique_email();
        let user = taskflow_db::queries::auth::create_user_with_tenant(
            pool,
            &email,
            "API IntTest User",
            FAKE_HASH,
        )
        .await
        .expect("Failed to create test user");
        (user.tenant_id, user.id)
    }

    /// Create user + workspace. Returns (tenant_id, user_id, workspace_id).
    pub async fn setup_user_and_workspace(pool: &PgPool) -> (Uuid, Uuid, Uuid) {
        let (tenant_id, user_id) = setup_user(pool).await;
        let ws = taskflow_db::queries::workspaces::create_workspace(
            pool,
            "API IntTest WS",
            None,
            tenant_id,
            user_id,
        )
        .await
        .expect("Failed to create test workspace");
        (tenant_id, user_id, ws.id)
    }

    /// Create user + workspace + board.
    /// Returns (tenant_id, user_id, workspace_id, board_id, first_column_id).
    pub async fn setup_full(pool: &PgPool) -> (Uuid, Uuid, Uuid, Uuid, Uuid) {
        let (tenant_id, user_id, ws_id) = setup_user_and_workspace(pool).await;
        let bwc = taskflow_db::queries::boards::create_board(
            pool,
            "API IntTest Board",
            None,
            ws_id,
            tenant_id,
            user_id,
        )
        .await
        .expect("Failed to create test board");
        let first_col_id = bwc.columns[0].id;
        (tenant_id, user_id, ws_id, bwc.board.id, first_col_id)
    }

    /// Build the full Axum Router matching the production app (minus background jobs).
    /// Returns `(Router, AppState)`.
    pub async fn test_app() -> (Router, AppState) {
        let state = test_app_state().await;
        let app = build_test_router(state.clone());
        (app, state)
    }

    /// Build the router without creating a new AppState.
    pub fn build_test_router(state: AppState) -> Router {
        let allowed_origin = state
            .config
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

        // Protected routes (require auth)
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

        // Public routes (no rate limiting for tests)
        let public_routes = Router::new()
            .route(
                "/auth/sign-in",
                axum::routing::post(routes::auth::sign_in_handler),
            )
            .route(
                "/auth/sign-up",
                axum::routing::post(routes::auth::sign_up_handler),
            )
            .route(
                "/auth/refresh",
                axum::routing::post(routes::auth::refresh_handler),
            )
            .route(
                "/auth/logout",
                axum::routing::post(routes::auth::logout_handler),
            )
            .route(
                "/auth/forgot-password",
                axum::routing::post(routes::auth_password::forgot_password_handler),
            )
            .route(
                "/auth/reset-password",
                axum::routing::post(routes::auth_password::reset_password_handler),
            )
            .route(
                "/invitations/accept",
                axum::routing::post(routes::invitation::accept_handler),
            )
            .route(
                "/invitations/validate/{token}",
                get(routes::invitation::validate_handler),
            );

        Router::new()
            // Health routes
            .route("/api/health", get(routes::health_handler))
            .route("/api/health/live", get(routes::liveness_handler))
            .route("/api/health/ready", get(routes::readiness_handler))
            .nest("/api", protected_routes)
            .nest("/api", public_routes)
            // Feature routers
            .nest("/api", routes::task_router(state.clone()))
            .nest("/api", routes::subtask_router(state.clone()))
            .nest("/api", routes::task_group_routes(state.clone()))
            .nest("/api", routes::dependency_router(state.clone()))
            .nest("/api", routes::milestone_router(state.clone()))
            .nest("/api", routes::attachment_router(state.clone()))
            .nest("/api", routes::comment_router(state.clone()))
            .nest("/api", routes::activity_log_router(state.clone()))
            .nest("/api/workspaces", routes::workspace_router(state.clone()))
            .nest(
                "/api/workspaces/{workspace_id}/boards",
                routes::workspace_boards_router(state.clone()),
            )
            .nest(
                "/api/board-templates",
                routes::board_templates_router(state.clone()),
            )
            .nest("/api/boards", routes::board_router(state.clone()))
            .nest(
                "/api/boards/{board_id}/columns",
                routes::board_columns_router(state.clone()),
            )
            .nest("/api/columns", routes::column_router(state.clone()))
            .nest("/api", routes::notification_router(state.clone()))
            .nest(
                "/api",
                routes::notification_preferences_router(state.clone()),
            )
            .nest("/api", routes::cron_router())
            .nest("/api/onboarding", routes::onboarding_router(state.clone()))
            .nest(
                "/api/workspaces/{workspace_id}",
                routes::team_overview_router(state.clone()),
            )
            .nest("/api/my-tasks", routes::my_tasks_router(state.clone()))
            .nest("/api/eisenhower", routes::eisenhower_router(state.clone()))
            .nest("/api/dashboard", routes::dashboard_router(state.clone()))
            .nest("/api", routes::admin_audit_router(state.clone()))
            .nest("/api", routes::admin_users_router(state.clone()))
            .nest("/api", routes::admin_trash_router(state.clone()))
            .nest("/api", routes::reports_router(state.clone()))
            .nest("/api", routes::search_router(state.clone()))
            .nest("/api", routes::recurring_router(state.clone()))
            .nest("/api", routes::custom_field_router(state.clone()))
            .nest("/api", routes::time_entry_router(state.clone()))
            .nest("/api", routes::project_template_router(state.clone()))
            .nest("/api", routes::automation_router(state.clone()))
            .nest("/api", routes::task_template_router(state.clone()))
            .nest("/api", routes::export::export_router(state.clone()))
            .nest("/api", routes::import::import_router(state.clone()))
            .nest("/api", routes::board_share_router(state.clone()))
            .nest("/api", routes::shared_board_public_router())
            .nest("/api", routes::webhook_router(state.clone()))
            .nest("/api", routes::themes_router(state.clone()))
            .nest("/api", routes::user_preferences_router(state.clone()))
            .nest("/api", routes::sessions_router(state.clone()))
            .nest("/api", routes::upload_router(state.clone()))
            .nest("/api", routes::workspace_api_keys_router(state.clone()))
            .nest("/api/favorites", routes::favorites_router(state.clone()))
            .nest("/api", routes::archive_router(state.clone()))
            // Position routes
            .nest(
                "/api/boards/{board_id}/positions",
                routes::board_positions_router(state.clone()),
            )
            .nest("/api/positions", routes::positions_router(state.clone()))
            .layer(cors)
            .with_state(state)
    }
}
