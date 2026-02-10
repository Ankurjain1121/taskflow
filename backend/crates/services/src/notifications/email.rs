//! Email notification provider using Postal
//!
//! Provides email sending capabilities via self-hosted Postal SMTP relay.

use reqwest::Client;
use serde::Serialize;

/// Error type for email operations
#[derive(Debug, thiserror::Error)]
pub enum EmailError {
    #[error("HTTP request failed: {0}")]
    Request(#[from] reqwest::Error),
    #[error("SMTP configuration error: {0}")]
    Config(String),
    #[error("API error: {status} - {message}")]
    Api { status: u16, message: String },
}

/// Postal email client for sending notifications
#[derive(Clone)]
pub struct PostalClient {
    client: Client,
    api_url: String,
    api_key: String,
    from_address: String,
    from_name: String,
}

/// Payload for sending an email via Postal API
#[derive(Serialize)]
struct SendEmailPayload<'a> {
    to: &'a [&'a str],
    from: &'a str,
    subject: &'a str,
    html_body: &'a str,
}

impl PostalClient {
    /// Create a new Postal client
    ///
    /// # Arguments
    /// * `api_url` - The Postal API URL (e.g., "https://postal.example.com")
    /// * `api_key` - The Postal API key
    /// * `from_address` - The sender email address
    /// * `from_name` - The sender display name
    pub fn new(api_url: String, api_key: String, from_address: String, from_name: String) -> Self {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            api_url: api_url.trim_end_matches('/').to_string(),
            api_key,
            from_address,
            from_name,
        }
    }

    /// Send an email via Postal
    ///
    /// # Arguments
    /// * `to` - Recipient email address
    /// * `subject` - Email subject line
    /// * `html_body` - Email body in HTML format
    pub async fn send_email(
        &self,
        to: &str,
        subject: &str,
        html_body: &str,
    ) -> Result<(), EmailError> {
        let url = format!("{}/api/v1/send/message", self.api_url);
        let from = format!("{} <{}>", self.from_name, self.from_address);
        let recipients = [to];

        let payload = SendEmailPayload {
            to: &recipients,
            from: &from,
            subject,
            html_body,
        };

        let response = self
            .client
            .post(&url)
            .header("X-Server-API-Key", &self.api_key)
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
            return Err(EmailError::Api { status, message });
        }

        tracing::debug!(
            to = to,
            subject = subject,
            "Email sent successfully via Postal"
        );

        Ok(())
    }

    /// Send a notification email based on event type
    ///
    /// Generates appropriate subject and body based on event type.
    pub async fn send_notification_email(
        &self,
        to: &str,
        _event_type: &str,
        title: &str,
        body: &str,
        link_url: Option<&str>,
        app_url: &str,
    ) -> Result<(), EmailError> {
        let subject = format!("[TaskFlow] {}", title);

        let link_html = if let Some(url) = link_url {
            let full_url = if url.starts_with("http") {
                url.to_string()
            } else {
                format!("{}{}", app_url, url)
            };
            format!(
                r#"<p><a href="{}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Details</a></p>"#,
                full_url
            )
        } else {
            String::new()
        };

        let html_body = format!(
            r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
        <h1 style="color: #111827; font-size: 24px; margin: 0 0 16px 0;">{}</h1>
        <p style="color: #4b5563; font-size: 16px; margin: 0 0 20px 0;">{}</p>
        {}
    </div>
    <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        This notification was sent from TaskFlow.
        <a href="{}/settings/notifications" style="color: #6366f1;">Manage your notification preferences</a>
    </p>
</body>
</html>"#,
            title, body, link_html, app_url
        );

        self.send_email(to, &subject, &html_body).await
    }
}

/// Generate HTML email for weekly digest
pub fn generate_weekly_digest_html(
    user_name: &str,
    tasks_completed: i64,
    tasks_created: i64,
    tasks_overdue: i64,
    tasks_due_this_week: i64,
    app_url: &str,
) -> String {
    format!(
        r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
        <h1 style="color: #111827; font-size: 24px; margin: 0 0 8px 0;">Weekly Summary</h1>
        <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px 0;">Hi {}, here's your task activity for the past week</p>

        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px;">
            <div style="background: white; border-radius: 8px; padding: 16px; text-align: center;">
                <div style="font-size: 32px; font-weight: bold; color: #10b981;">{}</div>
                <div style="font-size: 14px; color: #6b7280;">Completed</div>
            </div>
            <div style="background: white; border-radius: 8px; padding: 16px; text-align: center;">
                <div style="font-size: 32px; font-weight: bold; color: #3b82f6;">{}</div>
                <div style="font-size: 14px; color: #6b7280;">Created</div>
            </div>
            <div style="background: white; border-radius: 8px; padding: 16px; text-align: center;">
                <div style="font-size: 32px; font-weight: bold; color: #ef4444;">{}</div>
                <div style="font-size: 14px; color: #6b7280;">Overdue</div>
            </div>
            <div style="background: white; border-radius: 8px; padding: 16px; text-align: center;">
                <div style="font-size: 32px; font-weight: bold; color: #f59e0b;">{}</div>
                <div style="font-size: 14px; color: #6b7280;">Due This Week</div>
            </div>
        </div>

        <p style="text-align: center;">
            <a href="{}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Open TaskFlow</a>
        </p>
    </div>
    <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        <a href="{}/settings/notifications" style="color: #6366f1;">Manage your notification preferences</a>
    </p>
</body>
</html>"#,
        user_name,
        tasks_completed,
        tasks_created,
        tasks_overdue,
        tasks_due_this_week,
        app_url,
        app_url
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_postal_client_creation() {
        let client = PostalClient::new(
            "https://postal.example.com".to_string(),
            "test-api-key".to_string(),
            "noreply@example.com".to_string(),
            "TaskFlow".to_string(),
        );
        assert_eq!(client.api_url, "https://postal.example.com");
    }

    #[test]
    fn test_weekly_digest_html() {
        let html = generate_weekly_digest_html("John", 5, 10, 2, 3, "https://app.example.com");
        assert!(html.contains("John"));
        assert!(html.contains("Weekly Summary"));
    }
}
