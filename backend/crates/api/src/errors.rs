use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Forbidden: {0}")]
    Forbidden(String),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Precondition failed: {0}")]
    PreconditionFailed(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Internal server error")]
    InternalError(String),

    #[error(transparent)]
    SqlxError(#[from] sqlx::Error),

    #[error(transparent)]
    JwtError(#[from] jsonwebtoken::errors::Error),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, code, message) = match &self {
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, "NOT_FOUND", msg.clone()),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, "BAD_REQUEST", msg.clone()),
            AppError::Unauthorized(msg) => (StatusCode::UNAUTHORIZED, "UNAUTHORIZED", msg.clone()),
            AppError::Forbidden(msg) => (StatusCode::FORBIDDEN, "FORBIDDEN", msg.clone()),
            AppError::Conflict(msg) => (StatusCode::CONFLICT, "CONFLICT", msg.clone()),
            AppError::PreconditionFailed(msg) => (
                StatusCode::PRECONDITION_FAILED,
                "PRECONDITION_FAILED",
                msg.clone(),
            ),
            AppError::ValidationError(msg) => (
                StatusCode::UNPROCESSABLE_ENTITY,
                "VALIDATION_ERROR",
                msg.clone(),
            ),
            AppError::InternalError(msg) => {
                tracing::error!("Internal error: {}", msg);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "INTERNAL_ERROR",
                    "An internal error occurred".to_string(),
                )
            }
            AppError::SqlxError(err) => {
                tracing::error!("Database error: {:?}", err);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "INTERNAL_ERROR",
                    "An internal error occurred".to_string(),
                )
            }
            AppError::JwtError(_) => (
                StatusCode::UNAUTHORIZED,
                "UNAUTHORIZED",
                "Invalid or expired token".to_string(),
            ),
        };

        let body = json!({
            "error": {
                "code": code,
                "message": message,
            }
        });

        (status, axum::Json(body)).into_response()
    }
}

pub type Result<T> = std::result::Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;
    use axum::response::IntoResponse;

    #[test]
    fn test_not_found_status() {
        let response = AppError::NotFound("test".into()).into_response();
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[test]
    fn test_bad_request_status() {
        let response = AppError::BadRequest("test".into()).into_response();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[test]
    fn test_unauthorized_status() {
        let response = AppError::Unauthorized("test".into()).into_response();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[test]
    fn test_forbidden_status() {
        let response = AppError::Forbidden("test".into()).into_response();
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
    }

    #[test]
    fn test_conflict_status() {
        let response = AppError::Conflict("test".into()).into_response();
        assert_eq!(response.status(), StatusCode::CONFLICT);
    }

    #[test]
    fn test_validation_error_status() {
        let response = AppError::ValidationError("test".into()).into_response();
        assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
    }

    #[test]
    fn test_internal_error_hides_details() {
        let response = AppError::InternalError("secret database crash info".into()).into_response();
        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);

        // Extract body and verify the message is generic
        let body = tokio::runtime::Runtime::new().unwrap().block_on(async {
            let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            serde_json::from_slice::<serde_json::Value>(&bytes).unwrap()
        });

        let message = body["error"]["message"].as_str().unwrap();
        assert_eq!(message, "An internal error occurred");
        assert!(!message.contains("secret"));
    }

    #[test]
    fn test_error_response_json_shape() {
        let response = AppError::NotFound("resource missing".into()).into_response();

        let body = tokio::runtime::Runtime::new().unwrap().block_on(async {
            let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            serde_json::from_slice::<serde_json::Value>(&bytes).unwrap()
        });

        // Verify JSON shape: { "error": { "code": ..., "message": ... } }
        assert!(
            body.get("error").is_some(),
            "Response must have 'error' key"
        );
        let error_obj = &body["error"];
        assert!(
            error_obj.get("code").is_some(),
            "Error must have 'code' field"
        );
        assert!(
            error_obj.get("message").is_some(),
            "Error must have 'message' field"
        );
        assert_eq!(error_obj["code"].as_str().unwrap(), "NOT_FOUND");
        assert_eq!(error_obj["message"].as_str().unwrap(), "resource missing");
    }
}
