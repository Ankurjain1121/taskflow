use std::env;
use std::fmt;

#[derive(Clone)]
pub struct Config {
    pub app_database_url: String,
    pub host: String,
    pub port: u16,
    pub jwt_secret: String,
    pub jwt_refresh_secret: String,
    pub jwt_access_expiry_secs: i64,
    pub jwt_refresh_expiry_secs: i64,
    pub jwt_rsa_private_key: Option<String>,
    pub jwt_rsa_public_key: Option<String>,
    pub redis_url: String,
    pub minio_endpoint: String,
    pub minio_public_url: String,
    pub minio_access_key: String,
    pub minio_secret_key: String,
    pub minio_bucket: String,
    pub postal_api_url: String,
    pub postal_api_key: String,
    pub postal_from_address: String,
    pub postal_from_name: String,
    pub novu_api_url: String,
    pub novu_api_key: String,
    pub lago_api_url: String,
    pub lago_api_key: String,
    pub waha_api_url: String,
    pub waha_api_key: String,
    pub app_url: String,
}

impl Config {
    pub fn from_env() -> Result<Self, Box<dyn std::error::Error>> {
        dotenvy::dotenv().ok();

        Ok(Self {
            app_database_url: env::var("APP_DATABASE_URL").unwrap_or_else(|_| {
                env::var("DATABASE_URL").unwrap_or_else(|_| {
                    "postgresql://postgres:postgres@localhost:5432/taskflow".into()
                })
            }),
            host: env::var("HOST").unwrap_or_else(|_| "0.0.0.0".into()),
            port: env::var("PORT").unwrap_or_else(|_| "8080".into()).parse()?,
            jwt_secret: env::var("JWT_SECRET")
                .map_err(|_| "JWT_SECRET environment variable must be set")?,
            jwt_refresh_secret: env::var("JWT_REFRESH_SECRET")
                .map_err(|_| "JWT_REFRESH_SECRET environment variable must be set")?,
            jwt_access_expiry_secs: env::var("JWT_ACCESS_EXPIRY_SECS")
                .unwrap_or_else(|_| "900".into())
                .parse()?,
            jwt_refresh_expiry_secs: env::var("JWT_REFRESH_EXPIRY_SECS")
                .unwrap_or_else(|_| "604800".into())
                .parse()?,
            jwt_rsa_private_key: env::var("JWT_RSA_PRIVATE_KEY")
                .ok()
                .filter(|s| !s.is_empty()),
            jwt_rsa_public_key: env::var("JWT_RSA_PUBLIC_KEY")
                .ok()
                .filter(|s| !s.is_empty()),
            redis_url: env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".into()),
            minio_endpoint: env::var("MINIO_ENDPOINT")
                .unwrap_or_else(|_| "http://localhost:9000".into()),
            minio_public_url: env::var("MINIO_PUBLIC_URL")
                .unwrap_or_else(|_| "http://localhost:9000".into()),
            minio_access_key: env::var("MINIO_ACCESS_KEY")
                .map_err(|_| "MINIO_ACCESS_KEY environment variable must be set")?,
            minio_secret_key: env::var("MINIO_SECRET_KEY")
                .map_err(|_| "MINIO_SECRET_KEY environment variable must be set")?,
            minio_bucket: env::var("MINIO_BUCKET").unwrap_or_else(|_| "task-attachments".into()),
            postal_api_url: env::var("POSTAL_API_URL")
                .unwrap_or_else(|_| "http://localhost:5000".into()),
            postal_api_key: env::var("POSTAL_API_KEY").unwrap_or_default(),
            postal_from_address: env::var("POSTAL_FROM_ADDRESS")
                .unwrap_or_else(|_| "noreply@taskflow.local".into()),
            postal_from_name: env::var("POSTAL_FROM_NAME").unwrap_or_else(|_| "TaskFlow".into()),
            novu_api_url: env::var("NOVU_API_URL")
                .unwrap_or_else(|_| "http://localhost:3000".into()),
            novu_api_key: env::var("NOVU_API_KEY").unwrap_or_default(),
            lago_api_url: env::var("LAGO_API_URL")
                .unwrap_or_else(|_| "http://localhost:3000".into()),
            lago_api_key: env::var("LAGO_API_KEY").unwrap_or_default(),
            waha_api_url: env::var("WAHA_API_URL")
                .unwrap_or_else(|_| "http://localhost:3000".into()),
            waha_api_key: env::var("WAHA_API_KEY").unwrap_or_default(),
            app_url: env::var("APP_URL").unwrap_or_else(|_| "http://localhost:4200".into()),
        })
    }
}

impl fmt::Debug for Config {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Config")
            .field("host", &self.host)
            .field("port", &self.port)
            .field("app_url", &self.app_url)
            .field("jwt_secret", &"[REDACTED]")
            .field("jwt_refresh_secret", &"[REDACTED]")
            .field("minio_access_key", &"[REDACTED]")
            .field("minio_secret_key", &"[REDACTED]")
            .field("postal_api_key", &"[REDACTED]")
            .field("novu_api_key", &"[REDACTED]")
            .field("lago_api_key", &"[REDACTED]")
            .field("waha_api_key", &"[REDACTED]")
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_test_config() -> Config {
        Config {
            app_database_url: "postgresql://test:test@localhost/testdb".into(),
            host: "0.0.0.0".into(),
            port: 8080,
            jwt_secret: "actual-secret".into(),
            jwt_refresh_secret: "actual-refresh-secret".into(),
            jwt_access_expiry_secs: 900,
            jwt_refresh_expiry_secs: 604800,
            jwt_rsa_private_key: None,
            jwt_rsa_public_key: None,
            redis_url: "redis://localhost:6379".into(),
            minio_endpoint: "http://minio:9000".into(),
            minio_public_url: "http://localhost:9000".into(),
            minio_access_key: "actual-minio-access".into(),
            minio_secret_key: "actual-minio-secret".into(),
            minio_bucket: "task-attachments".into(),
            postal_api_url: "http://localhost:5000".into(),
            postal_api_key: "actual-postal-key".into(),
            postal_from_address: "noreply@test.local".into(),
            postal_from_name: "TaskFlow".into(),
            novu_api_url: "http://localhost:3000".into(),
            novu_api_key: "actual-novu-key".into(),
            lago_api_url: "http://localhost:3000".into(),
            lago_api_key: "actual-lago-key".into(),
            waha_api_url: "http://localhost:3000".into(),
            waha_api_key: "actual-waha-key".into(),
            app_url: "http://localhost:4200".into(),
        }
    }

    #[test]
    fn test_config_debug_redacts_secrets() {
        let config = make_test_config();
        let debug_str = format!("{:?}", config);

        // Should contain [REDACTED] for each sensitive field
        assert!(
            debug_str.contains("[REDACTED]"),
            "Debug output should contain [REDACTED]"
        );

        // Should NOT contain any actual secret values
        assert!(
            !debug_str.contains("actual-secret"),
            "Debug output must not leak jwt_secret"
        );
        assert!(
            !debug_str.contains("actual-refresh-secret"),
            "Debug output must not leak jwt_refresh_secret"
        );
        assert!(
            !debug_str.contains("actual-minio-access"),
            "Debug output must not leak minio_access_key"
        );
        assert!(
            !debug_str.contains("actual-minio-secret"),
            "Debug output must not leak minio_secret_key"
        );
        assert!(
            !debug_str.contains("actual-postal-key"),
            "Debug output must not leak postal_api_key"
        );
        assert!(
            !debug_str.contains("actual-novu-key"),
            "Debug output must not leak novu_api_key"
        );
        assert!(
            !debug_str.contains("actual-lago-key"),
            "Debug output must not leak lago_api_key"
        );
        assert!(
            !debug_str.contains("actual-waha-key"),
            "Debug output must not leak waha_api_key"
        );
    }

    #[test]
    fn test_config_debug_shows_non_sensitive_fields() {
        let config = make_test_config();
        let debug_str = format!("{:?}", config);

        // Non-sensitive fields should be visible
        assert!(
            debug_str.contains("0.0.0.0"),
            "Debug output should show host"
        );
        assert!(debug_str.contains("8080"), "Debug output should show port");
        assert!(
            debug_str.contains("http://localhost:4200"),
            "Debug output should show app_url"
        );
    }

    #[test]
    fn test_config_debug_contains_config_struct_name() {
        let config = make_test_config();
        let debug_str = format!("{:?}", config);
        assert!(
            debug_str.starts_with("Config"),
            "Debug output should start with 'Config'"
        );
    }

    #[test]
    fn test_config_clone() {
        let config = make_test_config();
        let cloned = config.clone();
        assert_eq!(cloned.host, config.host);
        assert_eq!(cloned.port, config.port);
        assert_eq!(cloned.jwt_secret, config.jwt_secret);
        assert_eq!(cloned.app_url, config.app_url);
    }

    #[test]
    fn test_config_debug_redacts_all_seven_secrets() {
        let config = make_test_config();
        let debug_str = format!("{:?}", config);

        // Count occurrences of [REDACTED] - should be 7 (jwt_secret, jwt_refresh_secret,
        // minio_access_key, minio_secret_key, postal_api_key, novu_api_key, lago_api_key, waha_api_key)
        let redacted_count = debug_str.matches("[REDACTED]").count();
        assert_eq!(
            redacted_count, 8,
            "Expected 8 [REDACTED] occurrences, got {}. Debug: {}",
            redacted_count, debug_str
        );
    }
}
