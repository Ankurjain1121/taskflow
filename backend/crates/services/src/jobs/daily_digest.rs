//! Daily digest email job
//!
//! Thin wrapper around digest_service for daily digest emails.
//! Uses notification_preferences with event_type 'daily-digest'.

use sqlx::PgPool;

use crate::jobs::digest_service::{generate_digests, DigestError, DigestPeriod, DigestResult};
use crate::notifications::email::PostalClient;

/// Send daily digest emails to all users with daily digest enabled
///
/// Delegates to the shared digest service with `DigestPeriod::Daily`.
pub async fn send_daily_digests(
    pool: &PgPool,
    postal: &PostalClient,
    app_url: &str,
) -> Result<DigestResult, DigestError> {
    generate_digests(pool, postal, app_url, DigestPeriod::Daily).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_daily_digest_uses_correct_period() {
        // Verify DigestPeriod::Daily has expected configuration
        assert_eq!(DigestPeriod::Daily.lookback_days(), 1);
        assert_eq!(DigestPeriod::Daily.preference_key(), "daily-digest");
        assert_eq!(
            DigestPeriod::Daily.email_subject(),
            "[TaskFlow] Your Daily Summary"
        );
    }
}
