use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::RecurringTaskConfig;

use super::recurring::{calculate_next_run, RecurringQueryError};

/// Internal struct for fetching source task fields
#[derive(sqlx::FromRow)]
struct SourceTask {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub priority: crate::models::TaskPriority,
    pub column_id: Uuid,
    pub board_id: Uuid,
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
        r#"
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
            board_id,
            tenant_id,
            created_by_id,
            created_at,
            updated_at,
            end_date,
            skip_weekends,
            days_of_week,
            day_of_month,
            creation_mode,
            position_id
        FROM recurring_task_configs
        WHERE next_run_at <= NOW()
          AND is_active = true
          AND creation_mode = 'on_schedule'
        ORDER BY next_run_at ASC
        "#,
    )
    .fetch_all(pool)
    .await?;

    Ok(configs)
}

/// Create a recurring task instance from a config.
/// 1. Fetch source task by config.task_id
/// 2. INSERT a new task with same title (append " (recurring)"), description, priority, column_id, board_id, tenant_id, created_by_id
/// 3. Set due_date to config.next_run_at
/// 4. Update config: last_run_at = now(), occurrences_created += 1, next_run_at = calculate_next_run
/// 5. If max_occurrences is set and occurrences_created >= max_occurrences, set is_active = false
pub async fn create_recurring_instance(
    pool: &PgPool,
    config: &RecurringTaskConfig,
) -> Result<Uuid, RecurringQueryError> {
    let mut tx = pool.begin().await?;

    // 1. Fetch source task
    let source_task = sqlx::query_as::<_, SourceTask>(
        r#"
        SELECT id, title, description, priority, column_id, board_id,
               tenant_id, created_by_id, estimated_hours, start_date
        FROM tasks
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(config.task_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(RecurringQueryError::TaskNotFound)?;

    // 2. Create new task instance
    let new_task_id = Uuid::new_v4();
    let now = Utc::now();
    let recurring_title = format!("{} (recurring)", source_task.title);

    // Generate a position key - use a timestamp-based key for simplicity
    let position = format!("a{}", now.timestamp_millis());

    sqlx::query(
        r#"
        INSERT INTO tasks (
            id, title, description, priority, due_date,
            column_id, board_id, position, tenant_id, created_by_id,
            estimated_hours, start_date, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)
        "#,
    )
    .bind(new_task_id)
    .bind(&recurring_title)
    .bind(&source_task.description)
    .bind(&source_task.priority)
    .bind(config.next_run_at)
    .bind(source_task.column_id)
    .bind(source_task.board_id)
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
            config.board_id,
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
        // Legacy: copy from source task
        sqlx::query(
            r#"
            INSERT INTO task_assignees (task_id, user_id)
            SELECT $1, user_id FROM task_assignees WHERE task_id = $2
            "#,
        )
        .bind(new_task_id)
        .bind(source_task.id)
        .execute(&mut *tx)
        .await?;
    }

    // Copy labels from source task
    sqlx::query(
        r#"
        INSERT INTO task_labels (id, task_id, label_id)
        SELECT gen_random_uuid(), $1, label_id FROM task_labels WHERE task_id = $2
        "#,
    )
    .bind(new_task_id)
    .bind(source_task.id)
    .execute(&mut *tx)
    .await?;

    // Copy subtasks (reset is_completed to false)
    sqlx::query(
        r#"
        INSERT INTO subtasks (id, task_id, title, is_completed, position, created_at, updated_at)
        SELECT gen_random_uuid(), $1, title, false, position, NOW(), NOW()
        FROM subtasks WHERE task_id = $2
        ORDER BY position
        "#,
    )
    .bind(new_task_id)
    .bind(source_task.id)
    .execute(&mut *tx)
    .await?;

    // Copy custom field values
    sqlx::query(
        r#"
        INSERT INTO task_custom_field_values (id, task_id, field_id, value_text, value_number, value_date, value_bool, created_at, updated_at)
        SELECT gen_random_uuid(), $1, field_id, value_text, value_number, value_date, value_bool, NOW(), NOW()
        FROM task_custom_field_values WHERE task_id = $2
        "#,
    )
    .bind(new_task_id)
    .bind(source_task.id)
    .execute(&mut *tx)
    .await?;

    // 3. Calculate next run
    let new_occurrences = config.occurrences_created + 1;
    let next_run = calculate_next_run(config.next_run_at, config);

    // 4 & 5. Update config
    let should_deactivate = config
        .max_occurrences
        .map(|max| new_occurrences >= max)
        .unwrap_or(false)
        || config.end_date.map(|end| next_run > end).unwrap_or(false);

    sqlx::query(
        r#"
        UPDATE recurring_task_configs
        SET last_run_at = $2,
            occurrences_created = $3,
            next_run_at = $4,
            is_active = $5,
            updated_at = $2
        WHERE id = $1
        "#,
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
