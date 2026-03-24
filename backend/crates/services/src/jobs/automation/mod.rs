//! Automation execution engine
//!
//! Evaluates automation rules when triggers fire (task created, moved, assigned, etc.)
//! and executes the configured actions.
//!
//! Safety features:
//! - Depth guard: prevents runaway chains (max depth 3)
//! - Redis rate limiting: 1000 executions per workspace per day
//! - Tokio timeout: 30s max per automation execution
//! - Name resolution: resolve column/label names to IDs
//! - Circuit breaker: deactivate board automations after 50 errors in 5 minutes

pub mod actions;
pub mod safety;
pub mod trigger;

use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

use taskbolt_db::models::automation::AutomationTrigger;
use taskbolt_db::queries::automation_evaluation::{get_active_rules_for_trigger, log_automation};

use actions::execute_action;
use safety::{
    check_circuit_breaker, check_depth, check_rate_limit, increment_rate_limit,
    record_circuit_breaker_error,
};
use trigger::matches_trigger_config;

// Re-export public API
pub use safety::{resolve_column_by_name, resolve_label_by_name};

/// Timeout for a single automation rule execution
const EXECUTION_TIMEOUT_SECS: u64 = 30;

/// Error type for automation execution
#[derive(Debug, thiserror::Error)]
pub enum AutomationExecutorError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Query error: {0}")]
    Query(#[from] taskbolt_db::queries::automations::AutomationQueryError),
    #[error("Action failed: {0}")]
    ActionFailed(String),
    #[error("Depth limit exceeded: depth {0} > max {1}")]
    DepthLimitExceeded(u8, u8),
    #[error("Rate limit exceeded for workspace {0}")]
    RateLimitExceeded(Uuid),
    #[error("Execution timed out after {0}s")]
    Timeout(u64),
    #[error("Circuit breaker open for board {0}")]
    CircuitBreakerOpen(Uuid),
    #[error("Redis error: {0}")]
    Redis(#[from] redis::RedisError),
    #[error("Name resolution failed: {0}")]
    NameResolutionFailed(String),
}

/// Context passed when evaluating automation triggers
#[derive(Debug, Clone)]
pub struct TriggerContext {
    pub task_id: Uuid,
    pub board_id: Uuid,
    pub tenant_id: Uuid,
    pub user_id: Uuid,
    /// Previous status ID (for TaskMoved trigger)
    pub previous_status_id: Option<Uuid>,
    /// New status ID (for TaskMoved trigger)
    pub new_status_id: Option<Uuid>,
    /// Priority value (for TaskPriorityChanged)
    pub priority: Option<String>,
    /// User ID of the member who joined (for MemberJoined trigger)
    pub member_user_id: Option<Uuid>,
}

/// Result of processing automation rules
#[derive(Debug)]
pub struct AutomationRunResult {
    pub rules_matched: usize,
    pub actions_executed: usize,
    pub errors: usize,
    pub timed_out: bool,
    pub rate_limited: bool,
    pub depth_exceeded: bool,
    pub circuit_breaker_tripped: bool,
}

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

/// Evaluate and execute automation rules for a given trigger.
/// This is the main entry point -- call from route handlers after task mutations.
///
/// Runs asynchronously and should be spawned as a background task.
///
/// # Safety features
/// - `depth`: recursion depth, starts at 0; aborts if > 3
/// - `redis`: used for rate limiting and circuit breaker
pub async fn evaluate_trigger(
    pool: &PgPool,
    redis: &mut redis::aio::ConnectionManager,
    trigger: AutomationTrigger,
    context: TriggerContext,
    depth: u8,
) -> AutomationRunResult {
    let mut result = AutomationRunResult {
        rules_matched: 0,
        actions_executed: 0,
        errors: 0,
        timed_out: false,
        rate_limited: false,
        depth_exceeded: false,
        circuit_breaker_tripped: false,
    };

    // Safety: Depth guard
    if let Err(_e) = check_depth(depth) {
        result.depth_exceeded = true;
        return result;
    }

    // Safety: Rate limit check
    if let Err(_e) = check_rate_limit(redis, context.tenant_id).await {
        result.rate_limited = true;
        return result;
    }

    // Safety: Circuit breaker check
    if let Err(_e) = check_circuit_breaker(redis, context.board_id).await {
        result.circuit_breaker_tripped = true;
        return result;
    }

    // Fetch active rules matching this trigger for the board
    let rules = match get_active_rules_for_trigger(pool, context.board_id, trigger.clone()).await {
        Ok(rules) => rules,
        Err(e) => {
            tracing::error!(
                board_id = %context.board_id,
                trigger = ?trigger,
                "Failed to fetch automation rules: {e}"
            );
            return result;
        }
    };

    if rules.is_empty() {
        return result;
    }

    result.rules_matched = rules.len();

    for rule_with_actions in &rules {
        // Check if trigger_config conditions match
        if !matches_trigger_config(&rule_with_actions.rule.trigger_config, &context) {
            continue;
        }

        // Safety: Wrap each rule execution in a timeout
        let pool_ref = pool;
        let rule_actions = &rule_with_actions.actions;
        let ctx = &context;

        let execution = async {
            let mut actions_ok = 0usize;
            let mut actions_err = 0usize;

            for action in rule_actions {
                match execute_action(
                    pool_ref,
                    action.action_type.clone(),
                    &action.action_config,
                    ctx,
                )
                .await
                {
                    Ok(()) => {
                        actions_ok += 1;
                    }
                    Err(e) => {
                        tracing::error!(
                            rule_id = %rule_with_actions.rule.id,
                            action_type = ?action.action_type,
                            "Automation action failed: {e}"
                        );
                        actions_err += 1;
                    }
                }
            }

            (actions_ok, actions_err)
        };

        match tokio::time::timeout(Duration::from_secs(EXECUTION_TIMEOUT_SECS), execution).await {
            Ok((ok, err)) => {
                result.actions_executed += ok;
                result.errors += err;

                // Record errors for circuit breaker
                for _ in 0..err {
                    record_circuit_breaker_error(redis, pool, context.board_id).await;
                }
            }
            Err(_elapsed) => {
                tracing::error!(
                    rule_id = %rule_with_actions.rule.id,
                    timeout_secs = EXECUTION_TIMEOUT_SECS,
                    "Automation execution timed out"
                );
                result.timed_out = true;
                result.errors += 1;

                // Log the timeout
                let _ = log_automation(
                    pool,
                    rule_with_actions.rule.id,
                    Some(context.task_id),
                    "timed_out",
                    Some(json!({
                        "trigger": format!("{:?}", trigger),
                        "timeout_secs": EXECUTION_TIMEOUT_SECS,
                        "timed_out": true
                    })),
                )
                .await;

                record_circuit_breaker_error(redis, pool, context.board_id).await;
                continue;
            }
        }

        // Log the execution result
        let status = if result.errors == 0 {
            "success"
        } else {
            "partial_failure"
        };
        if let Err(e) = log_automation(
            pool,
            rule_with_actions.rule.id,
            Some(context.task_id),
            status,
            Some(json!({
                "trigger": format!("{:?}", trigger),
                "actions_executed": result.actions_executed,
                "errors": result.errors,
                "depth": depth
            })),
        )
        .await
        {
            tracing::error!(
                rule_id = %rule_with_actions.rule.id,
                "Failed to log automation: {e}"
            );
        }
    }

    // Increment rate limit counter on successful execution
    if result.actions_executed > 0 {
        increment_rate_limit(redis, context.tenant_id).await;
    }

    result
}

/// Result of a scheduled automation scan via the cron endpoint.
#[derive(Debug, Serialize, Deserialize)]
pub struct ScheduledAutomationResult {
    pub tasks_scanned: usize,
    pub triggers_fired: usize,
    pub actions_executed: usize,
    pub errors: usize,
}

/// Execute scheduled (time-based) automations.
///
/// Scans for tasks with due dates that have passed or are approaching,
/// then fires the corresponding automation triggers (`TaskDueDatePassed`,
/// `DueDateApproaching`) for each matching task.
///
/// Designed to be called from a cron endpoint (e.g., every 15 minutes).
pub async fn execute_scheduled_automations(
    pool: &PgPool,
    redis: &mut redis::aio::ConnectionManager,
) -> Result<ScheduledAutomationResult, AutomationExecutorError> {
    use taskbolt_db::queries::automation_evaluation::get_scheduled_trigger_tasks;

    let tasks = get_scheduled_trigger_tasks(pool).await?;

    let mut result = ScheduledAutomationResult {
        tasks_scanned: tasks.len(),
        triggers_fired: 0,
        actions_executed: 0,
        errors: 0,
    };

    for task in &tasks {
        let context = TriggerContext {
            task_id: task.task_id,
            board_id: task.project_id,
            tenant_id: task.tenant_id,
            user_id: Uuid::nil(),
            previous_status_id: None,
            new_status_id: None,
            priority: None,
            member_user_id: None,
        };

        let run = evaluate_trigger(pool, redis, task.trigger.clone(), context, 0).await;

        if run.rules_matched > 0 {
            result.triggers_fired += run.rules_matched;
            result.actions_executed += run.actions_executed;
            result.errors += run.errors;
        }
    }

    tracing::info!(
        tasks_scanned = result.tasks_scanned,
        triggers_fired = result.triggers_fired,
        actions_executed = result.actions_executed,
        errors = result.errors,
        "Scheduled automation scan completed"
    );

    Ok(result)
}

/// Convenience function to spawn automation evaluation as a background task.
/// Call this from route handlers -- it won't block the response.
pub fn spawn_automation_evaluation(
    pool: PgPool,
    redis: redis::aio::ConnectionManager,
    trigger: AutomationTrigger,
    context: TriggerContext,
) {
    tokio::spawn(async move {
        let mut redis = redis;
        let result = evaluate_trigger(&pool, &mut redis, trigger.clone(), context, 0).await;
        if result.rules_matched > 0 {
            tracing::info!(
                trigger = ?trigger,
                rules = result.rules_matched,
                actions = result.actions_executed,
                errors = result.errors,
                timed_out = result.timed_out,
                rate_limited = result.rate_limited,
                depth_exceeded = result.depth_exceeded,
                circuit_breaker = result.circuit_breaker_tripped,
                "Automation evaluation completed"
            );
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_context() -> TriggerContext {
        TriggerContext {
            task_id: Uuid::new_v4(),
            board_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            previous_status_id: None,
            new_status_id: None,
            priority: None,
            member_user_id: None,
        }
    }

    // --- TriggerContext tests ---

    #[test]
    fn test_trigger_context_clone() {
        let ctx = make_context();
        let cloned = ctx.clone();
        assert_eq!(cloned.task_id, ctx.task_id);
        assert_eq!(cloned.board_id, ctx.board_id);
    }

    // --- AutomationRunResult tests ---

    #[test]
    fn test_automation_run_result_default_values() {
        let result = AutomationRunResult {
            rules_matched: 0,
            actions_executed: 0,
            errors: 0,
            timed_out: false,
            rate_limited: false,
            depth_exceeded: false,
            circuit_breaker_tripped: false,
        };
        assert_eq!(result.rules_matched, 0);
        assert_eq!(result.actions_executed, 0);
        assert_eq!(result.errors, 0);
        assert!(!result.timed_out);
        assert!(!result.rate_limited);
        assert!(!result.depth_exceeded);
        assert!(!result.circuit_breaker_tripped);
    }

    // --- AutomationExecutorError tests ---

    #[test]
    fn test_automation_executor_error_display() {
        let err = AutomationExecutorError::ActionFailed("MoveTask: missing column_id".into());
        let msg = format!("{}", err);
        assert!(msg.contains("Action failed"));
        assert!(msg.contains("missing column_id"));
    }

    #[test]
    fn test_depth_limit_error_display() {
        let err = AutomationExecutorError::DepthLimitExceeded(4, 3);
        let msg = format!("{}", err);
        assert!(msg.contains("Depth limit exceeded"));
        assert!(msg.contains("4"));
        assert!(msg.contains("3"));
    }

    #[test]
    fn test_rate_limit_error_display() {
        let ws_id = Uuid::new_v4();
        let err = AutomationExecutorError::RateLimitExceeded(ws_id);
        let msg = format!("{}", err);
        assert!(msg.contains("Rate limit exceeded"));
    }

    #[test]
    fn test_timeout_error_display() {
        let err = AutomationExecutorError::Timeout(30);
        let msg = format!("{}", err);
        assert!(msg.contains("timed out"));
        assert!(msg.contains("30"));
    }

    #[test]
    fn test_circuit_breaker_error_display() {
        let board_id = Uuid::new_v4();
        let err = AutomationExecutorError::CircuitBreakerOpen(board_id);
        let msg = format!("{}", err);
        assert!(msg.contains("Circuit breaker open"));
    }

    #[test]
    fn test_name_resolution_error_display() {
        let err = AutomationExecutorError::NameResolutionFailed("Column 'Done' not found".into());
        let msg = format!("{}", err);
        assert!(msg.contains("Name resolution failed"));
        assert!(msg.contains("Done"));
    }

    // --- Constants tests ---

    #[test]
    fn test_execution_timeout_is_sensible() {
        assert_eq!(EXECUTION_TIMEOUT_SECS, 30);
    }
}
