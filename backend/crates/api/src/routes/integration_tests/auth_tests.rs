use super::common::*;

// =========================================================================
// AUTH MIDDLEWARE — HAPPY PATH
// =========================================================================

#[tokio::test]
async fn test_protected_route_without_token_returns_401() {
    let (app, _state) = test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/workspaces")
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_protected_route_with_invalid_token_returns_401() {
    let (app, _state) = test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/workspaces")
                .header("Authorization", "Bearer invalid.jwt.token")
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_auth_via_cookie() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/workspaces")
                .header("Cookie", format!("access_token={}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::OK);
}

// =========================================================================
// AUTH MIDDLEWARE — ERROR SCENARIOS
// =========================================================================

#[tokio::test]
async fn test_expired_token_format_returns_401() {
    let (app, _state) = test_app().await;

    // Malformed JWT with correct structure but invalid signature
    let fake_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.\
                      eyJzdWIiOiIxMjM0NTY3ODkwIn0.\
                      dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/workspaces")
                .header("Authorization", format!("Bearer {}", fake_token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_empty_bearer_token_returns_401() {
    let (app, _state) = test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/workspaces")
                .header("Authorization", "Bearer ")
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_missing_bearer_prefix_returns_401() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    // Send token without "Bearer " prefix
    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/workspaces")
                .header("Authorization", token)
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

// =========================================================================
// SESSION ROUTES
// =========================================================================

#[tokio::test]
async fn test_list_sessions() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/users/me/sessions")
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_revoke_nonexistent_session_returns_404() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/api/users/me/sessions/{}", Uuid::new_v4()))
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

// =========================================================================
// USER PREFERENCES ROUTES
// =========================================================================

#[tokio::test]
async fn test_get_user_preferences() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/users/me/preferences")
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_update_user_preferences() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri("/api/users/me/preferences")
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "timezone": "America/New_York",
                        "date_format": "MM/dd/yyyy"
                    }))
                    .expect("serialize"),
                ))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::OK);
}

// =========================================================================
// SECURITY HARDENING TESTS (Session Timeout, CSRF, Rate Limiting)
// =========================================================================

#[tokio::test]
async fn test_csrf_token_provided_in_login_response() {
    let (app, state) = test_app().await;
    let (_tenant_id, _user_id) = setup_user(&state.db).await;

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/sign-in")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "email": "alice@acme.com",
                        "password": "Password123!"
                    }))
                    .expect("serialize"),
                ))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read body");
    let json: serde_json::Value = serde_json::from_slice(&body).expect("parse json");

    // CSRF token should be present in response
    assert!(
        json["csrf_token"].is_string(),
        "CSRF token should be present"
    );
    let csrf_token = json["csrf_token"].as_str().unwrap();
    assert!(!csrf_token.is_empty(), "CSRF token should not be empty");
}

#[tokio::test]
async fn test_session_created_on_login() {
    let (app, state) = test_app().await;
    let (_tenant_id, user_id) = setup_user(&state.db).await;

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/sign-in")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "email": "alice@acme.com",
                        "password": "Password123!"
                    }))
                    .expect("serialize"),
                ))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::OK);

    // Verify session exists in Redis
    let session_key = format!("session:{}", user_id);
    let mut redis_conn = state.redis.clone();
    let exists: bool = redis::cmd("EXISTS")
        .arg(&session_key)
        .query_async(&mut redis_conn)
        .await
        .expect("redis query");

    assert!(exists, "Session should exist in Redis after login");
}

#[tokio::test]
async fn test_session_expiration_returns_401() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    // Manually delete the session to simulate expiration
    let session_key = format!("session:{}", user_id);
    let mut redis_conn = state.redis.clone();
    let _: () = redis::cmd("DEL")
        .arg(&session_key)
        .query_async(&mut redis_conn)
        .await
        .expect("redis delete");

    // Request with expired session should return 401
    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/workspaces")
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}
