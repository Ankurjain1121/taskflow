//! Shared digest service for daily and weekly digests
//!
//! Extracts common logic from weekly_digest.rs and provides
//! a unified interface for generating digest emails across
//! different time periods. Uses batch CTE queries for performance.

use chrono::{Duration, Utc};
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::notifications::email::{generate_weekly_digest_html, PostalClient};

/// The time period for a digest
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DigestPeriod {
    Daily,
    Weekly,
}

impl DigestPeriod {
    /// Number of days to look back for activity
    pub fn lookback_days(&self) -> i64 {
        match self {
            DigestPeriod::Daily => 1,
            DigestPeriod::Weekly => 7,
        }
    }

    /// The notification preference event_type key
    pub fn preference_key(&self) -> &'static str {
        match self {
            DigestPeriod::Daily => "daily-digest",
            DigestPeriod::Weekly => "weekly-digest",
        }
    }

    /// Email subject line
    pub fn email_subject(&self) -> &'static str {
        match self {
            DigestPeriod::Daily => "[TaskFlow] Your Daily Summary",
            DigestPeriod::Weekly => "[TaskFlow] Your Weekly Summary",
        }
    }

    /// Human-readable label for the period
    pub fn label(&self) -> &'static str {
        match self {
            DigestPeriod::Daily => "daily",
            DigestPeriod::Weekly => "weekly",
        }
    }
}

/// Error type for digest operations
#[derive(Debug, thiserror::Error)]
pub enum DigestError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Email error: {0}")]
    Email(#[from] crate::notifications::email::EmailError),
}

/// Result of a digest job run
#[derive(Debug, Serialize)]
pub struct DigestResult {
    pub period: DigestPeriod,
    pub users_processed: usize,
    pub emails_sent: usize,
    pub errors: usize,
}

/// Stats for a single user from the batch CTE query
#[derive(Debug)]
struct UserBatchStats {
    user_id: Uuid,
    tasks_completed: i64,
    tasks_created: i64,
    tasks_overdue: i64,
    tasks_due_soon: i64,
}

/// Generate and send digest emails for the given period
///
/// Processes users in batches of 50. For each batch, runs a single
/// CTE query to get all user stats instead of 4 sequential queries
/// per user (the original weekly_digest.rs approach).
pub async fn generate_digests(
    pool: &PgPool,
    postal: &PostalClient,
    app_url: &str,
    period: DigestPeriod,
) -> Result<DigestResult, DigestError> {
    let now = Utc::now();
    let period_start = now - Duration::days(period.lookback_days());
    let lookahead_end = now + Duration::days(period.lookback_days());

    let mut result = DigestResult {
        period,
        users_processed: 0,
        emails_sent: 0,
        errors: 0,
    };

    let batch_size = 50i64;
    let mut offset = 0i64;
    let pref_key = period.preference_key();

    loop {
        // Fetch batch of users with email enabled for this digest type
        let users: Vec<(Uuid, String, String)> = sqlx::query_as(
            r#"
            SELECT DISTINCT u.id, u.email, u.name
            FROM users u
            WHERE u.deleted_at IS NULL
              AND (
                  NOT EXISTS (
                      SELECT 1 FROM notification_preferences np
                      WHERE np.user_id = u.id
                      AND np.event_type = $3
                  )
                  OR
                  EXISTS (
                      SELECT 1 FROM notification_preferences np
                      WHERE np.user_id = u.id
                      AND np.event_type = $3
                      AND np.email = true
                  )
              )
            ORDER BY u.id
            LIMIT $1 OFFSET $2
            "#,
        )
        .bind(batch_size)
        .bind(offset)
        .bind(pref_key)
        .fetch_all(pool)
        .await?;

        if users.is_empty() {
            break;
        }

        let user_ids: Vec<Uuid> = users.iter().map(|(id, _, _)| *id).collect();

        // Single batch CTE query for all users in this batch
        let batch_stats = fetch_batch_stats(pool, &user_ids, period_start, now, lookahead_end).await;
        let stats_map = match batch_stats {
            Ok(stats) => stats,
            Err(e) => {
                tracing::error!(
                    error = %e,
                    batch_offset = offset,
                    "Failed to fetch batch stats for digest"
                );
                result.errors += users.len();
                offset += batch_size;
                continue;
            }
        };

        for (user_id, email, name) in &users {
            result.users_processed += 1;

            let stats = stats_map
                .iter()
                .find(|s| s.user_id == *user_id);

            let (completed, created, overdue, due_soon) = match stats {
                Some(s) => (s.tasks_completed, s.tasks_created, s.tasks_overdue, s.tasks_due_soon),
                None => (0, 0, 0, 0),
            };

            // Skip if no activity
            if completed == 0 && created == 0 && overdue == 0 && due_soon == 0 {
                continue;
            }

            let html = generate_weekly_digest_html(
                name,
                completed,
                created,
                overdue,
                due_soon,
                app_url,
            );

            match postal
                .send_email(email, period.email_subject(), &html)
                .await
            {
                Ok(()) => {
                    result.emails_sent += 1;
                    tracing::debug!(
                        user_id = %user_id,
                        email = %email,
                        period = period.label(),
                        "Digest email sent"
                    );
                }
                Err(e) => {
                    tracing::error!(
                        user_id = %user_id,
                        email = %email,
                        error = %e,
                        period = period.label(),
                        "Failed to send digest email"
                    );
                    result.errors += 1;
                }
            }
        }

        offset += batch_size;
    }

    tracing::info!(
        period = period.label(),
        users_processed = result.users_processed,
        emails_sent = result.emails_sent,
        errors = result.errors,
        "Digest job completed"
    );

    Ok(result)
}

/// Fetch stats for a batch of users using a single CTE query
///
/// This replaces 4 sequential queries per user with 1 query per batch of 50.
async fn fetch_batch_stats(
    pool: &PgPool,
    user_ids: &[Uuid],
    period_start: chrono::DateTime<Utc>,
    now: chrono::DateTime<Utc>,
    lookahead_end: chrono::DateTime<Utc>,
) -> Result<Vec<UserBatchStats>, sqlx::Error> {
    // Use raw query_as since the CTE returns multiple rows
    let rows: Vec<(Uuid, Option<i64>, Option<i64>, Option<i64>, Option<i64>)> = sqlx::query_as(
        r#"
        WITH completed AS (
            SELECT al.user_id, COUNT(DISTINCT al.entity_id) as cnt
            FROM activity_log al
            JOIN tasks t ON t.id = al.entity_id AND t.deleted_at IS NULL
            LEFT JOIN project_statuses ps ON ps.id = t.status_id
            WHERE al.user_id = ANY($1)
              AND al.entity_type = 'task'
              AND al.action = 'moved'
              AND al.created_at >= $2
              AND al.created_at <= $3
              AND ps.type = 'done'
            GROUP BY al.user_id
        ),
        created AS (
            SELECT t.created_by_id as user_id, COUNT(*) as cnt
            FROM tasks t
            WHERE t.created_by_id = ANY($1)
              AND t.created_at >= $2
              AND t.created_at <= $3
              AND t.deleted_at IS NULL
            GROUP BY t.created_by_id
        ),
        overdue AS (
            SELECT ta.user_id, COUNT(DISTINCT t.id) as cnt
            FROM task_assignees ta
            JOIN tasks t ON t.id = ta.task_id AND t.deleted_at IS NULL
            WHERE ta.user_id = ANY($1)
              AND t.due_date < $3
              AND NOT EXISTS (
                  SELECT 1 FROM project_statuses ps
                  WHERE ps.id = t.status_id AND ps.type = 'done'
              )
            GROUP BY ta.user_id
        ),
        due_soon AS (
            SELECT ta.user_id, COUNT(DISTINCT t.id) as cnt
            FROM task_assignees ta
            JOIN tasks t ON t.id = ta.task_id AND t.deleted_at IS NULL
            WHERE ta.user_id = ANY($1)
              AND t.due_date >= $3
              AND t.due_date <= $4
              AND NOT EXISTS (
                  SELECT 1 FROM project_statuses ps
                  WHERE ps.id = t.status_id AND ps.type = 'done'
              )
            GROUP BY ta.user_id
        )
        SELECT
            u.id,
            c.cnt as tasks_completed,
            cr.cnt as tasks_created,
            o.cnt as tasks_overdue,
            ds.cnt as tasks_due_soon
        FROM unnest($1::uuid[]) AS u(id)
        LEFT JOIN completed c ON c.user_id = u.id
        LEFT JOIN created cr ON cr.user_id = u.id
        LEFT JOIN overdue o ON o.user_id = u.id
        LEFT JOIN due_soon ds ON ds.user_id = u.id
        "#,
    )
    .bind(user_ids)
    .bind(period_start)
    .bind(now)
    .bind(lookahead_end)
    .fetch_all(pool)
    .await?;

    let stats = rows
        .into_iter()
        .map(|(user_id, completed, created, overdue, due_soon)| UserBatchStats {
            user_id,
            tasks_completed: completed.unwrap_or(0),
            tasks_created: created.unwrap_or(0),
            tasks_overdue: overdue.unwrap_or(0),
            tasks_due_soon: due_soon.unwrap_or(0),
        })
        .collect();

    Ok(stats)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_digest_period_lookback_days() {
        assert_eq!(DigestPeriod::Daily.lookback_days(), 1);
        assert_eq!(DigestPeriod::Weekly.lookback_days(), 7);
    }

    #[test]
    fn test_digest_period_preference_key() {
        assert_eq!(DigestPeriod::Daily.preference_key(), "daily-digest");
        assert_eq!(DigestPeriod::Weekly.preference_key(), "weekly-digest");
    }

    #[test]
    fn test_digest_period_email_subject() {
        assert_eq!(
            DigestPeriod::Daily.email_subject(),
            "[TaskFlow] Your Daily Summary"
        );
        assert_eq!(
            DigestPeriod::Weekly.email_subject(),
            "[TaskFlow] Your Weekly Summary"
        );
    }

    #[test]
    fn test_digest_period_label() {
        assert_eq!(DigestPeriod::Daily.label(), "daily");
        assert_eq!(DigestPeriod::Weekly.label(), "weekly");
    }

    #[test]
    fn test_digest_period_serde_roundtrip() {
        let daily = DigestPeriod::Daily;
        let json = serde_json::to_string(&daily).expect("serialize");
        assert_eq!(json, r#""daily""#);

        let weekly = DigestPeriod::Weekly;
        let json = serde_json::to_string(&weekly).expect("serialize");
        assert_eq!(json, r#""weekly""#);
    }

    #[test]
    fn test_digest_result_serialize() {
        let result = DigestResult {
            period: DigestPeriod::Weekly,
            users_processed: 100,
            emails_sent: 85,
            errors: 2,
        };
        let json = serde_json::to_string(&result).expect("serialize");
        let parsed: serde_json::Value = serde_json::from_str(&json).expect("parse");
        assert_eq!(parsed["period"], "weekly");
        assert_eq!(parsed["users_processed"], 100);
        assert_eq!(parsed["emails_sent"], 85);
        assert_eq!(parsed["errors"], 2);
    }

    #[test]
    fn test_digest_result_zero_values() {
        let result = DigestResult {
            period: DigestPeriod::Daily,
            users_processed: 0,
            emails_sent: 0,
            errors: 0,
        };
        let json = serde_json::to_string(&result).expect("serialize");
        let parsed: serde_json::Value = serde_json::from_str(&json).expect("parse");
        assert_eq!(parsed["period"], "daily");
        assert_eq!(parsed["users_processed"], 0);
    }

    #[test]
    fn test_digest_result_consistency() {
        let result = DigestResult {
            period: DigestPeriod::Weekly,
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
    fn test_digest_error_display() {
        let err = DigestError::Database(sqlx::Error::RowNotFound);
        let msg = format!("{}", err);
        assert!(msg.contains("Database error"), "got: {}", msg);
    }

    #[test]
    fn test_digest_period_equality() {
        assert_eq!(DigestPeriod::Daily, DigestPeriod::Daily);
        assert_eq!(DigestPeriod::Weekly, DigestPeriod::Weekly);
        assert_ne!(DigestPeriod::Daily, DigestPeriod::Weekly);
    }
}
