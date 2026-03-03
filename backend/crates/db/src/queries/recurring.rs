use chrono::{DateTime, Datelike, Duration, Utc};
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
    pub end_date: Option<DateTime<Utc>>,
    pub skip_weekends: Option<bool>,
    pub days_of_week: Option<Vec<i32>>,
    pub day_of_month: Option<i32>,
    pub creation_mode: Option<String>,
    pub position_id: Option<Uuid>,
}

/// Input for updating a recurring task config
#[derive(Debug, Deserialize)]
pub struct UpdateRecurringInput {
    pub pattern: Option<RecurrencePattern>,
    pub cron_expression: Option<String>,
    pub interval_days: Option<i32>,
    pub max_occurrences: Option<i32>,
    pub is_active: Option<bool>,
    pub end_date: Option<DateTime<Utc>>,
    pub skip_weekends: Option<bool>,
    pub days_of_week: Option<Vec<i32>>,
    pub day_of_month: Option<i32>,
    pub creation_mode: Option<String>,
}

/// Build a temporary config struct for next-run calculation
fn build_calc_config(
    pattern: &RecurrencePattern,
    interval_days: Option<i32>,
    skip_weekends: bool,
    days_of_week: &[i32],
    day_of_month: Option<i32>,
) -> RecurringTaskConfig {
    RecurringTaskConfig {
        id: Uuid::nil(),
        task_id: Uuid::nil(),
        pattern: pattern.clone(),
        cron_expression: None,
        interval_days,
        next_run_at: Utc::now(),
        last_run_at: None,
        is_active: true,
        max_occurrences: None,
        occurrences_created: 0,
        board_id: Uuid::nil(),
        tenant_id: Uuid::nil(),
        created_by_id: Uuid::nil(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
        end_date: None,
        skip_weekends,
        days_of_week: days_of_week.to_vec(),
        day_of_month,
        creation_mode: "on_schedule".to_string(),
        position_id: None,
    }
}

/// Internal helper: get task's board_id
async fn get_task_board_id_internal(
    pool: &PgPool,
    task_id: Uuid,
) -> Result<Uuid, RecurringQueryError> {
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

/// Add one calendar month to a DateTime, clamping to month-end if needed.
fn add_months(from: DateTime<Utc>, months: u32) -> DateTime<Utc> {
    let year = from.year();
    let month = from.month();
    let day = from.day();

    let total_months = (year * 12 + month as i32 - 1) + months as i32;
    let new_year = total_months / 12;
    let new_month = (total_months % 12) as u32 + 1;

    // Clamp day to the last day of the target month
    let days_in_month = days_in_month(new_year, new_month);
    let new_day = day.min(days_in_month);

    from.with_year(new_year)
        .and_then(|d| d.with_month(new_month))
        .and_then(|d| d.with_day(new_day))
        .unwrap_or(from + Duration::days(30))
}

/// Get the number of days in a given month/year
fn days_in_month(year: i32, month: u32) -> u32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0) {
                29
            } else {
                28
            }
        }
        _ => 30,
    }
}

/// Calculate the next run time based on the recurrence pattern
fn calculate_next_run(from: DateTime<Utc>, config: &RecurringTaskConfig) -> DateTime<Utc> {
    let next = match config.pattern {
        RecurrencePattern::Daily => from + Duration::days(1),
        RecurrencePattern::Weekly => from + Duration::days(7),
        RecurrencePattern::Biweekly => from + Duration::days(14),
        RecurrencePattern::Monthly => {
            if let Some(dom) = config.day_of_month {
                // Use specific day of month
                let mut next = add_months(from, 1);
                let max_day = days_in_month(next.year(), next.month());
                let target_day = (dom as u32).min(max_day);
                next = next.with_day(target_day).unwrap_or(next);
                next
            } else {
                add_months(from, 1)
            }
        }
        RecurrencePattern::Yearly => add_months(from, 12),
        RecurrencePattern::Weekdays => {
            // Next weekday (Mon-Fri)
            let mut next = from + Duration::days(1);
            while next.weekday().num_days_from_monday() >= 5 {
                next += Duration::days(1);
            }
            next
        }
        RecurrencePattern::CustomWeekly => {
            // Find the next day in the days_of_week list
            if config.days_of_week.is_empty() {
                return from + Duration::days(7);
            }
            let current_dow = from.weekday().num_days_from_monday() as i32; // 0=Mon
                                                                            // Find next matching day this week or next week
            let mut best_offset = 7i64; // worst case: same day next week
            for &dow in &config.days_of_week {
                let dow = dow.clamp(0, 6);
                let offset = ((dow - current_dow).rem_euclid(7)) as i64;
                let offset = if offset == 0 { 7 } else { offset };
                if offset < best_offset {
                    best_offset = offset;
                }
            }
            from + Duration::days(best_offset)
        }
        RecurrencePattern::Custom => {
            let days = config.interval_days.unwrap_or(1) as i64;
            from + Duration::days(days)
        }
    };

    // Skip weekends if configured
    if config.skip_weekends {
        skip_to_weekday(next)
    } else {
        next
    }
}

/// Advance a date to the next weekday (Mon-Fri) if it falls on a weekend
fn skip_to_weekday(dt: DateTime<Utc>) -> DateTime<Utc> {
    match dt.weekday().num_days_from_monday() {
        5 => dt + Duration::days(2), // Saturday -> Monday
        6 => dt + Duration::days(1), // Sunday -> Monday
        _ => dt,
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
    let skip_wk = input.skip_weekends.unwrap_or(false);
    let dow = input.days_of_week.clone().unwrap_or_default();
    let dom = input.day_of_month;
    let creation_mode = input
        .creation_mode
        .clone()
        .unwrap_or_else(|| "on_schedule".to_string());
    let calc = build_calc_config(&input.pattern, input.interval_days, skip_wk, &dow, dom);
    let next_run = calculate_next_run(now, &calc);

    let config = sqlx::query_as::<_, RecurringTaskConfig>(
        r#"
        INSERT INTO recurring_task_configs (
            id, task_id, pattern, cron_expression, interval_days,
            next_run_at, is_active, max_occurrences, occurrences_created,
            board_id, tenant_id, created_by_id,
            end_date, skip_weekends, days_of_week, day_of_month, creation_mode,
            created_at, updated_at, position_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, true, $7, 0, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16, $17)
        RETURNING
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
    .bind(input.end_date)
    .bind(skip_wk)
    .bind(&dow)
    .bind(dom)
    .bind(&creation_mode)
    .bind(now)
    .bind(input.position_id)
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
    let new_end_date = input.end_date.or(existing.end_date);
    let new_skip_wk = input.skip_weekends.unwrap_or(existing.skip_weekends);
    let new_dow = input
        .days_of_week
        .clone()
        .unwrap_or(existing.days_of_week.clone());
    let new_dom = input.day_of_month.or(existing.day_of_month);
    let new_creation_mode = input
        .creation_mode
        .clone()
        .unwrap_or(existing.creation_mode.clone());

    // Recalculate next_run_at if pattern or interval changed
    let calc = build_calc_config(&new_pattern, new_interval, new_skip_wk, &new_dow, new_dom);
    let new_next_run = calculate_next_run(Utc::now(), &calc);

    let config = sqlx::query_as::<_, RecurringTaskConfig>(
        r#"
        UPDATE recurring_task_configs
        SET pattern = $2,
            cron_expression = $3,
            interval_days = $4,
            max_occurrences = $5,
            is_active = $6,
            next_run_at = $7,
            end_date = $8,
            skip_weekends = $9,
            days_of_week = $10,
            day_of_month = $11,
            creation_mode = $12,
            updated_at = NOW()
        WHERE id = $1
        RETURNING
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
        "#,
    )
    .bind(config_id)
    .bind(&new_pattern)
    .bind(&new_cron)
    .bind(new_interval)
    .bind(new_max)
    .bind(new_active)
    .bind(new_next_run)
    .bind(new_end_date)
    .bind(new_skip_wk)
    .bind(&new_dow)
    .bind(new_dom)
    .bind(&new_creation_mode)
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::TaskPriority;
    use crate::queries::{auth, boards, tasks, workspaces};
    use sqlx::PgPool;

    const FAKE_HASH: &str = "$argon2id$v=19$m=19456,t=2,p=1$fake_salt$fake_hash_for_test";

    fn unique_email() -> String {
        format!("inttest-recurring-{}@example.com", Uuid::new_v4())
    }

    async fn test_pool() -> PgPool {
        PgPool::connect(
            "postgresql://taskflow:189015388bb0f90c999ea6b975d7e494@localhost:5433/taskflow",
        )
        .await
        .expect("Failed to connect to test database")
    }

    async fn setup_user(pool: &PgPool) -> (Uuid, Uuid) {
        let user =
            auth::create_user_with_tenant(pool, &unique_email(), "Recurring Test User", FAKE_HASH)
                .await
                .expect("create_user_with_tenant");
        (user.tenant_id, user.id)
    }

    async fn setup_user_and_workspace(pool: &PgPool) -> (Uuid, Uuid, Uuid) {
        let (tenant_id, user_id) = setup_user(pool).await;
        let ws = workspaces::create_workspace(pool, "Recurring WS", None, tenant_id, user_id)
            .await
            .expect("create_workspace");
        (tenant_id, user_id, ws.id)
    }

    async fn setup_full(pool: &PgPool) -> (Uuid, Uuid, Uuid, Uuid, Uuid) {
        let (tenant_id, user_id, ws_id) = setup_user_and_workspace(pool).await;
        let bwc = boards::create_board(pool, "Recurring Board", None, ws_id, tenant_id, user_id)
            .await
            .expect("create_board");
        let first_col_id = bwc.columns[0].id;
        (tenant_id, user_id, ws_id, bwc.board.id, first_col_id)
    }

    async fn setup_task(pool: &PgPool) -> (Uuid, Uuid, Uuid, Uuid) {
        let (tenant_id, user_id, _ws_id, board_id, col_id) = setup_full(pool).await;
        let input = tasks::CreateTaskInput {
            title: format!("Recurring Source Task {}", Uuid::new_v4()),
            description: Some("Source task for recurring".to_string()),
            priority: TaskPriority::Medium,
            due_date: None,
            start_date: None,
            estimated_hours: None,
            column_id: col_id,
            group_id: None,
            milestone_id: None,
            assignee_ids: None,
            label_ids: None,
        };
        let task = tasks::create_task(pool, board_id, input, tenant_id, user_id)
            .await
            .expect("create task for recurring");
        (tenant_id, user_id, board_id, task.id)
    }

    #[tokio::test]
    async fn test_create_recurring_config() {
        let pool = test_pool().await;
        let (tenant_id, user_id, _board_id, task_id) = setup_task(&pool).await;

        let input = CreateRecurringInput {
            pattern: RecurrencePattern::Daily,
            cron_expression: None,
            interval_days: None,
            max_occurrences: Some(10),
            end_date: None,
            skip_weekends: Some(false),
            days_of_week: None,
            day_of_month: None,
            creation_mode: None,
            position_id: None,
        };

        let config = create_config(&pool, task_id, input, user_id, tenant_id)
            .await
            .expect("create_config should succeed");

        assert_eq!(config.task_id, task_id);
        assert_eq!(config.pattern, RecurrencePattern::Daily);
        assert!(config.is_active);
        assert_eq!(config.max_occurrences, Some(10));
        assert_eq!(config.occurrences_created, 0);
        assert_eq!(config.tenant_id, tenant_id);
        assert_eq!(config.created_by_id, user_id);
        assert_eq!(config.creation_mode, "on_schedule");
    }

    #[tokio::test]
    async fn test_get_config_for_task() {
        let pool = test_pool().await;
        let (tenant_id, user_id, _board_id, task_id) = setup_task(&pool).await;

        let input = CreateRecurringInput {
            pattern: RecurrencePattern::Weekly,
            cron_expression: None,
            interval_days: None,
            max_occurrences: None,
            end_date: None,
            skip_weekends: None,
            days_of_week: None,
            day_of_month: None,
            creation_mode: Some("on_completion".to_string()),
            position_id: None,
        };

        let created = create_config(&pool, task_id, input, user_id, tenant_id)
            .await
            .expect("create_config");

        let fetched = get_config_for_task(&pool, task_id, user_id)
            .await
            .expect("get_config_for_task should succeed");

        assert_eq!(fetched.id, created.id);
        assert_eq!(fetched.task_id, task_id);
        assert_eq!(fetched.pattern, RecurrencePattern::Weekly);
        assert_eq!(fetched.creation_mode, "on_completion");
    }

    #[tokio::test]
    async fn test_update_recurring_config() {
        let pool = test_pool().await;
        let (tenant_id, user_id, _board_id, task_id) = setup_task(&pool).await;

        let input = CreateRecurringInput {
            pattern: RecurrencePattern::Daily,
            cron_expression: None,
            interval_days: None,
            max_occurrences: None,
            end_date: None,
            skip_weekends: Some(false),
            days_of_week: None,
            day_of_month: None,
            creation_mode: None,
            position_id: None,
        };

        let created = create_config(&pool, task_id, input, user_id, tenant_id)
            .await
            .expect("create_config");

        let update_input = UpdateRecurringInput {
            pattern: Some(RecurrencePattern::Monthly),
            cron_expression: None,
            interval_days: None,
            max_occurrences: Some(5),
            is_active: Some(false),
            end_date: None,
            skip_weekends: Some(true),
            days_of_week: None,
            day_of_month: Some(15),
            creation_mode: None,
        };

        let updated = update_config(&pool, created.id, update_input, user_id)
            .await
            .expect("update_config should succeed");

        assert_eq!(updated.id, created.id);
        assert_eq!(updated.pattern, RecurrencePattern::Monthly);
        assert_eq!(updated.max_occurrences, Some(5));
        assert!(!updated.is_active);
        assert!(updated.skip_weekends);
        assert_eq!(updated.day_of_month, Some(15));
    }

    #[tokio::test]
    async fn test_delete_recurring_config() {
        let pool = test_pool().await;
        let (tenant_id, user_id, _board_id, task_id) = setup_task(&pool).await;

        let input = CreateRecurringInput {
            pattern: RecurrencePattern::Daily,
            cron_expression: None,
            interval_days: None,
            max_occurrences: None,
            end_date: None,
            skip_weekends: None,
            days_of_week: None,
            day_of_month: None,
            creation_mode: None,
            position_id: None,
        };

        let created = create_config(&pool, task_id, input, user_id, tenant_id)
            .await
            .expect("create_config");

        delete_config(&pool, created.id, user_id)
            .await
            .expect("delete_config should succeed");

        // Verify it's gone
        let result = get_config_for_task(&pool, task_id, user_id).await;
        assert!(result.is_err(), "config should be deleted");
    }

    #[tokio::test]
    async fn test_create_recurring_instance() {
        let pool = test_pool().await;
        let (tenant_id, user_id, _board_id, task_id) = setup_task(&pool).await;

        let input = CreateRecurringInput {
            pattern: RecurrencePattern::Daily,
            cron_expression: None,
            interval_days: None,
            max_occurrences: Some(3),
            end_date: None,
            skip_weekends: Some(false),
            days_of_week: None,
            day_of_month: None,
            creation_mode: Some("on_schedule".to_string()),
            position_id: None,
        };

        let config = create_config(&pool, task_id, input, user_id, tenant_id)
            .await
            .expect("create_config");

        let new_task_id = create_recurring_instance(&pool, &config)
            .await
            .expect("create_recurring_instance should succeed");

        // Verify new task was created
        let new_task = sqlx::query_as::<_, crate::models::Task>(
            r#"
            SELECT id, title, description, priority,
                   due_date, start_date, estimated_hours, board_id, column_id,
                   group_id, position, milestone_id, eisenhower_urgency,
                   eisenhower_importance, tenant_id, created_by_id, deleted_at,
                   column_entered_at, created_at, updated_at, version
            FROM tasks WHERE id = $1
            "#,
        )
        .bind(new_task_id)
        .fetch_one(&pool)
        .await
        .expect("new recurring task should exist");

        assert!(
            new_task.title.contains("(recurring)"),
            "title should contain (recurring)"
        );

        // Verify config was updated
        let updated_config = get_config_for_task(&pool, task_id, user_id)
            .await
            .expect("get updated config");
        assert_eq!(updated_config.occurrences_created, 1);
        assert!(updated_config.last_run_at.is_some());
    }
}
