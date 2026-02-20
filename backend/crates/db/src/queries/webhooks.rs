use chrono::Utc;
use serde::Deserialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{Webhook, WebhookDelivery};

/// Error type for webhook query operations
#[derive(Debug, thiserror::Error)]
pub enum WebhookQueryError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("User is not a member of this board")]
    NotBoardMember,
    #[error("Webhook not found")]
    NotFound,
}

/// Input for creating a webhook
#[derive(Debug, Deserialize)]
pub struct CreateWebhookInput {
    pub url: String,
    pub secret: Option<String>,
    pub events: Vec<String>,
}

/// Input for updating a webhook
#[derive(Debug, Deserialize)]
pub struct UpdateWebhookInput {
    pub url: Option<String>,
    pub secret: Option<String>,
    pub events: Option<Vec<String>>,
    pub is_active: Option<bool>,
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

/// Internal helper: get webhook's board_id
async fn get_webhook_board_id_internal(
    pool: &PgPool,
    webhook_id: Uuid,
) -> Result<Uuid, WebhookQueryError> {
    let board_id = sqlx::query_scalar::<_, Uuid>(r#"SELECT board_id FROM webhooks WHERE id = $1"#)
        .bind(webhook_id)
        .fetch_optional(pool)
        .await?
        .ok_or(WebhookQueryError::NotFound)?;

    Ok(board_id)
}

/// List all webhooks for a board.
/// Verifies board membership.
pub async fn list_webhooks(
    pool: &PgPool,
    board_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<Webhook>, WebhookQueryError> {
    if !verify_board_membership_internal(pool, board_id, user_id).await? {
        return Err(WebhookQueryError::NotBoardMember);
    }

    let webhooks = sqlx::query_as::<_, Webhook>(
        r#"
        SELECT id, board_id, url, secret, events, is_active,
               tenant_id, created_by_id, created_at, updated_at
        FROM webhooks
        WHERE board_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(board_id)
    .fetch_all(pool)
    .await?;

    Ok(webhooks)
}

/// Create a new webhook.
/// Verifies board membership.
pub async fn create_webhook(
    pool: &PgPool,
    board_id: Uuid,
    input: CreateWebhookInput,
    user_id: Uuid,
    tenant_id: Uuid,
) -> Result<Webhook, WebhookQueryError> {
    if !verify_board_membership_internal(pool, board_id, user_id).await? {
        return Err(WebhookQueryError::NotBoardMember);
    }

    let id = Uuid::new_v4();
    let now = Utc::now();

    let webhook = sqlx::query_as::<_, Webhook>(
        r#"
        INSERT INTO webhooks (
            id, board_id, url, secret, events, is_active,
            tenant_id, created_by_id, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8, $8)
        RETURNING id, board_id, url, secret, events, is_active,
                  tenant_id, created_by_id, created_at, updated_at
        "#,
    )
    .bind(id)
    .bind(board_id)
    .bind(&input.url)
    .bind(&input.secret)
    .bind(&input.events)
    .bind(tenant_id)
    .bind(user_id)
    .bind(now)
    .fetch_one(pool)
    .await?;

    Ok(webhook)
}

/// Update a webhook.
/// Verifies board membership via the webhook's board_id.
pub async fn update_webhook(
    pool: &PgPool,
    webhook_id: Uuid,
    input: UpdateWebhookInput,
    user_id: Uuid,
) -> Result<Webhook, WebhookQueryError> {
    let board_id = get_webhook_board_id_internal(pool, webhook_id).await?;

    if !verify_board_membership_internal(pool, board_id, user_id).await? {
        return Err(WebhookQueryError::NotBoardMember);
    }

    let webhook = sqlx::query_as::<_, Webhook>(
        r#"
        UPDATE webhooks
        SET url = COALESCE($2, url),
            secret = COALESCE($3, secret),
            events = COALESCE($4, events),
            is_active = COALESCE($5, is_active),
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, board_id, url, secret, events, is_active,
                  tenant_id, created_by_id, created_at, updated_at
        "#,
    )
    .bind(webhook_id)
    .bind(&input.url)
    .bind(&input.secret)
    .bind(&input.events)
    .bind(input.is_active)
    .fetch_one(pool)
    .await?;

    Ok(webhook)
}

/// Delete a webhook.
/// Verifies board membership.
pub async fn delete_webhook(
    pool: &PgPool,
    webhook_id: Uuid,
    user_id: Uuid,
) -> Result<(), WebhookQueryError> {
    let board_id = get_webhook_board_id_internal(pool, webhook_id).await?;

    if !verify_board_membership_internal(pool, board_id, user_id).await? {
        return Err(WebhookQueryError::NotBoardMember);
    }

    sqlx::query(r#"DELETE FROM webhooks WHERE id = $1"#)
        .bind(webhook_id)
        .execute(pool)
        .await?;

    Ok(())
}

/// Get recent deliveries for a webhook.
/// Verifies board membership.
pub async fn get_webhook_deliveries(
    pool: &PgPool,
    webhook_id: Uuid,
    user_id: Uuid,
    limit: i64,
) -> Result<Vec<WebhookDelivery>, WebhookQueryError> {
    let board_id = get_webhook_board_id_internal(pool, webhook_id).await?;

    if !verify_board_membership_internal(pool, board_id, user_id).await? {
        return Err(WebhookQueryError::NotBoardMember);
    }

    let deliveries = sqlx::query_as::<_, WebhookDelivery>(
        r#"
        SELECT id, webhook_id, event_type, payload, response_status,
               response_body, delivered_at, success
        FROM webhook_deliveries
        WHERE webhook_id = $1
        ORDER BY delivered_at DESC
        LIMIT $2
        "#,
    )
    .bind(webhook_id)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(deliveries)
}

/// Get all active webhooks for a board that match a given event type.
/// Used internally by the webhook dispatcher (no user auth check needed).
pub async fn get_active_webhooks_for_event(
    pool: &PgPool,
    board_id: Uuid,
    event_type: &str,
) -> Result<Vec<Webhook>, WebhookQueryError> {
    let webhooks = sqlx::query_as::<_, Webhook>(
        r#"
        SELECT id, board_id, url, secret, events, is_active,
               tenant_id, created_by_id, created_at, updated_at
        FROM webhooks
        WHERE board_id = $1
          AND is_active = true
          AND $2 = ANY(events)
        "#,
    )
    .bind(board_id)
    .bind(event_type)
    .fetch_all(pool)
    .await?;

    Ok(webhooks)
}

/// Log a webhook delivery attempt.
pub async fn log_webhook_delivery(
    pool: &PgPool,
    webhook_id: Uuid,
    event_type: &str,
    payload: &serde_json::Value,
    response_status: Option<i32>,
    response_body: Option<&str>,
    success: bool,
) -> Result<WebhookDelivery, WebhookQueryError> {
    let id = Uuid::new_v4();
    let now = Utc::now();

    let delivery = sqlx::query_as::<_, WebhookDelivery>(
        r#"
        INSERT INTO webhook_deliveries (
            id, webhook_id, event_type, payload, response_status,
            response_body, delivered_at, success
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, webhook_id, event_type, payload, response_status,
                  response_body, delivered_at, success
        "#,
    )
    .bind(id)
    .bind(webhook_id)
    .bind(event_type)
    .bind(payload)
    .bind(response_status)
    .bind(response_body)
    .bind(now)
    .bind(success)
    .fetch_one(pool)
    .await?;

    Ok(delivery)
}
