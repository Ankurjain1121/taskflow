//! Safety checks for automation execution
//!
//! - Depth guard: prevents runaway chains (max depth 3)
//! - Redis rate limiting: 1000 executions per workspace per day
//! - Circuit breaker: deactivate board automations after 50 errors in 5 minutes
//! - Name resolution: resolve column/label names to IDs

use redis::AsyncCommands;
use sqlx::PgPool;
use uuid::Uuid;

use super::AutomationExecutorError;

/// Maximum recursion depth for automation chains
pub(crate) const MAX_DEPTH: u8 = 3;

/// Maximum automations per workspace per day
pub(crate) const DAILY_RATE_LIMIT: i64 = 1000;

/// Error count threshold for circuit breaker (per board in 5 minutes)
pub(crate) const CIRCUIT_BREAKER_THRESHOLD: i64 = 50;

/// Circuit breaker window in seconds (5 minutes)
pub(crate) const CIRCUIT_BREAKER_WINDOW_SECS: i64 = 300;

// ---------------------------------------------------------------------------
// Safety: Depth Guard
// ---------------------------------------------------------------------------

/// Check if the current execution depth is within limits.
pub(crate) fn check_depth(depth: u8) -> Result<(), AutomationExecutorError> {
    if depth > MAX_DEPTH {
        tracing::warn!(
            depth = depth,
            max = MAX_DEPTH,
            "Automation depth limit exceeded, aborting execution"
        );
        return Err(AutomationExecutorError::DepthLimitExceeded(
            depth, MAX_DEPTH,
        ));
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Safety: Redis Rate Limiting
// ---------------------------------------------------------------------------

/// Check and increment the daily rate limit for a workspace.
/// Returns Ok(()) if under limit, Err if exceeded.
pub(crate) async fn check_rate_limit(
    redis: &mut redis::aio::ConnectionManager,
    workspace_id: Uuid,
) -> Result<(), AutomationExecutorError> {
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let key = format!("automation_rate:{}:{}", workspace_id, today);

    let current: i64 = redis.get(&key).await.unwrap_or(0);

    if current >= DAILY_RATE_LIMIT {
        tracing::warn!(
            workspace_id = %workspace_id,
            current = current,
            limit = DAILY_RATE_LIMIT,
            "Automation daily rate limit exceeded"
        );
        return Err(AutomationExecutorError::RateLimitExceeded(workspace_id));
    }

    Ok(())
}

/// Increment the rate limit counter after successful execution.
pub(crate) async fn increment_rate_limit(
    redis: &mut redis::aio::ConnectionManager,
    workspace_id: Uuid,
) {
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let key = format!("automation_rate:{}:{}", workspace_id, today);

    let _: Result<i64, _> = redis.incr(&key, 1i64).await;
    // Set expiry to 48h to auto-cleanup (covers timezone edge cases)
    let _: Result<bool, _> = redis.expire(&key, 172_800).await;
}

// ---------------------------------------------------------------------------
// Safety: Circuit Breaker
// ---------------------------------------------------------------------------

/// Check if the circuit breaker is open for a board.
pub(crate) async fn check_circuit_breaker(
    redis: &mut redis::aio::ConnectionManager,
    board_id: Uuid,
) -> Result<(), AutomationExecutorError> {
    let key = format!("automation_errors:{}:5min", board_id);

    let error_count: i64 = redis.get(&key).await.unwrap_or(0);

    if error_count > CIRCUIT_BREAKER_THRESHOLD {
        tracing::error!(
            board_id = %board_id,
            error_count = error_count,
            threshold = CIRCUIT_BREAKER_THRESHOLD,
            "Circuit breaker OPEN for board — automations deactivated"
        );
        return Err(AutomationExecutorError::CircuitBreakerOpen(board_id));
    }

    Ok(())
}

/// Record an error for the circuit breaker counter.
/// If threshold is crossed, deactivate all automations for the board.
pub(crate) async fn record_circuit_breaker_error(
    redis: &mut redis::aio::ConnectionManager,
    pool: &PgPool,
    board_id: Uuid,
) {
    let key = format!("automation_errors:{}:5min", board_id);

    let new_count: i64 = redis.incr(&key, 1i64).await.unwrap_or(1);
    let _: Result<bool, _> = redis.expire(&key, CIRCUIT_BREAKER_WINDOW_SECS).await;

    if new_count > CIRCUIT_BREAKER_THRESHOLD {
        tracing::error!(
            board_id = %board_id,
            error_count = new_count,
            "Circuit breaker TRIPPED — deactivating all automations for board"
        );

        // Deactivate all automations for this board
        let deactivate_result = sqlx::query(
            "UPDATE automation_rules SET is_active = false WHERE project_id = $1 AND is_active = true",
        )
        .bind(board_id)
        .execute(pool)
        .await;

        match deactivate_result {
            Ok(result) => {
                tracing::warn!(
                    board_id = %board_id,
                    deactivated = result.rows_affected(),
                    "Deactivated automation rules due to circuit breaker"
                );
            }
            Err(e) => {
                tracing::error!(
                    board_id = %board_id,
                    "Failed to deactivate automations during circuit breaker: {e}"
                );
            }
        }

        // Create a notification for the board about circuit breaker activation
        if let Err(e) = create_circuit_breaker_notification(pool, board_id).await {
            tracing::error!(
                board_id = %board_id,
                "Failed to create circuit breaker notification: {e}"
            );
        }
    }
}

/// Create a notification for board admins when circuit breaker trips.
async fn create_circuit_breaker_notification(
    pool: &PgPool,
    board_id: Uuid,
) -> Result<(), sqlx::Error> {
    // Get project owner(s) - members with 'owner' role
    let owner_ids: Vec<Uuid> = sqlx::query_scalar(
        r#"
        SELECT user_id FROM project_members
        WHERE project_id = $1 AND role = 'owner'
        "#,
    )
    .bind(board_id)
    .fetch_all(pool)
    .await?;

    for owner_id in owner_ids {
        sqlx::query(
            r#"
            INSERT INTO notifications (id, recipient_id, title, body, event_type, link_url, created_at)
            VALUES ($1, $2, 'Automations Paused', $3, 'automation', $4, NOW())
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(owner_id)
        .bind("Too many automation errors in a short time. All automations for this board have been paused. Please review and re-enable them.")
        .bind(format!("/projects/{}/settings", board_id))
        .execute(pool)
        .await?;
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Safety: Name Resolution Helpers
// ---------------------------------------------------------------------------

/// Resolve a column by name within a board, returning its UUID.
pub async fn resolve_column_by_name(
    pool: &PgPool,
    board_id: Uuid,
    column_name: &str,
) -> Result<Uuid, AutomationExecutorError> {
    let column_id: Option<Uuid> = sqlx::query_scalar(
        r#"
        SELECT id FROM project_statuses
        WHERE project_id = $1 AND LOWER(name) = LOWER($2)
        LIMIT 1
        "#,
    )
    .bind(board_id)
    .bind(column_name)
    .fetch_optional(pool)
    .await?;

    column_id.ok_or_else(|| {
        AutomationExecutorError::NameResolutionFailed(format!(
            "Status '{}' not found on project {}",
            column_name, board_id
        ))
    })
}

/// Resolve a label by name within a board's workspace, returning its UUID.
pub async fn resolve_label_by_name(
    pool: &PgPool,
    board_id: Uuid,
    label_name: &str,
) -> Result<Uuid, AutomationExecutorError> {
    let label_id: Option<Uuid> = sqlx::query_scalar(
        r#"
        SELECT l.id FROM labels l
        JOIN projects b ON b.workspace_id = l.workspace_id
        WHERE b.id = $1 AND LOWER(l.name) = LOWER($2)
        LIMIT 1
        "#,
    )
    .bind(board_id)
    .bind(label_name)
    .fetch_optional(pool)
    .await?;

    label_id.ok_or_else(|| {
        AutomationExecutorError::NameResolutionFailed(format!(
            "Label '{}' not found for board {}",
            label_name, board_id
        ))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- Depth Guard tests ---

    #[test]
    fn test_depth_guard_at_zero() {
        assert!(check_depth(0).is_ok());
    }

    #[test]
    fn test_depth_guard_at_one() {
        assert!(check_depth(1).is_ok());
    }

    #[test]
    fn test_depth_guard_at_max() {
        assert!(check_depth(MAX_DEPTH).is_ok());
    }

    #[test]
    fn test_depth_guard_exceeds_max() {
        let result = check_depth(MAX_DEPTH + 1);
        assert!(result.is_err());
        match result.err() {
            Some(AutomationExecutorError::DepthLimitExceeded(depth, max)) => {
                assert_eq!(depth, MAX_DEPTH + 1);
                assert_eq!(max, MAX_DEPTH);
            }
            other => panic!("Expected DepthLimitExceeded, got {:?}", other),
        }
    }

    #[test]
    fn test_depth_guard_well_above_max() {
        assert!(check_depth(10).is_err());
        assert!(check_depth(255).is_err());
    }

    // --- Constants tests ---

    #[test]
    fn test_constants_are_sensible() {
        assert_eq!(MAX_DEPTH, 3);
        assert_eq!(DAILY_RATE_LIMIT, 1000);
        assert_eq!(CIRCUIT_BREAKER_THRESHOLD, 50);
        assert_eq!(CIRCUIT_BREAKER_WINDOW_SECS, 300);
    }
}
