//! WhatsApp digest jobs — daily morning report + weekly summary
//!
//! Sends task summaries via WhatsApp to users who have WhatsApp notifications
//! enabled and a phone number set.
//!
//! Schedule:
//! - Daily: 02:30 UTC (8:00 AM IST)
//! - Weekly: 02:30 UTC on Mondays

use std::fmt::Write as _;

use chrono::{Duration, FixedOffset, NaiveTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::notifications::whatsapp::WahaClient;

/// IST (Asia/Kolkata) offset in seconds: UTC+05:30 = 5*3600 + 30*60 = 19800.
/// Within the valid `FixedOffset::east_opt` range of ±86400.
const IST_OFFSET_SECS: i32 = 5 * 3600 + 30 * 60;

/// IST timezone offset (UTC+05:30) used by digest scheduling.
///
/// Constructed from a compile-time constant proven within `FixedOffset`'s valid
/// range (`±86400`s), so the single `expect` here is unreachable in practice.
fn ist_offset() -> FixedOffset {
    FixedOffset::east_opt(IST_OFFSET_SECS)
        .expect("IST_OFFSET_SECS is compile-time-validated 19800s, within ±86400")
}

/// Start-of-day `NaiveTime` (00:00:00). Hardcoded valid hour/min/sec.
fn naive_time_start_of_day() -> NaiveTime {
    NaiveTime::from_hms_opt(0, 0, 0).expect("00:00:00 is a valid NaiveTime")
}

/// End-of-day `NaiveTime` (23:59:59). Hardcoded valid hour/min/sec.
fn naive_time_end_of_day() -> NaiveTime {
    NaiveTime::from_hms_opt(23, 59, 59).expect("23:59:59 is a valid NaiveTime")
}

/// Error type for WhatsApp digest operations
#[derive(Debug, thiserror::Error)]
pub enum WhatsAppDigestError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("WhatsApp error: {0}")]
    WhatsApp(#[from] crate::notifications::whatsapp::WhatsAppError),
}

/// Result of a WhatsApp digest run
#[derive(Debug)]
pub struct WhatsAppDigestResult {
    pub users_processed: usize,
    pub messages_sent: usize,
    pub skipped_quiet_hours: usize,
    pub skipped_no_activity: usize,
    pub errors: usize,
}

/// Task summary stats for a single user
#[derive(Debug)]
pub struct UserTaskSummary {
    pub user_id: Uuid,
    pub name: String,
    pub phone_number: String,
    pub tasks_due_today: i64,
    pub tasks_overdue: i64,
    pub tasks_pending: i64,
    pub tasks_completed_period: i64,
    pub tasks_created_period: i64,
}

/// Send daily WhatsApp morning reports
pub async fn send_daily_whatsapp_digests(
    pool: &PgPool,
    waha_client: &WahaClient,
    app_url: &str,
) -> Result<WhatsAppDigestResult, WhatsAppDigestError> {
    send_whatsapp_digests(pool, waha_client, app_url, DigestType::Daily).await
}

/// Send weekly WhatsApp summaries
pub async fn send_weekly_whatsapp_summaries(
    pool: &PgPool,
    waha_client: &WahaClient,
    app_url: &str,
) -> Result<WhatsAppDigestResult, WhatsAppDigestError> {
    send_whatsapp_digests(pool, waha_client, app_url, DigestType::Weekly).await
}

#[derive(Debug, Clone, Copy)]
enum DigestType {
    Daily,
    Weekly,
}

impl DigestType {
    fn lookback_days(self) -> i64 {
        match self {
            DigestType::Daily => 1,
            DigestType::Weekly => 7,
        }
    }

    fn preference_key(self) -> &'static str {
        match self {
            DigestType::Daily => "daily-digest",
            DigestType::Weekly => "weekly-digest",
        }
    }

    fn label(self) -> &'static str {
        match self {
            DigestType::Daily => "daily",
            DigestType::Weekly => "weekly",
        }
    }
}

#[allow(clippy::type_complexity)]
async fn send_whatsapp_digests(
    pool: &PgPool,
    waha_client: &WahaClient,
    app_url: &str,
    digest_type: DigestType,
) -> Result<WhatsAppDigestResult, WhatsAppDigestError> {
    let now = Utc::now();
    let period_start = now - Duration::days(digest_type.lookback_days());

    let mut result = WhatsAppDigestResult {
        users_processed: 0,
        messages_sent: 0,
        skipped_quiet_hours: 0,
        skipped_no_activity: 0,
        errors: 0,
    };

    let pref_key = digest_type.preference_key();

    // Fetch users with WhatsApp enabled for this digest type AND phone number set
    let users: Vec<(
        Uuid,
        String,
        String,
        Option<chrono::NaiveTime>,
        Option<chrono::NaiveTime>,
    )> = sqlx::query_as(
        r#"
        SELECT u.id, u.name, u.phone_number, up.quiet_hours_start, up.quiet_hours_end
        FROM users u
        LEFT JOIN user_preferences up ON up.user_id = u.id
        WHERE u.deleted_at IS NULL
          AND u.phone_number IS NOT NULL
          AND u.phone_number != ''
          AND (
              -- WhatsApp enabled for this digest type (or default = false for digests)
              EXISTS (
                  SELECT 1 FROM notification_preferences np
                  WHERE np.user_id = u.id
                  AND np.event_type = $1
                  AND np.whatsapp = true
              )
          )
        ORDER BY u.id
        "#,
    )
    .bind(pref_key)
    .fetch_all(pool)
    .await?;

    if users.is_empty() {
        tracing::info!(
            digest_type = digest_type.label(),
            "WhatsApp digest: no eligible users"
        );
        return Ok(result);
    }

    let user_ids: Vec<Uuid> = users.iter().map(|(id, _, _, _, _)| *id).collect();

    // Batch query for task summaries
    let summaries = fetch_task_summaries(pool, &user_ids, period_start, now).await?;

    // IST offset for quiet hours check
    let ist_offset = ist_offset();
    let now_ist = now.with_timezone(&ist_offset).time();

    for (user_id, name, phone, quiet_start, quiet_end) in &users {
        result.users_processed += 1;

        // Check quiet hours
        if let (Some(start), Some(end)) = (quiet_start, quiet_end) {
            if taskbolt_db::queries::is_in_quiet_hours(now_ist, *start, *end) {
                result.skipped_quiet_hours += 1;
                tracing::debug!(
                    user_id = %user_id,
                    "WhatsApp digest skipped: quiet hours"
                );
                continue;
            }
        }

        // Find this user's stats
        let stats = summaries.iter().find(|s| s.0 == *user_id);
        let (tasks_due_today, tasks_overdue, tasks_pending, tasks_completed, tasks_created) =
            match stats {
                Some((_, due, overdue, pending, completed, created)) => {
                    (*due, *overdue, *pending, *completed, *created)
                }
                None => (0i64, 0i64, 0i64, 0i64, 0i64),
            };

        // Skip if no meaningful data
        if tasks_due_today == 0
            && tasks_overdue == 0
            && tasks_pending == 0
            && tasks_completed == 0
            && tasks_created == 0
        {
            result.skipped_no_activity += 1;
            continue;
        }

        // Format the WhatsApp message
        let message = match digest_type {
            DigestType::Daily => format_daily_message(
                name,
                tasks_due_today,
                tasks_overdue,
                tasks_pending,
                tasks_completed,
                app_url,
            ),
            DigestType::Weekly => format_weekly_message(
                name,
                tasks_due_today,
                tasks_overdue,
                tasks_pending,
                tasks_completed,
                tasks_created,
                app_url,
            ),
        };

        // Send via WAHA
        match waha_client.send_message(phone, &message).await {
            Ok(()) => {
                result.messages_sent += 1;
                // Log delivery
                let _ = taskbolt_db::queries::log_delivery(
                    pool, None, *user_id, "whatsapp", "sent", None, None,
                )
                .await;
            }
            Err(e) => {
                tracing::error!(
                    user_id = %user_id,
                    phone = %phone,
                    error = %e,
                    "Failed to send WhatsApp digest"
                );
                let _ = taskbolt_db::queries::log_delivery(
                    pool,
                    None,
                    *user_id,
                    "whatsapp",
                    "failed",
                    None,
                    Some(&e.to_string()),
                )
                .await;
                result.errors += 1;
            }
        }

        // Small delay between messages to respect WhatsApp rate limits
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }

    tracing::info!(
        digest_type = digest_type.label(),
        users_processed = result.users_processed,
        messages_sent = result.messages_sent,
        skipped_quiet = result.skipped_quiet_hours,
        skipped_empty = result.skipped_no_activity,
        errors = result.errors,
        "WhatsApp digest completed"
    );

    Ok(result)
}

/// Batch query for user task summaries
///
/// Returns: Vec<(user_id, due_today, overdue, pending, completed_period, created_period)>
#[allow(clippy::type_complexity)]
async fn fetch_task_summaries(
    pool: &PgPool,
    user_ids: &[Uuid],
    period_start: chrono::DateTime<Utc>,
    now: chrono::DateTime<Utc>,
) -> Result<Vec<(Uuid, i64, i64, i64, i64, i64)>, sqlx::Error> {
    let today_start = now.date_naive().and_time(naive_time_start_of_day());
    let today_end = now.date_naive().and_time(naive_time_end_of_day());

    let rows: Vec<(
        Uuid,
        Option<i64>,
        Option<i64>,
        Option<i64>,
        Option<i64>,
        Option<i64>,
    )> = sqlx::query_as(
        r#"
        WITH due_today AS (
            SELECT ta.user_id, COUNT(DISTINCT t.id) as cnt
            FROM task_assignees ta
            JOIN tasks t ON t.id = ta.task_id AND t.deleted_at IS NULL
            WHERE ta.user_id = ANY($1)
              AND t.due_date >= $2
              AND t.due_date <= $3
              AND NOT EXISTS (
                  SELECT 1 FROM project_statuses ps
                  WHERE ps.id = t.status_id AND ps.type = 'done'
              )
            GROUP BY ta.user_id
        ),
        overdue AS (
            SELECT ta.user_id, COUNT(DISTINCT t.id) as cnt
            FROM task_assignees ta
            JOIN tasks t ON t.id = ta.task_id AND t.deleted_at IS NULL
            WHERE ta.user_id = ANY($1)
              AND t.due_date < $2
              AND NOT EXISTS (
                  SELECT 1 FROM project_statuses ps
                  WHERE ps.id = t.status_id AND ps.type = 'done'
              )
            GROUP BY ta.user_id
        ),
        pending AS (
            SELECT ta.user_id, COUNT(DISTINCT t.id) as cnt
            FROM task_assignees ta
            JOIN tasks t ON t.id = ta.task_id AND t.deleted_at IS NULL
            WHERE ta.user_id = ANY($1)
              AND NOT EXISTS (
                  SELECT 1 FROM project_statuses ps
                  WHERE ps.id = t.status_id AND ps.type = 'done'
              )
            GROUP BY ta.user_id
        ),
        completed AS (
            SELECT al.user_id, COUNT(DISTINCT al.entity_id) as cnt
            FROM activity_log al
            JOIN tasks t ON t.id = al.entity_id AND t.deleted_at IS NULL
            LEFT JOIN project_statuses ps ON ps.id = t.status_id
            WHERE al.user_id = ANY($1)
              AND al.entity_type = 'task'
              AND al.action = 'moved'
              AND al.created_at >= $4
              AND ps.type = 'done'
            GROUP BY al.user_id
        ),
        created AS (
            SELECT t.created_by_id as user_id, COUNT(*) as cnt
            FROM tasks t
            WHERE t.created_by_id = ANY($1)
              AND t.created_at >= $4
              AND t.deleted_at IS NULL
            GROUP BY t.created_by_id
        )
        SELECT
            u.id,
            dt.cnt as due_today,
            o.cnt as overdue,
            p.cnt as pending,
            c.cnt as completed,
            cr.cnt as created
        FROM unnest($1::uuid[]) AS u(id)
        LEFT JOIN due_today dt ON dt.user_id = u.id
        LEFT JOIN overdue o ON o.user_id = u.id
        LEFT JOIN pending p ON p.user_id = u.id
        LEFT JOIN completed c ON c.user_id = u.id
        LEFT JOIN created cr ON cr.user_id = u.id
        "#,
    )
    .bind(user_ids)
    .bind(today_start)
    .bind(today_end)
    .bind(period_start)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|(uid, due, over, pend, comp, crea)| {
            (
                uid,
                due.unwrap_or(0),
                over.unwrap_or(0),
                pend.unwrap_or(0),
                comp.unwrap_or(0),
                crea.unwrap_or(0),
            )
        })
        .collect())
}

fn format_daily_message(
    name: &str,
    due_today: i64,
    overdue: i64,
    pending: i64,
    completed_yesterday: i64,
    app_url: &str,
) -> String {
    let greeting = "\u{2615}"; // coffee emoji
    let mut msg = format!(
        "{} *Good morning, {}!*\n\nHere's your daily task summary:\n",
        greeting, name
    );

    if due_today > 0 {
        let _ = write!(
            msg,
            "\n\u{1F4CB} *Due today:* {} task{}\n",
            due_today,
            if due_today == 1 { "" } else { "s" }
        );
    }

    if overdue > 0 {
        let _ = writeln!(
            msg,
            "\u{26A0}\u{FE0F} *Overdue:* {} task{}",
            overdue,
            if overdue == 1 { "" } else { "s" }
        );
    }

    let _ = writeln!(
        msg,
        "\u{1F4CA} *Total pending:* {} task{}",
        pending,
        if pending == 1 { "" } else { "s" }
    );

    if completed_yesterday > 0 {
        let _ = writeln!(
            msg,
            "\u{2705} *Completed yesterday:* {}",
            completed_yesterday
        );
    }

    let _ = write!(msg, "\nView your tasks: {}/my-tasks", app_url);
    msg
}

fn format_weekly_message(
    name: &str,
    due_today: i64,
    overdue: i64,
    pending: i64,
    completed_week: i64,
    created_week: i64,
    app_url: &str,
) -> String {
    let greeting = "\u{1F4CA}"; // bar chart emoji
    let mut msg = format!(
        "{} *Weekly summary for {}*\n\nHere's how your week went:\n",
        greeting, name
    );

    let _ = writeln!(msg, "\n\u{2705} *Completed this week:* {}", completed_week);
    let _ = writeln!(msg, "\u{1F4DD} *Created this week:* {}", created_week);
    let _ = writeln!(msg, "\u{1F4CB} *Still pending:* {}", pending);

    if overdue > 0 {
        let _ = writeln!(
            msg,
            "\u{26A0}\u{FE0F} *Overdue:* {} task{}",
            overdue,
            if overdue == 1 { "" } else { "s" }
        );
    }

    if due_today > 0 {
        let _ = writeln!(
            msg,
            "\u{1F4C5} *Due today:* {} task{}",
            due_today,
            if due_today == 1 { "" } else { "s" }
        );
    }

    let _ = write!(msg, "\nView dashboard: {}/dashboard", app_url);
    msg
}

// =============================================================================
// Admin daily org report
// =============================================================================

/// Send daily org report to workspace admins via WhatsApp.
/// Shows per-employee task completion breakdown including subtasks.
pub async fn send_admin_daily_org_report(
    pool: &PgPool,
    waha_client: &WahaClient,
    app_url: &str,
) -> Result<WhatsAppDigestResult, WhatsAppDigestError> {
    let now = Utc::now();
    let yesterday = now - Duration::days(1);

    let mut result = WhatsAppDigestResult {
        users_processed: 0,
        messages_sent: 0,
        skipped_quiet_hours: 0,
        skipped_no_activity: 0,
        errors: 0,
    };

    // Fetch workspace admins with phone numbers
    let admins: Vec<(Uuid, String, String, Uuid)> = sqlx::query_as(
        r#"
        SELECT u.id, u.name, u.phone_number, wm.workspace_id
        FROM workspace_members wm
        JOIN users u ON u.id = wm.user_id AND u.deleted_at IS NULL
        WHERE wm.role = 'admin'
          AND u.phone_number IS NOT NULL
          AND u.phone_number != ''
        ORDER BY wm.workspace_id, u.id
        "#,
    )
    .fetch_all(pool)
    .await?;

    if admins.is_empty() {
        tracing::info!("Admin org report: no eligible admins with phone numbers");
        return Ok(result);
    }

    for (admin_id, admin_name, admin_phone, workspace_id) in &admins {
        result.users_processed += 1;

        // Fetch per-employee breakdown for this workspace
        let employee_stats: Vec<(String, i64, i64, i64, i64)> = sqlx::query_as(
            r#"
            WITH member_tasks AS (
                SELECT
                    u.name,
                    u.id as user_id
                FROM workspace_members wm
                JOIN users u ON u.id = wm.user_id AND u.deleted_at IS NULL
                WHERE wm.workspace_id = $1
                  AND wm.role IN ('member', 'admin')
            ),
            completed AS (
                SELECT ta.user_id, COUNT(DISTINCT t.id) as cnt
                FROM task_assignees ta
                JOIN tasks t ON t.id = ta.task_id AND t.deleted_at IS NULL
                JOIN projects p ON p.id = t.project_id AND p.workspace_id = $1 AND p.deleted_at IS NULL
                JOIN project_statuses ps ON ps.id = t.status_id AND ps.type = 'done'
                JOIN activity_log al ON al.entity_id = t.id
                    AND al.entity_type = 'task'
                    AND al.action = 'moved'
                    AND al.created_at >= $2
                WHERE ta.user_id IN (SELECT user_id FROM member_tasks)
                GROUP BY ta.user_id
            ),
            overdue AS (
                SELECT ta.user_id, COUNT(DISTINCT t.id) as cnt
                FROM task_assignees ta
                JOIN tasks t ON t.id = ta.task_id AND t.deleted_at IS NULL
                JOIN projects p ON p.id = t.project_id AND p.workspace_id = $1 AND p.deleted_at IS NULL
                WHERE ta.user_id IN (SELECT user_id FROM member_tasks)
                  AND t.due_date < $3
                  AND NOT EXISTS (
                      SELECT 1 FROM project_statuses ps
                      WHERE ps.id = t.status_id AND ps.type = 'done'
                  )
                GROUP BY ta.user_id
            ),
            pending AS (
                SELECT ta.user_id, COUNT(DISTINCT t.id) as cnt
                FROM task_assignees ta
                JOIN tasks t ON t.id = ta.task_id AND t.deleted_at IS NULL
                JOIN projects p ON p.id = t.project_id AND p.workspace_id = $1 AND p.deleted_at IS NULL
                WHERE ta.user_id IN (SELECT user_id FROM member_tasks)
                  AND NOT EXISTS (
                      SELECT 1 FROM project_statuses ps
                      WHERE ps.id = t.status_id AND ps.type = 'done'
                  )
                GROUP BY ta.user_id
            ),
            subtasks_completed AS (
                SELECT ta.user_id, COUNT(DISTINCT t.id) as cnt
                FROM task_assignees ta
                JOIN tasks t ON t.id = ta.task_id AND t.deleted_at IS NULL
                JOIN projects p ON p.id = t.project_id AND p.workspace_id = $1 AND p.deleted_at IS NULL
                JOIN project_statuses ps ON ps.id = t.status_id AND ps.type = 'done'
                JOIN activity_log al ON al.entity_id = t.id
                    AND al.entity_type = 'task'
                    AND al.action = 'moved'
                    AND al.created_at >= $2
                WHERE ta.user_id IN (SELECT user_id FROM member_tasks)
                  AND t.parent_task_id IS NOT NULL
                GROUP BY ta.user_id
            )
            SELECT
                mt.name,
                COALESCE(c.cnt, 0) as completed,
                COALESCE(o.cnt, 0) as overdue,
                COALESCE(p.cnt, 0) as pending,
                COALESCE(sc.cnt, 0) as subtasks_completed
            FROM member_tasks mt
            LEFT JOIN completed c ON c.user_id = mt.user_id
            LEFT JOIN overdue o ON o.user_id = mt.user_id
            LEFT JOIN pending p ON p.user_id = mt.user_id
            LEFT JOIN subtasks_completed sc ON sc.user_id = mt.user_id
            WHERE COALESCE(c.cnt, 0) > 0
               OR COALESCE(o.cnt, 0) > 0
               OR COALESCE(p.cnt, 0) > 0
            ORDER BY COALESCE(c.cnt, 0) DESC
            "#,
        )
        .bind(workspace_id)
        .bind(yesterday)
        .bind(now)
        .fetch_all(pool)
        .await
        .unwrap_or_default();

        if employee_stats.is_empty() {
            result.skipped_no_activity += 1;
            continue;
        }

        // Get workspace name
        let workspace_name: String =
            sqlx::query_scalar("SELECT name FROM workspaces WHERE id = $1")
                .bind(workspace_id)
                .fetch_optional(pool)
                .await
                .ok()
                .flatten()
                .unwrap_or_else(|| "Workspace".to_string());

        let message =
            format_admin_org_report(admin_name, &workspace_name, &employee_stats, app_url);

        match waha_client.send_message(admin_phone, &message).await {
            Ok(()) => {
                result.messages_sent += 1;
                let _ = taskbolt_db::queries::log_delivery(
                    pool, None, *admin_id, "whatsapp", "sent", None, None,
                )
                .await;
            }
            Err(e) => {
                tracing::error!(
                    admin_id = %admin_id,
                    error = %e,
                    "Failed to send admin org report"
                );
                result.errors += 1;
            }
        }

        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }

    tracing::info!(
        admins = result.users_processed,
        sent = result.messages_sent,
        skipped = result.skipped_no_activity,
        errors = result.errors,
        "Admin daily org report completed"
    );

    Ok(result)
}

fn format_admin_org_report(
    admin_name: &str,
    workspace_name: &str,
    employee_stats: &[(String, i64, i64, i64, i64)],
    app_url: &str,
) -> String {
    let mut msg = format!(
        "\u{1F4CA} *Daily Org Report — {}*\n\nGood morning, {}!\n",
        workspace_name, admin_name
    );

    // Summary totals
    let total_completed: i64 = employee_stats.iter().map(|s| s.1).sum();
    let total_subtasks: i64 = employee_stats.iter().map(|s| s.4).sum();
    let total_overdue: i64 = employee_stats.iter().map(|s| s.2).sum();
    let total_pending: i64 = employee_stats.iter().map(|s| s.3).sum();

    let _ = write!(
        msg,
        "\n\u{2705} *Completed yesterday:* {} task{}",
        total_completed,
        if total_completed == 1 { "" } else { "s" }
    );
    if total_subtasks > 0 {
        let _ = write!(msg, " ({} subtasks)", total_subtasks);
    }
    let _ = writeln!(msg);

    if total_overdue > 0 {
        let _ = writeln!(
            msg,
            "\u{26A0}\u{FE0F} *Overdue:* {} task{}",
            total_overdue,
            if total_overdue == 1 { "" } else { "s" }
        );
    }
    let _ = writeln!(msg, "\u{1F4CB} *Total pending:* {}", total_pending);

    // Per-employee breakdown
    let _ = writeln!(msg, "\n\u{1F465} *Team Breakdown:*");

    for (name, completed, overdue, pending, subtasks) in employee_stats {
        let status_icon = if *overdue > 0 {
            "\u{1F534}" // red circle
        } else if *completed > 0 {
            "\u{1F7E2}" // green circle
        } else {
            "\u{26AA}" // white circle
        };

        let _ = write!(msg, "\n{} *{}*", status_icon, name);

        let mut parts = Vec::new();
        if *completed > 0 {
            let mut s = format!("{} done", completed);
            if *subtasks > 0 {
                let _ = write!(s, " +{} subtasks", subtasks);
            }
            parts.push(s);
        }
        if *overdue > 0 {
            parts.push(format!("{} overdue", overdue));
        }
        if *pending > 0 {
            parts.push(format!("{} pending", pending));
        }

        if !parts.is_empty() {
            let _ = write!(msg, " — {}", parts.join(" \u{2022} "));
        }
    }

    let _ = write!(msg, "\n\nView dashboard: {}/dashboard", app_url);
    msg
}

// =============================================================================
// Enhanced daily assignee message with due TIME + subtask context
// =============================================================================

/// (task_title, due_date, project_name, is_subtask)
type DueTodayDetail = (String, Option<chrono::DateTime<Utc>>, Option<String>, bool);

/// Fetch tasks due today with their exact due times for a user
async fn fetch_due_today_details(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Vec<DueTodayDetail>, sqlx::Error> {
    // Returns: (task_title, due_date, project_name, is_subtask)
    sqlx::query_as(
        r#"
        SELECT t.title, t.due_date, p.name, (t.parent_task_id IS NOT NULL) as is_subtask
        FROM task_assignees ta
        JOIN tasks t ON t.id = ta.task_id AND t.deleted_at IS NULL
        LEFT JOIN projects p ON p.id = t.project_id AND p.deleted_at IS NULL
        WHERE ta.user_id = $1
          AND t.due_date::date = CURRENT_DATE
          AND NOT EXISTS (
              SELECT 1 FROM project_statuses ps
              WHERE ps.id = t.status_id AND ps.type = 'done'
          )
        ORDER BY t.due_date ASC NULLS LAST
        LIMIT 10
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
}

/// Send enhanced daily digests with due time details
pub async fn send_enhanced_daily_digests(
    pool: &PgPool,
    waha_client: &WahaClient,
    app_url: &str,
) -> Result<WhatsAppDigestResult, WhatsAppDigestError> {
    let now = Utc::now();
    let yesterday = now - Duration::days(1);

    let mut result = WhatsAppDigestResult {
        users_processed: 0,
        messages_sent: 0,
        skipped_quiet_hours: 0,
        skipped_no_activity: 0,
        errors: 0,
    };

    // Fetch ALL users with phone numbers (not just opted-in for digest)
    // Admin requested all assignees get reminders
    #[allow(clippy::type_complexity)]
    let users: Vec<(
        Uuid,
        String,
        String,
        Option<chrono::NaiveTime>,
        Option<chrono::NaiveTime>,
    )> = sqlx::query_as(
        r#"
            SELECT u.id, u.name, u.phone_number, up.quiet_hours_start, up.quiet_hours_end
            FROM users u
            LEFT JOIN user_preferences up ON up.user_id = u.id
            WHERE u.deleted_at IS NULL
              AND u.phone_number IS NOT NULL
              AND u.phone_number != ''
            ORDER BY u.id
            "#,
    )
    .fetch_all(pool)
    .await?;

    if users.is_empty() {
        tracing::info!("Enhanced daily digest: no users with phone numbers");
        return Ok(result);
    }

    let ist_offset = ist_offset();
    let now_ist = now.with_timezone(&ist_offset).time();

    let user_ids: Vec<Uuid> = users.iter().map(|(id, _, _, _, _)| *id).collect();
    let summaries = fetch_task_summaries(pool, &user_ids, yesterday, now).await?;

    for (user_id, name, phone, quiet_start, quiet_end) in &users {
        result.users_processed += 1;

        // Check quiet hours
        if let (Some(start), Some(end)) = (quiet_start, quiet_end) {
            if taskbolt_db::queries::is_in_quiet_hours(now_ist, *start, *end) {
                result.skipped_quiet_hours += 1;
                continue;
            }
        }

        // Get summary stats
        let stats = summaries.iter().find(|s| s.0 == *user_id);
        let (tasks_due_today, tasks_overdue, tasks_pending, tasks_completed, _) = match stats {
            Some((_, due, overdue, pending, completed, created)) => {
                (*due, *overdue, *pending, *completed, *created)
            }
            None => (0i64, 0i64, 0i64, 0i64, 0i64),
        };

        if tasks_due_today == 0 && tasks_overdue == 0 && tasks_pending == 0 && tasks_completed == 0
        {
            result.skipped_no_activity += 1;
            continue;
        }

        // Fetch detailed due-today tasks with times
        let due_details = fetch_due_today_details(pool, *user_id)
            .await
            .unwrap_or_default();

        let message = format_enhanced_daily_message(
            name,
            tasks_due_today,
            tasks_overdue,
            tasks_pending,
            tasks_completed,
            &due_details,
            app_url,
        );

        match waha_client.send_message(phone, &message).await {
            Ok(()) => {
                result.messages_sent += 1;
                let _ = taskbolt_db::queries::log_delivery(
                    pool, None, *user_id, "whatsapp", "sent", None, None,
                )
                .await;
            }
            Err(e) => {
                tracing::error!(
                    user_id = %user_id,
                    phone = %phone,
                    error = %e,
                    "Failed to send enhanced daily digest"
                );
                result.errors += 1;
            }
        }

        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }

    tracing::info!(
        users = result.users_processed,
        sent = result.messages_sent,
        skipped_quiet = result.skipped_quiet_hours,
        skipped_empty = result.skipped_no_activity,
        errors = result.errors,
        "Enhanced daily digest completed"
    );

    Ok(result)
}

fn format_enhanced_daily_message(
    name: &str,
    due_today: i64,
    overdue: i64,
    pending: i64,
    completed_yesterday: i64,
    due_details: &[DueTodayDetail],
    app_url: &str,
) -> String {
    let ist = ist_offset();
    let greeting = "\u{2615}";
    let mut msg = format!(
        "{} *Good morning, {}!*\n\nHere's your day:\n",
        greeting, name
    );

    // Summary stats
    if completed_yesterday > 0 {
        let _ = writeln!(
            msg,
            "\u{2705} *Completed yesterday:* {}",
            completed_yesterday
        );
    }

    if overdue > 0 {
        let _ = writeln!(
            msg,
            "\u{26A0}\u{FE0F} *OVERDUE:* {} task{} — complete these first!",
            overdue,
            if overdue == 1 { "" } else { "s" }
        );
    }

    let _ = writeln!(
        msg,
        "\u{1F4CB} *Pending:* {} \u{2022} *Due today:* {}",
        pending, due_today
    );

    // Detailed due-today list with times
    if !due_details.is_empty() {
        let _ = writeln!(msg, "\n\u{23F0} *Today's Deadlines:*");

        for (title, due_date, project_name, is_subtask) in due_details {
            let time_str = match due_date {
                Some(dt) => {
                    let dt_ist = dt.with_timezone(&ist);
                    let now = Utc::now();
                    let remaining = dt.signed_duration_since(now);

                    if remaining.num_seconds() < 0 {
                        format!("{} \u{26A0}\u{FE0F} OVERDUE", dt_ist.format("%I:%M %p"))
                    } else if remaining.num_hours() < 2 {
                        format!(
                            "{} \u{23F3} *{}m left*",
                            dt_ist.format("%I:%M %p"),
                            remaining.num_minutes()
                        )
                    } else {
                        format!(
                            "{} ({}h left)",
                            dt_ist.format("%I:%M %p"),
                            remaining.num_hours()
                        )
                    }
                }
                None => "No time set".to_string(),
            };

            let subtask_marker = if *is_subtask { "\u{2514} " } else { "" };
            let project_suffix = project_name
                .as_deref()
                .map(|p| format!(" \u{2022} {}", p))
                .unwrap_or_default();

            let _ = writeln!(
                msg,
                "\n{}\u{1F4CC} *{}*\n   {} {}",
                subtask_marker, title, time_str, project_suffix
            );
        }
    }

    let _ = write!(msg, "\nView tasks: {}/my-tasks", app_url);
    msg
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_daily_message_with_tasks() {
        let msg = format_daily_message("Ankur", 3, 1, 10, 5, "https://taskflow.paraslace.in");
        assert!(msg.contains("Good morning, Ankur"));
        assert!(msg.contains("Due today:* 3 tasks"));
        assert!(msg.contains("Overdue:* 1 task\n")); // singular
        assert!(msg.contains("Total pending:* 10 tasks"));
        assert!(msg.contains("Completed yesterday:* 5"));
        assert!(msg.contains("taskflow.paraslace.in/my-tasks"));
    }

    #[test]
    fn test_format_daily_message_no_overdue() {
        let msg = format_daily_message("Test", 1, 0, 5, 0, "http://localhost");
        assert!(!msg.contains("Overdue"));
        assert!(!msg.contains("Completed yesterday"));
        assert!(msg.contains("Due today:* 1 task\n")); // singular
    }

    #[test]
    fn test_format_weekly_message() {
        let msg = format_weekly_message("Ankur", 2, 3, 15, 12, 8, "https://taskflow.paraslace.in");
        assert!(msg.contains("Weekly summary for Ankur"));
        assert!(msg.contains("Completed this week:* 12"));
        assert!(msg.contains("Created this week:* 8"));
        assert!(msg.contains("Still pending:* 15"));
        assert!(msg.contains("Overdue:* 3 tasks"));
        assert!(msg.contains("taskflow.paraslace.in/dashboard"));
    }

    #[test]
    fn test_format_weekly_message_no_overdue() {
        let msg = format_weekly_message("Test", 0, 0, 5, 3, 2, "http://localhost");
        assert!(!msg.contains("Overdue"));
        assert!(!msg.contains("Due today"));
    }

    #[test]
    fn test_digest_type_properties() {
        assert_eq!(DigestType::Daily.lookback_days(), 1);
        assert_eq!(DigestType::Weekly.lookback_days(), 7);
        assert_eq!(DigestType::Daily.preference_key(), "daily-digest");
        assert_eq!(DigestType::Weekly.preference_key(), "weekly-digest");
        assert_eq!(DigestType::Daily.label(), "daily");
        assert_eq!(DigestType::Weekly.label(), "weekly");
    }
}
