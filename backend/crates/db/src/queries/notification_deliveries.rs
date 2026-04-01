//! Query module for notification delivery audit trail

use sqlx::PgPool;
use uuid::Uuid;

/// Log a notification delivery attempt
pub async fn log_delivery(
    pool: &PgPool,
    notification_id: Option<Uuid>,
    recipient_id: Uuid,
    channel: &str,
    status: &str,
    external_id: Option<&str>,
    error_message: Option<&str>,
) -> Result<Uuid, sqlx::Error> {
    let id = sqlx::query_scalar(
        r"
        INSERT INTO notification_deliveries (notification_id, recipient_id, channel, status, external_id, error_message)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
        ",
    )
    .bind(notification_id)
    .bind(recipient_id)
    .bind(channel)
    .bind(status)
    .bind(external_id)
    .bind(error_message)
    .fetch_one(pool)
    .await?;

    Ok(id)
}
