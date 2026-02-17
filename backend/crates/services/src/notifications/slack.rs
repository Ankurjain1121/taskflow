//! Slack notification provider
//!
//! Sends notifications to Slack via incoming webhooks.
//! Feature-gated via SLACK_ENABLED environment variable.

use reqwest::Client;
use serde::Serialize;
use serde_json::{json, Value};
use std::env;

/// Error type for Slack operations
#[derive(Debug, thiserror::Error)]
pub enum SlackError {
    #[error("HTTP request failed: {0}")]
    Request(#[from] reqwest::Error),
    #[error("Invalid webhook URL: {0}")]
    InvalidWebhookUrl(String),
    #[error("Slack is disabled")]
    Disabled,
    #[error("Webhook error: {0}")]
    WebhookError(String),
}

/// Check if Slack integration is enabled
pub fn is_slack_enabled() -> bool {
    env::var("SLACK_ENABLED")
        .map(|v| v == "true" || v == "1")
        .unwrap_or(false)
}

/// Validate a Slack webhook URL
fn validate_webhook_url(url: &str) -> Result<(), SlackError> {
    if !url.starts_with("https://hooks.slack.com/") {
        return Err(SlackError::InvalidWebhookUrl(format!(
            "URL must start with https://hooks.slack.com/, got: {}",
            url
        )));
    }
    Ok(())
}

/// Slack Block Kit message structure
#[derive(Serialize)]
struct SlackMessage {
    blocks: Vec<Value>,
}

/// Send a Slack notification via webhook
///
/// # Arguments
/// * `webhook_url` - The Slack incoming webhook URL (from board settings)
/// * `event_type` - The notification event type name
/// * `payload` - Event-specific payload with title, body, and optional link
///
/// # Returns
/// Ok(()) if the message was sent successfully
pub async fn send_slack_notification(
    webhook_url: &str,
    event_type: &str,
    title: &str,
    body: &str,
    link_url: Option<&str>,
) -> Result<(), SlackError> {
    // Check if Slack is enabled
    if !is_slack_enabled() {
        return Err(SlackError::Disabled);
    }

    // Validate the webhook URL
    validate_webhook_url(webhook_url)?;

    // Build the Slack Block Kit message
    let mut blocks = vec![
        // Header with event emoji
        json!({
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": format!("{} {}", get_event_emoji(event_type), title),
                "emoji": true
            }
        }),
        // Body text
        json!({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": body
            }
        }),
    ];

    // Add action button if link is provided
    if let Some(url) = link_url {
        blocks.push(json!({
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "View in TaskFlow",
                        "emoji": true
                    },
                    "url": url,
                    "style": "primary"
                }
            ]
        }));
    }

    // Add divider at the end
    blocks.push(json!({
        "type": "divider"
    }));

    let message = SlackMessage { blocks };

    // Send the message
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(SlackError::Request)?;

    let response = client
        .post(webhook_url)
        .header("Content-Type", "application/json")
        .json(&message)
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(SlackError::WebhookError(format!(
            "Status {}: {}",
            status, body
        )));
    }

    tracing::debug!(
        event_type = event_type,
        "Slack notification sent successfully"
    );

    Ok(())
}

/// Get an emoji for the event type
fn get_event_emoji(event_type: &str) -> &'static str {
    match event_type {
        "task-assigned" => ":inbox_tray:",
        "task-due-soon" => ":alarm_clock:",
        "task-overdue" => ":warning:",
        "task-commented" => ":speech_balloon:",
        "task-completed" => ":white_check_mark:",
        "mention-in-comment" => ":point_right:",
        _ => ":bell:",
    }
}

/// Send a simple text message to Slack (for testing or simple notifications)
pub async fn send_slack_text(webhook_url: &str, text: &str) -> Result<(), SlackError> {
    if !is_slack_enabled() {
        return Err(SlackError::Disabled);
    }

    validate_webhook_url(webhook_url)?;

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(SlackError::Request)?;

    let response = client
        .post(webhook_url)
        .header("Content-Type", "application/json")
        .json(&json!({ "text": text }))
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(SlackError::WebhookError(format!(
            "Status {}: {}",
            status, body
        )));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_webhook_url_valid() {
        let result =
            validate_webhook_url("https://hooks.slack.com/services/T00000000/B00000000/XXXX");
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_webhook_url_invalid() {
        let result = validate_webhook_url("https://example.com/webhook");
        assert!(result.is_err());
    }

    #[test]
    fn test_get_event_emoji() {
        assert_eq!(get_event_emoji("task-assigned"), ":inbox_tray:");
        assert_eq!(get_event_emoji("task-overdue"), ":warning:");
        assert_eq!(get_event_emoji("unknown"), ":bell:");
    }
}
