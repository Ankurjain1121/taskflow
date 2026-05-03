//! Integration tests for GET /api/integrations/twenty/health
//!
//! These tests exercise the full Axum router (auth middleware, CSRF, handler)
//! and require a live PostgreSQL + Redis instance reachable via DATABASE_URL /
//! REDIS_URL (or the defaults in test_helpers::test_config).
//!
//! Run with: cargo test -- --ignored twenty_health

use axum::body::Body;
use axum::http::{Request, StatusCode};
use taskbolt_api::test_helpers::helpers::{
    setup_user, test_app, test_jwt_token, test_jwt_token_with_role,
};
use taskbolt_db::models::UserRole;
use tower::ServiceExt;

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn twenty_health_requires_admin() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;

    // Create token for a non-admin user (default role is Member)
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/integrations/twenty/health")
                .header("Cookie", format!("access_token={}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    // Non-admin should get 403 Forbidden
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn twenty_health_requires_auth() {
    let (app, _state) = test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/integrations/twenty/health")
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    // No auth should get 401 Unauthorized
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn twenty_health_admin_access() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;

    let token = test_jwt_token_with_role(&state, user_id, tenant_id, UserRole::Admin);

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/integrations/twenty/health")
                .header("Cookie", format!("access_token={}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    // Admin should either get 200 or 503 (depending on Twenty availability)
    let status = response.status().as_u16();
    assert!(
        status == 200 || status == 503,
        "Expected 200 or 503, got {}",
        status
    );

    if status == 200 {
        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let json: serde_json::Value = serde_json::from_slice(&body).expect("parse JSON");

        // Response shape: { twenty_reachable: bool, last_sync_at: Option<String>, api_key_valid: bool }
        assert!(
            json["twenty_reachable"].is_boolean(),
            "twenty_reachable should be boolean"
        );
        assert!(
            json["api_key_valid"].is_boolean(),
            "api_key_valid should be boolean"
        );
    }
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn twenty_health_response_shape() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token_with_role(&state, user_id, tenant_id, UserRole::Admin);

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/integrations/twenty/health")
                .header("Cookie", format!("access_token={}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    let status = response.status().as_u16();
    assert!(
        status == 200 || status == 503,
        "Expected 200 or 503, got {}",
        status
    );

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read body");
    let json: serde_json::Value = serde_json::from_slice(&body).expect("parse JSON");

    assert!(json.is_object(), "Response should be an object");
    assert!(
        json["twenty_reachable"].is_boolean(),
        "twenty_reachable should exist and be boolean"
    );
    assert!(
        json["api_key_valid"].is_boolean(),
        "api_key_valid should exist and be boolean"
    );
    assert!(
        json["last_sync_at"].is_null() || json["last_sync_at"].is_string(),
        "last_sync_at should be null or string"
    );
}
