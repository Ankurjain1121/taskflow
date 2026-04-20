//! WhatsApp notification provider via WAHA (WhatsApp HTTP API)
//!
//! Sends notifications to WhatsApp using the WAHA self-hosted API.
//! Feature-gated via WAHA_ENABLED environment variable.

use chrono::{DateTime, Utc};
use reqwest::Client;
use serde::Serialize;
use std::env;
use std::fmt::Write as _;
use uuid::Uuid;

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
pub fn validate_e164_phone_number(phone: &str) -> Result<(), WhatsAppError> {
    // Must start with +
    if !phone.starts_with('+') {
        return Err(WhatsAppError::InvalidPhoneNumber(
            "Phone number must start with + (E.164 format)".to_string(),
        ));
    }

    // Must be between 8 and 15 digits (plus the +)
    let digits: String = phone.chars().skip(1).filter(char::is_ascii_digit).collect();

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
    let digits: String = phone.chars().filter(char::is_ascii_digit).collect();
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

/// Payload for sending a text message via WAHA.
/// Includes link preview flags so URLs in the text auto-scrape OG tags.
#[derive(Serialize)]
struct SendMessagePayload<'a> {
    #[serde(rename = "chatId")]
    chat_id: String,
    text: &'a str,
    session: &'a str,
    #[serde(rename = "linkPreview", skip_serializing_if = "Option::is_none")]
    link_preview: Option<bool>,
    #[serde(
        rename = "linkPreviewHighQuality",
        skip_serializing_if = "Option::is_none"
    )]
    link_preview_high_quality: Option<bool>,
}

/// Payload for `/api/send/link-custom-preview` (WAHA Plus only).
/// Lets us override the scraped OG preview with branded title/description/image.
#[derive(Serialize)]
struct LinkCustomPreviewPayload<'a> {
    #[serde(rename = "chatId")]
    chat_id: String,
    text: &'a str,
    session: &'a str,
    #[serde(
        rename = "linkPreviewHighQuality",
        skip_serializing_if = "Option::is_none"
    )]
    link_preview_high_quality: Option<bool>,
    preview: LinkCustomPreview<'a>,
}

#[derive(Serialize)]
struct LinkCustomPreview<'a> {
    url: &'a str,
    title: &'a str,
    description: &'a str,
    image: LinkCustomPreviewImage<'a>,
}

#[derive(Serialize)]
struct LinkCustomPreviewImage<'a> {
    mimetype: &'a str,
    url: &'a str,
}

/// Rich metadata for notification messages.
/// Passed by route handlers to the dispatcher so WhatsApp messages include full context.
#[derive(Debug, Clone, Default)]
pub struct NotificationMetadata {
    pub actor_name: Option<String>,
    pub project_name: Option<String>,
    pub task_id: Option<Uuid>,
    pub task_title: Option<String>,
    pub due_date: Option<DateTime<Utc>>,
    pub priority: Option<String>,
    pub parent_task_title: Option<String>,
    pub subtask_progress: Option<(i64, i64)>, // (completed, total)
}

impl WahaClient {
    /// Create a new WAHA client
    ///
    /// # Arguments
    /// * `api_url` - The WAHA API URL (e.g., "http://localhost:3000")
    /// * `api_key` - The WAHA API key
    /// * `session_name` - The WAHA session name (default: "default")
    pub fn new(
        api_url: String,
        api_key: String,
        session_name: Option<String>,
    ) -> Result<Self, WhatsAppError> {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(WhatsAppError::Request)?;

        Ok(Self {
            client,
            api_url: api_url.trim_end_matches('/').to_string(),
            api_key,
            session_name: session_name.unwrap_or_else(|| "default".to_string()),
        })
    }

    /// Send a WhatsApp text message
    ///
    /// # Arguments
    /// * `phone_number` - Recipient phone in E.164 format (e.g., +14155552671)
    /// * `message` - Plain text message to send
    pub async fn send_message(
        &self,
        phone_number: &str,
        message: &str,
    ) -> Result<(), WhatsAppError> {
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
            link_preview: Some(true),
            link_preview_high_quality: Some(true),
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

        tracing::debug!(phone = phone_number, "WhatsApp message sent successfully");

        Ok(())
    }

    /// Send a WhatsApp message with a link.
    ///
    /// Appends the URL to the body and relies on `linkPreview: true` in the
    /// `/api/sendText` payload to auto-scrape OG tags from the link target.
    /// Works on all WAHA engines/tiers (no interactive buttons — Meta
    /// deprecated those on unofficial APIs in 2023–2024).
    pub async fn send_link_message(
        &self,
        phone_number: &str,
        body: &str,
        link_url: &str,
    ) -> Result<(), WhatsAppError> {
        let message = if body.is_empty() {
            link_url.to_string()
        } else {
            format!("{}\n\n{}", body, link_url)
        };
        self.send_message(phone_number, &message).await
    }

    /// Send a link with a custom preview card (title, description, image)
    /// via WAHA's `/api/send/link-custom-preview` endpoint.
    ///
    /// Requires WAHA Plus tier. Falls back to `send_link_message` (plain
    /// text with URL + auto-scraped preview) on any failure.
    #[allow(clippy::too_many_arguments)]
    pub async fn send_link_custom_preview(
        &self,
        phone_number: &str,
        body: &str,
        link_url: &str,
        preview_title: &str,
        preview_description: &str,
        image_url: &str,
        image_mimetype: &str,
    ) -> Result<(), WhatsAppError> {
        if !is_whatsapp_enabled() {
            return Err(WhatsAppError::Disabled);
        }
        validate_e164_phone_number(phone_number)?;

        let chat_id = phone_to_chat_id(phone_number);
        let url = format!("{}/api/send/link-custom-preview", self.api_url);

        let text = if body.is_empty() {
            link_url.to_string()
        } else {
            format!("{}\n\n{}", body, link_url)
        };

        let payload = LinkCustomPreviewPayload {
            chat_id,
            text: &text,
            session: &self.session_name,
            link_preview_high_quality: Some(true),
            preview: LinkCustomPreview {
                url: link_url,
                title: preview_title,
                description: preview_description,
                image: LinkCustomPreviewImage {
                    mimetype: image_mimetype,
                    url: image_url,
                },
            },
        };

        let response = self
            .client
            .post(&url)
            .header("X-Api-Key", &self.api_key)
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await;

        let should_fallback = match &response {
            Err(_) => true,
            Ok(resp) => !resp.status().is_success(),
        };

        if should_fallback {
            tracing::warn!(
                phone = phone_number,
                "link-custom-preview failed (not Plus tier?), falling back to sendText"
            );
            return self.send_link_message(phone_number, body, link_url).await;
        }

        tracing::debug!(
            phone = phone_number,
            "WhatsApp custom-preview link message sent successfully"
        );
        Ok(())
    }

    /// Send a file (PDF, image, etc.) via WhatsApp using WAHA's /api/sendFile
    pub async fn send_file(
        &self,
        phone_number: &str,
        base64_data: &str,
        filename: &str,
        mimetype: &str,
        caption: Option<&str>,
    ) -> Result<(), WhatsAppError> {
        if !is_whatsapp_enabled() {
            return Err(WhatsAppError::Disabled);
        }
        validate_e164_phone_number(phone_number)?;

        let chat_id = phone_to_chat_id(phone_number);
        let url = format!("{}/api/sendFile", self.api_url);

        let mut payload = serde_json::json!({
            "chatId": chat_id,
            "session": self.session_name,
            "file": {
                "mimetype": mimetype,
                "filename": filename,
                "data": format!("data:{};base64,{}", mimetype, base64_data)
            }
        });

        if let Some(cap) = caption {
            payload["caption"] = serde_json::Value::String(cap.to_string());
        }

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
            let msg = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(WhatsAppError::ApiError {
                status,
                message: msg,
            });
        }

        tracing::debug!(
            phone = phone_number,
            filename = filename,
            "WhatsApp file sent successfully"
        );
        Ok(())
    }

    /// Send a file via URL reference (WAHA downloads from the URL)
    pub async fn send_file_url(
        &self,
        phone_number: &str,
        file_url: &str,
        filename: &str,
        mimetype: &str,
        caption: Option<&str>,
    ) -> Result<(), WhatsAppError> {
        if !is_whatsapp_enabled() {
            return Err(WhatsAppError::Disabled);
        }
        validate_e164_phone_number(phone_number)?;

        let chat_id = phone_to_chat_id(phone_number);
        let url = format!("{}/api/sendFile", self.api_url);

        let mut payload = serde_json::json!({
            "chatId": chat_id,
            "session": self.session_name,
            "file": {
                "mimetype": mimetype,
                "filename": filename,
                "url": file_url
            }
        });

        if let Some(cap) = caption {
            payload["caption"] = serde_json::Value::String(cap.to_string());
        }

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
            let msg = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(WhatsAppError::ApiError {
                status,
                message: msg,
            });
        }

        tracing::debug!(
            phone = phone_number,
            filename = filename,
            "WhatsApp file (URL) sent successfully"
        );
        Ok(())
    }
}

/// Format a rich WhatsApp notification message with full context
pub fn format_rich_notification(
    event_type: &str,
    title: &str,
    body: &str,
    metadata: Option<&NotificationMetadata>,
) -> String {
    let emoji = get_event_emoji(event_type);
    let mut msg = format!("{} *{}*\n", emoji, title);

    if let Some(meta) = metadata {
        // Project context
        if let Some(ref project) = meta.project_name {
            let _ = write!(msg, "\n\u{1F4C1} *Project:* {}", project);
        }

        // Task title (if not already in body)
        if let Some(ref task_title) = meta.task_title {
            if !body.contains(task_title) {
                let _ = write!(msg, "\n\u{1F4CC} *Task:* {}", task_title);
            }
        }

        // Actor
        if let Some(ref actor) = meta.actor_name {
            let action_label = match event_type {
                "task-assigned" => "Assigned by",
                "task-completed" => "Completed by",
                "task-commented" => "Comment by",
                "mention-in-comment" => "Mentioned by",
                _ => "By",
            };
            let _ = write!(msg, "\n\u{1F464} *{}:* {}", action_label, actor);
        }

        // Priority
        if let Some(ref priority) = meta.priority {
            let priority_emoji = match priority.as_str() {
                "urgent" => "\u{1F534}",
                "high" => "\u{1F7E0}",
                "medium" => "\u{1F7E1}",
                "low" => "\u{1F7E2}",
                _ => "\u{26AA}",
            };
            let _ = write!(
                msg,
                "\n{} *Priority:* {}",
                priority_emoji,
                capitalize(priority)
            );
        }

        // Due date + time with remaining time
        if let Some(due) = meta.due_date {
            let now = Utc::now();
            let ist = chrono::FixedOffset::east_opt(5 * 3600 + 30 * 60).expect("valid IST offset");
            let due_ist = due.with_timezone(&ist);
            let due_str = due_ist.format("%b %d, %I:%M %p IST").to_string();

            let remaining = due.signed_duration_since(now);
            let remaining_str = if remaining.num_seconds() < 0 {
                let overdue = -remaining;
                if overdue.num_days() > 0 {
                    format!(
                        "\u{26A0}\u{FE0F} *OVERDUE by {} day(s)*",
                        overdue.num_days()
                    )
                } else if overdue.num_hours() > 0 {
                    format!("\u{26A0}\u{FE0F} *OVERDUE by {}h*", overdue.num_hours())
                } else {
                    format!("\u{26A0}\u{FE0F} *OVERDUE by {}m*", overdue.num_minutes())
                }
            } else if remaining.num_days() > 1 {
                format!("{} days left", remaining.num_days())
            } else if remaining.num_hours() > 0 {
                format!(
                    "{}h {}m left",
                    remaining.num_hours(),
                    remaining.num_minutes() % 60
                )
            } else {
                format!("\u{23F3} *{}m left*", remaining.num_minutes())
            };

            let _ = write!(msg, "\n\u{1F4C5} *Due:* {} ({})", due_str, remaining_str);
        }

        // Subtask progress (for watcher notifications)
        if let Some((completed, total)) = meta.subtask_progress {
            let bar = progress_bar(completed, total);
            let _ = write!(
                msg,
                "\n\u{1F4CA} *Subtasks:* {}/{} {}\n",
                completed, total, bar
            );
        }

        // Parent task context (for subtask notifications)
        if let Some(ref parent) = meta.parent_task_title {
            let _ = write!(msg, "\n\u{1F517} *Parent task:* {}", parent);
        }
    }

    // Body text (the description/detail)
    if !body.is_empty() {
        let _ = write!(msg, "\n\n{}", body);
    }

    msg
}

fn capitalize(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(c) => c.to_uppercase().to_string() + chars.as_str(),
    }
}

fn progress_bar(completed: i64, total: i64) -> String {
    if total == 0 {
        return String::new();
    }
    let filled = ((completed as f64 / total as f64) * 10.0).round() as usize;
    let empty = 10 - filled.min(10);
    format!("{}{}", "\u{2588}".repeat(filled), "\u{2591}".repeat(empty))
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
        use std::fmt::Write as _;
        let _ = write!(message, "\n\nView details: {}", url);
    }

    let client = WahaClient::new(waha_api_url.to_string(), waha_api_key.to_string(), None)?;

    client.send_message(phone_number, &message).await
}

/// Get an emoji for the event type
pub fn get_event_emoji(event_type: &str) -> &'static str {
    match event_type {
        "task-assigned" => "\u{1F4E5}",      // inbox_tray
        "task-due-soon" => "\u{23F0}",       // alarm_clock
        "task-overdue" => "\u{26A0}",        // warning
        "task-commented" => "\u{1F4AC}",     // speech_balloon
        "task-completed" => "\u{2705}",      // white_check_mark
        "mention-in-comment" => "\u{1F449}", // point_right
        _ => "\u{1F514}",                    // bell
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

    #[test]
    fn test_validate_e164_too_long() {
        // 16 digits after the + exceeds the 15-digit max
        let result = validate_e164_phone_number("+1234567890123456");
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_e164_minimum_length() {
        // 7 digits after the + is the minimum
        let result = validate_e164_phone_number("+1234567");
        assert!(result.is_ok());
    }

    #[test]
    fn test_phone_to_chat_id_strips_plus() {
        let chat_id = phone_to_chat_id("+14155552671");
        assert!(!chat_id.contains('+'), "chat_id should not contain +");
        assert_eq!(chat_id, "14155552671@c.us");
    }

    #[test]
    fn test_get_event_emoji_all_events() {
        assert_eq!(get_event_emoji("task-assigned"), "\u{1F4E5}");
        assert_eq!(get_event_emoji("task-due-soon"), "\u{23F0}");
        assert_eq!(get_event_emoji("task-overdue"), "\u{26A0}");
        assert_eq!(get_event_emoji("task-commented"), "\u{1F4AC}");
        assert_eq!(get_event_emoji("task-completed"), "\u{2705}");
        assert_eq!(get_event_emoji("mention-in-comment"), "\u{1F449}");
        // Unknown fallback
        assert_eq!(get_event_emoji("some-random-event"), "\u{1F514}");
    }

    #[test]
    fn test_waha_client_creation() {
        let client = WahaClient::new(
            "http://localhost:3000/".to_string(),
            "test-api-key".to_string(),
            None,
        )
        .expect("Failed to create WahaClient");
        // api_url should be trimmed of trailing slash
        assert_eq!(client.api_url, "http://localhost:3000");
        assert_eq!(client.session_name, "default");
    }

    #[test]
    fn test_send_message_payload_serializes_link_preview_flags() {
        let payload = SendMessagePayload {
            chat_id: "12345@c.us".to_string(),
            text: "hi",
            session: "default",
            link_preview: Some(true),
            link_preview_high_quality: Some(true),
        };
        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains("\"linkPreview\":true"));
        assert!(json.contains("\"linkPreviewHighQuality\":true"));
        assert!(json.contains("\"chatId\":\"12345@c.us\""));
    }

    #[test]
    fn test_send_message_payload_omits_link_preview_when_none() {
        let payload = SendMessagePayload {
            chat_id: "12345@c.us".to_string(),
            text: "hi",
            session: "default",
            link_preview: None,
            link_preview_high_quality: None,
        };
        let json = serde_json::to_string(&payload).unwrap();
        assert!(!json.contains("linkPreview"));
    }

    #[test]
    fn test_link_custom_preview_payload_structure() {
        let payload = LinkCustomPreviewPayload {
            chat_id: "12345@c.us".to_string(),
            text: "body\n\nhttps://x.io",
            session: "default",
            link_preview_high_quality: Some(true),
            preview: LinkCustomPreview {
                url: "https://x.io",
                title: "TaskBolt",
                description: "A task",
                image: LinkCustomPreviewImage {
                    mimetype: "image/png",
                    url: "https://x.io/img.png",
                },
            },
        };
        let json = serde_json::to_value(&payload).unwrap();
        assert_eq!(json["preview"]["title"], "TaskBolt");
        assert_eq!(json["preview"]["url"], "https://x.io");
        assert_eq!(json["preview"]["image"]["mimetype"], "image/png");
        assert_eq!(json["preview"]["image"]["url"], "https://x.io/img.png");
    }

    #[test]
    fn test_waha_client_custom_session() {
        let client = WahaClient::new(
            "http://localhost:3000".to_string(),
            "test-key".to_string(),
            Some("custom".to_string()),
        )
        .expect("Failed to create WahaClient");
        assert_eq!(client.session_name, "custom");
    }
}
