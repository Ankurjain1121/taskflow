use std::sync::Arc;

use dashmap::DashMap;
use s3::bucket::Bucket;
use s3::creds::Credentials;
use s3::region::Region;
use sqlx::PgPool;
use tokio::sync::broadcast;
use uuid::Uuid;

use crate::config::Config;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub config: Arc<Config>,
    pub redis: redis::aio::ConnectionManager,
    pub board_channels: Arc<DashMap<Uuid, broadcast::Sender<String>>>,
    pub s3_bucket: Arc<Bucket>,
}

impl AppState {
    pub async fn new(config: Config) -> Result<Self, Box<dyn std::error::Error>> {
        // Connect to PostgreSQL
        let db = PgPool::connect(&config.app_database_url).await?;

        // Run pending migrations
        sqlx::migrate!("../db/src/migrations")
            .run(&db)
            .await?;
        tracing::info!("Database migrations applied");

        // Connect to Redis
        let redis_client = redis::Client::open(config.redis_url.as_str())?;
        let redis = redis_client.get_connection_manager().await?;
        tracing::info!("Redis connected");

        // Set up S3 bucket for MinIO using rust-s3
        let credentials = Credentials::new(
            Some(&config.minio_access_key),
            Some(&config.minio_secret_key),
            None,
            None,
            None,
        )?;

        let region = Region::Custom {
            region: "us-east-1".to_string(),
            endpoint: config.minio_endpoint.clone(),
        };

        let s3_bucket = Bucket::new(&config.minio_bucket, region, credentials)?
            .with_path_style();

        let board_channels = Arc::new(DashMap::new());

        Ok(Self {
            db,
            config: Arc::new(config),
            redis,
            board_channels,
            s3_bucket: Arc::new(s3_bucket),
        })
    }

    /// Get or create a broadcast channel for a board
    pub fn get_board_channel(&self, board_id: Uuid) -> broadcast::Sender<String> {
        self.board_channels
            .entry(board_id)
            .or_insert_with(|| broadcast::channel(256).0)
            .clone()
    }
}
