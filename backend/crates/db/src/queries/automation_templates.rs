use chrono::Utc;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::automation_template::AutomationTemplate;

/// List all automation templates for a workspace, optionally filtered by category.
pub async fn list_templates(
    pool: &PgPool,
    workspace_id: Uuid,
    category: Option<&str>,
) -> Result<Vec<AutomationTemplate>, sqlx::Error> {
    if let Some(cat) = category {
        sqlx::query_as::<_, AutomationTemplate>(
            r#"
            SELECT id, workspace_id, name, description, category,
                   trigger_type, trigger_config, action_type, action_config,
                   enabled, is_system, created_at, updated_at
            FROM automation_templates
            WHERE workspace_id = $1 AND category = $2
            ORDER BY is_system DESC, name ASC
            "#,
        )
        .bind(workspace_id)
        .bind(cat)
        .fetch_all(pool)
        .await
    } else {
        sqlx::query_as::<_, AutomationTemplate>(
            r#"
            SELECT id, workspace_id, name, description, category,
                   trigger_type, trigger_config, action_type, action_config,
                   enabled, is_system, created_at, updated_at
            FROM automation_templates
            WHERE workspace_id = $1
            ORDER BY is_system DESC, name ASC
            "#,
        )
        .bind(workspace_id)
        .fetch_all(pool)
        .await
    }
}

/// Get a single automation template by ID.
pub async fn get_template(
    pool: &PgPool,
    template_id: Uuid,
) -> Result<Option<AutomationTemplate>, sqlx::Error> {
    sqlx::query_as::<_, AutomationTemplate>(
        r#"
        SELECT id, workspace_id, name, description, category,
               trigger_type, trigger_config, action_type, action_config,
               enabled, is_system, created_at, updated_at
        FROM automation_templates
        WHERE id = $1
        "#,
    )
    .bind(template_id)
    .fetch_optional(pool)
    .await
}

/// Toggle a template's enabled status. Returns the updated template.
pub async fn toggle_template(
    pool: &PgPool,
    template_id: Uuid,
    enabled: bool,
) -> Result<Option<AutomationTemplate>, sqlx::Error> {
    sqlx::query_as::<_, AutomationTemplate>(
        r#"
        UPDATE automation_templates
        SET enabled = $2
        WHERE id = $1
        RETURNING id, workspace_id, name, description, category,
                  trigger_type, trigger_config, action_type, action_config,
                  enabled, is_system, created_at, updated_at
        "#,
    )
    .bind(template_id)
    .bind(enabled)
    .fetch_optional(pool)
    .await
}

/// Apply a template to a board by creating an automation_rule + automation_action
/// from the template's trigger/action config.
/// Returns the created automation rule ID.
pub async fn apply_template(
    pool: &PgPool,
    workspace_id: Uuid,
    template_id: Uuid,
    board_id: Uuid,
    user_id: Uuid,
    tenant_id: Uuid,
) -> Result<Uuid, sqlx::Error> {
    // Fetch the template
    let template = sqlx::query_as::<_, AutomationTemplate>(
        r#"
        SELECT id, workspace_id, name, description, category,
               trigger_type, trigger_config, action_type, action_config,
               enabled, is_system, created_at, updated_at
        FROM automation_templates
        WHERE id = $1 AND workspace_id = $2
        "#,
    )
    .bind(template_id)
    .bind(workspace_id)
    .fetch_optional(pool)
    .await?;

    let template = match template {
        Some(t) => t,
        None => {
            return Err(sqlx::Error::RowNotFound);
        }
    };

    let now = Utc::now();
    let rule_id = Uuid::new_v4();

    // Map template trigger_type string to the automation_trigger enum
    let trigger_enum = map_trigger_type(&template.trigger_type);
    let action_enum = map_action_type(&template.action_type);

    let mut tx = pool.begin().await?;

    // Create the automation rule
    sqlx::query(
        r#"
        INSERT INTO automation_rules (
            id, name, project_id, trigger, trigger_config,
            is_active, tenant_id, created_by_id, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4::automation_trigger, $5, true, $6, $7, $8, $8)
        "#,
    )
    .bind(rule_id)
    .bind(&template.name)
    .bind(board_id)
    .bind(trigger_enum)
    .bind(&template.trigger_config)
    .bind(tenant_id)
    .bind(user_id)
    .bind(now)
    .execute(&mut *tx)
    .await?;

    // Create the automation action
    sqlx::query(
        r#"
        INSERT INTO automation_actions (
            id, rule_id, action_type, action_config, position
        )
        VALUES ($1, $2, $3::automation_action_type, $4, 0)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(rule_id)
    .bind(action_enum)
    .bind(&template.action_config)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(rule_id)
}

/// Map a template trigger_type string to the Postgres enum value.
fn map_trigger_type(trigger_type: &str) -> &str {
    match trigger_type {
        "task_created" => "task_created",
        "task_moved" | "task_status_change" => "task_moved",
        "task_assigned" => "task_assigned",
        "task_completed" => "task_completed",
        "task_priority_changed" => "task_priority_changed",
        "task_due_date_passed" => "task_due_date_passed",
        "subtask_completed" => "subtask_completed",
        "comment_added" => "comment_added",
        "custom_field_changed" => "custom_field_changed",
        "label_changed" => "label_changed",
        "due_date_approaching" => "due_date_approaching",
        "member_joined" => "member_joined",
        other => other,
    }
}

/// Map a template action_type string to the Postgres enum value.
fn map_action_type(action_type: &str) -> &str {
    match action_type {
        "move_task" => "move_task",
        "assign_task" => "assign_task",
        "set_priority" => "set_priority",
        "send_notification" => "send_notification",
        "add_label" => "add_label",
        "set_milestone" => "set_milestone",
        "create_subtask" => "create_subtask",
        "add_comment" => "add_comment",
        "set_due_date" => "set_due_date",
        "set_custom_field" => "set_custom_field",
        "send_webhook" => "send_webhook",
        "assign_to_role_members" => "assign_to_role_members",
        other => other,
    }
}

/// Seed all 18 system automation templates for a workspace.
/// Uses ON CONFLICT to be idempotent — safe to call multiple times.
pub async fn seed_system_templates(pool: &PgPool, workspace_id: Uuid) -> Result<(), sqlx::Error> {
    let templates: Vec<(
        &str,
        &str,
        &str,
        &str,
        serde_json::Value,
        &str,
        serde_json::Value,
    )> = vec![
        // ── Task Management (6) ──
        (
            "Auto-assign to creator",
            "Automatically assign new tasks to the person who created them",
            "task_management",
            "task_created",
            serde_json::json!({}),
            "assign_task",
            serde_json::json!({"assign_to": "creator"}),
        ),
        (
            "Move completed tasks to Done",
            "When all subtasks are completed, move the parent task to Done column",
            "task_management",
            "subtask_completed",
            serde_json::json!({"all_subtasks_done": true}),
            "move_task",
            serde_json::json!({"to_column": "Done"}),
        ),
        (
            "Set high priority for overdue",
            "Automatically escalate priority when a task passes its due date",
            "task_management",
            "task_due_date_passed",
            serde_json::json!({}),
            "set_priority",
            serde_json::json!({"priority": "high"}),
        ),
        (
            "Add review checklist",
            "Add a review subtask when a task is moved to Review",
            "task_management",
            "task_moved",
            serde_json::json!({"to_column": "Review"}),
            "create_subtask",
            serde_json::json!({"title": "Code review completed"}),
        ),
        (
            "Auto-label urgent tasks",
            "Add 'Urgent' label when priority is set to urgent",
            "task_management",
            "task_priority_changed",
            serde_json::json!({"new_priority": "urgent"}),
            "add_label",
            serde_json::json!({"label": "Urgent"}),
        ),
        (
            "Due date reminder",
            "Send a notification when a task's due date is approaching (24h)",
            "task_management",
            "due_date_approaching",
            serde_json::json!({"hours_before": 24}),
            "send_notification",
            serde_json::json!({"message": "Task due in 24 hours"}),
        ),
        // ── Notifications (4) ──
        (
            "Notify on assignment",
            "Send a notification when a task is assigned to someone",
            "notifications",
            "task_assigned",
            serde_json::json!({}),
            "send_notification",
            serde_json::json!({"message": "You have been assigned a new task"}),
        ),
        (
            "Notify on comment",
            "Send a notification when someone comments on a task",
            "notifications",
            "comment_added",
            serde_json::json!({}),
            "send_notification",
            serde_json::json!({"message": "New comment on your task"}),
        ),
        (
            "Notify on completion",
            "Notify the task creator when their task is completed",
            "notifications",
            "task_completed",
            serde_json::json!({}),
            "send_notification",
            serde_json::json!({"message": "Your task has been completed", "notify": "creator"}),
        ),
        (
            "Welcome new members",
            "Send a welcome notification when someone joins the board",
            "notifications",
            "member_joined",
            serde_json::json!({}),
            "send_notification",
            serde_json::json!({"message": "Welcome to the team!"}),
        ),
        // ── Workflow (4) ──
        (
            "Move to In Progress on assign",
            "Move task to In Progress when it gets assigned",
            "workflow",
            "task_assigned",
            serde_json::json!({}),
            "move_task",
            serde_json::json!({"to_column": "In Progress"}),
        ),
        (
            "Auto-close completed",
            "Move task to Done column when marked as completed",
            "workflow",
            "task_completed",
            serde_json::json!({}),
            "move_task",
            serde_json::json!({"to_column": "Done"}),
        ),
        (
            "Assign to role on move",
            "Assign to QA team members when task moves to Testing",
            "workflow",
            "task_moved",
            serde_json::json!({"to_column": "Testing"}),
            "assign_to_role_members",
            serde_json::json!({"role": "QA"}),
        ),
        (
            "Add comment on status change",
            "Add an audit comment when a task changes column",
            "workflow",
            "task_moved",
            serde_json::json!({}),
            "add_comment",
            serde_json::json!({"text": "Task status changed automatically"}),
        ),
        // ── Integrations (2) ──
        (
            "Webhook on completion",
            "Fire a webhook when a task is completed (e.g., for CI/CD triggers)",
            "integrations",
            "task_completed",
            serde_json::json!({}),
            "send_webhook",
            serde_json::json!({"url_placeholder": "https://your-webhook-url.com"}),
        ),
        (
            "Webhook on creation",
            "Fire a webhook when a new task is created",
            "integrations",
            "task_created",
            serde_json::json!({}),
            "send_webhook",
            serde_json::json!({"url_placeholder": "https://your-webhook-url.com"}),
        ),
        // ── Custom Fields (2) ──
        (
            "Set default custom field",
            "Set a default value for a custom field when a task is created",
            "custom_fields",
            "task_created",
            serde_json::json!({}),
            "set_custom_field",
            serde_json::json!({"field_name": "Environment", "value": "Production"}),
        ),
        (
            "Update field on move",
            "Update a custom field when a task moves to a specific column",
            "custom_fields",
            "task_moved",
            serde_json::json!({"to_column": "Done"}),
            "set_custom_field",
            serde_json::json!({"field_name": "Status", "value": "Completed"}),
        ),
    ];

    for (name, description, category, trigger_type, trigger_config, action_type, action_config) in
        templates
    {
        sqlx::query(
            r#"
            INSERT INTO automation_templates (
                workspace_id, name, description, category,
                trigger_type, trigger_config, action_type, action_config,
                enabled, is_system
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, true)
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(workspace_id)
        .bind(name)
        .bind(description)
        .bind(category)
        .bind(trigger_type)
        .bind(&trigger_config)
        .bind(action_type)
        .bind(&action_config)
        .execute(pool)
        .await?;
    }

    Ok(())
}
