//! Version-tolerant Twenty CRM HTTP client for health and OpenAPI probes.
//!
//! Phase 8 (renovate): used by `routes/integrations/twenty_health.rs` to power
//! the auto-bump pipeline.  Kept separate from `client::TwentyClient` because:
//!   - it does not need an API key (probes Twenty's public health surface);
//!   - it tolerates unknown fields across minor version bumps;
//!   - it caches the detected Twenty version in a `OnceCell`.

use once_cell::sync::OnceCell;
use reqwest::Client;
use serde::{de, Deserialize};
use serde_json::Value;

#[derive(Debug, thiserror::Error)]
pub enum HealthClientError {
    #[error("HTTP request failed: {0}")]
    Request(#[from] reqwest::Error),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    #[error("API error: {status} - {message}")]
    Api { status: u16, message: String },
}

/// Path used for Twenty's liveness probe.
const HEALTH_CHECK_PATH: &str = "/healthz";

/// Version-tolerant Twenty CRM client
///
/// Handles unknown fields gracefully by skipping them instead of failing.
/// Detects version once on first API call and caches it.
#[derive(Clone)]
pub struct VersionTolerantClient {
    client: Client,
    base_url: String,
    detected_version: OnceCell<String>,
}

impl VersionTolerantClient {
    /// Create a new version-tolerant Twenty client
    pub fn new(base_url: String) -> Self {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            base_url: base_url.trim_end_matches('/').to_string(),
            detected_version: OnceCell::new(),
        }
    }

    /// Detect and cache Twenty version from /open-api/json
    pub async fn detect_version(&self) -> Result<String, HealthClientError> {
        if let Some(cached) = self.detected_version.get() {
            return Ok(cached.clone());
        }

        let url = format!("{}/open-api/json", self.base_url);
        let response = self.client.get(&url).send().await?;

        if !response.status().is_success() {
            let status = response.status().as_u16();
            return Err(HealthClientError::Api {
                status,
                message: "Failed to fetch OpenAPI spec".to_string(),
            });
        }

        let spec: Value = response.json().await?;
        let version = spec
            .get("info")
            .and_then(|v| v.get("version"))
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();

        let _ = self.detected_version.set(version.clone());
        Ok(version)
    }

    /// Call a Twenty API endpoint with version-tolerant deserialization
    pub async fn call<T: de::DeserializeOwned>(
        &self,
        method: &str,
        path: &str,
    ) -> Result<T, HealthClientError> {
        let url = format!("{}{}", self.base_url, path);
        let response = match method {
            "GET" => self.client.get(&url).send().await?,
            "POST" => self.client.post(&url).send().await?,
            _ => {
                return Err(HealthClientError::Api {
                    status: 400,
                    message: format!("Unsupported HTTP method: {}", method),
                })
            }
        };

        if !response.status().is_success() {
            let status = response.status().as_u16();
            let message = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(HealthClientError::Api { status, message });
        }

        let body = response.text().await?;

        // `serde_json::from_str` allows unknown fields by default unless the target type
        // is annotated with `#[serde(deny_unknown_fields)]`. Twenty API responses often
        // include extra fields on minor version bumps; keeping target structs without
        // `deny_unknown_fields` ensures forward-compatible deserialization.
        match serde_json::from_str::<T>(&body) {
            Ok(result) => Ok(result),
            Err(e) => {
                tracing::error!(
                    error = %e,
                    body = %body,
                    "Failed to deserialize Twenty API response"
                );
                Err(HealthClientError::Serialization(e))
            }
        }
    }

    /// Health check: call Twenty's `/healthz` endpoint (see [`HEALTH_CHECK_PATH`]).
    pub async fn health_check(&self) -> Result<HealthResponse, HealthClientError> {
        let url = format!("{}{}", self.base_url, HEALTH_CHECK_PATH);
        let response = self.client.get(&url).send().await?;

        if !response.status().is_success() {
            return Err(HealthClientError::Api {
                status: response.status().as_u16(),
                message: "Health check failed".to_string(),
            });
        }

        Ok(HealthResponse { reachable: true })
    }
}

#[derive(Deserialize, Debug)]
pub struct HealthResponse {
    pub reachable: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_creation() {
        let client = VersionTolerantClient::new("http://localhost:3000".to_string());
        assert_eq!(client.base_url, "http://localhost:3000");
    }

    #[test]
    fn test_strips_trailing_slash() {
        let client = VersionTolerantClient::new("http://localhost:3000/".to_string());
        assert_eq!(client.base_url, "http://localhost:3000");
    }
}
