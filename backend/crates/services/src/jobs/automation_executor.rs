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

use std::time::Duration;

use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

use taskflow_db::models::automation::{AutomationActionType, AutomationTrigger};
use taskflow_db::queries::automation_evaluation::{get_active_rules_for_trigger, log_automation};

/// Maximum recursion depth for automation chains
const MAX_DEPTH: u8 = 3;

/// Maximum automations per workspace per day
const DAILY_RATE_LIMIT: i64 = 1000;

/// Timeout for a single automation rule execution
const EXECUTION_TIMEOUT_SECS: u64 = 30;

/// Error count threshold for circuit breaker (per board in 5 minutes)
const CIRCUIT_BREAKER_THRESHOLD: i64 = 50;

/// Circuit breaker window in seconds (5 minutes)
const CIRCUIT_BREAKER_WINDOW_SECS: i64 = 300;

/// Error type for automation execution
#[derive(Debug, thiserror::Error)]
pub enum AutomationExecutorError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Query error: {0}")]
    Query(#[from] taskflow_db::queries::automations::AutomationQueryError),
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
// Safety: Depth Guard
// ---------------------------------------------------------------------------

/// Check if the current execution depth is within limits.
fn check_depth(depth: u8) -> Result<(), AutomationExecutorError> {
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
async fn check_rate_limit(
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
async fn increment_rate_limit(redis: &mut redis::aio::ConnectionManager, workspace_id: Uuid) {
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
async fn check_circuit_breaker(
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
async fn record_circuit_breaker_error(
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

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

/// Evaluate and execute automation rules for a given trigger.
/// This is the main entry point — call from route handlers after task mutations.
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

/// Check if the trigger_config conditions match the current context.
///
/// trigger_config is a JSON object with optional fields like:
/// - `source_column_id`: for TaskMoved, only fire if moved FROM this column
/// - `target_column_id`: for TaskMoved, only fire if moved TO this column
/// - `priority`: for TaskPriorityChanged, only fire for this priority
fn matches_trigger_config(config: &serde_json::Value, context: &TriggerContext) -> bool {
    let obj = match config.as_object() {
        Some(obj) => obj,
        None => return true, // Empty/null config means always match
    };

    // If empty object, match everything
    if obj.is_empty() {
        return true;
    }

    // Check source_column_id (TaskMoved)
    if let Some(source_col) = obj.get("source_column_id").and_then(|v| v.as_str()) {
        if let Ok(expected) = source_col.parse::<Uuid>() {
            if let Some(prev) = context.previous_status_id {
                if prev != expected {
                    return false;
                }
            }
        }
    }

    // Check target_column_id (TaskMoved)
    if let Some(target_col) = obj.get("target_column_id").and_then(|v| v.as_str()) {
        if let Ok(expected) = target_col.parse::<Uuid>() {
            if let Some(new) = context.new_status_id {
                if new != expected {
                    return false;
                }
            }
        }
    }

    // Check priority (TaskPriorityChanged)
    if let Some(expected_priority) = obj.get("priority").and_then(|v| v.as_str()) {
        if let Some(ref actual) = context.priority {
            if actual != expected_priority {
                return false;
            }
        }
    }

    true
}

/// Execute a single automation action
async fn execute_action(
    pool: &PgPool,
    action_type: AutomationActionType,
    config: &serde_json::Value,
    context: &TriggerContext,
) -> Result<(), AutomationExecutorError> {
    match action_type {
        AutomationActionType::MoveTask => execute_move_task(pool, config, context).await,
        AutomationActionType::AssignTask => execute_assign_task(pool, config, context).await,
        AutomationActionType::SetPriority => execute_set_priority(pool, config, context).await,
        AutomationActionType::SendNotification => {
            execute_send_notification(pool, config, context).await
        }
        AutomationActionType::AddLabel => execute_add_label(pool, config, context).await,
        AutomationActionType::SetMilestone => execute_set_milestone(pool, config, context).await,
        AutomationActionType::CreateSubtask => execute_create_subtask(pool, config, context).await,
        AutomationActionType::AddComment => execute_add_comment(pool, config, context).await,
        AutomationActionType::SetDueDate => execute_set_due_date(pool, config, context).await,
        AutomationActionType::SetCustomField => {
            execute_set_custom_field(pool, config, context).await
        }
        AutomationActionType::SendWebhook => execute_send_webhook(config, context).await,
        AutomationActionType::AssignToRoleMembers => {
            execute_assign_to_role_members(pool, config, context).await
        }
    }
}

/// MoveTask action: moves the task to a specified column.
/// Supports both `column_id` (UUID) and `column_name` (string) for resolution.
async fn execute_move_task(
    pool: &PgPool,
    config: &serde_json::Value,
    context: &TriggerContext,
) -> Result<(), AutomationExecutorError> {
    // Try column_id first, then fall back to column_name resolution
    let column_id = if let Some(id) = config
        .get("column_id")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<Uuid>().ok())
    {
        id
    } else if let Some(name) = config.get("column_name").and_then(|v| v.as_str()) {
        resolve_column_by_name(pool, context.board_id, name).await?
    } else {
        return Err(AutomationExecutorError::ActionFailed(
            "MoveTask: missing column_id or column_name".into(),
        ));
    };

    let position = format!("a{}", chrono::Utc::now().timestamp_millis());

    sqlx::query(
        r#"
        UPDATE tasks SET status_id = $2, position = $3, updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(context.task_id)
    .bind(column_id)
    .bind(&position)
    .execute(pool)
    .await?;

    Ok(())
}

/// AssignTask action: assigns a user to the task
async fn execute_assign_task(
    pool: &PgPool,
    config: &serde_json::Value,
    context: &TriggerContext,
) -> Result<(), AutomationExecutorError> {
    let user_id = config
        .get("user_id")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<Uuid>().ok())
        .ok_or_else(|| {
            AutomationExecutorError::ActionFailed("AssignTask: missing user_id".into())
        })?;

    sqlx::query(
        r#"
        INSERT INTO task_assignees (task_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (task_id, user_id) DO NOTHING
        "#,
    )
    .bind(context.task_id)
    .bind(user_id)
    .execute(pool)
    .await?;

    Ok(())
}

/// SetPriority action: updates the task's priority
async fn execute_set_priority(
    pool: &PgPool,
    config: &serde_json::Value,
    context: &TriggerContext,
) -> Result<(), AutomationExecutorError> {
    let priority = config
        .get("priority")
        .and_then(|v| v.as_str())
        .ok_or_else(|| {
            AutomationExecutorError::ActionFailed("SetPriority: missing priority".into())
        })?;

    // Validate priority value
    let valid_priorities = ["urgent", "high", "medium", "low"];
    if !valid_priorities.contains(&priority) {
        return Err(AutomationExecutorError::ActionFailed(format!(
            "SetPriority: invalid priority '{priority}'"
        )));
    }

    sqlx::query(
        r#"
        UPDATE tasks SET priority = $2::task_priority, updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(context.task_id)
    .bind(priority)
    .execute(pool)
    .await?;

    Ok(())
}

/// SendNotification action: creates an in-app notification
async fn execute_send_notification(
    pool: &PgPool,
    config: &serde_json::Value,
    context: &TriggerContext,
) -> Result<(), AutomationExecutorError> {
    let message = config
        .get("message")
        .and_then(|v| v.as_str())
        .unwrap_or("Automation triggered");

    // Determine recipient: explicit user_id, or all task assignees
    let recipients: Vec<Uuid> = if let Some(user_id) = config
        .get("user_id")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<Uuid>().ok())
    {
        vec![user_id]
    } else {
        // Notify all assignees
        sqlx::query_scalar::<_, Uuid>(r#"SELECT user_id FROM task_assignees WHERE task_id = $1"#)
            .bind(context.task_id)
            .fetch_all(pool)
            .await?
    };

    for recipient_id in recipients {
        sqlx::query(
            r#"
            INSERT INTO notifications (id, recipient_id, title, body, event_type, link_url, created_at)
            VALUES ($1, $2, 'Automation', $3, 'automation', $4, NOW())
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(recipient_id)
        .bind(message)
        .bind(format!("/projects/{}/tasks/{}", context.board_id, context.task_id))
        .execute(pool)
        .await?;
    }

    Ok(())
}

/// AddLabel action: adds a label to the task.
/// Supports both `label_id` (UUID) and `label_name` (string) for resolution.
async fn execute_add_label(
    pool: &PgPool,
    config: &serde_json::Value,
    context: &TriggerContext,
) -> Result<(), AutomationExecutorError> {
    // Try label_id first, then fall back to label_name resolution
    let label_id = if let Some(id) = config
        .get("label_id")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<Uuid>().ok())
    {
        id
    } else if let Some(name) = config.get("label_name").and_then(|v| v.as_str()) {
        resolve_label_by_name(pool, context.board_id, name).await?
    } else {
        return Err(AutomationExecutorError::ActionFailed(
            "AddLabel: missing label_id or label_name".into(),
        ));
    };

    sqlx::query(
        r#"
        INSERT INTO task_labels (id, task_id, label_id)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(context.task_id)
    .bind(label_id)
    .execute(pool)
    .await?;

    Ok(())
}

/// SetMilestone action: sets the task's milestone
async fn execute_set_milestone(
    pool: &PgPool,
    config: &serde_json::Value,
    context: &TriggerContext,
) -> Result<(), AutomationExecutorError> {
    let milestone_id = config
        .get("milestone_id")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<Uuid>().ok());

    sqlx::query(
        r#"
        UPDATE tasks SET milestone_id = $2, updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(context.task_id)
    .bind(milestone_id)
    .execute(pool)
    .await?;

    Ok(())
}

/// CreateSubtask action: adds a subtask to the task
async fn execute_create_subtask(
    pool: &PgPool,
    config: &serde_json::Value,
    context: &TriggerContext,
) -> Result<(), AutomationExecutorError> {
    let title = config
        .get("title")
        .and_then(|v| v.as_str())
        .ok_or_else(|| {
            AutomationExecutorError::ActionFailed("CreateSubtask: missing title".into())
        })?;

    // Get next position
    let max_pos = sqlx::query_scalar::<_, Option<i32>>(
        "SELECT MAX(position) FROM subtasks WHERE task_id = $1",
    )
    .bind(context.task_id)
    .fetch_one(pool)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO subtasks (id, task_id, title, is_completed, position, created_at, updated_at)
        VALUES ($1, $2, $3, false, $4, NOW(), NOW())
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(context.task_id)
    .bind(title)
    .bind(max_pos.unwrap_or(0) + 1)
    .execute(pool)
    .await?;

    Ok(())
}

/// AddComment action: posts an automated comment on the task
async fn execute_add_comment(
    pool: &PgPool,
    config: &serde_json::Value,
    context: &TriggerContext,
) -> Result<(), AutomationExecutorError> {
    let body = config
        .get("body")
        .and_then(|v| v.as_str())
        .unwrap_or("Automated comment");

    sqlx::query(
        r#"
        INSERT INTO comments (id, task_id, user_id, body, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(context.task_id)
    .bind(context.user_id)
    .bind(body)
    .execute(pool)
    .await?;

    Ok(())
}

/// SetDueDate action: sets or adjusts the task's due date
async fn execute_set_due_date(
    pool: &PgPool,
    config: &serde_json::Value,
    context: &TriggerContext,
) -> Result<(), AutomationExecutorError> {
    // Support absolute date or relative offset like "+3d"
    if let Some(offset_str) = config.get("offset").and_then(|v| v.as_str()) {
        // Parse offset like "+3d", "+1w"
        let offset_days = parse_offset_days(offset_str);
        sqlx::query(
            r#"
            UPDATE tasks
            SET due_date = COALESCE(due_date, NOW()) + make_interval(days => $2),
                updated_at = NOW()
            WHERE id = $1 AND deleted_at IS NULL
            "#,
        )
        .bind(context.task_id)
        .bind(offset_days)
        .execute(pool)
        .await?;
    } else if let Some(date_str) = config.get("date").and_then(|v| v.as_str()) {
        // Absolute date
        let date = date_str
            .parse::<chrono::DateTime<chrono::Utc>>()
            .map_err(|e| {
                AutomationExecutorError::ActionFailed(format!("SetDueDate: invalid date: {e}"))
            })?;
        sqlx::query(
            r#"
            UPDATE tasks SET due_date = $2, updated_at = NOW()
            WHERE id = $1 AND deleted_at IS NULL
            "#,
        )
        .bind(context.task_id)
        .bind(date)
        .execute(pool)
        .await?;
    }

    Ok(())
}

/// Parse offset strings like "+3d", "+1w", "+2m" into days
fn parse_offset_days(s: &str) -> i32 {
    let s = s.trim_start_matches('+');
    if let Some(d) = s.strip_suffix('d') {
        d.parse().unwrap_or(0)
    } else if let Some(w) = s.strip_suffix('w') {
        w.parse::<i32>().unwrap_or(0) * 7
    } else if let Some(m) = s.strip_suffix('m') {
        m.parse::<i32>().unwrap_or(0) * 30
    } else {
        s.parse().unwrap_or(0)
    }
}

/// SetCustomField action: sets a custom field value on the task
async fn execute_set_custom_field(
    pool: &PgPool,
    config: &serde_json::Value,
    context: &TriggerContext,
) -> Result<(), AutomationExecutorError> {
    let field_id = config
        .get("field_id")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<Uuid>().ok())
        .ok_or_else(|| {
            AutomationExecutorError::ActionFailed("SetCustomField: missing field_id".into())
        })?;

    let value = config.get("value").and_then(|v| v.as_str()).unwrap_or("");

    sqlx::query(
        r#"
        INSERT INTO task_custom_field_values (id, task_id, field_id, value, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        ON CONFLICT (task_id, field_id) DO UPDATE SET value = $4, updated_at = NOW()
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(context.task_id)
    .bind(field_id)
    .bind(value)
    .execute(pool)
    .await?;

    Ok(())
}

/// SendWebhook action: POST to an external URL with task data
async fn execute_send_webhook(
    config: &serde_json::Value,
    context: &TriggerContext,
) -> Result<(), AutomationExecutorError> {
    let url = config
        .get("url")
        .and_then(|v| v.as_str())
        .ok_or_else(|| AutomationExecutorError::ActionFailed("SendWebhook: missing url".into()))?;

    let payload = json!({
        "task_id": context.task_id,
        "board_id": context.board_id,
        "tenant_id": context.tenant_id,
        "user_id": context.user_id,
        "timestamp": chrono::Utc::now().to_rfc3339(),
    });

    let client = reqwest::Client::new();
    let resp = client
        .post(url)
        .json(&payload)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| {
            AutomationExecutorError::ActionFailed(format!("SendWebhook: request failed: {e}"))
        })?;

    if !resp.status().is_success() {
        return Err(AutomationExecutorError::ActionFailed(format!(
            "SendWebhook: got status {}",
            resp.status()
        )));
    }

    Ok(())
}

/// AssignToRoleMembers action: assigns all members of a workspace job role to the task
async fn execute_assign_to_role_members(
    pool: &PgPool,
    config: &serde_json::Value,
    context: &TriggerContext,
) -> Result<(), AutomationExecutorError> {
    let role_id = config
        .get("role_id")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<Uuid>().ok())
        .ok_or_else(|| {
            AutomationExecutorError::ActionFailed("AssignToRoleMembers: missing role_id".into())
        })?;

    let member_ids = taskflow_db::queries::get_members_with_role(pool, role_id).await?;

    for member_id in member_ids {
        sqlx::query(
            r#"
            INSERT INTO task_assignees (task_id, user_id)
            VALUES ($1, $2)
            ON CONFLICT (task_id, user_id) DO NOTHING
            "#,
        )
        .bind(context.task_id)
        .bind(member_id)
        .execute(pool)
        .await?;
    }

    Ok(())
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
    use taskflow_db::queries::automation_evaluation::get_scheduled_trigger_tasks;

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
            board_id: task.board_id,
            tenant_id: task.tenant_id,
            user_id: task.assignee_id.unwrap_or(Uuid::nil()),
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
/// Call this from route handlers — it won't block the response.
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
    use serde_json::json;

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

    // --- parse_offset_days tests ---

    #[test]
    fn test_parse_offset_days_days() {
        assert_eq!(parse_offset_days("+3d"), 3);
        assert_eq!(parse_offset_days("3d"), 3);
        assert_eq!(parse_offset_days("+1d"), 1);
        assert_eq!(parse_offset_days("+0d"), 0);
    }

    #[test]
    fn test_parse_offset_days_weeks() {
        assert_eq!(parse_offset_days("+1w"), 7);
        assert_eq!(parse_offset_days("+2w"), 14);
        assert_eq!(parse_offset_days("3w"), 21);
    }

    #[test]
    fn test_parse_offset_days_months() {
        assert_eq!(parse_offset_days("+1m"), 30);
        assert_eq!(parse_offset_days("+2m"), 60);
        assert_eq!(parse_offset_days("3m"), 90);
    }

    #[test]
    fn test_parse_offset_days_plain_number() {
        assert_eq!(parse_offset_days("+5"), 5);
        assert_eq!(parse_offset_days("10"), 10);
    }

    #[test]
    fn test_parse_offset_days_invalid() {
        assert_eq!(parse_offset_days("abc"), 0);
        assert_eq!(parse_offset_days(""), 0);
        assert_eq!(parse_offset_days("+"), 0);
    }

    // --- matches_trigger_config tests ---

    #[test]
    fn test_matches_trigger_config_null_config() {
        let config = json!(null);
        let ctx = make_context();
        assert!(matches_trigger_config(&config, &ctx));
    }

    #[test]
    fn test_matches_trigger_config_empty_object() {
        let config = json!({});
        let ctx = make_context();
        assert!(matches_trigger_config(&config, &ctx));
    }

    #[test]
    fn test_matches_trigger_config_source_column_match() {
        let col_id = Uuid::new_v4();
        let config = json!({"source_column_id": col_id.to_string()});
        let mut ctx = make_context();
        ctx.previous_status_id = Some(col_id);
        assert!(matches_trigger_config(&config, &ctx));
    }

    #[test]
    fn test_matches_trigger_config_source_column_mismatch() {
        let col_id = Uuid::new_v4();
        let other_col = Uuid::new_v4();
        let config = json!({"source_column_id": col_id.to_string()});
        let mut ctx = make_context();
        ctx.previous_status_id = Some(other_col);
        assert!(!matches_trigger_config(&config, &ctx));
    }

    #[test]
    fn test_matches_trigger_config_target_column_match() {
        let col_id = Uuid::new_v4();
        let config = json!({"target_column_id": col_id.to_string()});
        let mut ctx = make_context();
        ctx.new_status_id = Some(col_id);
        assert!(matches_trigger_config(&config, &ctx));
    }

    #[test]
    fn test_matches_trigger_config_target_column_mismatch() {
        let col_id = Uuid::new_v4();
        let other_col = Uuid::new_v4();
        let config = json!({"target_column_id": col_id.to_string()});
        let mut ctx = make_context();
        ctx.new_status_id = Some(other_col);
        assert!(!matches_trigger_config(&config, &ctx));
    }

    #[test]
    fn test_matches_trigger_config_priority_match() {
        let config = json!({"priority": "high"});
        let mut ctx = make_context();
        ctx.priority = Some("high".to_string());
        assert!(matches_trigger_config(&config, &ctx));
    }

    #[test]
    fn test_matches_trigger_config_priority_mismatch() {
        let config = json!({"priority": "high"});
        let mut ctx = make_context();
        ctx.priority = Some("low".to_string());
        assert!(!matches_trigger_config(&config, &ctx));
    }

    #[test]
    fn test_matches_trigger_config_combined_conditions() {
        let source = Uuid::new_v4();
        let target = Uuid::new_v4();
        let config = json!({
            "source_column_id": source.to_string(),
            "target_column_id": target.to_string()
        });
        let mut ctx = make_context();
        ctx.previous_status_id = Some(source);
        ctx.new_status_id = Some(target);
        assert!(matches_trigger_config(&config, &ctx));
    }

    #[test]
    fn test_matches_trigger_config_combined_one_fails() {
        let source = Uuid::new_v4();
        let target = Uuid::new_v4();
        let config = json!({
            "source_column_id": source.to_string(),
            "target_column_id": target.to_string()
        });
        let mut ctx = make_context();
        ctx.previous_status_id = Some(source);
        ctx.new_status_id = Some(Uuid::new_v4()); // wrong target
        assert!(!matches_trigger_config(&config, &ctx));
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
    fn test_constants_are_sensible() {
        assert_eq!(MAX_DEPTH, 3);
        assert_eq!(DAILY_RATE_LIMIT, 1000);
        assert_eq!(EXECUTION_TIMEOUT_SECS, 30);
        assert_eq!(CIRCUIT_BREAKER_THRESHOLD, 50);
        assert_eq!(CIRCUIT_BREAKER_WINDOW_SECS, 300);
    }
}
