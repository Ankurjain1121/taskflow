//! WhatsApp digest jobs — daily morning report + weekly summary
//!
//! Sends task summaries via WhatsApp to users who have WhatsApp notifications
//! enabled and a phone number set.
//!
//! Schedule:
//! - Daily: 02:30 UTC (8:00 AM IST)
//! - Weekly: 02:30 UTC on Mondays

use chrono::{Duration, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::notifications::whatsapp::WahaClient;

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
    fn lookback_days(&self) -> i64 {
        match self {
            DigestType::Daily => 1,
            DigestType::Weekly => 7,
        }
    }

    fn preference_key(&self) -> &'static str {
        match self {
            DigestType::Daily => "daily-digest",
            DigestType::Weekly => "weekly-digest",
        }
    }

    fn label(&self) -> &'static str {
        match self {
            DigestType::Daily => "daily",
            DigestType::Weekly => "weekly",
        }
    }
}

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
    let ist_offset = chrono::FixedOffset::east_opt(5 * 3600 + 30 * 60).expect("valid IST offset");
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
async fn fetch_task_summaries(
    pool: &PgPool,
    user_ids: &[Uuid],
    period_start: chrono::DateTime<Utc>,
    now: chrono::DateTime<Utc>,
) -> Result<Vec<(Uuid, i64, i64, i64, i64, i64)>, sqlx::Error> {
    let today_start = now.date_naive().and_hms_opt(0, 0, 0).expect("valid time");
    let today_end = now
        .date_naive()
        .and_hms_opt(23, 59, 59)
        .expect("valid time");

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
        msg.push_str(&format!(
            "\n\u{1F4CB} *Due today:* {} task{}\n",
            due_today,
            if due_today == 1 { "" } else { "s" }
        ));
    }

    if overdue > 0 {
        msg.push_str(&format!(
            "\u{26A0}\u{FE0F} *Overdue:* {} task{}\n",
            overdue,
            if overdue == 1 { "" } else { "s" }
        ));
    }

    msg.push_str(&format!(
        "\u{1F4CA} *Total pending:* {} task{}\n",
        pending,
        if pending == 1 { "" } else { "s" }
    ));

    if completed_yesterday > 0 {
        msg.push_str(&format!(
            "\u{2705} *Completed yesterday:* {}\n",
            completed_yesterday
        ));
    }

    msg.push_str(&format!("\nView your tasks: {}/my-tasks", app_url));
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

    msg.push_str(&format!(
        "\n\u{2705} *Completed this week:* {}\n",
        completed_week
    ));
    msg.push_str(&format!(
        "\u{1F4DD} *Created this week:* {}\n",
        created_week
    ));
    msg.push_str(&format!("\u{1F4CB} *Still pending:* {}\n", pending));

    if overdue > 0 {
        msg.push_str(&format!(
            "\u{26A0}\u{FE0F} *Overdue:* {} task{}\n",
            overdue,
            if overdue == 1 { "" } else { "s" }
        ));
    }

    if due_today > 0 {
        msg.push_str(&format!(
            "\u{1F4C5} *Due today:* {} task{}\n",
            due_today,
            if due_today == 1 { "" } else { "s" }
        ));
    }

    msg.push_str(&format!("\nView dashboard: {}/dashboard", app_url));
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
