//! Twenty CRM HTTP client.
//!
//! Mirrors the shape of `services::novu`: a small `reqwest` wrapper that
//! takes the API base URL + API key and exposes typed methods. W4 only needs
//! `health()` (used by the integration setup wizard) and `provision_user()`
//! (idempotent on 409). W5/W6 will extend it.

use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum TwentyError {
    #[error("HTTP request failed: {0}")]
    Request(#[from] reqwest::Error),
    #[error("API error: status={status} body={body}")]
    Api { status: u16, body: String },
}

/// Outcome of a `provision_user` call. `AlreadyExists` is treated as success
/// (Twenty returns 409 when the workspace already has a user with that email).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProvisionUserOutcome {
    Created { user_id: String },
    AlreadyExists,
}

#[derive(Debug, Deserialize)]
struct ProvisionedUser {
    id: String,
}

#[derive(Debug, Serialize)]
struct ProvisionUserBody<'a> {
    workspace_id: &'a str,
    email: &'a str,
    name: &'a str,
}

#[derive(Clone)]
pub struct TwentyClient {
    client: Client,
    api_url: String,
    api_key: String,
}

impl TwentyClient {
    /// Construct a client. `api_url` is Twenty's REST base
    /// (e.g. `http://127.0.0.1:3000`). `api_key` is the workspace API key.
    pub fn new(api_url: String, api_key: String) -> Self {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .expect("build reqwest client");
        Self {
            client,
            api_url: api_url.trim_end_matches('/').to_string(),
            api_key,
        }
    }

    /// Hit Twenty's `/healthz` endpoint. Returns Ok if the response is 2xx.
    /// Used by the tenant admin's "Connect Twenty" wizard to validate creds.
    pub async fn health(&self) -> Result<(), TwentyError> {
        let url = format!("{}/healthz", self.api_url);
        let response = self
            .client
            .get(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .send()
            .await?;
        let status = response.status();
        if status.is_success() {
            return Ok(());
        }
        let body = response.text().await.unwrap_or_default();
        Err(TwentyError::Api {
            status: status.as_u16(),
            body,
        })
    }

    /// Provision a user inside a Twenty workspace.
    ///
    /// Idempotency: if Twenty returns 409 (user already exists for that
    /// workspace/email pair) the call is treated as success. Twenty's table
    /// has a unique constraint on `(workspaceId, email)`.
    pub async fn provision_user(
        &self,
        workspace_id: &str,
        email: &str,
        name: &str,
    ) -> Result<ProvisionUserOutcome, TwentyError> {
        let url = format!("{}/rest/users", self.api_url);
        let body = ProvisionUserBody {
            workspace_id,
            email,
            name,
        };

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&json!(body))
            .send()
            .await?;

        let status = response.status();
        if status == StatusCode::CONFLICT {
            tracing::debug!(
                workspace_id,
                email,
                "Twenty user already exists; treating as success"
            );
            return Ok(ProvisionUserOutcome::AlreadyExists);
        }
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(TwentyError::Api {
                status: status.as_u16(),
                body,
            });
        }
        let parsed: ProvisionedUser = response.json().await?;
        Ok(ProvisionUserOutcome::Created { user_id: parsed.id })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_strips_trailing_slash() {
        let c = TwentyClient::new("http://localhost:3000/".to_string(), "k".to_string());
        assert_eq!(c.api_url, "http://localhost:3000");
    }

    #[test]
    fn provision_outcome_eq() {
        let a = ProvisionUserOutcome::Created {
            user_id: "u1".to_string(),
        };
        let b = ProvisionUserOutcome::Created {
            user_id: "u1".to_string(),
        };
        assert_eq!(a, b);
        assert_ne!(a, ProvisionUserOutcome::AlreadyExists);
    }
}
