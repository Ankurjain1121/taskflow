//! Email worker — continuous loop that dequeues and sends email jobs
//!
//! The worker uses BRPOP to block-wait for jobs on the Redis email queue.
//! On failure it retries up to [`MAX_RETRIES`] times with exponential backoff,
//! then moves the job to the dead-letter queue.

use std::time::Duration;

use crate::notifications::email::PostalClient;

use super::email_queue::{dequeue_email, enqueue_email, push_to_dlq, EmailQueueError, MAX_RETRIES};

/// Run the email worker loop.
///
/// This function never returns under normal operation. It continuously
/// dequeues email jobs from Redis and sends them via the Postal API.
pub async fn run_email_worker(
    redis: redis::aio::ConnectionManager,
    postal: PostalClient,
) {
    tracing::info!("Email worker started — listening on queue");

    let mut consecutive_redis_errors: u32 = 0;

    loop {
        // Dequeue next job (blocks up to 5s)
        let job_result = dequeue_email(&redis).await;

        match job_result {
            Ok(Some(job)) => {
                // Reset error counter on successful dequeue
                consecutive_redis_errors = 0;

                tracing::info!(
                    job_id = %job.id,
                    recipient = %job.recipient_email,
                    event_type = %job.event_type,
                    retry_count = job.retry_count,
                    "Email job received"
                );

                // Attempt to send
                let send_result = postal
                    .send_email(&job.recipient_email, &job.subject, &job.html_body)
                    .await;

                match send_result {
                    Ok(()) => {
                        tracing::info!(
                            job_id = %job.id,
                            recipient = %job.recipient_email,
                            "Email sent successfully"
                        );
                    }
                    Err(e) => {
                        let should_retry = is_retryable_error(&e);
                        let new_retry_count = job.retry_count + 1;

                        if should_retry && new_retry_count < MAX_RETRIES {
                            tracing::warn!(
                                job_id = %job.id,
                                recipient = %job.recipient_email,
                                retry_count = new_retry_count,
                                error = %e,
                                "Email send failed (retryable), re-enqueuing"
                            );

                            // Backoff before re-enqueue: 1s, 2s, 4s
                            let backoff = Duration::from_secs(1 << job.retry_count);
                            tokio::time::sleep(backoff).await;

                            let mut retry_job = job.clone();
                            retry_job.retry_count = new_retry_count;

                            if let Err(enq_err) = enqueue_email(&redis, &retry_job).await {
                                tracing::error!(
                                    job_id = %retry_job.id,
                                    error = %enq_err,
                                    "Failed to re-enqueue email job for retry"
                                );
                            }
                        } else {
                            tracing::error!(
                                job_id = %job.id,
                                recipient = %job.recipient_email,
                                retry_count = new_retry_count,
                                retryable = should_retry,
                                error = %e,
                                "Email send failed permanently, moving to DLQ"
                            );

                            let mut dlq_job = job.clone();
                            dlq_job.retry_count = new_retry_count;

                            if let Err(dlq_err) = push_to_dlq(&redis, &dlq_job).await {
                                tracing::error!(
                                    job_id = %dlq_job.id,
                                    error = %dlq_err,
                                    "Failed to push email job to DLQ"
                                );
                            }
                        }
                    }
                }
            }
            Ok(None) => {
                // BRPOP timeout — no jobs available, loop again
                consecutive_redis_errors = 0;
            }
            Err(EmailQueueError::Redis(_)) => {
                consecutive_redis_errors += 1;
                // Exponential backoff on Redis connection errors: 1s, 2s, 4s (capped)
                let backoff_secs =
                    1u64 << consecutive_redis_errors.min(2);
                tracing::error!(
                    consecutive_errors = consecutive_redis_errors,
                    backoff_secs,
                    "Redis connection error in email worker, backing off"
                );
                tokio::time::sleep(Duration::from_secs(backoff_secs)).await;
            }
            Err(e) => {
                tracing::error!(error = %e, "Unexpected error in email worker");
                tokio::time::sleep(Duration::from_secs(1)).await;
            }
        }
    }
}

/// Determine whether an email error is retryable.
///
/// Timeout and connection errors are retryable; API errors (4xx/5xx) and
/// config errors are not.
fn is_retryable_error(err: &crate::notifications::email::EmailError) -> bool {
    match err {
        crate::notifications::email::EmailError::Request(reqwest_err) => {
            reqwest_err.is_timeout() || reqwest_err.is_connect()
        }
        crate::notifications::email::EmailError::Config(_) => false,
        crate::notifications::email::EmailError::Api { .. } => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::notifications::email::EmailError;

    #[test]
    fn test_config_error_is_not_retryable() {
        let err = EmailError::Config("bad config".to_string());
        assert!(!is_retryable_error(&err));
    }

    #[test]
    fn test_api_error_is_not_retryable() {
        let err = EmailError::Api {
            status: 422,
            message: "Unprocessable".to_string(),
        };
        assert!(!is_retryable_error(&err));
    }

    #[test]
    fn test_api_500_error_is_not_retryable() {
        let err = EmailError::Api {
            status: 500,
            message: "Internal Server Error".to_string(),
        };
        assert!(!is_retryable_error(&err));
    }
}
