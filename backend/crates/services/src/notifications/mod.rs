//! Notification system module
//!
//! Provides multi-channel notification capabilities including:
//! - In-app notifications with WebSocket broadcast
//! - Email via Postal
//! - Slack via webhooks
//! - WhatsApp via WAHA

pub mod email;
pub mod events;
pub mod service;
pub mod slack;
pub mod whatsapp;

pub use email::{generate_weekly_digest_html, EmailError, PostalClient};
pub use events::NotificationEvent;
pub use service::{NotificationService, NotificationServiceError};
pub use slack::{is_slack_enabled, send_slack_notification, SlackError};
pub use whatsapp::{is_whatsapp_enabled, send_whatsapp_notification, WhatsAppError};
