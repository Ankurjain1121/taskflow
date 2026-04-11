use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::RecurringTaskConfig;

use super::recurring::{RecurringQueryError, calculate_next_run};

/// Internal struct for fetching source task fields
#[derive(sqlx::FromRow)]
struct SourceTask {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub priority: crate::models::TaskPriority,
    pub status_id: Option<Uuid>,
    pub project_id: Uuid,
    pub tenant_id: Uuid,
    pub created_by_id: Uuid,
    pub estimated_hours: Option<f64>,
    pub start_date: Option<DateTime<Utc>>,
}

/// Get all due recurring configs (next_run_at <= now() and is_active = true).
/// Used by the cron job to process recurring tasks.
pub async fn get_due_configs(
    pool: &PgPool,
) -> Result<Vec<RecurringTaskConfig>, RecurringQueryError> {
    let configs = sqlx::query_as::<_, RecurringTaskConfig>(
        r"
        SELECT
            id,
            task_id,
            pattern,
            cron_expression,
            interval_days,
            next_run_at,
            last_run_at,
            is_active,
            max_occurrences,
            occurrences_created,
            project_id,
            tenant_id,
            created_by_id,
            created_at,
            updated_at,
            end_date,
            skip_weekends,
            days_of_week,
            day_of_month,
            creation_mode,
            position_id,
            task_template
        FROM recurring_task_configs
        WHERE next_run_at <= NOW()
          AND is_active = true
          AND creation_mode = 'on_schedule'
        ORDER BY next_run_at ASC
        ",
    )
    .fetch_all(pool)
    .await?;

    Ok(configs)
}

/// Create a recurring task instance from a config.
/// Supports two paths:
/// - **Template path**: config.task_template is Some — create task from template JSONB
/// - **Legacy path**: config.task_id is Some — clone from source task
pub async fn create_recurring_instance(
    pool: &PgPool,
    config: &RecurringTaskConfig,
) -> Result<Uuid, RecurringQueryError> {
    let mut tx = pool.begin().await?;

    let new_task_id = Uuid::new_v4();
    let now = Utc::now();
    let position = format!("a{}", now.timestamp_millis());

    if let Some(ref template_json) = config.task_template {
        // ── Template path ──
        let template: crate::models::TaskTemplateData =
            serde_json::from_value(template_json.clone()).map_err(|e| {
                RecurringQueryError::Database(sqlx::Error::Protocol(format!(
                    "invalid task_template JSON: {e}"
                )))
            })?;

        let priority_str = template.priority.as_str();
        let priority: crate::models::TaskPriority =
            serde_json::from_value(serde_json::Value::String(priority_str.to_string()))
                .unwrap_or(crate::models::TaskPriority::Medium);

        let recurring_title = format!("{} (recurring)", template.title);

        sqlx::query(
            r"
            INSERT INTO tasks (
                id, title, description, priority, due_date,
                status_id, task_list_id, project_id, position, tenant_id, created_by_id,
                estimated_hours, reporting_person_id, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)
            ",
        )
        .bind(new_task_id)
        .bind(&recurring_title)
        .bind(&template.description)
        .bind(&priority)
        .bind(config.next_run_at)
        .bind(template.status_id)
        .bind(template.task_list_id)
        .bind(config.project_id)
        .bind(&position)
        .bind(config.tenant_id)
        .bind(config.created_by_id)
        .bind(template.estimated_hours)
        .bind(template.reporting_person_id)
        .bind(now)
        .execute(&mut *tx)
        .await?;

        // Assignees from template
        for uid in &template.assignee_ids {
            sqlx::query(
                "INSERT INTO task_assignees (task_id, user_id) VALUES ($1, $2) ON CONFLICT (task_id, user_id) DO NOTHING",
            )
            .bind(new_task_id)
            .bind(uid)
            .execute(&mut *tx)
            .await?;
        }

        // Watchers from template
        for uid in &template.watcher_ids {
            sqlx::query(
                "INSERT INTO task_watchers (id, task_id, user_id) VALUES ($1, $2, $3) ON CONFLICT (task_id, user_id) DO NOTHING",
            )
            .bind(Uuid::new_v4())
            .bind(new_task_id)
            .bind(uid)
            .execute(&mut *tx)
            .await?;
        }

        // Labels from template
        for label_id in &template.label_ids {
            sqlx::query(
                "INSERT INTO task_labels (id, task_id, label_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
            )
            .bind(Uuid::new_v4())
            .bind(new_task_id)
            .bind(label_id)
            .execute(&mut *tx)
            .await?;
        }

        // Subtasks from template (as child tasks)
        for (i, subtask) in template.subtasks.iter().enumerate() {
            let child_id = Uuid::new_v4();
            let child_position = format!(
                "a{}",
                now.timestamp_millis() + i64::try_from(i).unwrap_or(i64::MAX) + 1
            );
            sqlx::query(
                r"
                INSERT INTO tasks (
                    id, title, parent_task_id, depth, priority,
                    project_id, position, tenant_id, created_by_id,
                    created_at, updated_at
                )
                VALUES ($1, $2, $3, 1, 'medium', $4, $5, $6, $7, $8, $8)
                ",
            )
            .bind(child_id)
            .bind(&subtask.title)
            .bind(new_task_id)
            .bind(config.project_id)
            .bind(&child_position)
            .bind(config.tenant_id)
            .bind(config.created_by_id)
            .bind(now)
            .execute(&mut *tx)
            .await?;

            // Assign subtask if specified
            if let Some(assignee_id) = subtask.assigned_to_id {
                sqlx::query(
                    "INSERT INTO task_assignees (task_id, user_id) VALUES ($1, $2) ON CONFLICT (task_id, user_id) DO NOTHING",
                )
                .bind(child_id)
                .bind(assignee_id)
                .execute(&mut *tx)
                .await?;
            }
        }
    } else {
        // ── Legacy path: clone from source task ──
        let source_task_id = config.task_id.ok_or(RecurringQueryError::TaskNotFound)?;

        let source_task = sqlx::query_as::<_, SourceTask>(
            r"
            SELECT id, title, description, priority, status_id, project_id,
                   tenant_id, created_by_id, estimated_hours, start_date
            FROM tasks
            WHERE id = $1 AND deleted_at IS NULL
            ",
        )
        .bind(source_task_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(RecurringQueryError::TaskNotFound)?;

        let recurring_title = format!("{} (recurring)", source_task.title);

        sqlx::query(
            r"
            INSERT INTO tasks (
                id, title, description, priority, due_date,
                status_id, project_id, position, tenant_id, created_by_id,
                estimated_hours, start_date, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)
            ",
        )
        .bind(new_task_id)
        .bind(&recurring_title)
        .bind(&source_task.description)
        .bind(&source_task.priority)
        .bind(config.next_run_at)
        .bind(source_task.status_id)
        .bind(source_task.project_id)
        .bind(&position)
        .bind(source_task.tenant_id)
        .bind(source_task.created_by_id)
        .bind(source_task.estimated_hours)
        .bind(source_task.start_date)
        .bind(now)
        .execute(&mut *tx)
        .await?;

        // Position-based assignment or legacy copy
        if let Some(pos_id) = config.position_id {
            let assignee_ids = crate::queries::positions::resolve_assignees(
                pool,
                pos_id,
                config.project_id,
                config.tenant_id,
            )
            .await?;
            for uid in &assignee_ids {
                sqlx::query(
                    "INSERT INTO task_assignees (task_id, user_id) VALUES ($1, $2) ON CONFLICT (task_id, user_id) DO NOTHING",
                )
                .bind(new_task_id)
                .bind(uid)
                .execute(&mut *tx)
                .await?;
            }
        } else {
            sqlx::query(
                r"
                INSERT INTO task_assignees (task_id, user_id)
                SELECT $1, user_id FROM task_assignees WHERE task_id = $2
                ",
            )
            .bind(new_task_id)
            .bind(source_task.id)
            .execute(&mut *tx)
            .await?;
        }

        // Copy labels from source task
        sqlx::query(
            r"
            INSERT INTO task_labels (id, task_id, label_id)
            SELECT gen_random_uuid(), $1, label_id FROM task_labels WHERE task_id = $2
            ",
        )
        .bind(new_task_id)
        .bind(source_task.id)
        .execute(&mut *tx)
        .await?;

        // Copy subtasks (reset is_completed to false)
        sqlx::query(
            r"
            INSERT INTO subtasks (id, task_id, title, is_completed, position, created_at, updated_at)
            SELECT gen_random_uuid(), $1, title, false, position, NOW(), NOW()
            FROM subtasks WHERE task_id = $2
            ORDER BY position
            ",
        )
        .bind(new_task_id)
        .bind(source_task.id)
        .execute(&mut *tx)
        .await?;

        // Copy custom field values
        sqlx::query(
            r"
            INSERT INTO task_custom_field_values (id, task_id, field_id, value_text, value_number, value_date, value_bool, created_at, updated_at)
            SELECT gen_random_uuid(), $1, field_id, value_text, value_number, value_date, value_bool, NOW(), NOW()
            FROM task_custom_field_values WHERE task_id = $2
            ",
        )
        .bind(new_task_id)
        .bind(source_task.id)
        .execute(&mut *tx)
        .await?;
    }

    // Calculate next run and update config (shared by both paths)
    let new_occurrences = config.occurrences_created + 1;
    let next_run = calculate_next_run(config.next_run_at, config);

    let should_deactivate = config
        .max_occurrences
        .is_some_and(|max| new_occurrences >= max)
        || config.end_date.is_some_and(|end| next_run > end);

    sqlx::query(
        r"
        UPDATE recurring_task_configs
        SET last_run_at = $2,
            occurrences_created = $3,
            next_run_at = $4,
            is_active = $5,
            updated_at = $2
        WHERE id = $1
        ",
    )
    .bind(config.id)
    .bind(now)
    .bind(new_occurrences)
    .bind(next_run)
    .bind(!should_deactivate)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(new_task_id)
}
