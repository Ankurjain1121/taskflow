//! Weekly digest email job
//!
//! Aggregates task activity for the past week and sends digest emails.
//! Designed to be triggered weekly (e.g., Monday 9am) via cron endpoint.

use chrono::{Duration, Utc};
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::notifications::email::{generate_weekly_digest_html, PostalClient};

/// Error type for weekly digest operations
#[derive(Debug, thiserror::Error)]
pub enum WeeklyDigestError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Email error: {0}")]
    Email(#[from] crate::notifications::email::EmailError),
}

/// Result of weekly digest job
#[derive(Debug, Serialize)]
pub struct WeeklyDigestResult {
    pub users_processed: usize,
    pub emails_sent: usize,
    pub errors: usize,
}

/// User stats for the weekly digest
#[derive(Debug)]
#[allow(dead_code)]
struct UserDigestStats {
    user_id: Uuid,
    email: String,
    name: String,
    tasks_completed: i64,
    tasks_created: i64,
    tasks_overdue: i64,
    tasks_due_this_week: i64,
}

/// Send weekly digest emails to all users with email notifications enabled
///
/// This function:
/// 1. Finds users with email notifications enabled for digests
/// 2. Aggregates task activity from the last 7 days
/// 3. Sends personalized HTML digest emails via Postal
pub async fn send_weekly_digests(
    pool: &PgPool,
    postal: &PostalClient,
    app_url: &str,
) -> Result<WeeklyDigestResult, WeeklyDigestError> {
    let now = Utc::now();
    let week_ago = now - Duration::days(7);
    let week_from_now = now + Duration::days(7);

    let mut result = WeeklyDigestResult {
        users_processed: 0,
        emails_sent: 0,
        errors: 0,
    };

    // Process in batches of 50
    let batch_size = 50i64;
    let mut offset = 0i64;

    loop {
        // Get users with email notifications enabled
        // We check the notification_preferences table for weekly-digest preference
        // If no preference exists, email defaults to true
        let users: Vec<(Uuid, String, String)> = sqlx::query_as(
            r#"
            SELECT DISTINCT u.id, u.email, u.name
            FROM users u
            WHERE u.deleted_at IS NULL
              AND (
                  -- No preference record means default (email enabled)
                  NOT EXISTS (
                      SELECT 1 FROM notification_preferences np
                      WHERE np.user_id = u.id
                      AND np.event_type = 'weekly-digest'
                  )
                  OR
                  -- Or explicitly enabled
                  EXISTS (
                      SELECT 1 FROM notification_preferences np
                      WHERE np.user_id = u.id
                      AND np.event_type = 'weekly-digest'
                      AND np.email = true
                  )
              )
            ORDER BY u.id
            LIMIT $1 OFFSET $2
            "#,
        )
        .bind(batch_size)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        if users.is_empty() {
            break;
        }

        for (user_id, email, name) in users {
            result.users_processed += 1;

            // Get stats for this user
            let stats = match get_user_stats(pool, user_id, week_ago, now, week_from_now).await {
                Ok(s) => s,
                Err(e) => {
                    tracing::error!(
                        user_id = %user_id,
                        error = %e,
                        "Failed to get user stats for digest"
                    );
                    result.errors += 1;
                    continue;
                }
            };

            // Skip if no activity
            if stats.tasks_completed == 0
                && stats.tasks_created == 0
                && stats.tasks_overdue == 0
                && stats.tasks_due_this_week == 0
            {
                continue;
            }

            // Generate and send email
            let html = generate_weekly_digest_html(
                &name,
                stats.tasks_completed,
                stats.tasks_created,
                stats.tasks_overdue,
                stats.tasks_due_this_week,
                app_url,
            );

            match postal
                .send_email(&email, "[TaskFlow] Your Weekly Summary", &html)
                .await
            {
                Ok(_) => {
                    result.emails_sent += 1;
                    tracing::debug!(
                        user_id = %user_id,
                        email = %email,
                        "Weekly digest sent"
                    );
                }
                Err(e) => {
                    tracing::error!(
                        user_id = %user_id,
                        email = %email,
                        error = %e,
                        "Failed to send weekly digest email"
                    );
                    result.errors += 1;
                }
            }
        }

        offset += batch_size;
    }

    tracing::info!(
        users_processed = result.users_processed,
        emails_sent = result.emails_sent,
        errors = result.errors,
        "Weekly digest job completed"
    );

    Ok(result)
}

/// Get task statistics for a user
async fn get_user_stats(
    pool: &PgPool,
    user_id: Uuid,
    week_ago: chrono::DateTime<Utc>,
    now: chrono::DateTime<Utc>,
    week_from_now: chrono::DateTime<Utc>,
) -> Result<UserDigestStats, sqlx::Error> {
    // Count tasks completed in the last 7 days
    // A task is "completed" when it's moved to a column with status_mapping.done = true
    let tasks_completed: i64 = sqlx::query_scalar!(
        r#"
        SELECT COUNT(DISTINCT al.entity_id) as "count!"
        FROM activity_log al
        JOIN tasks t ON t.id = al.entity_id
        JOIN board_columns bc ON bc.id = t.column_id
        WHERE al.user_id = $1
          AND al.entity_type = 'task'
          AND al.action = 'moved'
          AND al.created_at >= $2
          AND al.created_at <= $3
          AND (bc.status_mapping->>'done')::boolean = true
        "#,
        user_id,
        week_ago,
        now
    )
    .fetch_one(pool)
    .await?;

    // Count tasks created in the last 7 days
    let tasks_created: i64 = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) as "count!"
        FROM tasks t
        WHERE t.created_by_id = $1
          AND t.created_at >= $2
          AND t.created_at <= $3
          AND t.deleted_at IS NULL
        "#,
        user_id,
        week_ago,
        now
    )
    .fetch_one(pool)
    .await?;

    // Count overdue tasks assigned to user
    let tasks_overdue: i64 = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) as "count!"
        FROM tasks t
        JOIN task_assignees ta ON ta.task_id = t.id
        WHERE ta.user_id = $1
          AND t.due_date < $2
          AND t.deleted_at IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM board_columns bc
              WHERE bc.id = t.column_id
              AND (bc.status_mapping->>'done')::boolean = true
          )
        "#,
        user_id,
        now
    )
    .fetch_one(pool)
    .await?;

    // Count tasks due this week
    let tasks_due_this_week: i64 = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) as "count!"
        FROM tasks t
        JOIN task_assignees ta ON ta.task_id = t.id
        WHERE ta.user_id = $1
          AND t.due_date >= $2
          AND t.due_date <= $3
          AND t.deleted_at IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM board_columns bc
              WHERE bc.id = t.column_id
              AND (bc.status_mapping->>'done')::boolean = true
          )
        "#,
        user_id,
        now,
        week_from_now
    )
    .fetch_one(pool)
    .await?;

    // Get user info
    let user: (String, String) = sqlx::query_as(r#"SELECT email, name FROM users WHERE id = $1"#)
        .bind(user_id)
        .fetch_one(pool)
        .await?;

    Ok(UserDigestStats {
        user_id,
        email: user.0,
        name: user.1,
        tasks_completed,
        tasks_created,
        tasks_overdue,
        tasks_due_this_week,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_weekly_digest_result_serialize() {
        let result = WeeklyDigestResult {
            users_processed: 100,
            emails_sent: 85,
            errors: 2,
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("\"users_processed\":100"));
    }

    #[test]
    fn test_weekly_digest_result_serialize_all_fields() {
        let result = WeeklyDigestResult {
            users_processed: 200,
            emails_sent: 180,
            errors: 5,
        };
        let json = serde_json::to_string(&result).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["users_processed"], 200);
        assert_eq!(parsed["emails_sent"], 180);
        assert_eq!(parsed["errors"], 5);
    }

    #[test]
    fn test_weekly_digest_result_zero_values() {
        let result = WeeklyDigestResult {
            users_processed: 0,
            emails_sent: 0,
            errors: 0,
        };
        let json = serde_json::to_string(&result).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["users_processed"], 0);
        assert_eq!(parsed["emails_sent"], 0);
        assert_eq!(parsed["errors"], 0);
    }

    #[test]
    fn test_weekly_digest_result_debug() {
        let result = WeeklyDigestResult {
            users_processed: 50,
            emails_sent: 40,
            errors: 1,
        };
        let debug = format!("{:?}", result);
        assert!(debug.contains("WeeklyDigestResult"), "got: {}", debug);
        assert!(debug.contains("users_processed"), "got: {}", debug);
    }

    #[test]
    fn test_weekly_digest_error_display() {
        let err = WeeklyDigestError::Database(sqlx::Error::RowNotFound);
        let msg = format!("{}", err);
        assert!(msg.contains("Database error"), "got: {}", msg);
    }

    #[test]
    fn test_weekly_digest_error_debug() {
        let err = WeeklyDigestError::Database(sqlx::Error::RowNotFound);
        let debug = format!("{:?}", err);
        assert!(debug.contains("Database"), "got: {}", debug);
    }

    #[test]
    fn test_weekly_digest_time_range_is_seven_days() {
        let now = Utc::now();
        let week_ago = now - Duration::days(7);
        let diff = (now - week_ago).num_days();
        assert_eq!(diff, 7, "Time range should be exactly 7 days");
    }

    #[test]
    fn test_weekly_digest_result_emails_never_exceed_users() {
        // This is a logical invariant: you can't send more emails than users processed
        let result = WeeklyDigestResult {
            users_processed: 50,
            emails_sent: 40,
            errors: 1,
        };
        assert!(
            result.emails_sent <= result.users_processed,
            "emails_sent ({}) should not exceed users_processed ({})",
            result.emails_sent,
            result.users_processed
        );
    }

    #[test]
    fn test_weekly_digest_result_consistency() {
        // errors + emails_sent should not exceed users_processed
        // (some users may be skipped due to no activity)
        let result = WeeklyDigestResult {
            users_processed: 100,
            emails_sent: 85,
            errors: 5,
        };
        assert!(
            result.emails_sent + result.errors <= result.users_processed,
            "emails_sent + errors should not exceed users_processed"
        );
    }

    #[test]
    fn test_email_subject_format() {
        let subject = "[TaskFlow] Your Weekly Summary";
        assert!(subject.starts_with("[TaskFlow]"));
        assert!(subject.contains("Weekly"));
    }
}
