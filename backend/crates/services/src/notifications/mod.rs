//! Notification system module
//!
//! Provides multi-channel notification capabilities including:
//! - In-app notifications with WebSocket broadcast
//! - Email via Resend or Postal (pluggable via `EmailProvider` trait)
//! - Slack via webhooks
//! - WhatsApp via WAHA

pub mod dispatcher;
pub mod email;
pub mod events;
pub mod service;
pub mod slack;
pub mod whatsapp;

pub use email::{
    build_email_provider, generate_weekly_digest_html, AnyEmailProvider, EmailError, PostalClient,
    ResendClient,
};
pub use events::NotificationEvent;
pub use service::{NotificationService, NotificationServiceError};
pub use slack::{is_slack_enabled, send_slack_notification, SlackError};
pub use whatsapp::{is_whatsapp_enabled, send_whatsapp_notification, WhatsAppError};
