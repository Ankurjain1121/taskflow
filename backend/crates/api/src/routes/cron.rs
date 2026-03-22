//! Cron endpoints for scheduled jobs
//!
//! These endpoints are designed to be called by an external scheduler (e.g., cron, Cloud Scheduler).
//! They are protected by a shared secret header, not user authentication.

use axum::{extract::State, http::HeaderMap, routing::post, Json, Router};
use serde::Serialize;
use std::env;

use crate::errors::{AppError, Result};
use crate::state::AppState;
use taskflow_db::queries::metrics::refresh_metrics;
use taskflow_db::queries::recurring_generation::{create_recurring_instance, get_due_configs};
use taskflow_services::broadcast::BroadcastService;
use taskflow_services::jobs::{
    cleanup_expired_trash, execute_scheduled_automations, scan_deadlines, send_weekly_digests,
    DeadlineScanResult, ScheduledAutomationResult, TrashCleanupResult, WeeklyDigestResult,
};
use taskflow_services::minio::{MinioConfig, MinioService};
use taskflow_services::notifications::{NotificationService, PostalClient};
use taskflow_services::novu::NovuClient;

/// Validate the X-Cron-Secret header
fn validate_cron_secret(headers: &HeaderMap) -> Result<()> {
    let expected_secret = env::var("CRON_SECRET").unwrap_or_else(|_| "".to_string());

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

/// GET /api/cron/deadline-scan
///
/// Scans for tasks approaching deadlines (within 24h) and overdue tasks.
/// Creates notifications for assignees.
///
/// Requires X-Cron-Secret header for authentication.
async fn deadline_scan_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<DeadlineScanResult>> {
    validate_cron_secret(&headers)?;

    let broadcast = BroadcastService::new(state.redis.clone());

    // Create Postal client if configured
    let postal_client = {
        let api_url = env::var("POSTAL_API_URL").ok();
        let api_key = env::var("POSTAL_API_KEY").ok();
        let from_address = env::var("POSTAL_FROM_ADDRESS").ok();
        let from_name = env::var("POSTAL_FROM_NAME").ok();
        match (api_url, api_key, from_address) {
            (Some(url), Some(key), Some(from)) if !url.is_empty() && !key.is_empty() => {
                Some(PostalClient::new(
                    url,
                    key,
                    from,
                    from_name.unwrap_or_else(|| "TaskFlow".to_string()),
                ))
            }
            _ => None,
        }
    };

    let notification_service = NotificationService::new(
        state.db.clone(),
        broadcast,
        postal_client,
        state.config.app_url.clone(),
    );

    // Create Novu client if configured
    let novu_api_url = env::var("NOVU_API_URL").ok();
    let novu_api_key = env::var("NOVU_API_KEY").ok();
    let novu_client = match (novu_api_url, novu_api_key) {
        (Some(url), Some(key)) if !url.is_empty() && !key.is_empty() => {
            Some(NovuClient::new(url, key))
        }
        _ => None,
    };

    let app_url = state.config.app_url.clone();

    let result = scan_deadlines(
        &state.db,
        &notification_service,
        novu_client.as_ref(),
        &app_url,
    )
    .await
    .map_err(|e| AppError::InternalError(format!("Deadline scan failed: {}", e)))?;

    Ok(Json(result))
}

/// GET /api/cron/weekly-digest
///
/// Sends weekly digest emails to users who have email notifications enabled.
/// Should be triggered weekly (e.g., Monday 9am).
///
/// Requires X-Cron-Secret header for authentication.
async fn weekly_digest_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<WeeklyDigestResult>> {
    validate_cron_secret(&headers)?;

    // Create Postal client
    let postal_api_url =
        env::var("POSTAL_API_URL").unwrap_or_else(|_| "http://localhost:5000".to_string());
    let postal_api_key = env::var("POSTAL_API_KEY").unwrap_or_else(|_| "".to_string());
    let postal_from_address =
        env::var("POSTAL_FROM_ADDRESS").unwrap_or_else(|_| "noreply@taskflow.local".to_string());
    let postal_from_name = env::var("POSTAL_FROM_NAME").unwrap_or_else(|_| "TaskFlow".to_string());

    let postal = PostalClient::new(
        postal_api_url,
        postal_api_key,
        postal_from_address,
        postal_from_name,
    );

    let app_url = state.config.app_url.clone();

    let result = send_weekly_digests(&state.db, &postal, &app_url)
        .await
        .map_err(|e| AppError::InternalError(format!("Weekly digest failed: {}", e)))?;

    Ok(Json(result))
}

/// GET /api/cron/trash-cleanup
///
/// Permanently deletes items that have been in trash for more than 30 days.
/// Should be triggered daily.
///
/// Requires X-Cron-Secret header for authentication.
async fn trash_cleanup_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<TrashCleanupResult>> {
    validate_cron_secret(&headers)?;

    let minio = MinioService::new(MinioConfig {
        endpoint: state.config.minio_endpoint.clone(),
        public_url: state.config.minio_public_url.clone(),
        access_key: state.config.minio_access_key.clone(),
        secret_key: state.config.minio_secret_key.clone(),
        bucket: state.config.minio_bucket.clone(),
    })
    .await;

    let result = cleanup_expired_trash(&state.db, &minio)
        .await
        .map_err(|e| AppError::InternalError(format!("Trash cleanup failed: {}", e)))?;

    Ok(Json(result))
}

/// Result of processing recurring tasks
#[derive(Serialize)]
pub struct RecurringTasksResult {
    pub processed: usize,
    pub created_tasks: Vec<String>,
    pub errors: Vec<String>,
}

/// POST /api/cron/recurring-tasks
///
/// Processes all due recurring task configs.
/// Creates new task instances for each due config.
///
/// Requires X-Cron-Secret header for authentication.
async fn process_recurring_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<RecurringTasksResult>> {
    validate_cron_secret(&headers)?;

    let configs = get_due_configs(&state.db)
        .await
        .map_err(|e| AppError::InternalError(format!("Failed to get due configs: {}", e)))?;

    let mut created_tasks = Vec::new();
    let mut errors = Vec::new();

    for config in &configs {
        match create_recurring_instance(&state.db, config).await {
            Ok(task_id) => {
                created_tasks.push(task_id.to_string());
            }
            Err(e) => {
                errors.push(format!("Config {}: {}", config.id, e));
            }
        }
    }

    Ok(Json(RecurringTasksResult {
        processed: configs.len(),
        created_tasks,
        errors,
    }))
}

/// POST /api/cron/execute-automations
///
/// Scans for tasks with due dates that have passed or are approaching,
/// then fires the corresponding time-based automation triggers.
/// Should be triggered every 15 minutes.
///
/// Requires X-Cron-Secret header for authentication.
async fn execute_automations_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<ScheduledAutomationResult>> {
    validate_cron_secret(&headers)?;

    let mut redis = state.redis.clone();

    let result = execute_scheduled_automations(&state.db, &mut redis)
        .await
        .map_err(|e| AppError::InternalError(format!("Automation execution failed: {}", e)))?;

    Ok(Json(result))
}

/// Result of refreshing metrics materialized views
#[derive(Serialize)]
pub struct MetricsRefreshResult {
    pub refreshed: bool,
    pub message: String,
}

/// POST /api/cron/refresh-metrics
///
/// Refreshes all metrics materialized views (cycle time, velocity, workload).
/// Should be triggered every 15-30 minutes.
///
/// Requires X-Cron-Secret header for authentication.
async fn refresh_metrics_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<MetricsRefreshResult>> {
    validate_cron_secret(&headers)?;

    refresh_metrics(&state.db)
        .await
        .map_err(|e| AppError::InternalError(format!("Metrics refresh failed: {}", e)))?;

    Ok(Json(MetricsRefreshResult {
        refreshed: true,
        message: "All metrics materialized views refreshed".to_string(),
    }))
}

/// Response for health check
#[derive(Serialize)]
struct CronHealthResponse {
    status: &'static str,
    endpoints: Vec<&'static str>,
}

/// GET /api/cron/health
///
/// Health check for cron system. Requires X-Cron-Secret header.
async fn cron_health(headers: HeaderMap) -> Result<Json<CronHealthResponse>> {
    validate_cron_secret(&headers)?;

    Ok(Json(CronHealthResponse {
        status: "ok",
        endpoints: vec![
            "/api/cron/deadline-scan",
            "/api/cron/weekly-digest",
            "/api/cron/trash-cleanup",
            "/api/cron/recurring-tasks",
            "/api/cron/execute-automations",
            "/api/cron/refresh-metrics",
        ],
    }))
}

/// Create the cron router
///
/// NOTE: These routes do NOT use auth_middleware.
/// They use X-Cron-Secret header validation instead.
pub fn cron_router() -> Router<AppState> {
    Router::new()
        .route("/cron/health", post(cron_health))
        .route("/cron/deadline-scan", post(deadline_scan_handler))
        .route("/cron/weekly-digest", post(weekly_digest_handler))
        .route("/cron/trash-cleanup", post(trash_cleanup_handler))
        .route("/cron/recurring-tasks", post(process_recurring_handler))
        .route(
            "/cron/execute-automations",
            post(execute_automations_handler),
        )
        .route("/cron/refresh-metrics", post(refresh_metrics_handler))
}
