use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde_json::json;
use taskflow_db::queries::{CommentQueryError, TaskQueryError};

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

    #[error("Version conflict")]
    VersionConflict(serde_json::Value),

    #[error("Precondition failed: {0}")]
    PreconditionFailed(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Service unavailable: {0}")]
    ServiceUnavailable(String),

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
            AppError::VersionConflict(ref current_task) => {
                let body = json!({
                    "error": {
                        "code": "VERSION_CONFLICT",
                        "message": "Task was modified by another user",
                    },
                    "current_task": current_task,
                });
                return (StatusCode::CONFLICT, axum::Json(body)).into_response();
            }
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
            AppError::ServiceUnavailable(msg) => (
                StatusCode::SERVICE_UNAVAILABLE,
                "SERVICE_UNAVAILABLE",
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

impl From<TaskQueryError> for AppError {
    fn from(e: TaskQueryError) -> Self {
        match e {
            TaskQueryError::NotProjectMember => AppError::Forbidden("Not a board member".into()),
            TaskQueryError::NotFound => AppError::NotFound("Task not found".into()),
            TaskQueryError::Database(e) => AppError::SqlxError(e),
            TaskQueryError::VersionConflict(_) => AppError::Conflict("Version conflict".into()),
            TaskQueryError::Other(msg) => AppError::BadRequest(msg),
        }
    }
}

impl From<CommentQueryError> for AppError {
    fn from(e: CommentQueryError) -> Self {
        match e {
            CommentQueryError::NotFound => AppError::NotFound("Comment not found".into()),
            CommentQueryError::NotAuthorized => {
                AppError::Forbidden("Not authorized to modify this comment".into())
            }
            CommentQueryError::Database(e) => AppError::SqlxError(e),
        }
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

    #[tokio::test]
    async fn test_internal_error_hides_details() {
        let response = AppError::InternalError("secret database crash info".into()).into_response();
        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);

        let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let body: serde_json::Value = serde_json::from_slice(&bytes).unwrap();

        let message = body["error"]["message"].as_str().unwrap();
        assert_eq!(message, "An internal error occurred");
        assert!(!message.contains("secret"));
    }

    #[tokio::test]
    async fn test_error_response_json_shape() {
        let response = AppError::NotFound("resource missing".into()).into_response();

        let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let body: serde_json::Value = serde_json::from_slice(&bytes).unwrap();

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

    #[test]
    fn test_precondition_failed_status() {
        let response = AppError::PreconditionFailed("version mismatch".into()).into_response();
        assert_eq!(response.status(), StatusCode::PRECONDITION_FAILED);
    }

    #[tokio::test]
    async fn test_all_error_variants_have_correct_codes() {
        let test_cases: Vec<(AppError, StatusCode, &str)> = vec![
            (
                AppError::NotFound("x".into()),
                StatusCode::NOT_FOUND,
                "NOT_FOUND",
            ),
            (
                AppError::BadRequest("x".into()),
                StatusCode::BAD_REQUEST,
                "BAD_REQUEST",
            ),
            (
                AppError::Unauthorized("x".into()),
                StatusCode::UNAUTHORIZED,
                "UNAUTHORIZED",
            ),
            (
                AppError::Forbidden("x".into()),
                StatusCode::FORBIDDEN,
                "FORBIDDEN",
            ),
            (
                AppError::Conflict("x".into()),
                StatusCode::CONFLICT,
                "CONFLICT",
            ),
            (
                AppError::PreconditionFailed("x".into()),
                StatusCode::PRECONDITION_FAILED,
                "PRECONDITION_FAILED",
            ),
            (
                AppError::ValidationError("x".into()),
                StatusCode::UNPROCESSABLE_ENTITY,
                "VALIDATION_ERROR",
            ),
            (
                AppError::InternalError("x".into()),
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
            ),
        ];

        for (error, expected_status, expected_code) in test_cases {
            let response = error.into_response();
            assert_eq!(response.status(), expected_status);

            let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap();
            let body: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
            assert_eq!(body["error"]["code"].as_str().unwrap(), expected_code);
        }
    }

    #[test]
    fn test_error_display_messages() {
        assert_eq!(
            format!("{}", AppError::NotFound("missing".into())),
            "Not found: missing"
        );
        assert_eq!(
            format!("{}", AppError::BadRequest("invalid".into())),
            "Bad request: invalid"
        );
        assert_eq!(
            format!("{}", AppError::Forbidden("denied".into())),
            "Forbidden: denied"
        );
    }

    #[tokio::test]
    async fn test_version_conflict_status_and_shape() {
        let task_data = json!({"id": "123", "version": 5, "title": "Latest"});
        let response = AppError::VersionConflict(task_data.clone()).into_response();
        assert_eq!(response.status(), StatusCode::CONFLICT);

        let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let body: serde_json::Value = serde_json::from_slice(&bytes).unwrap();

        assert_eq!(body["error"]["code"].as_str().unwrap(), "VERSION_CONFLICT");
        assert!(
            body["current_task"].is_object(),
            "Should include current_task"
        );
        assert_eq!(body["current_task"]["version"], 5);
    }

    #[tokio::test]
    async fn test_jwt_error_returns_unauthorized() {
        // Create a real JWT error
        let jwt_err =
            jsonwebtoken::errors::Error::from(jsonwebtoken::errors::ErrorKind::InvalidToken);
        let response = AppError::JwtError(jwt_err).into_response();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

        let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let body: serde_json::Value = serde_json::from_slice(&bytes).unwrap();

        assert_eq!(body["error"]["code"].as_str().unwrap(), "UNAUTHORIZED");
        // Should not leak JWT error details
        let message = body["error"]["message"].as_str().unwrap();
        assert!(
            !message.contains("InvalidToken"),
            "JWT error details should not leak"
        );
    }

    #[tokio::test]
    async fn test_internal_error_does_not_leak_sqlx_details() {
        // Simulate a database error message
        let response =
            AppError::InternalError("connection to database refused at 10.0.0.1:5432".into())
                .into_response();
        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);

        let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let body: serde_json::Value = serde_json::from_slice(&bytes).unwrap();

        let message = body["error"]["message"].as_str().unwrap();
        assert!(!message.contains("10.0.0.1"), "IP address should not leak");
        assert!(!message.contains("5432"), "Port should not leak");
    }
}
