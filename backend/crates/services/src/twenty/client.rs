//! Twenty CRM HTTP client.
//!
//! Mirrors `services::novu`: a small `reqwest` wrapper that takes the API
//! base URL + API key and exposes typed methods.
//!
//! W4 owns `health()` + `provision_user()`; W6 adds the outbound sync surface
//! (`upsert_object`, `delete_object`) used by the queue worker.
//!
//! REST shape (Twenty 0.x): `<base>/rest/<objectName>` for collections,
//! `<base>/rest/<objectName>/<id>` for single records. Auth via
//! `Authorization: Bearer <api_key>`.

use reqwest::{Client, Method, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum TwentyError {
    #[error("HTTP request failed: {0}")]
    Request(#[from] reqwest::Error),
    #[error("API error: status={status} body={body}")]
    Api { status: u16, body: String },
}

impl TwentyError {
    /// Whether this error class warrants a retry (5xx / network) vs being
    /// permanently rejected (4xx other than 409). 409 is upgrade-to-success
    /// at the worker layer, not surfaced here.
    pub fn is_retryable(&self) -> bool {
        match self {
            TwentyError::Request(e) => {
                // Network errors (connect, timeout) are retryable; payload
                // serialization errors are not.
                e.is_timeout() || e.is_connect() || e.is_request()
            }
            TwentyError::Api { status, .. } => {
                let s = *status;
                s >= 500 || s == 408 || s == 429
            }
        }
    }
}

/// Outcome of a `provision_user` call. `AlreadyExists` is treated as success
/// (Twenty returns 409 when the workspace already has a user with that email).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProvisionUserOutcome {
    Created { user_id: String },
    AlreadyExists,
}

/// Outcome of a generic `upsert_object` call. `AlreadyExists` is success
/// (idempotent retry) and carries no body.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum UpsertOutcome {
    Created { id: String, body: serde_json::Value },
    Updated { id: String, body: serde_json::Value },
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

    /// Provision a user inside a Twenty workspace. 409 → `AlreadyExists`.
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

    // ── outbound sync surface (Phase 6b) ─────────────────────────────────────

    /// Upsert an object via Twenty's REST API.
    ///
    /// - If `twenty_id` is `Some`: PATCH `/rest/<object>/<id>` (update path).
    /// - If `twenty_id` is `None`: POST `/rest/<object>` (create path).
    /// - 409 from POST → `AlreadyExists` (Twenty rejected as duplicate; we treat as success).
    /// - 404 from PATCH → `Api{status:404}` (caller decides to log + drop or retry).
    pub async fn upsert_object(
        &self,
        object: &str,
        twenty_id: Option<&str>,
        body: &serde_json::Value,
    ) -> Result<UpsertOutcome, TwentyError> {
        let (method, url, is_patch) = match twenty_id {
            Some(id) => (
                Method::PATCH,
                format!("{}/rest/{}/{}", self.api_url, object, id),
                true,
            ),
            None => (
                Method::POST,
                format!("{}/rest/{}", self.api_url, object),
                false,
            ),
        };

        let response = self
            .client
            .request(method, &url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(body)
            .send()
            .await?;

        let status = response.status();
        if status == StatusCode::CONFLICT {
            return Ok(UpsertOutcome::AlreadyExists);
        }
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(TwentyError::Api {
                status: status.as_u16(),
                body,
            });
        }

        let json: serde_json::Value = response.json().await.unwrap_or(serde_json::Value::Null);
        let id = json
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        Ok(if is_patch {
            UpsertOutcome::Updated { id, body: json }
        } else {
            UpsertOutcome::Created { id, body: json }
        })
    }

    /// Delete an object. 404 is treated as success (already gone).
    pub async fn delete_object(&self, object: &str, twenty_id: &str) -> Result<(), TwentyError> {
        let url = format!("{}/rest/{}/{}", self.api_url, object, twenty_id);
        let response = self
            .client
            .delete(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .send()
            .await?;

        let status = response.status();
        if status.is_success() || status == StatusCode::NOT_FOUND {
            return Ok(());
        }
        let body = response.text().await.unwrap_or_default();
        Err(TwentyError::Api {
            status: status.as_u16(),
            body,
        })
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

    #[test]
    fn retryable_classifies_5xx_and_429() {
        let e500 = TwentyError::Api {
            status: 500,
            body: "boom".into(),
        };
        let e503 = TwentyError::Api {
            status: 503,
            body: "boom".into(),
        };
        let e429 = TwentyError::Api {
            status: 429,
            body: "rate".into(),
        };
        let e400 = TwentyError::Api {
            status: 400,
            body: "bad".into(),
        };
        let e404 = TwentyError::Api {
            status: 404,
            body: "miss".into(),
        };
        assert!(e500.is_retryable());
        assert!(e503.is_retryable());
        assert!(e429.is_retryable());
        assert!(!e400.is_retryable());
        assert!(!e404.is_retryable());
    }
}
