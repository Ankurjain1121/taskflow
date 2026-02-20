//! Novu HTTP client for notification orchestration
//!
//! Provides a fire-and-forget interface for triggering notifications
//! via self-hosted Novu instance.

use reqwest::Client;
use serde::Serialize;
use serde_json::Value;

/// Error type for Novu operations
#[derive(Debug, thiserror::Error)]
pub enum NovuError {
    #[error("HTTP request failed: {0}")]
    Request(#[from] reqwest::Error),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    #[error("API error: {status} - {message}")]
    Api { status: u16, message: String },
}

/// Novu HTTP client for triggering notifications
#[derive(Clone)]
pub struct NovuClient {
    client: Client,
    api_url: String,
    api_key: String,
}

/// Payload for triggering a Novu event
#[derive(Serialize)]
struct TriggerEventPayload<'a> {
    name: &'a str,
    to: TriggerRecipient<'a>,
    payload: &'a Value,
}

#[derive(Serialize)]
struct TriggerRecipient<'a> {
    subscriber_id: &'a str,
}

impl NovuClient {
    /// Create a new Novu client
    ///
    /// # Arguments
    /// * `api_url` - The Novu API base URL (e.g., "http://localhost:3000")
    /// * `api_key` - The Novu API key
    pub fn new(api_url: String, api_key: String) -> Self {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            api_url: api_url.trim_end_matches('/').to_string(),
            api_key,
        }
    }

    /// Trigger a notification event (fire-and-forget)
    ///
    /// This method logs errors but does not propagate them,
    /// ensuring notification failures don't affect the main application flow.
    ///
    /// # Arguments
    /// * `event_name` - The event name (e.g., "task-assigned")
    /// * `subscriber_id` - The subscriber ID (usually user UUID)
    /// * `payload` - Event-specific payload data
    pub async fn trigger_event(&self, event_name: &str, subscriber_id: &str, payload: Value) {
        let url = format!("{}/v1/events/trigger", self.api_url);

        let request_payload = TriggerEventPayload {
            name: event_name,
            to: TriggerRecipient { subscriber_id },
            payload: &payload,
        };

        match self
            .client
            .post(&url)
            .header("Authorization", format!("ApiKey {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request_payload)
            .send()
            .await
        {
            Ok(response) => {
                if !response.status().is_success() {
                    let status = response.status().as_u16();
                    let message = response
                        .text()
                        .await
                        .unwrap_or_else(|_| "Unknown error".to_string());
                    tracing::error!(
                        event = event_name,
                        subscriber = subscriber_id,
                        status = status,
                        message = %message,
                        "Novu trigger_event failed"
                    );
                } else {
                    tracing::debug!(
                        event = event_name,
                        subscriber = subscriber_id,
                        "Novu event triggered successfully"
                    );
                }
            }
            Err(e) => {
                tracing::error!(
                    event = event_name,
                    subscriber = subscriber_id,
                    error = %e,
                    "Novu trigger_event request failed"
                );
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_novu_client_creation() {
        let client = NovuClient::new(
            "http://localhost:3000".to_string(),
            "test-api-key".to_string(),
        );
        assert_eq!(client.api_url, "http://localhost:3000");
    }

    #[test]
    fn test_novu_client_strips_trailing_slash() {
        let client = NovuClient::new(
            "http://localhost:3000/".to_string(),
            "test-api-key".to_string(),
        );
        assert_eq!(client.api_url, "http://localhost:3000");
    }
}
