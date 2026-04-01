//! MinIO service for S3-compatible object storage operations
//!
//! Provides presigned URL generation, object management, and bucket operations
//! for file attachments using the aws-sdk-s3 crate.

use aws_sdk_s3::config::{Credentials, Region};
use aws_sdk_s3::presigning::PresigningConfig;
use aws_sdk_s3::Client;
use std::time::Duration;
/// Errors that can occur during MinIO operations
#[derive(Debug, thiserror::Error)]
pub enum MinioError {
    #[error("S3 error: {0}")]
    S3Error(String),
    #[error("Presigning error: {0}")]
    PresigningError(String),
    #[error("Object not found: {0}")]
    NotFound(String),
    #[error("Bucket creation failed: {0}")]
    BucketCreationFailed(String),
}

/// Configuration for MinIO service
#[derive(Clone, Debug)]
pub struct MinioConfig {
    /// Internal endpoint for S3 operations (e.g., http://minio:9000 in Docker)
    pub endpoint: String,
    /// Public URL for presigned URLs (e.g., http://localhost:9000)
    pub public_url: String,
    /// Access key (username)
    pub access_key: String,
    /// Secret key (password)
    pub secret_key: String,
    /// Bucket name for attachments
    pub bucket: String,
}

/// MinIO service for S3-compatible object storage
#[derive(Clone)]
pub struct MinioService {
    /// Internal client for bucket operations and object management
    internal_client: Client,
    /// Client configured with public URL for presigned URL generation
    public_client: Client,
    /// Bucket name
    bucket: String,
    /// Public URL for presigned URLs
    public_url: String,
}

impl MinioService {
    /// Create a new MinioService with the given configuration
    #[allow(clippy::unused_async)]
    pub async fn new(config: MinioConfig) -> Self {
        // Build internal client (uses Docker internal endpoint)
        let internal_creds = Credentials::new(
            &config.access_key,
            &config.secret_key,
            None,
            None,
            "minio-internal",
        );
        let internal_s3_config = aws_sdk_s3::config::Builder::new()
            .endpoint_url(&config.endpoint)
            .region(Region::new("us-east-1"))
            .credentials_provider(internal_creds)
            .force_path_style(true)
            .build();
        let internal_client = Client::from_conf(internal_s3_config);

        // Build public client (uses public URL for presigned URLs)
        let public_creds = Credentials::new(
            &config.access_key,
            &config.secret_key,
            None,
            None,
            "minio-public",
        );
        let public_s3_config = aws_sdk_s3::config::Builder::new()
            .endpoint_url(&config.public_url)
            .region(Region::new("us-east-1"))
            .credentials_provider(public_creds)
            .force_path_style(true)
            .build();
        let public_client = Client::from_conf(public_s3_config);

        Self {
            internal_client,
            public_client,
            bucket: config.bucket,
            public_url: config.public_url,
        }
    }

    /// Ensure the bucket exists, creating it if necessary
    pub async fn ensure_bucket(&self) -> Result<(), MinioError> {
        // Check if bucket exists using head_bucket
        let head_result = self
            .internal_client
            .head_bucket()
            .bucket(&self.bucket)
            .send()
            .await;

        match head_result {
            Ok(_) => {
                tracing::info!("MinIO bucket '{}' already exists", self.bucket);
                Ok(())
            }
            Err(_) => {
                // Bucket doesn't exist, create it
                tracing::info!("Creating MinIO bucket '{}'", self.bucket);
                self.internal_client
                    .create_bucket()
                    .bucket(&self.bucket)
                    .send()
                    .await
                    .map_err(|e| {
                        MinioError::BucketCreationFailed(format!(
                            "Failed to create bucket '{}': {}",
                            self.bucket, e
                        ))
                    })?;
                tracing::info!("MinIO bucket '{}' created successfully", self.bucket);
                Ok(())
            }
        }
    }

    /// Generate a presigned PUT URL for uploading a file
    ///
    /// # Arguments
    /// * `key` - The object key (path) in the bucket
    /// * `content_type` - The MIME type of the file
    /// * `expires_secs` - How long the URL should be valid (in seconds)
    ///
    /// # Returns
    /// A presigned URL that can be used for HTTP PUT upload
    pub async fn presigned_put_url(
        &self,
        key: &str,
        content_type: &str,
        expires_secs: u64,
    ) -> Result<String, MinioError> {
        let presigning_config = PresigningConfig::expires_in(Duration::from_secs(expires_secs))
            .map_err(|e| MinioError::PresigningError(e.to_string()))?;

        // Use public_client to generate URLs with public endpoint
        let presigned_request = self
            .public_client
            .put_object()
            .bucket(&self.bucket)
            .key(key)
            .content_type(content_type)
            .presigned(presigning_config)
            .await
            .map_err(|e| MinioError::PresigningError(e.to_string()))?;

        Ok(presigned_request.uri().to_string())
    }

    /// Generate a presigned GET URL for downloading a file
    ///
    /// # Arguments
    /// * `key` - The object key (path) in the bucket
    /// * `expires_secs` - How long the URL should be valid (in seconds)
    ///
    /// # Returns
    /// A presigned URL that can be used for HTTP GET download
    pub async fn presigned_get_url(
        &self,
        key: &str,
        expires_secs: u64,
    ) -> Result<String, MinioError> {
        let presigning_config = PresigningConfig::expires_in(Duration::from_secs(expires_secs))
            .map_err(|e| MinioError::PresigningError(e.to_string()))?;

        // Use public_client to generate URLs with public endpoint
        let presigned_request = self
            .public_client
            .get_object()
            .bucket(&self.bucket)
            .key(key)
            .presigned(presigning_config)
            .await
            .map_err(|e| MinioError::PresigningError(e.to_string()))?;

        Ok(presigned_request.uri().to_string())
    }

    /// Check if an object exists (verify upload completed)
    ///
    /// # Arguments
    /// * `key` - The object key (path) in the bucket
    ///
    /// # Returns
    /// Ok(()) if the object exists, Err(NotFound) otherwise
    pub async fn stat_object(&self, key: &str) -> Result<(), MinioError> {
        self.internal_client
            .head_object()
            .bucket(&self.bucket)
            .key(key)
            .send()
            .await
            .map_err(|e| MinioError::NotFound(format!("Object '{}' not found: {}", key, e)))?;

        Ok(())
    }

    /// Delete an object from the bucket
    ///
    /// # Arguments
    /// * `key` - The object key (path) in the bucket
    ///
    /// # Note
    /// This operation is idempotent - deleting a non-existent object succeeds
    pub async fn delete_object(&self, key: &str) -> Result<(), MinioError> {
        self.internal_client
            .delete_object()
            .bucket(&self.bucket)
            .key(key)
            .send()
            .await
            .map_err(|e| MinioError::S3Error(format!("Failed to delete '{}': {}", key, e)))?;

        tracing::info!("Deleted object '{}' from bucket '{}'", key, self.bucket);
        Ok(())
    }

    /// Get the public URL base for reference
    pub fn public_url(&self) -> &str {
        &self.public_url
    }

    /// Get the bucket name
    pub fn bucket(&self) -> &str {
        &self.bucket
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_minio_config() {
        let config = MinioConfig {
            endpoint: "http://minio:9000".to_string(),
            public_url: "http://localhost:9000".to_string(),
            access_key: "minioadmin".to_string(),
            secret_key: "minioadmin".to_string(),
            bucket: "test-bucket".to_string(),
        };

        assert_eq!(config.endpoint, "http://minio:9000");
        assert_eq!(config.public_url, "http://localhost:9000");
    }

    #[test]
    fn test_minio_config_clone() {
        let config = MinioConfig {
            endpoint: "http://minio:9000".to_string(),
            public_url: "http://localhost:9000".to_string(),
            access_key: "minioadmin".to_string(),
            secret_key: "minioadmin".to_string(),
            bucket: "test-bucket".to_string(),
        };
        let cloned = config.clone();
        assert_eq!(cloned.endpoint, config.endpoint);
        assert_eq!(cloned.public_url, config.public_url);
        assert_eq!(cloned.access_key, config.access_key);
        assert_eq!(cloned.secret_key, config.secret_key);
        assert_eq!(cloned.bucket, config.bucket);
    }

    #[test]
    fn test_minio_config_debug_output() {
        let config = MinioConfig {
            endpoint: "http://minio:9000".to_string(),
            public_url: "http://localhost:9000".to_string(),
            access_key: "minioadmin".to_string(),
            secret_key: "minioadmin".to_string(),
            bucket: "attachments".to_string(),
        };
        let debug = format!("{:?}", config);
        assert!(debug.contains("MinioConfig"), "got: {}", debug);
        assert!(debug.contains("attachments"), "got: {}", debug);
    }

    #[test]
    fn test_minio_config_all_fields_set() {
        let config = MinioConfig {
            endpoint: "http://s3.example.com".to_string(),
            public_url: "https://cdn.example.com".to_string(),
            access_key: "AKID".to_string(),
            secret_key: "SKEY".to_string(),
            bucket: "my-bucket".to_string(),
        };
        assert_eq!(config.endpoint, "http://s3.example.com");
        assert_eq!(config.public_url, "https://cdn.example.com");
        assert_eq!(config.access_key, "AKID");
        assert_eq!(config.secret_key, "SKEY");
        assert_eq!(config.bucket, "my-bucket");
    }

    #[test]
    fn test_minio_error_display_s3() {
        let err = MinioError::S3Error("connection refused".to_string());
        assert_eq!(format!("{}", err), "S3 error: connection refused");
    }

    #[test]
    fn test_minio_error_display_presigning() {
        let err = MinioError::PresigningError("invalid duration".to_string());
        assert_eq!(format!("{}", err), "Presigning error: invalid duration");
    }

    #[test]
    fn test_minio_error_display_not_found() {
        let err = MinioError::NotFound("key/path".to_string());
        assert_eq!(format!("{}", err), "Object not found: key/path");
    }

    #[test]
    fn test_minio_error_display_bucket_creation() {
        let err = MinioError::BucketCreationFailed("access denied".to_string());
        assert_eq!(format!("{}", err), "Bucket creation failed: access denied");
    }

    #[tokio::test]
    async fn test_minio_service_accessors() {
        let config = MinioConfig {
            endpoint: "http://minio:9000".to_string(),
            public_url: "http://localhost:9000".to_string(),
            access_key: "minioadmin".to_string(),
            secret_key: "minioadmin".to_string(),
            bucket: "test-attachments".to_string(),
        };
        let service = MinioService::new(config).await;

        assert_eq!(service.bucket(), "test-attachments");
        assert_eq!(service.public_url(), "http://localhost:9000");
    }

    #[tokio::test]
    async fn test_minio_service_presigned_put_url_contains_bucket_and_key() {
        let config = MinioConfig {
            endpoint: "http://minio:9000".to_string(),
            public_url: "http://localhost:9000".to_string(),
            access_key: "minioadmin".to_string(),
            secret_key: "minioadmin".to_string(),
            bucket: "attachments".to_string(),
        };
        let service = MinioService::new(config).await;

        let url = service
            .presigned_put_url("uploads/test-file.pdf", "application/pdf", 3600)
            .await
            .expect("presigned put url should succeed");

        assert!(
            url.contains("attachments"),
            "URL should contain bucket name, got: {}",
            url
        );
        assert!(
            url.contains("uploads/test-file.pdf") || url.contains("uploads%2Ftest-file.pdf"),
            "URL should contain object key, got: {}",
            url
        );
        assert!(
            url.starts_with("http://localhost:9000"),
            "URL should use public URL, got: {}",
            url
        );
    }

    #[tokio::test]
    async fn test_minio_service_presigned_get_url_contains_bucket_and_key() {
        let config = MinioConfig {
            endpoint: "http://minio:9000".to_string(),
            public_url: "https://cdn.example.com".to_string(),
            access_key: "minioadmin".to_string(),
            secret_key: "minioadmin".to_string(),
            bucket: "my-bucket".to_string(),
        };
        let service = MinioService::new(config).await;

        let url = service
            .presigned_get_url("path/to/file.jpg", 600)
            .await
            .expect("presigned get url should succeed");

        assert!(
            url.starts_with("https://cdn.example.com"),
            "URL should use public URL, got: {}",
            url
        );
        assert!(
            url.contains("my-bucket"),
            "URL should contain bucket name, got: {}",
            url
        );
    }

    #[tokio::test]
    async fn test_minio_service_clone() {
        let config = MinioConfig {
            endpoint: "http://minio:9000".to_string(),
            public_url: "http://localhost:9000".to_string(),
            access_key: "minioadmin".to_string(),
            secret_key: "minioadmin".to_string(),
            bucket: "clone-test".to_string(),
        };
        let service = MinioService::new(config).await;
        let cloned = service.clone();

        assert_eq!(service.bucket(), cloned.bucket());
        assert_eq!(service.public_url(), cloned.public_url());
    }

    #[test]
    fn test_minio_error_debug_output() {
        let err = MinioError::S3Error("timeout".to_string());
        let debug = format!("{:?}", err);
        assert!(debug.contains("S3Error"), "got: {}", debug);
        assert!(debug.contains("timeout"), "got: {}", debug);
    }

    #[test]
    fn test_minio_error_variants_are_distinct() {
        let s3 = format!("{}", MinioError::S3Error("x".to_string()));
        let presign = format!("{}", MinioError::PresigningError("x".to_string()));
        let not_found = format!("{}", MinioError::NotFound("x".to_string()));
        let bucket = format!("{}", MinioError::BucketCreationFailed("x".to_string()));

        // Each variant produces a unique prefix
        assert_ne!(s3, presign);
        assert_ne!(presign, not_found);
        assert_ne!(not_found, bucket);
    }
}
