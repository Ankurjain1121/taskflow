use super::common::*;

// =========================================================================
// INTEGRATIONS — GET /api/integrations/twenty/health
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_twenty_health_requires_admin() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;

    // Create token for non-admin user
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
async fn test_twenty_health_requires_auth() {
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
async fn test_twenty_health_admin_access() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;

    // Create token for admin user
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
async fn test_twenty_health_response_shape() {
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

    // Should get 200 or 503
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

    // Verify response shape
    assert!(json.is_object(), "Response should be an object");
    assert!(
        json["twenty_reachable"].is_boolean(),
        "twenty_reachable should exist and be boolean"
    );
    assert!(
        json["api_key_valid"].is_boolean(),
        "api_key_valid should exist and be boolean"
    );
    // last_sync_at can be null or a string
    assert!(
        json["last_sync_at"].is_null() || json["last_sync_at"].is_string(),
        "last_sync_at should be null or string"
    );
}
