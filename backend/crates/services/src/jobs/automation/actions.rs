//! Action execution handlers for automation rules
//!
//! Each `execute_*` function implements one `AutomationActionType`.

use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

use super::safety::{resolve_column_by_name, resolve_label_by_name};
use super::{AutomationExecutorError, TriggerContext};

use taskbolt_db::models::automation::AutomationActionType;
use taskbolt_db::models::ActivityAction;
use taskbolt_db::queries::activity_log::insert_activity_log;

/// Execute a single automation action
pub(crate) async fn execute_action(
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

    // Capture previous status before the UPDATE so we can emit a
    // `status_changed` activity entry if it actually changes. Missing
    // values are tolerated — logging is best-effort.
    let previous_status_id: Option<Uuid> =
        sqlx::query_scalar("SELECT status_id FROM tasks WHERE id = $1 AND deleted_at IS NULL")
            .bind(context.task_id)
            .fetch_optional(pool)
            .await?
            .flatten();

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

    // Record status_changed activity when the status actually changed.
    // Runs inline (we're already in a background job) but errors are
    // swallowed with a log — automation moves must not fail on logging.
    if previous_status_id != Some(column_id) {
        let from_name: Option<String> = match previous_status_id {
            Some(id) => sqlx::query_scalar("SELECT name FROM project_statuses WHERE id = $1")
                .bind(id)
                .fetch_optional(pool)
                .await
                .unwrap_or(None),
            None => None,
        };
        let to_name: Option<String> =
            sqlx::query_scalar("SELECT name FROM project_statuses WHERE id = $1")
                .bind(column_id)
                .fetch_optional(pool)
                .await
                .unwrap_or(None);

        let metadata = json!({
            "from_status": from_name.clone().unwrap_or_default(),
            "to_status": to_name.clone().unwrap_or_default(),
        });

        if let Err(e) = insert_activity_log(
            pool,
            context.task_id,
            context.user_id,
            ActivityAction::StatusChanged,
            Some(metadata),
            context.tenant_id,
        )
        .await
        {
            tracing::error!(
                task_id = %context.task_id,
                "Failed to record status_changed activity from automation: {}",
                e
            );
        }
    }

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
        .bind(format!(
            "/projects/{}/tasks/{}",
            context.board_id, context.task_id
        ))
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

/// CreateSubtask action: creates a child task under the trigger task
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

    // Get parent task to inherit project_id, status_id, task_list_id
    let parent = sqlx::query_as::<_, (Uuid, Option<Uuid>, Option<Uuid>, Uuid, i16)>(
        r#"SELECT project_id, status_id, task_list_id, tenant_id, depth
           FROM tasks WHERE id = $1 AND deleted_at IS NULL"#,
    )
    .bind(context.task_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| {
        AutomationExecutorError::ActionFailed("CreateSubtask: parent task not found".into())
    })?;

    // Get next position
    let last_pos = sqlx::query_scalar::<_, String>(
        "SELECT position FROM tasks WHERE parent_task_id = $1 AND deleted_at IS NULL ORDER BY position DESC LIMIT 1",
    )
    .bind(context.task_id)
    .fetch_optional(pool)
    .await?;

    let position = match last_pos {
        Some(p) => format!("{}0", p),
        None => "a".to_string(),
    };

    sqlx::query(
        r#"
        INSERT INTO tasks (id, title, priority, project_id, status_id, task_list_id,
                          position, tenant_id, created_by_id, parent_task_id, depth)
        VALUES ($1, $2, 'medium'::task_priority, $3, $4, $5, $6, $7, $8, $9, $10)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(title)
    .bind(parent.0) // project_id
    .bind(parent.1) // status_id
    .bind(parent.2) // task_list_id
    .bind(&position)
    .bind(parent.3) // tenant_id
    .bind(context.user_id)
    .bind(context.task_id)
    .bind(parent.4 + 1) // depth
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
pub(crate) fn parse_offset_days(s: &str) -> i32 {
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

/// SendWebhook action: POST to an external URL with task data.
/// Retries up to 3 times with exponential backoff (1s, 2s, 4s) on failure.
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
        "project_id": context.board_id,
        "tenant_id": context.tenant_id,
        "user_id": context.user_id,
        "timestamp": chrono::Utc::now().to_rfc3339(),
    });

    let client = reqwest::Client::new();
    let max_attempts = 3u32;
    let mut last_error = String::new();

    for attempt in 0..max_attempts {
        if attempt > 0 {
            let delay_secs = 1u64 << attempt; // 2s, 4s
            tracing::warn!(
                url = url,
                attempt = attempt + 1,
                delay_secs = delay_secs,
                "SendWebhook: retrying after failure"
            );
            tokio::time::sleep(std::time::Duration::from_secs(delay_secs)).await;
        }

        match client
            .post(url)
            .json(&payload)
            .timeout(std::time::Duration::from_secs(10))
            .send()
            .await
        {
            Ok(resp) => {
                if resp.status().is_success() {
                    return Ok(());
                }
                last_error = format!("SendWebhook: got status {}", resp.status());
                tracing::warn!(
                    url = url,
                    attempt = attempt + 1,
                    status = %resp.status(),
                    "SendWebhook: non-success status"
                );
            }
            Err(e) => {
                last_error = format!("SendWebhook: request failed: {e}");
                tracing::warn!(
                    url = url,
                    attempt = attempt + 1,
                    error = %e,
                    "SendWebhook: request error"
                );
            }
        }
    }

    Err(AutomationExecutorError::ActionFailed(last_error))
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

    let member_ids = taskbolt_db::queries::get_members_with_role(pool, role_id).await?;

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

#[cfg(test)]
mod tests {
    use super::*;

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
}
