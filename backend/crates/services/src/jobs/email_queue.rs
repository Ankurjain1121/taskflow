//! Email job queue backed by Redis
//!
//! Provides an `EmailJob` struct and functions to enqueue/dequeue email jobs
//! using Redis lists (LPUSH / BRPOP). Failed jobs that exceed the retry limit
//! are moved to a dead-letter queue for manual inspection.

use chrono::{DateTime, Utc};
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Redis key for the main email queue
pub const QUEUE_KEY: &str = "taskbolt:email:queue";

/// Redis key for the dead-letter queue (jobs that exceeded max retries)
pub const DLQ_KEY: &str = "taskbolt:email:dlq";

/// Maximum number of retry attempts before moving to the DLQ
pub const MAX_RETRIES: u8 = 3;

/// An email job to be processed by the email worker
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EmailJob {
    pub id: Uuid,
    pub recipient_email: String,
    pub subject: String,
    pub html_body: String,
    pub event_type: String,
    pub retry_count: u8,
    pub created_at: DateTime<Utc>,
}

impl EmailJob {
    /// Create a new email job with a fresh ID and zero retries
    pub fn new(
        recipient_email: String,
        subject: String,
        html_body: String,
        event_type: String,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            recipient_email,
            subject,
            html_body,
            event_type,
            retry_count: 0,
            created_at: Utc::now(),
        }
    }
}

/// Push an email job onto the queue (left-push so BRPOP processes FIFO)
pub async fn enqueue_email(
    redis: &redis::aio::ConnectionManager,
    job: &EmailJob,
) -> Result<(), EmailQueueError> {
    let payload = serde_json::to_string(job).map_err(EmailQueueError::Serialization)?;
    let mut conn = redis.clone();
    conn.lpush::<_, _, ()>(QUEUE_KEY, &payload).await?;
    tracing::debug!(
        job_id = %job.id,
        recipient = %job.recipient_email,
        event_type = %job.event_type,
        "Email job enqueued"
    );
    Ok(())
}

/// Block-pop the next email job from the queue (5-second timeout).
/// Returns `None` if the timeout expires with no job available.
pub async fn dequeue_email(
    redis: &redis::aio::ConnectionManager,
) -> Result<Option<EmailJob>, EmailQueueError> {
    let mut conn = redis.clone();
    // BRPOP returns Option<(key, value)>
    let result: Option<(String, String)> = redis::cmd("BRPOP")
        .arg(QUEUE_KEY)
        .arg(5) // 5-second timeout
        .query_async(&mut conn)
        .await?;

    match result {
        Some((_key, payload)) => {
            let job: EmailJob =
                serde_json::from_str(&payload).map_err(EmailQueueError::Serialization)?;
            Ok(Some(job))
        }
        None => Ok(None),
    }
}

/// Push a failed job to the dead-letter queue for manual inspection
pub async fn push_to_dlq(
    redis: &redis::aio::ConnectionManager,
    job: &EmailJob,
) -> Result<(), EmailQueueError> {
    let payload = serde_json::to_string(job).map_err(EmailQueueError::Serialization)?;
    let mut conn = redis.clone();
    conn.lpush::<_, _, ()>(DLQ_KEY, &payload).await?;
    tracing::warn!(
        job_id = %job.id,
        recipient = %job.recipient_email,
        retry_count = job.retry_count,
        "Email job moved to dead-letter queue"
    );
    Ok(())
}

/// Error type for email queue operations
#[derive(Debug, thiserror::Error)]
pub enum EmailQueueError {
    #[error("Redis error: {0}")]
    Redis(#[from] redis::RedisError),
    #[error("Serialization error: {0}")]
    Serialization(serde_json::Error),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_email_job_new_has_zero_retries() {
        let job = EmailJob::new(
            "test@example.com".into(),
            "Subject".into(),
            "<p>Body</p>".into(),
            "task-assigned".into(),
        );
        assert_eq!(job.retry_count, 0);
        assert_eq!(job.recipient_email, "test@example.com");
        assert_eq!(job.event_type, "task-assigned");
    }

    #[test]
    fn test_email_job_serialization_roundtrip() {
        let job = EmailJob::new(
            "user@example.com".into(),
            "Test Subject".into(),
            "<h1>Hello</h1>".into(),
            "comment-added".into(),
        );

        let json = serde_json::to_string(&job).expect("serialize");
        let deserialized: EmailJob = serde_json::from_str(&json).expect("deserialize");

        assert_eq!(job, deserialized);
    }

    #[test]
    fn test_email_job_serialization_preserves_all_fields() {
        let job = EmailJob {
            id: Uuid::new_v4(),
            recipient_email: "alice@test.com".into(),
            subject: "Important".into(),
            html_body: "<p>Content</p>".into(),
            event_type: "deadline-approaching".into(),
            retry_count: 2,
            created_at: Utc::now(),
        };

        let json = serde_json::to_string(&job).expect("serialize");
        let parsed: serde_json::Value = serde_json::from_str(&json).expect("parse");

        assert_eq!(parsed["recipient_email"], "alice@test.com");
        assert_eq!(parsed["subject"], "Important");
        assert_eq!(parsed["event_type"], "deadline-approaching");
        assert_eq!(parsed["retry_count"], 2);
    }

    #[test]
    fn test_email_job_retry_count_increment() {
        let mut job = EmailJob::new(
            "test@example.com".into(),
            "Subject".into(),
            "<p>Body</p>".into(),
            "task-assigned".into(),
        );
        assert_eq!(job.retry_count, 0);

        job.retry_count += 1;
        assert_eq!(job.retry_count, 1);
        assert!(job.retry_count < MAX_RETRIES);

        job.retry_count += 1;
        assert_eq!(job.retry_count, 2);
        assert!(job.retry_count < MAX_RETRIES);

        job.retry_count += 1;
        assert_eq!(job.retry_count, 3);
        assert!(job.retry_count >= MAX_RETRIES);
    }

    #[test]
    fn test_max_retries_is_three() {
        assert_eq!(MAX_RETRIES, 3);
    }

    #[test]
    fn test_queue_keys_are_namespaced() {
        assert!(QUEUE_KEY.starts_with("taskbolt:"));
        assert!(DLQ_KEY.starts_with("taskbolt:"));
    }

    #[test]
    fn test_email_queue_error_display() {
        let err =
            EmailQueueError::Serialization(serde_json::from_str::<EmailJob>("bad").unwrap_err());
        let msg = format!("{}", err);
        assert!(msg.contains("Serialization error"), "got: {}", msg);
    }

    #[test]
    fn test_email_queue_error_debug() {
        let err =
            EmailQueueError::Serialization(serde_json::from_str::<EmailJob>("bad").unwrap_err());
        let debug = format!("{:?}", err);
        assert!(debug.contains("Serialization"), "got: {}", debug);
    }

    #[test]
    fn test_email_job_clone() {
        let job = EmailJob::new(
            "test@example.com".into(),
            "Subject".into(),
            "<p>Body</p>".into(),
            "task-assigned".into(),
        );
        let cloned = job.clone();
        assert_eq!(job, cloned);
    }
}
