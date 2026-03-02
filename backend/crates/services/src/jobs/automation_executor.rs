//! Automation execution engine
//!
//! Evaluates automation rules when triggers fire (task created, moved, assigned, etc.)
//! and executes the configured actions.

use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

use taskflow_db::models::automation::{AutomationActionType, AutomationTrigger};
use taskflow_db::queries::automations::{get_active_rules_for_trigger, log_automation};

/// Error type for automation execution
#[derive(Debug, thiserror::Error)]
pub enum AutomationExecutorError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Query error: {0}")]
    Query(#[from] taskflow_db::queries::automations::AutomationQueryError),
    #[error("Action failed: {0}")]
    ActionFailed(String),
}

/// Context passed when evaluating automation triggers
#[derive(Debug, Clone)]
pub struct TriggerContext {
    pub task_id: Uuid,
    pub board_id: Uuid,
    pub tenant_id: Uuid,
    pub user_id: Uuid,
    /// Previous column ID (for TaskMoved trigger)
    pub previous_column_id: Option<Uuid>,
    /// New column ID (for TaskMoved trigger)
    pub new_column_id: Option<Uuid>,
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
}

/// Evaluate and execute automation rules for a given trigger.
/// This is the main entry point — call from route handlers after task mutations.
///
/// Runs asynchronously and should be spawned as a background task.
pub async fn evaluate_trigger(
    pool: &PgPool,
    trigger: AutomationTrigger,
    context: TriggerContext,
) -> AutomationRunResult {
    let mut result = AutomationRunResult {
        rules_matched: 0,
        actions_executed: 0,
        errors: 0,
    };

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

        // Execute each action in order
        for action in &rule_with_actions.actions {
            match execute_action(
                pool,
                action.action_type.clone(),
                &action.action_config,
                &context,
            )
            .await
            {
                Ok(()) => {
                    result.actions_executed += 1;
                }
                Err(e) => {
                    tracing::error!(
                        rule_id = %rule_with_actions.rule.id,
                        action_type = ?action.action_type,
                        "Automation action failed: {e}"
                    );
                    result.errors += 1;
                }
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
                "errors": result.errors
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
            if let Some(prev) = context.previous_column_id {
                if prev != expected {
                    return false;
                }
            }
        }
    }

    // Check target_column_id (TaskMoved)
    if let Some(target_col) = obj.get("target_column_id").and_then(|v| v.as_str()) {
        if let Ok(expected) = target_col.parse::<Uuid>() {
            if let Some(new) = context.new_column_id {
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

/// MoveTask action: moves the task to a specified column
async fn execute_move_task(
    pool: &PgPool,
    config: &serde_json::Value,
    context: &TriggerContext,
) -> Result<(), AutomationExecutorError> {
    let column_id = config
        .get("column_id")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<Uuid>().ok())
        .ok_or_else(|| {
            AutomationExecutorError::ActionFailed("MoveTask: missing column_id".into())
        })?;

    let position = format!("a{}", chrono::Utc::now().timestamp_millis());

    sqlx::query(
        r#"
        UPDATE tasks SET column_id = $2, position = $3, updated_at = NOW()
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
        .bind(format!("/boards/{}/tasks/{}", context.board_id, context.task_id))
        .execute(pool)
        .await?;
    }

    Ok(())
}

/// AddLabel action: adds a label to the task
async fn execute_add_label(
    pool: &PgPool,
    config: &serde_json::Value,
    context: &TriggerContext,
) -> Result<(), AutomationExecutorError> {
    let label_id = config
        .get("label_id")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<Uuid>().ok())
        .ok_or_else(|| {
            AutomationExecutorError::ActionFailed("AddLabel: missing label_id".into())
        })?;

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

/// Convenience function to spawn automation evaluation as a background task.
/// Call this from route handlers — it won't block the response.
pub fn spawn_automation_evaluation(
    pool: PgPool,
    trigger: AutomationTrigger,
    context: TriggerContext,
) {
    tokio::spawn(async move {
        let result = evaluate_trigger(&pool, trigger.clone(), context).await;
        if result.rules_matched > 0 {
            tracing::info!(
                trigger = ?trigger,
                rules = result.rules_matched,
                actions = result.actions_executed,
                errors = result.errors,
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
            previous_column_id: None,
            new_column_id: None,
            priority: None,
            member_user_id: None,
        }
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
        ctx.previous_column_id = Some(col_id);
        assert!(matches_trigger_config(&config, &ctx));
    }

    #[test]
    fn test_matches_trigger_config_source_column_mismatch() {
        let col_id = Uuid::new_v4();
        let other_col = Uuid::new_v4();
        let config = json!({"source_column_id": col_id.to_string()});
        let mut ctx = make_context();
        ctx.previous_column_id = Some(other_col);
        assert!(!matches_trigger_config(&config, &ctx));
    }

    #[test]
    fn test_matches_trigger_config_target_column_match() {
        let col_id = Uuid::new_v4();
        let config = json!({"target_column_id": col_id.to_string()});
        let mut ctx = make_context();
        ctx.new_column_id = Some(col_id);
        assert!(matches_trigger_config(&config, &ctx));
    }

    #[test]
    fn test_matches_trigger_config_target_column_mismatch() {
        let col_id = Uuid::new_v4();
        let other_col = Uuid::new_v4();
        let config = json!({"target_column_id": col_id.to_string()});
        let mut ctx = make_context();
        ctx.new_column_id = Some(other_col);
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
        ctx.previous_column_id = Some(source);
        ctx.new_column_id = Some(target);
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
        ctx.previous_column_id = Some(source);
        ctx.new_column_id = Some(Uuid::new_v4()); // wrong target
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
        };
        assert_eq!(result.rules_matched, 0);
        assert_eq!(result.actions_executed, 0);
        assert_eq!(result.errors, 0);
    }

    // --- AutomationExecutorError tests ---

    #[test]
    fn test_automation_executor_error_display() {
        let err = AutomationExecutorError::ActionFailed("MoveTask: missing column_id".into());
        let msg = format!("{}", err);
        assert!(msg.contains("Action failed"));
        assert!(msg.contains("missing column_id"));
    }
}
