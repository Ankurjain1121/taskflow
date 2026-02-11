use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
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
    pub postal_smtp_host: String,
    pub postal_smtp_port: u16,
    pub postal_api_url: String,
    pub postal_api_key: String,
    pub postal_from_address: String,
    pub postal_from_name: String,
    pub novu_api_url: String,
    pub novu_api_key: String,
    pub lago_api_url: String,
    pub lago_api_key: String,
    pub stripe_secret_key: String,
    pub stripe_webhook_secret: String,
    pub waha_api_url: String,
    pub waha_api_key: String,
    pub app_url: String,
}

impl Config {
    pub fn from_env() -> Result<Self, Box<dyn std::error::Error>> {
        dotenvy::dotenv().ok();

        Ok(Self {
            database_url: env::var("DATABASE_URL")
                .unwrap_or_else(|_| "postgresql://postgres:postgres@localhost:5432/taskflow".into()),
            app_database_url: env::var("APP_DATABASE_URL")
                .unwrap_or_else(|_| env::var("DATABASE_URL")
                    .unwrap_or_else(|_| "postgresql://postgres:postgres@localhost:5432/taskflow".into())),
            host: env::var("HOST").unwrap_or_else(|_| "0.0.0.0".into()),
            port: env::var("PORT")
                .unwrap_or_else(|_| "8080".into())
                .parse()?,
            jwt_secret: env::var("JWT_SECRET")
                .expect("JWT_SECRET environment variable must be set"),
            jwt_refresh_secret: env::var("JWT_REFRESH_SECRET")
                .expect("JWT_REFRESH_SECRET environment variable must be set"),
            jwt_access_expiry_secs: env::var("JWT_ACCESS_EXPIRY_SECS")
                .unwrap_or_else(|_| "900".into())
                .parse()?,
            jwt_refresh_expiry_secs: env::var("JWT_REFRESH_EXPIRY_SECS")
                .unwrap_or_else(|_| "604800".into())
                .parse()?,
            jwt_rsa_private_key: env::var("JWT_RSA_PRIVATE_KEY").ok().filter(|s| !s.is_empty()),
            jwt_rsa_public_key: env::var("JWT_RSA_PUBLIC_KEY").ok().filter(|s| !s.is_empty()),
            redis_url: env::var("REDIS_URL")
                .unwrap_or_else(|_| "redis://localhost:6379".into()),
            minio_endpoint: env::var("MINIO_ENDPOINT")
                .unwrap_or_else(|_| "http://localhost:9000".into()),
            minio_public_url: env::var("MINIO_PUBLIC_URL")
                .unwrap_or_else(|_| "http://localhost:9000".into()),
            minio_access_key: env::var("MINIO_ACCESS_KEY")
                .expect("MINIO_ACCESS_KEY environment variable must be set"),
            minio_secret_key: env::var("MINIO_SECRET_KEY")
                .expect("MINIO_SECRET_KEY environment variable must be set"),
            minio_bucket: env::var("MINIO_BUCKET")
                .unwrap_or_else(|_| "task-attachments".into()),
            postal_smtp_host: env::var("POSTAL_SMTP_HOST")
                .unwrap_or_else(|_| "localhost".into()),
            postal_smtp_port: env::var("POSTAL_SMTP_PORT")
                .unwrap_or_else(|_| "25".into())
                .parse()?,
            postal_api_url: env::var("POSTAL_API_URL")
                .unwrap_or_else(|_| "http://localhost:5000".into()),
            postal_api_key: env::var("POSTAL_API_KEY").unwrap_or_default(),
            postal_from_address: env::var("POSTAL_FROM_ADDRESS")
                .unwrap_or_else(|_| "noreply@taskflow.local".into()),
            postal_from_name: env::var("POSTAL_FROM_NAME")
                .unwrap_or_else(|_| "TaskFlow".into()),
            novu_api_url: env::var("NOVU_API_URL")
                .unwrap_or_else(|_| "http://localhost:3000".into()),
            novu_api_key: env::var("NOVU_API_KEY").unwrap_or_default(),
            lago_api_url: env::var("LAGO_API_URL")
                .unwrap_or_else(|_| "http://localhost:3000".into()),
            lago_api_key: env::var("LAGO_API_KEY").unwrap_or_default(),
            stripe_secret_key: env::var("STRIPE_SECRET_KEY").unwrap_or_default(),
            stripe_webhook_secret: env::var("STRIPE_WEBHOOK_SECRET").unwrap_or_default(),
            waha_api_url: env::var("WAHA_API_URL")
                .unwrap_or_else(|_| "http://localhost:3000".into()),
            waha_api_key: env::var("WAHA_API_KEY").unwrap_or_default(),
            app_url: env::var("APP_URL")
                .unwrap_or_else(|_| "http://localhost:4200".into()),
        })
    }
}
