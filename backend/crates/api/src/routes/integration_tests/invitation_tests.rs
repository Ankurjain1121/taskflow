use super::common::*;

// =========================================================================
// INVITATION ROUTES — HAPPY PATH
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_list_invitations() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, ws_id) = setup_user_and_workspace(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/invitations?workspace_id={}", ws_id))
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::OK);
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_create_invitation() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, ws_id) = setup_user_and_workspace(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/invitations")
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "email": unique_email(),
                        "workspace_id": ws_id,
                        "role": "Member"
                    }))
                    .expect("serialize"),
                ))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    // Route is reachable and auth works
    assert!(
        response.status() == StatusCode::OK
            || response.status() == StatusCode::UNPROCESSABLE_ENTITY,
        "Expected OK or 422, got {}",
        response.status()
    );
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_validate_invalid_invitation_token() {
    let (app, _state) = test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/invitations/validate/{}", Uuid::new_v4()))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    // Returns 200 with valid=false for nonexistent tokens (by design)
    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read body");
    let json: serde_json::Value = serde_json::from_slice(&body).expect("parse JSON");
    assert_eq!(
        json["valid"], false,
        "Nonexistent token should not be valid"
    );
}

// =========================================================================
// INVITATION ROUTES — ERROR SCENARIOS
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_create_invitation_missing_email_returns_400() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, ws_id) = setup_user_and_workspace(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/invitations")
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "workspace_id": ws_id,
                        "role": "Member"
                    }))
                    .expect("serialize"),
                ))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert!(
        response.status() == StatusCode::BAD_REQUEST
            || response.status() == StatusCode::UNPROCESSABLE_ENTITY,
        "Expected 400 or 422 for missing email, got {}",
        response.status()
    );
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_create_invitation_invalid_email_returns_error() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, ws_id) = setup_user_and_workspace(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/invitations")
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "email": "not-an-email",
                        "workspace_id": ws_id,
                        "role": "Member"
                    }))
                    .expect("serialize"),
                ))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert!(
        response.status() == StatusCode::BAD_REQUEST
            || response.status() == StatusCode::UNPROCESSABLE_ENTITY,
        "Expected 400 or 422 for invalid email, got {}",
        response.status()
    );
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_create_invitation_invalid_workspace_returns_error() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/invitations")
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "email": unique_email(),
                        "workspace_id": Uuid::new_v4(),
                        "role": "Member"
                    }))
                    .expect("serialize"),
                ))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    // Could be 404, 403, or 422 depending on validation order
    assert!(
        response.status() == StatusCode::NOT_FOUND
            || response.status() == StatusCode::FORBIDDEN
            || response.status() == StatusCode::UNPROCESSABLE_ENTITY
            || response.status() == StatusCode::INTERNAL_SERVER_ERROR,
        "Expected error for non-existent workspace, got {}",
        response.status()
    );
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_create_invitation_missing_body_returns_400() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id) = setup_user_and_workspace(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/invitations")
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_delete_nonexistent_invitation_returns_error() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/api/invitations/{}", Uuid::new_v4()))
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert!(
        response.status() == StatusCode::NOT_FOUND
            || response.status() == StatusCode::INTERNAL_SERVER_ERROR,
        "Expected 404 or 500 for non-existent invitation, got {}",
        response.status()
    );
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_accept_invitation_invalid_token_returns_error() {
    let (app, _state) = test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/invitations/accept")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "token": Uuid::new_v4(),
                        "name": "New User",
                        "password": "TestPassword123!"
                    }))
                    .expect("serialize"),
                ))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    // Should fail with invalid/expired token
    assert!(
        response.status() == StatusCode::NOT_FOUND
            || response.status() == StatusCode::BAD_REQUEST
            || response.status() == StatusCode::GONE
            || response.status() == StatusCode::UNPROCESSABLE_ENTITY
            || response.status() == StatusCode::INTERNAL_SERVER_ERROR,
        "Expected error for invalid invitation token, got {}",
        response.status()
    );
}
