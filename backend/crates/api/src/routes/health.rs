//! Health check endpoint for monitoring service status
//!
//! Provides comprehensive health checks for all external dependencies:
//! - PostgreSQL database
//! - Redis cache
//! - MinIO object storage
//! - Novu notification service
//! - Lago billing service

use axum::{extract::State, http::StatusCode, Json};
use chrono::{DateTime, Utc};
use serde::Serialize;
use std::time::Duration;
use tokio::time::timeout;

use crate::state::AppState;

/// Timeout for individual service health checks (5 seconds)
const HEALTH_CHECK_TIMEOUT: Duration = Duration::from_secs(5);

/// Overall health status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum HealthStatus {
    /// All services are operational
    Healthy,
    /// One or more services are down, but core functionality may work
    Degraded,
}

/// Individual service status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ServiceStatus {
    Up,
    Down,
}

/// Status of all external services
#[derive(Debug, Clone, Serialize)]
pub struct ServiceStatuses {
    pub postgres: ServiceStatus,
    pub redis: ServiceStatus,
    pub minio: ServiceStatus,
    pub novu: ServiceStatus,
    pub lago: ServiceStatus,
}

/// Health check response
#[derive(Debug, Clone, Serialize)]
pub struct HealthResponse {
    pub status: HealthStatus,
    pub services: ServiceStatuses,
    pub timestamp: DateTime<Utc>,
}

/// Check PostgreSQL connectivity
async fn check_postgres(state: &AppState) -> ServiceStatus {
    let result = timeout(
        HEALTH_CHECK_TIMEOUT,
        sqlx::query("SELECT 1").execute(&state.db),
    )
    .await;

    match result {
        Ok(Ok(_)) => ServiceStatus::Up,
        Ok(Err(e)) => {
            tracing::warn!("PostgreSQL health check failed: {}", e);
            ServiceStatus::Down
        }
        Err(_) => {
            tracing::warn!("PostgreSQL health check timed out");
            ServiceStatus::Down
        }
    }
}

/// Check Redis connectivity
async fn check_redis(state: &AppState) -> ServiceStatus {
    let mut conn = state.redis.clone();

    let result = timeout(
        HEALTH_CHECK_TIMEOUT,
        redis::cmd("PING").query_async::<String>(&mut conn),
    )
    .await;

    match result {
        Ok(Ok(response)) if response == "PONG" => ServiceStatus::Up,
        Ok(Ok(response)) => {
            tracing::warn!("Redis health check unexpected response: {}", response);
            ServiceStatus::Down
        }
        Ok(Err(e)) => {
            tracing::warn!("Redis health check failed: {}", e);
            ServiceStatus::Down
        }
        Err(_) => {
            tracing::warn!("Redis health check timed out");
            ServiceStatus::Down
        }
    }
}

/// Check MinIO connectivity by listing buckets
async fn check_minio(state: &AppState) -> ServiceStatus {
    let result = timeout(
        HEALTH_CHECK_TIMEOUT,
        state
            .s3_client
            .head_bucket()
            .bucket(&state.config.minio_bucket)
            .send(),
    )
    .await;

    match result {
        Ok(Ok(_)) => ServiceStatus::Up,
        Ok(Err(e)) => {
            // Check if it's a "not found" error (bucket doesn't exist but MinIO is up)
            let err_str = e.to_string();
            if err_str.contains("NoSuchBucket") || err_str.contains("NotFound") {
                // MinIO is responding, bucket just doesn't exist yet
                tracing::debug!("MinIO is up but bucket not found: {}", err_str);
                ServiceStatus::Up
            } else {
                tracing::warn!("MinIO health check failed: {}", e);
                ServiceStatus::Down
            }
        }
        Err(_) => {
            tracing::warn!("MinIO health check timed out");
            ServiceStatus::Down
        }
    }
}

/// Check Novu notification service
async fn check_novu(state: &AppState) -> ServiceStatus {
    let client = reqwest::Client::new();
    let url = format!("{}/v1/health-check", state.config.novu_api_url);

    let result = timeout(HEALTH_CHECK_TIMEOUT, client.get(&url).send()).await;

    match result {
        Ok(Ok(response)) if response.status().is_success() => ServiceStatus::Up,
        Ok(Ok(response)) => {
            tracing::warn!(
                "Novu health check returned non-success status: {}",
                response.status()
            );
            // Consider 2xx and some 4xx as "up" (service is responding)
            if response.status().as_u16() < 500 {
                ServiceStatus::Up
            } else {
                ServiceStatus::Down
            }
        }
        Ok(Err(e)) => {
            tracing::warn!("Novu health check failed: {}", e);
            ServiceStatus::Down
        }
        Err(_) => {
            tracing::warn!("Novu health check timed out");
            ServiceStatus::Down
        }
    }
}

/// Check Lago billing service
async fn check_lago(state: &AppState) -> ServiceStatus {
    let client = reqwest::Client::new();
    let url = format!("{}/health", state.config.lago_api_url);

    let result = timeout(HEALTH_CHECK_TIMEOUT, client.get(&url).send()).await;

    match result {
        Ok(Ok(response)) if response.status().is_success() => ServiceStatus::Up,
        Ok(Ok(response)) => {
            tracing::warn!(
                "Lago health check returned non-success status: {}",
                response.status()
            );
            if response.status().as_u16() < 500 {
                ServiceStatus::Up
            } else {
                ServiceStatus::Down
            }
        }
        Ok(Err(e)) => {
            tracing::warn!("Lago health check failed: {}", e);
            ServiceStatus::Down
        }
        Err(_) => {
            tracing::warn!("Lago health check timed out");
            ServiceStatus::Down
        }
    }
}

/// Health check handler
///
/// GET /api/health
///
/// Returns the health status of all services. No authentication required.
/// Checks all services independently (one failure doesn't prevent checking others).
///
/// Returns:
/// - 200 OK with status "healthy" if all services are up
/// - 503 Service Unavailable with status "degraded" if any service is down
pub async fn health_handler(State(state): State<AppState>) -> (StatusCode, Json<HealthResponse>) {
    // Check all services concurrently
    let (postgres, redis, minio, novu, lago) = tokio::join!(
        check_postgres(&state),
        check_redis(&state),
        check_minio(&state),
        check_novu(&state),
        check_lago(&state),
    );

    let services = ServiceStatuses {
        postgres,
        redis,
        minio,
        novu,
        lago,
    };

    // Determine overall status
    let all_up = postgres == ServiceStatus::Up
        && redis == ServiceStatus::Up
        && minio == ServiceStatus::Up
        && novu == ServiceStatus::Up
        && lago == ServiceStatus::Up;

    let status = if all_up {
        HealthStatus::Healthy
    } else {
        HealthStatus::Degraded
    };

    let response = HealthResponse {
        status,
        services,
        timestamp: Utc::now(),
    };

    let status_code = if all_up {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };

    (status_code, Json(response))
}

/// Simple liveness check handler
///
/// GET /api/health/live
///
/// Returns 200 OK if the service is running. Used for Kubernetes liveness probes.
pub async fn liveness_handler() -> StatusCode {
    StatusCode::OK
}

/// Readiness check handler
///
/// GET /api/health/ready
///
/// Returns 200 OK if the service is ready to accept traffic (database connected).
/// Used for Kubernetes readiness probes.
pub async fn readiness_handler(State(state): State<AppState>) -> StatusCode {
    // Only check critical services for readiness
    let postgres = check_postgres(&state).await;
    let redis = check_redis(&state).await;

    if postgres == ServiceStatus::Up && redis == ServiceStatus::Up {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_health_status_serialization() {
        assert_eq!(
            serde_json::to_string(&HealthStatus::Healthy).unwrap(),
            "\"healthy\""
        );
        assert_eq!(
            serde_json::to_string(&HealthStatus::Degraded).unwrap(),
            "\"degraded\""
        );
    }

    #[test]
    fn test_service_status_serialization() {
        assert_eq!(
            serde_json::to_string(&ServiceStatus::Up).unwrap(),
            "\"up\""
        );
        assert_eq!(
            serde_json::to_string(&ServiceStatus::Down).unwrap(),
            "\"down\""
        );
    }
}
