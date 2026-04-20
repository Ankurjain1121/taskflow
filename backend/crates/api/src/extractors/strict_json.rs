//! StrictJson extractor — deserializes JSON bodies with strict handling.
//!
//! Rejections (malformed JSON, invalid types, unknown fields when the target
//! DTO uses `#[serde(deny_unknown_fields)]`) are mapped to a generic 400
//! response through `AppError::BadRequest`. The full serde error message —
//! which can include field names and expected-value lists — is logged
//! server-side but NOT returned to the client. This closes CWE-209 (schema
//! enumeration via error payload).

use axum::{
    extract::{rejection::JsonRejection, FromRequest, Request},
    Json,
};
use strict_dto::StrictDto;

use crate::errors::AppError;

pub struct StrictJson<T>(pub T);

impl<S, T> FromRequest<S> for StrictJson<T>
where
    S: Send + Sync,
    T: StrictDto,
{
    type Rejection = AppError;

    async fn from_request(req: Request, state: &S) -> Result<Self, Self::Rejection> {
        match Json::<T>::from_request(req, state).await {
            Ok(Json(value)) => Ok(StrictJson(value)),
            Err(rejection) => {
                // Log only the variant name — the Display impl can embed
                // request-body fragments, so leaking it at any level risks
                // CWE-532 under RUST_LOG=debug triage.
                tracing::warn!(
                    target: "strict_json",
                    variant = rejection_variant(&rejection),
                    "JSON body rejected"
                );
                Err(map_json_rejection(&rejection))
            }
        }
    }
}

fn rejection_variant(rejection: &JsonRejection) -> &'static str {
    match rejection {
        JsonRejection::MissingJsonContentType(_) => "MissingJsonContentType",
        JsonRejection::JsonSyntaxError(_) => "JsonSyntaxError",
        JsonRejection::JsonDataError(_) => "JsonDataError",
        JsonRejection::BytesRejection(_) => "BytesRejection",
        _ => "Unknown",
    }
}

fn map_json_rejection(rejection: &JsonRejection) -> AppError {
    // One opaque string for every rejection path. Variance would let a
    // client fingerprint the rejection class across requests.
    let _ = rejection;
    AppError::BadRequest("Invalid request body".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{header, Request, StatusCode};
    use axum::routing::post;
    use axum::Router;
    use strict_dto_derive::strict_dto;
    use tower::ServiceExt;

    #[strict_dto]
    struct Payload {
        name: String,
    }

    async fn handler(StrictJson(body): StrictJson<Payload>) -> String {
        body.name
    }

    fn app() -> Router {
        Router::new().route("/echo", post(handler))
    }

    async fn body_text(res: axum::response::Response) -> String {
        let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
            .await
            .unwrap();
        String::from_utf8(bytes.to_vec()).unwrap()
    }

    #[tokio::test]
    async fn accepts_valid_payload() {
        let res = app()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/echo")
                    .header(header::CONTENT_TYPE, "application/json")
                    .body(Body::from(r#"{"name":"hi"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        assert_eq!(body_text(res).await, "hi");
    }

    async fn assert_opaque_rejection(res: axum::response::Response) {
        assert_eq!(res.status(), StatusCode::BAD_REQUEST);
        let body = body_text(res).await;
        let parsed: serde_json::Value =
            serde_json::from_str(&body).expect("response must be JSON");
        assert_eq!(
            parsed["error"]["code"].as_str(),
            Some("BAD_REQUEST"),
            "error.code must be BAD_REQUEST"
        );
        assert_eq!(
            parsed["error"]["message"].as_str(),
            Some("Invalid request body"),
            "response must use the single opaque message"
        );
    }

    #[tokio::test]
    async fn rejects_unknown_field_without_leaking() {
        let res = app()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/echo")
                    .header(header::CONTENT_TYPE, "application/json")
                    .body(Body::from(r#"{"name":"x","evil":"leak"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        let status = res.status();
        assert_eq!(status, StatusCode::BAD_REQUEST);

        let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
            .await
            .unwrap();
        let body = String::from_utf8(bytes.to_vec()).unwrap();

        // Schema-leak checks
        assert!(!body.contains("evil"), "response must not leak field name");
        assert!(
            !body.contains("unknown field"),
            "response must not leak serde wording"
        );
        assert!(!body.contains("name"), "response must not leak known fields");

        // Envelope assertions (positive shape)
        let parsed: serde_json::Value = serde_json::from_str(&body).unwrap();
        assert_eq!(parsed["error"]["code"].as_str(), Some("BAD_REQUEST"));
        assert_eq!(
            parsed["error"]["message"].as_str(),
            Some("Invalid request body")
        );
    }

    #[tokio::test]
    async fn rejects_malformed_json() {
        let res = app()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/echo")
                    .header(header::CONTENT_TYPE, "application/json")
                    .body(Body::from("{ not json"))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_opaque_rejection(res).await;
    }

    #[tokio::test]
    async fn rejects_wrong_content_type() {
        let res = app()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/echo")
                    .header(header::CONTENT_TYPE, "text/plain")
                    .body(Body::from(r#"{"name":"x"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_opaque_rejection(res).await;
    }

    #[tokio::test]
    async fn rejects_type_mismatch() {
        let res = app()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/echo")
                    .header(header::CONTENT_TYPE, "application/json")
                    .body(Body::from(r#"{"name":42}"#))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_opaque_rejection(res).await;
    }
}
