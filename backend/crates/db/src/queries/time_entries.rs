use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use crate::models::TimeEntry;

/// Error type for time entry query operations
#[derive(Debug, thiserror::Error)]
pub enum TimeEntryQueryError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Time entry not found")]
    NotFound,
    #[error("Not a project member")]
    NotBoardMember,
    #[error("A timer is already running")]
    AlreadyRunning,
    #[error("Not the owner of this time entry")]
    NotOwner,
}

/// Input for starting a timer
#[derive(Debug, Deserialize)]
pub struct StartTimerInput {
    pub task_id: Uuid,
    pub user_id: Uuid,
    pub description: Option<String>,
    pub board_id: Uuid,
    pub tenant_id: Uuid,
    pub is_billable: Option<bool>,
}

/// Input for creating a manual time entry
#[derive(Debug, Deserialize)]
pub struct ManualEntryInput {
    pub task_id: Uuid,
    pub user_id: Uuid,
    pub description: Option<String>,
    pub started_at: DateTime<Utc>,
    pub ended_at: DateTime<Utc>,
    pub duration_minutes: i32,
    pub board_id: Uuid,
    pub tenant_id: Uuid,
    pub is_billable: Option<bool>,
}

/// Input for updating a time entry
#[derive(Debug, Deserialize)]
pub struct UpdateEntryInput {
    pub description: Option<String>,
    pub started_at: Option<DateTime<Utc>>,
    pub ended_at: Option<DateTime<Utc>>,
    pub duration_minutes: Option<i32>,
    pub is_billable: Option<bool>,
}

/// Aggregated time report per task
#[derive(Debug, FromRow, Serialize, Deserialize, Clone)]
pub struct TaskTimeReport {
    pub task_id: Uuid,
    pub task_title: String,
    pub total_minutes: i64,
    pub entries_count: i64,
}

/// Time entry with associated task title
#[derive(Debug, FromRow, Serialize, Deserialize, Clone)]
pub struct TimeEntryWithTask {
    pub id: Uuid,
    pub task_id: Uuid,
    pub user_id: Uuid,
    pub description: Option<String>,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub duration_minutes: Option<i32>,
    pub is_running: bool,
    pub project_id: Uuid,
    pub tenant_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub task_title: String,
    pub is_billable: bool,
}

/// Timesheet report entry (detailed per time entry)
#[derive(Debug, FromRow, Serialize, Deserialize, Clone)]
pub struct TimesheetEntry {
    pub id: Uuid,
    pub task_id: Uuid,
    pub task_title: String,
    pub user_id: Uuid,
    pub user_name: String,
    pub description: Option<String>,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub duration_minutes: i64,
    pub is_billable: bool,
    pub is_running: bool,
    pub billing_rate_cents: Option<i32>,
}

/// Timesheet report summary
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TimesheetReport {
    pub entries: Vec<TimesheetEntry>,
    pub summary: TimesheetSummary,
}

/// Timesheet summary totals
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TimesheetSummary {
    pub total_minutes: i64,
    pub billable_minutes: i64,
    pub non_billable_minutes: i64,
    pub total_cost_cents: i64,
}

use super::membership::verify_project_membership;

/// List all time entries for a task (verifies board membership)
pub async fn list_task_time_entries(
    pool: &PgPool,
    task_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<TimeEntry>, TimeEntryQueryError> {
    // Verify board membership via task's project_id
    let board_id = sqlx::query_scalar::<_, Uuid>(
        r#"SELECT project_id FROM tasks WHERE id = $1 AND deleted_at IS NULL"#,
    )
    .bind(task_id)
    .fetch_optional(pool)
    .await?
    .ok_or(TimeEntryQueryError::NotFound)?;

    if !verify_project_membership(pool, board_id, user_id).await? {
        return Err(TimeEntryQueryError::NotBoardMember);
    }

    let entries = sqlx::query_as::<_, TimeEntry>(
        r#"
        SELECT
            id, task_id, user_id, description, started_at, ended_at,
            duration_minutes, is_running, project_id, tenant_id,
            created_at, updated_at, is_billable
        FROM time_entries
        WHERE task_id = $1
        ORDER BY started_at DESC
        "#,
    )
    .bind(task_id)
    .fetch_all(pool)
    .await?;

    Ok(entries)
}

/// Start a timer for a task. Stops any running timer for this user first.
pub async fn start_timer(
    pool: &PgPool,
    input: StartTimerInput,
) -> Result<TimeEntry, TimeEntryQueryError> {
    if !verify_project_membership(pool, input.board_id, input.user_id).await? {
        return Err(TimeEntryQueryError::NotBoardMember);
    }

    // Stop any currently running timer for this user
    sqlx::query(
        r#"
        UPDATE time_entries
        SET
            ended_at = NOW(),
            duration_minutes = EXTRACT(EPOCH FROM (NOW() - started_at))::int / 60,
            is_running = false,
            updated_at = NOW()
        WHERE user_id = $1 AND is_running = true
        "#,
    )
    .bind(input.user_id)
    .execute(pool)
    .await?;

    // Create new running timer
    let id = Uuid::new_v4();
    let is_billable = input.is_billable.unwrap_or(false);
    let entry = sqlx::query_as::<_, TimeEntry>(
        r#"
        INSERT INTO time_entries (id, task_id, user_id, description, started_at, is_running, project_id, tenant_id, is_billable)
        VALUES ($1, $2, $3, $4, NOW(), true, $5, $6, $7)
        RETURNING
            id, task_id, user_id, description, started_at, ended_at,
            duration_minutes, is_running, project_id, tenant_id,
            created_at, updated_at, is_billable
        "#,
    )
    .bind(id)
    .bind(input.task_id)
    .bind(input.user_id)
    .bind(&input.description)
    .bind(input.board_id)
    .bind(input.tenant_id)
    .bind(is_billable)
    .fetch_one(pool)
    .await?;

    Ok(entry)
}

/// Stop a running timer
pub async fn stop_timer(
    pool: &PgPool,
    entry_id: Uuid,
    user_id: Uuid,
) -> Result<TimeEntry, TimeEntryQueryError> {
    // Verify ownership
    let owner_id =
        sqlx::query_scalar::<_, Uuid>(r#"SELECT user_id FROM time_entries WHERE id = $1"#)
            .bind(entry_id)
            .fetch_optional(pool)
            .await?
            .ok_or(TimeEntryQueryError::NotFound)?;

    if owner_id != user_id {
        return Err(TimeEntryQueryError::NotOwner);
    }

    let entry = sqlx::query_as::<_, TimeEntry>(
        r#"
        UPDATE time_entries
        SET
            ended_at = NOW(),
            duration_minutes = EXTRACT(EPOCH FROM (NOW() - started_at))::int / 60,
            is_running = false,
            updated_at = NOW()
        WHERE id = $1 AND is_running = true
        RETURNING
            id, task_id, user_id, description, started_at, ended_at,
            duration_minutes, is_running, project_id, tenant_id,
            created_at, updated_at, is_billable
        "#,
    )
    .bind(entry_id)
    .fetch_optional(pool)
    .await?
    .ok_or(TimeEntryQueryError::NotFound)?;

    Ok(entry)
}

/// Create a manual time entry (for logging time retroactively)
pub async fn create_manual_entry(
    pool: &PgPool,
    input: ManualEntryInput,
) -> Result<TimeEntry, TimeEntryQueryError> {
    if !verify_project_membership(pool, input.board_id, input.user_id).await? {
        return Err(TimeEntryQueryError::NotBoardMember);
    }

    let id = Uuid::new_v4();
    let is_billable = input.is_billable.unwrap_or(false);
    let entry = sqlx::query_as::<_, TimeEntry>(
        r#"
        INSERT INTO time_entries (id, task_id, user_id, description, started_at, ended_at, duration_minutes, is_running, project_id, tenant_id, is_billable)
        VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, $9, $10)
        RETURNING
            id, task_id, user_id, description, started_at, ended_at,
            duration_minutes, is_running, project_id, tenant_id,
            created_at, updated_at, is_billable
        "#,
    )
    .bind(id)
    .bind(input.task_id)
    .bind(input.user_id)
    .bind(&input.description)
    .bind(input.started_at)
    .bind(input.ended_at)
    .bind(input.duration_minutes)
    .bind(input.board_id)
    .bind(input.tenant_id)
    .bind(is_billable)
    .fetch_one(pool)
    .await?;

    Ok(entry)
}

/// Update a time entry
pub async fn update_entry(
    pool: &PgPool,
    id: Uuid,
    input: UpdateEntryInput,
    user_id: Uuid,
) -> Result<TimeEntry, TimeEntryQueryError> {
    // Verify ownership
    let owner_id =
        sqlx::query_scalar::<_, Uuid>(r#"SELECT user_id FROM time_entries WHERE id = $1"#)
            .bind(id)
            .fetch_optional(pool)
            .await?
            .ok_or(TimeEntryQueryError::NotFound)?;

    if owner_id != user_id {
        return Err(TimeEntryQueryError::NotOwner);
    }

    let entry = sqlx::query_as::<_, TimeEntry>(
        r#"
        UPDATE time_entries
        SET
            description = COALESCE($2, description),
            started_at = COALESCE($3, started_at),
            ended_at = COALESCE($4, ended_at),
            duration_minutes = COALESCE($5, duration_minutes),
            is_billable = COALESCE($6, is_billable),
            updated_at = NOW()
        WHERE id = $1
        RETURNING
            id, task_id, user_id, description, started_at, ended_at,
            duration_minutes, is_running, project_id, tenant_id,
            created_at, updated_at, is_billable
        "#,
    )
    .bind(id)
    .bind(&input.description)
    .bind(input.started_at)
    .bind(input.ended_at)
    .bind(input.duration_minutes)
    .bind(input.is_billable)
    .fetch_optional(pool)
    .await?
    .ok_or(TimeEntryQueryError::NotFound)?;

    Ok(entry)
}

/// Delete a time entry
pub async fn delete_entry(
    pool: &PgPool,
    id: Uuid,
    user_id: Uuid,
) -> Result<(), TimeEntryQueryError> {
    // Verify ownership
    let owner_id =
        sqlx::query_scalar::<_, Uuid>(r#"SELECT user_id FROM time_entries WHERE id = $1"#)
            .bind(id)
            .fetch_optional(pool)
            .await?
            .ok_or(TimeEntryQueryError::NotFound)?;

    if owner_id != user_id {
        return Err(TimeEntryQueryError::NotOwner);
    }

    let rows_affected = sqlx::query(r#"DELETE FROM time_entries WHERE id = $1"#)
        .bind(id)
        .execute(pool)
        .await?
        .rows_affected();

    if rows_affected == 0 {
        return Err(TimeEntryQueryError::NotFound);
    }

    Ok(())
}

/// Get aggregated time report for a board
pub async fn get_board_time_report(
    pool: &PgPool,
    board_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<TaskTimeReport>, TimeEntryQueryError> {
    if !verify_project_membership(pool, board_id, user_id).await? {
        return Err(TimeEntryQueryError::NotBoardMember);
    }

    let report = sqlx::query_as::<_, TaskTimeReport>(
        r#"
        SELECT
            t.id as task_id,
            t.title as task_title,
            COALESCE(SUM(te.duration_minutes)::bigint, 0) as total_minutes,
            COUNT(te.id)::bigint as entries_count
        FROM tasks t
        LEFT JOIN time_entries te ON te.task_id = t.id
        WHERE t.project_id = $1 AND t.deleted_at IS NULL
            AND (te.id IS NOT NULL)
        GROUP BY t.id, t.title
        ORDER BY total_minutes DESC
        "#,
    )
    .bind(board_id)
    .fetch_all(pool)
    .await?;

    Ok(report)
}

/// Get detailed timesheet report with billing for a project
pub async fn get_timesheet_report(
    pool: &PgPool,
    project_id: Uuid,
    user_id: Uuid,
    start_date: Option<NaiveDate>,
    end_date: Option<NaiveDate>,
    filter_user_id: Option<Uuid>,
    billable_only: Option<bool>,
) -> Result<TimesheetReport, TimeEntryQueryError> {
    if !verify_project_membership(pool, project_id, user_id).await? {
        return Err(TimeEntryQueryError::NotBoardMember);
    }

    let entries = sqlx::query_as::<_, TimesheetEntry>(
        r#"
        SELECT
            te.id,
            te.task_id,
            t.title as task_title,
            te.user_id,
            COALESCE(u.display_name, u.name, u.email) as user_name,
            te.description,
            te.started_at,
            te.ended_at,
            COALESCE(
                te.duration_minutes::bigint,
                EXTRACT(EPOCH FROM (NOW() - te.started_at))::bigint / 60
            ) as duration_minutes,
            te.is_billable,
            te.is_running,
            pm.billing_rate_cents
        FROM time_entries te
        JOIN tasks t ON t.id = te.task_id
        JOIN users u ON u.id = te.user_id
        LEFT JOIN project_members pm ON pm.project_id = te.project_id AND pm.user_id = te.user_id
        WHERE te.project_id = $1
            AND ($2::date IS NULL OR te.started_at >= $2::date::timestamp AT TIME ZONE 'UTC')
            AND ($3::date IS NULL OR te.started_at < ($3::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'UTC')
            AND ($4::uuid IS NULL OR te.user_id = $4)
            AND ($5::bool IS NULL OR $5 = false OR te.is_billable = true)
        ORDER BY te.started_at DESC
        "#,
    )
    .bind(project_id)
    .bind(start_date)
    .bind(end_date)
    .bind(filter_user_id)
    .bind(billable_only)
    .fetch_all(pool)
    .await?;

    // Compute summary
    let mut total_minutes: i64 = 0;
    let mut billable_minutes: i64 = 0;
    let mut total_cost_cents: i64 = 0;

    for entry in &entries {
        total_minutes += entry.duration_minutes;
        if entry.is_billable {
            billable_minutes += entry.duration_minutes;
            if let Some(rate) = entry.billing_rate_cents {
                // cost = minutes * rate_cents / 60
                total_cost_cents += entry.duration_minutes * rate as i64 / 60;
            }
        }
    }

    Ok(TimesheetReport {
        entries,
        summary: TimesheetSummary {
            total_minutes,
            billable_minutes,
            non_billable_minutes: total_minutes - billable_minutes,
            total_cost_cents,
        },
    })
}

/// Get the currently running timer for a user (with task info)
pub async fn get_running_timer(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Option<TimeEntryWithTask>, TimeEntryQueryError> {
    let entry = sqlx::query_as::<_, TimeEntryWithTask>(
        r#"
        SELECT
            te.id, te.task_id, te.user_id, te.description, te.started_at, te.ended_at,
            te.duration_minutes, te.is_running, te.project_id, te.tenant_id,
            te.created_at, te.updated_at, te.is_billable,
            t.title as task_title
        FROM time_entries te
        JOIN tasks t ON t.id = te.task_id
        WHERE te.user_id = $1 AND te.is_running = true
        LIMIT 1
        "#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    Ok(entry)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::TaskPriority;
    use crate::queries::{auth, boards, tasks, workspaces};
    use crate::test_helpers::test_pool;
    use chrono::Duration;

    const FAKE_HASH: &str = "$argon2id$v=19$m=19456,t=2,p=1$fake_salt$fake_hash_for_test";

    fn unique_email() -> String {
        format!("inttest-time-{}@example.com", Uuid::new_v4())
    }

    async fn setup_user(pool: &PgPool) -> (Uuid, Uuid) {
        let user =
            auth::create_user_with_tenant(pool, &unique_email(), "TimeEntry User", FAKE_HASH)
                .await
                .expect("create_user_with_tenant");
        (user.tenant_id, user.id)
    }

    async fn setup_user_and_workspace(pool: &PgPool) -> (Uuid, Uuid, Uuid) {
        let (tenant_id, user_id) = setup_user(pool).await;
        let ws = workspaces::create_workspace(pool, "TimeEntry WS", None, tenant_id, user_id)
            .await
            .expect("create_workspace");
        (tenant_id, user_id, ws.id)
    }

    async fn setup_full(pool: &PgPool) -> (Uuid, Uuid, Uuid, Uuid, Uuid) {
        let (tenant_id, user_id, ws_id) = setup_user_and_workspace(pool).await;
        let bwc = boards::create_board(pool, "TimeEntry Board", None, ws_id, tenant_id, user_id)
            .await
            .expect("create_board");
        let first_list_id = bwc.task_lists[0].id;
        (tenant_id, user_id, ws_id, bwc.project.id, first_list_id)
    }

    /// Setup full scenario with a task, returns (tenant_id, user_id, board_id, task_id)
    async fn setup_with_task(pool: &PgPool) -> (Uuid, Uuid, Uuid, Uuid) {
        let (tenant_id, user_id, _ws_id, board_id, col_id) = setup_full(pool).await;
        let input = tasks::CreateTaskInput {
            title: format!("TimeTask-{}", Uuid::new_v4()),
            description: None,
            priority: TaskPriority::Medium,
            due_date: None,
            start_date: None,
            estimated_hours: None,
            status_id: None,
            task_list_id: Some(col_id),
            milestone_id: None,
            assignee_ids: None,
            label_ids: None,
            parent_task_id: None,
        };
        let task = tasks::create_task(pool, board_id, input, tenant_id, user_id)
            .await
            .expect("create task for time entries");
        (tenant_id, user_id, board_id, task.id)
    }

    #[tokio::test]
    async fn test_start_timer() {
        let pool = test_pool().await;
        let (tenant_id, user_id, board_id, task_id) = setup_with_task(&pool).await;

        let input = StartTimerInput {
            task_id,
            user_id,
            description: Some("Working on it".to_string()),
            board_id,
            tenant_id,
            is_billable: None,
        };

        let entry = start_timer(&pool, input)
            .await
            .expect("start_timer should succeed");

        assert_eq!(entry.task_id, task_id);
        assert_eq!(entry.user_id, user_id);
        assert!(entry.is_running);
        assert!(entry.ended_at.is_none());
        assert_eq!(entry.description.as_deref(), Some("Working on it"));
        assert_eq!(entry.project_id, board_id);
        assert_eq!(entry.tenant_id, tenant_id);
        assert!(!entry.is_billable);
    }

    #[tokio::test]
    async fn test_stop_timer() {
        let pool = test_pool().await;
        let (tenant_id, user_id, board_id, task_id) = setup_with_task(&pool).await;

        let input = StartTimerInput {
            task_id,
            user_id,
            description: None,
            board_id,
            tenant_id,
            is_billable: None,
        };

        let started = start_timer(&pool, input).await.expect("start_timer");

        let stopped = stop_timer(&pool, started.id, user_id)
            .await
            .expect("stop_timer should succeed");

        assert!(!stopped.is_running);
        assert!(stopped.ended_at.is_some());
        assert!(stopped.duration_minutes.is_some());
    }

    #[tokio::test]
    async fn test_create_manual_entry() {
        let pool = test_pool().await;
        let (tenant_id, user_id, board_id, task_id) = setup_with_task(&pool).await;

        let started_at = Utc::now() - Duration::hours(2);
        let ended_at = Utc::now() - Duration::hours(1);

        let input = ManualEntryInput {
            task_id,
            user_id,
            description: Some("Manual logging".to_string()),
            started_at,
            ended_at,
            duration_minutes: 60,
            board_id,
            tenant_id,
            is_billable: Some(true),
        };

        let entry = create_manual_entry(&pool, input)
            .await
            .expect("create_manual_entry should succeed");

        assert_eq!(entry.task_id, task_id);
        assert_eq!(entry.user_id, user_id);
        assert!(!entry.is_running);
        assert!(entry.ended_at.is_some());
        assert_eq!(entry.duration_minutes, Some(60));
        assert_eq!(entry.description.as_deref(), Some("Manual logging"));
        assert!(entry.is_billable);
    }

    #[tokio::test]
    async fn test_billable_default_false() {
        let pool = test_pool().await;
        let (tenant_id, user_id, board_id, task_id) = setup_with_task(&pool).await;

        let started_at = Utc::now() - Duration::hours(2);
        let ended_at = Utc::now() - Duration::hours(1);

        let input = ManualEntryInput {
            task_id,
            user_id,
            description: None,
            started_at,
            ended_at,
            duration_minutes: 30,
            board_id,
            tenant_id,
            is_billable: None,
        };

        let entry = create_manual_entry(&pool, input)
            .await
            .expect("create_manual_entry");

        assert!(!entry.is_billable, "Default should be false");
    }

    #[tokio::test]
    async fn test_list_task_time_entries() {
        let pool = test_pool().await;
        let (tenant_id, user_id, board_id, task_id) = setup_with_task(&pool).await;

        // Create two manual entries
        let started1 = Utc::now() - Duration::hours(4);
        let ended1 = Utc::now() - Duration::hours(3);
        create_manual_entry(
            &pool,
            ManualEntryInput {
                task_id,
                user_id,
                description: Some("Entry 1".to_string()),
                started_at: started1,
                ended_at: ended1,
                duration_minutes: 60,
                board_id,
                tenant_id,
                is_billable: None,
            },
        )
        .await
        .expect("create entry 1");

        let started2 = Utc::now() - Duration::hours(2);
        let ended2 = Utc::now() - Duration::hours(1);
        create_manual_entry(
            &pool,
            ManualEntryInput {
                task_id,
                user_id,
                description: Some("Entry 2".to_string()),
                started_at: started2,
                ended_at: ended2,
                duration_minutes: 60,
                board_id,
                tenant_id,
                is_billable: None,
            },
        )
        .await
        .expect("create entry 2");

        let entries = list_task_time_entries(&pool, task_id, user_id)
            .await
            .expect("list_task_time_entries should succeed");

        assert!(entries.len() >= 2, "should have at least 2 entries");
        let descriptions: Vec<Option<&str>> =
            entries.iter().map(|e| e.description.as_deref()).collect();
        assert!(
            descriptions.contains(&Some("Entry 1")),
            "should contain entry 1"
        );
        assert!(
            descriptions.contains(&Some("Entry 2")),
            "should contain entry 2"
        );
    }

    #[tokio::test]
    async fn test_get_board_time_report() {
        let pool = test_pool().await;
        let (tenant_id, user_id, board_id, task_id) = setup_with_task(&pool).await;

        // Create a manual entry with known duration
        let started = Utc::now() - Duration::hours(2);
        let ended = Utc::now() - Duration::hours(1);
        create_manual_entry(
            &pool,
            ManualEntryInput {
                task_id,
                user_id,
                description: Some("Report entry".to_string()),
                started_at: started,
                ended_at: ended,
                duration_minutes: 90,
                board_id,
                tenant_id,
                is_billable: None,
            },
        )
        .await
        .expect("create entry for report");

        let report = get_board_time_report(&pool, board_id, user_id)
            .await
            .expect("get_board_time_report should succeed");

        assert!(!report.is_empty(), "report should have at least 1 task");
        let task_report = report
            .iter()
            .find(|r| r.task_id == task_id)
            .expect("should find report for our task");
        assert_eq!(task_report.total_minutes, 90);
        assert_eq!(task_report.entries_count, 1);
    }

    #[tokio::test]
    async fn test_running_timer_auto_stops_previous() {
        let pool = test_pool().await;
        let (tenant_id, user_id, board_id, task_id) = setup_with_task(&pool).await;

        // Start first timer
        let input1 = StartTimerInput {
            task_id,
            user_id,
            description: Some("Timer 1".to_string()),
            board_id,
            tenant_id,
            is_billable: None,
        };
        let timer1 = start_timer(&pool, input1).await.expect("start first timer");
        assert!(timer1.is_running);

        // Start second timer - should auto-stop first
        let input2 = StartTimerInput {
            task_id,
            user_id,
            description: Some("Timer 2".to_string()),
            board_id,
            tenant_id,
            is_billable: None,
        };
        let timer2 = start_timer(&pool, input2)
            .await
            .expect("start second timer");
        assert!(timer2.is_running);

        // Verify only the second timer is running
        let running = get_running_timer(&pool, user_id)
            .await
            .expect("get_running_timer");
        assert!(running.is_some(), "should have a running timer");
        assert_eq!(
            running.as_ref().expect("running timer").id,
            timer2.id,
            "running timer should be the second one"
        );
    }
}
