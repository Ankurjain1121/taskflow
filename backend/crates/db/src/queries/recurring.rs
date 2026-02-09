use chrono::{DateTime, Duration, Utc};
use serde::Deserialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{RecurrencePattern, RecurringTaskConfig};

/// Error type for recurring task query operations
#[derive(Debug, thiserror::Error)]
pub enum RecurringQueryError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("User is not a member of this board")]
    NotBoardMember,
    #[error("Recurring config not found")]
    NotFound,
    #[error("Task not found")]
    TaskNotFound,
}

/// Input for creating a recurring task config
#[derive(Debug, Deserialize)]
pub struct CreateRecurringInput {
    pub pattern: RecurrencePattern,
    pub cron_expression: Option<String>,
    pub interval_days: Option<i32>,
    pub max_occurrences: Option<i32>,
}

/// Input for updating a recurring task config
#[derive(Debug, Deserialize)]
pub struct UpdateRecurringInput {
    pub pattern: Option<RecurrencePattern>,
    pub cron_expression: Option<String>,
    pub interval_days: Option<i32>,
    pub max_occurrences: Option<i32>,
    pub is_active: Option<bool>,
}

/// Internal helper: get task's board_id
async fn get_task_board_id_internal(pool: &PgPool, task_id: Uuid) -> Result<Uuid, RecurringQueryError> {
    let board_id = sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT board_id FROM tasks WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(task_id)
    .fetch_optional(pool)
    .await?
    .ok_or(RecurringQueryError::TaskNotFound)?;

    Ok(board_id)
}

/// Internal helper: verify board membership
async fn verify_board_membership_internal(
    pool: &PgPool,
    board_id: Uuid,
    user_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM board_members
            WHERE board_id = $1 AND user_id = $2
        )
        "#,
    )
    .bind(board_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    Ok(result)
}

/// Calculate the next run time based on the recurrence pattern
fn calculate_next_run(
    from: DateTime<Utc>,
    pattern: &RecurrencePattern,
    interval_days: Option<i32>,
) -> DateTime<Utc> {
    match pattern {
        RecurrencePattern::Daily => from + Duration::days(1),
        RecurrencePattern::Weekly => from + Duration::days(7),
        RecurrencePattern::Biweekly => from + Duration::days(14),
        RecurrencePattern::Monthly => from + Duration::days(30),
        RecurrencePattern::Custom => {
            let days = interval_days.unwrap_or(1) as i64;
            from + Duration::days(days)
        }
    }
}

/// Get the recurring config for a task.
/// Verifies board membership through the task's board.
pub async fn get_config_for_task(
    pool: &PgPool,
    task_id: Uuid,
    user_id: Uuid,
) -> Result<RecurringTaskConfig, RecurringQueryError> {
    // Verify board membership
    let board_id = get_task_board_id_internal(pool, task_id).await?;
    if !verify_board_membership_internal(pool, board_id, user_id).await? {
        return Err(RecurringQueryError::NotBoardMember);
    }

    let config = sqlx::query_as::<_, RecurringTaskConfig>(
        r#"
        SELECT
            id,
            task_id,
            pattern as "pattern: RecurrencePattern",
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
            updated_at
        FROM recurring_task_configs
        WHERE task_id = $1
        "#,
    )
    .bind(task_id)
    .fetch_optional(pool)
    .await?
    .ok_or(RecurringQueryError::NotFound)?;

    Ok(config)
}

/// Create a new recurring task config.
/// Validates task exists and board membership.
pub async fn create_config(
    pool: &PgPool,
    task_id: Uuid,
    input: CreateRecurringInput,
    user_id: Uuid,
    tenant_id: Uuid,
) -> Result<RecurringTaskConfig, RecurringQueryError> {
    // Verify task exists and get board_id
    let board_id = get_task_board_id_internal(pool, task_id).await?;

    // Verify board membership
    if !verify_board_membership_internal(pool, board_id, user_id).await? {
        return Err(RecurringQueryError::NotBoardMember);
    }

    let id = Uuid::new_v4();
    let now = Utc::now();
    let next_run = calculate_next_run(now, &input.pattern, input.interval_days);

    let config = sqlx::query_as::<_, RecurringTaskConfig>(
        r#"
        INSERT INTO recurring_task_configs (
            id, task_id, pattern, cron_expression, interval_days,
            next_run_at, is_active, max_occurrences, occurrences_created,
            board_id, tenant_id, created_by_id, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, true, $7, 0, $8, $9, $10, $11, $11)
        RETURNING
            id,
            task_id,
            pattern as "pattern: RecurrencePattern",
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
            updated_at
        "#,
    )
    .bind(id)
    .bind(task_id)
    .bind(&input.pattern)
    .bind(&input.cron_expression)
    .bind(input.interval_days)
    .bind(next_run)
    .bind(input.max_occurrences)
    .bind(board_id)
    .bind(tenant_id)
    .bind(user_id)
    .bind(now)
    .fetch_one(pool)
    .await?;

    Ok(config)
}

/// Update an existing recurring task config.
pub async fn update_config(
    pool: &PgPool,
    config_id: Uuid,
    input: UpdateRecurringInput,
    user_id: Uuid,
) -> Result<RecurringTaskConfig, RecurringQueryError> {
    // Fetch existing config to verify it exists
    let existing = sqlx::query_as::<_, RecurringTaskConfig>(
        r#"
        SELECT
            id,
            task_id,
            pattern as "pattern: RecurrencePattern",
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
            updated_at
        FROM recurring_task_configs
        WHERE id = $1
        "#,
    )
    .bind(config_id)
    .fetch_optional(pool)
    .await?
    .ok_or(RecurringQueryError::NotFound)?;

    // Verify board membership
    if !verify_board_membership_internal(pool, existing.board_id, user_id).await? {
        return Err(RecurringQueryError::NotBoardMember);
    }

    let new_pattern = input.pattern.unwrap_or(existing.pattern.clone());
    let new_interval = input.interval_days.or(existing.interval_days);
    let new_cron = input.cron_expression.or(existing.cron_expression);
    let new_max = input.max_occurrences.or(existing.max_occurrences);
    let new_active = input.is_active.unwrap_or(existing.is_active);

    // Recalculate next_run_at if pattern or interval changed
    let new_next_run = calculate_next_run(Utc::now(), &new_pattern, new_interval);

    let config = sqlx::query_as::<_, RecurringTaskConfig>(
        r#"
        UPDATE recurring_task_configs
        SET pattern = $2,
            cron_expression = $3,
            interval_days = $4,
            max_occurrences = $5,
            is_active = $6,
            next_run_at = $7,
            updated_at = NOW()
        WHERE id = $1
        RETURNING
            id,
            task_id,
            pattern as "pattern: RecurrencePattern",
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
            updated_at
        "#,
    )
    .bind(config_id)
    .bind(&new_pattern)
    .bind(&new_cron)
    .bind(new_interval)
    .bind(new_max)
    .bind(new_active)
    .bind(new_next_run)
    .fetch_one(pool)
    .await?;

    Ok(config)
}

/// Delete a recurring task config.
pub async fn delete_config(
    pool: &PgPool,
    config_id: Uuid,
    user_id: Uuid,
) -> Result<(), RecurringQueryError> {
    // Fetch config to verify board membership
    let existing = sqlx::query_as::<_, RecurringTaskConfig>(
        r#"
        SELECT
            id,
            task_id,
            pattern as "pattern: RecurrencePattern",
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
            updated_at
        FROM recurring_task_configs
        WHERE id = $1
        "#,
    )
    .bind(config_id)
    .fetch_optional(pool)
    .await?
    .ok_or(RecurringQueryError::NotFound)?;

    // Verify board membership
    if !verify_board_membership_internal(pool, existing.board_id, user_id).await? {
        return Err(RecurringQueryError::NotBoardMember);
    }

    sqlx::query(
        r#"
        DELETE FROM recurring_task_configs WHERE id = $1
        "#,
    )
    .bind(config_id)
    .execute(pool)
    .await?;

    Ok(())
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
            pattern as "pattern: RecurrencePattern",
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
            updated_at
        FROM recurring_task_configs
        WHERE next_run_at <= NOW()
          AND is_active = true
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
    // 1. Fetch source task
    let source_task = sqlx::query_as::<_, SourceTask>(
        r#"
        SELECT id, title, description, priority, column_id, board_id, tenant_id, created_by_id
        FROM tasks
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(config.task_id)
    .fetch_optional(pool)
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
            created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
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
    .bind(now)
    .execute(pool)
    .await?;

    // 3. Calculate next run
    let new_occurrences = config.occurrences_created + 1;
    let next_run = calculate_next_run(config.next_run_at, &config.pattern, config.interval_days);

    // 4 & 5. Update config
    let should_deactivate = config
        .max_occurrences
        .map(|max| new_occurrences >= max)
        .unwrap_or(false);

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
    .execute(pool)
    .await?;

    Ok(new_task_id)
}

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
}
