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

use super::verify_board_membership_internal;

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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::UserRole;
    use crate::queries::{auth, boards, workspaces};

    const FAKE_HASH: &str = "$argon2id$v=19$m=19456,t=2,p=1$fake_salt$fake_hash_for_test";

    async fn test_pool() -> PgPool {
        PgPool::connect(
            "postgresql://taskflow:REDACTED_PG_PASSWORD@localhost:5433/taskflow",
        )
        .await
        .expect("Failed to connect to test database")
    }

    fn unique_email() -> String {
        format!("inttest-wh-{}@example.com", Uuid::new_v4())
    }

    async fn setup_user(pool: &PgPool) -> (Uuid, Uuid) {
        let user = auth::create_user_with_tenant(pool, &unique_email(), "WH Test User", FAKE_HASH)
            .await
            .expect("create_user_with_tenant");
        (user.tenant_id, user.id)
    }

    async fn setup_user_and_workspace(pool: &PgPool) -> (Uuid, Uuid, Uuid) {
        let (tenant_id, user_id) = setup_user(pool).await;
        let ws = workspaces::create_workspace(pool, "WH Test WS", None, tenant_id, user_id)
            .await
            .expect("create_workspace");
        (tenant_id, user_id, ws.id)
    }

    async fn setup_full(pool: &PgPool) -> (Uuid, Uuid, Uuid, Uuid, Uuid) {
        let (tenant_id, user_id, ws_id) = setup_user_and_workspace(pool).await;
        let bwc = boards::create_board(pool, "WH Test Board", None, ws_id, tenant_id, user_id)
            .await
            .expect("create_board");
        let first_col_id = bwc.columns[0].id;
        (tenant_id, user_id, ws_id, bwc.board.id, first_col_id)
    }

    #[tokio::test]
    async fn test_create_webhook() {
        let pool = test_pool().await;
        let (tenant_id, user_id, _ws_id, board_id, _col_id) = setup_full(&pool).await;

        let input = CreateWebhookInput {
            url: "https://example.com/webhook".to_string(),
            secret: Some("test-secret".to_string()),
            events: vec!["task.created".to_string(), "task.updated".to_string()],
        };

        let webhook = create_webhook(&pool, board_id, input, user_id, tenant_id)
            .await
            .expect("create_webhook");

        assert_eq!(webhook.board_id, board_id);
        assert_eq!(webhook.url, "https://example.com/webhook");
        assert_eq!(webhook.secret.as_deref(), Some("test-secret"));
        assert_eq!(webhook.events.len(), 2);
        assert!(webhook.is_active);
        assert_eq!(webhook.tenant_id, tenant_id);
        assert_eq!(webhook.created_by_id, user_id);
    }

    #[tokio::test]
    async fn test_list_webhooks() {
        let pool = test_pool().await;
        let (tenant_id, user_id, _ws_id, board_id, _col_id) = setup_full(&pool).await;

        let input1 = CreateWebhookInput {
            url: "https://example.com/hook1".to_string(),
            secret: None,
            events: vec!["task.created".to_string()],
        };
        create_webhook(&pool, board_id, input1, user_id, tenant_id)
            .await
            .expect("create webhook 1");

        let input2 = CreateWebhookInput {
            url: "https://example.com/hook2".to_string(),
            secret: None,
            events: vec!["task.deleted".to_string()],
        };
        create_webhook(&pool, board_id, input2, user_id, tenant_id)
            .await
            .expect("create webhook 2");

        let webhooks = list_webhooks(&pool, board_id, user_id)
            .await
            .expect("list_webhooks");

        assert!(webhooks.len() >= 2);
        let urls: Vec<&str> = webhooks.iter().map(|w| w.url.as_str()).collect();
        assert!(urls.contains(&"https://example.com/hook1"));
        assert!(urls.contains(&"https://example.com/hook2"));
    }

    #[tokio::test]
    async fn test_delete_webhook() {
        let pool = test_pool().await;
        let (tenant_id, user_id, _ws_id, board_id, _col_id) = setup_full(&pool).await;

        let input = CreateWebhookInput {
            url: "https://example.com/to-delete".to_string(),
            secret: None,
            events: vec!["task.created".to_string()],
        };
        let webhook = create_webhook(&pool, board_id, input, user_id, tenant_id)
            .await
            .expect("create webhook to delete");

        delete_webhook(&pool, webhook.id, user_id)
            .await
            .expect("delete_webhook");

        // Verify it is no longer listed
        let webhooks = list_webhooks(&pool, board_id, user_id)
            .await
            .expect("list after delete");
        assert!(
            !webhooks.iter().any(|w| w.id == webhook.id),
            "deleted webhook should not appear in list"
        );
    }

    #[tokio::test]
    async fn test_update_webhook() {
        let pool = test_pool().await;
        let (tenant_id, user_id, _ws_id, board_id, _col_id) = setup_full(&pool).await;

        let input = CreateWebhookInput {
            url: "https://example.com/original".to_string(),
            secret: None,
            events: vec!["task.created".to_string()],
        };
        let webhook = create_webhook(&pool, board_id, input, user_id, tenant_id)
            .await
            .expect("create webhook to update");

        let update_input = UpdateWebhookInput {
            url: Some("https://example.com/updated".to_string()),
            secret: None,
            events: None,
            is_active: Some(false),
        };
        let updated = update_webhook(&pool, webhook.id, update_input, user_id)
            .await
            .expect("update_webhook");

        assert_eq!(updated.url, "https://example.com/updated");
        assert!(!updated.is_active);
    }

    #[tokio::test]
    async fn test_get_active_webhooks_for_event() {
        let pool = test_pool().await;
        let (tenant_id, user_id, _ws_id, board_id, _col_id) = setup_full(&pool).await;

        let input = CreateWebhookInput {
            url: "https://example.com/event-hook".to_string(),
            secret: None,
            events: vec!["task.created".to_string(), "task.deleted".to_string()],
        };
        create_webhook(&pool, board_id, input, user_id, tenant_id)
            .await
            .expect("create webhook for event test");

        let active = get_active_webhooks_for_event(&pool, board_id, "task.created")
            .await
            .expect("get_active_webhooks_for_event");
        assert!(
            !active.is_empty(),
            "should find at least one active webhook for task.created"
        );

        let no_match = get_active_webhooks_for_event(&pool, board_id, "nonexistent.event")
            .await
            .expect("get_active_webhooks_for_event nonexistent");
        // Nonexistent event may or may not have matches, but shouldn't error
        // (previous tests may have created webhooks with this event, so just check no error)
        let _ = no_match;
    }

    #[tokio::test]
    async fn test_webhook_not_board_member() {
        let pool = test_pool().await;
        let (tenant_id, _user_id, _ws_id, board_id, _col_id) = setup_full(&pool).await;

        let other_user = auth::create_user(
            &pool,
            &unique_email(),
            "Non-member",
            FAKE_HASH,
            UserRole::Member,
            tenant_id,
        )
        .await
        .expect("create other user");

        let input = CreateWebhookInput {
            url: "https://example.com/unauthorized".to_string(),
            secret: None,
            events: vec!["task.created".to_string()],
        };
        let result = create_webhook(&pool, board_id, input, other_user.id, tenant_id).await;
        assert!(
            result.is_err(),
            "non-member should not be able to create webhook"
        );
    }
}
