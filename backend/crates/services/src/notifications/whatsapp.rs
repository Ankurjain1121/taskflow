//! WhatsApp notification provider via WAHA (WhatsApp HTTP API)
//!
//! Sends notifications to WhatsApp using the WAHA self-hosted API.
//! Feature-gated via WAHA_ENABLED environment variable.

use reqwest::Client;
use serde::Serialize;
use std::env;

/// Error type for WhatsApp operations
#[derive(Debug, thiserror::Error)]
pub enum WhatsAppError {
    #[error("HTTP request failed: {0}")]
    Request(#[from] reqwest::Error),
    #[error("Invalid phone number: {0}")]
    InvalidPhoneNumber(String),
    #[error("WhatsApp is disabled")]
    Disabled,
    #[error("WAHA API error: {status} - {message}")]
    ApiError { status: u16, message: String },
    #[error("Configuration error: {0}")]
    Config(String),
}

/// Check if WhatsApp integration is enabled
pub fn is_whatsapp_enabled() -> bool {
    env::var("WAHA_ENABLED")
        .map(|v| v == "true" || v == "1")
        .unwrap_or(false)
}

/// Validate E.164 phone number format
///
/// E.164 format: +[country code][number]
/// Examples: +14155552671, +447911123456
fn validate_e164_phone_number(phone: &str) -> Result<(), WhatsAppError> {
    // Must start with +
    if !phone.starts_with('+') {
        return Err(WhatsAppError::InvalidPhoneNumber(
            "Phone number must start with + (E.164 format)".to_string(),
        ));
    }

    // Must be between 8 and 15 digits (plus the +)
    let digits: String = phone.chars().skip(1).filter(|c| c.is_ascii_digit()).collect();

    if digits.len() < 7 || digits.len() > 15 {
        return Err(WhatsAppError::InvalidPhoneNumber(format!(
            "Phone number must have 7-15 digits, got {}",
            digits.len()
        )));
    }

    // Must only contain digits after the +
    if phone.len() != digits.len() + 1 {
        return Err(WhatsAppError::InvalidPhoneNumber(
            "Phone number must only contain digits after the +".to_string(),
        ));
    }

    Ok(())
}

/// Convert E.164 phone to WhatsApp chat ID format
///
/// WhatsApp uses the format: [country code][number]@c.us
fn phone_to_chat_id(phone: &str) -> String {
    let digits: String = phone.chars().filter(|c| c.is_ascii_digit()).collect();
    format!("{}@c.us", digits)
}

/// WAHA client for sending WhatsApp messages
#[derive(Clone)]
pub struct WahaClient {
    client: Client,
    api_url: String,
    api_key: String,
    session_name: String,
}

/// Payload for sending a text message via WAHA
#[derive(Serialize)]
struct SendMessagePayload<'a> {
    #[serde(rename = "chatId")]
    chat_id: String,
    text: &'a str,
    session: &'a str,
}

impl WahaClient {
    /// Create a new WAHA client
    ///
    /// # Arguments
    /// * `api_url` - The WAHA API URL (e.g., "http://localhost:3000")
    /// * `api_key` - The WAHA API key
    /// * `session_name` - The WAHA session name (default: "default")
    pub fn new(api_url: String, api_key: String, session_name: Option<String>) -> Self {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            api_url: api_url.trim_end_matches('/').to_string(),
            api_key,
            session_name: session_name.unwrap_or_else(|| "default".to_string()),
        }
    }

    /// Send a WhatsApp text message
    ///
    /// # Arguments
    /// * `phone_number` - Recipient phone in E.164 format (e.g., +14155552671)
    /// * `message` - Plain text message to send
    pub async fn send_message(&self, phone_number: &str, message: &str) -> Result<(), WhatsAppError> {
        // Check if WhatsApp is enabled
        if !is_whatsapp_enabled() {
            return Err(WhatsAppError::Disabled);
        }

        // Validate phone number
        validate_e164_phone_number(phone_number)?;

        let chat_id = phone_to_chat_id(phone_number);
        let url = format!("{}/api/sendText", self.api_url);

        let payload = SendMessagePayload {
            chat_id,
            text: message,
            session: &self.session_name,
        };

        let response = self
            .client
            .post(&url)
            .header("X-Api-Key", &self.api_key)
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status().as_u16();
            let message = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(WhatsAppError::ApiError { status, message });
        }

        tracing::debug!(
            phone = phone_number,
            "WhatsApp message sent successfully"
        );

        Ok(())
    }
}

/// Send a notification message via WhatsApp
///
/// # Arguments
/// * `phone_number` - Recipient phone in E.164 format
/// * `event_type` - The notification event type
/// * `title` - Notification title
/// * `body` - Notification body
/// * `link_url` - Optional link URL
/// * `waha_api_url` - WAHA API URL
/// * `waha_api_key` - WAHA API key
pub async fn send_whatsapp_notification(
    phone_number: &str,
    event_type: &str,
    title: &str,
    body: &str,
    link_url: Option<&str>,
    waha_api_url: &str,
    waha_api_key: &str,
) -> Result<(), WhatsAppError> {
    if !is_whatsapp_enabled() {
        return Err(WhatsAppError::Disabled);
    }

    validate_e164_phone_number(phone_number)?;

    // Format the message
    let emoji = get_event_emoji(event_type);
    let mut message = format!("{} *{}*\n\n{}", emoji, title, body);

    if let Some(url) = link_url {
        message.push_str(&format!("\n\nView details: {}", url));
    }

    let client = WahaClient::new(
        waha_api_url.to_string(),
        waha_api_key.to_string(),
        None,
    );

    client.send_message(phone_number, &message).await
}

/// Get an emoji for the event type
fn get_event_emoji(event_type: &str) -> &'static str {
    match event_type {
        "task-assigned" => "\u{1F4E5}", // inbox_tray
        "task-due-soon" => "\u{23F0}",  // alarm_clock
        "task-overdue" => "\u{26A0}",   // warning
        "task-commented" => "\u{1F4AC}", // speech_balloon
        "task-completed" => "\u{2705}", // white_check_mark
        "mention-in-comment" => "\u{1F449}", // point_right
        _ => "\u{1F514}",               // bell
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_e164_valid() {
        assert!(validate_e164_phone_number("+14155552671").is_ok());
        assert!(validate_e164_phone_number("+447911123456").is_ok());
        assert!(validate_e164_phone_number("+919876543210").is_ok());
    }

    #[test]
    fn test_validate_e164_invalid() {
        // Missing +
        assert!(validate_e164_phone_number("14155552671").is_err());
        // Too short
        assert!(validate_e164_phone_number("+12345").is_err());
        // Contains non-digits
        assert!(validate_e164_phone_number("+1415-555-2671").is_err());
    }

    #[test]
    fn test_phone_to_chat_id() {
        assert_eq!(phone_to_chat_id("+14155552671"), "14155552671@c.us");
        assert_eq!(phone_to_chat_id("+447911123456"), "447911123456@c.us");
    }

    #[test]
    fn test_get_event_emoji() {
        assert_eq!(get_event_emoji("task-assigned"), "\u{1F4E5}");
        assert_eq!(get_event_emoji("task-overdue"), "\u{26A0}");
    }
}
