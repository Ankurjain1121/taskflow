use super::common::*;

// =========================================================================
// WORKSPACE AUDIT LOG — HAPPY PATH
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_list_audit_log_empty_returns_ok() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, ws_id) = setup_user_and_workspace(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/workspaces/{}/audit-log", ws_id))
                .header("Cookie", format!("access_token={}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read body");
    let json: serde_json::Value = serde_json::from_slice(&body).expect("parse JSON");

    assert!(
        json.get("items").is_some(),
        "Response should include 'items'"
    );
    assert!(json["items"].is_array(), "'items' should be an array");
    assert_eq!(
        json["items"].as_array().unwrap().len(),
        0,
        "Fresh workspace should have empty audit log"
    );
    assert!(
        json.get("next_cursor").is_some(),
        "Response should include 'next_cursor' field"
    );
}

// =========================================================================
// WORKSPACE AUDIT LOG — ERROR SCENARIOS
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_list_audit_log_no_auth_returns_401() {
    let (app, _state) = test_app().await;
    let fake_ws_id = Uuid::new_v4();

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/workspaces/{}/audit-log", fake_ws_id))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_list_audit_log_nonexistent_workspace_returns_404() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);
    let phantom_ws_id = Uuid::new_v4();

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/workspaces/{}/audit-log", phantom_ws_id))
                .header("Cookie", format!("access_token={}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    // Handler returns 403 when caller is not a member of the workspace,
    // which is how a nonexistent workspace presents to the caller.
    assert!(
        response.status() == StatusCode::NOT_FOUND || response.status() == StatusCode::FORBIDDEN,
        "Expected 404 or 403 for nonexistent workspace, got {}",
        response.status()
    );
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_list_audit_log_non_member_returns_403() {
    let (app, state) = test_app().await;
    // Owner creates a workspace
    let (_owner_tenant, _owner_id, ws_id) = setup_user_and_workspace(&state.db).await;
    // A completely separate user (different tenant) attempts to access
    let (outsider_tenant, outsider_id) = setup_user(&state.db).await;
    let outsider_token = test_jwt_token(&state, outsider_id, outsider_tenant);

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/workspaces/{}/audit-log", ws_id))
                .header("Cookie", format!("access_token={}", outsider_token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

// =========================================================================
// WORKSPACE AUDIT ACTIONS
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_list_audit_actions_happy_path() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, ws_id) = setup_user_and_workspace(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/workspaces/{}/audit-log/actions", ws_id))
                .header("Cookie", format!("access_token={}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read body");
    let json: serde_json::Value = serde_json::from_slice(&body).expect("parse JSON");

    assert!(
        json.get("actions").is_some(),
        "Response should include 'actions' field"
    );
    assert!(json["actions"].is_array(), "'actions' should be an array");
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_list_audit_actions_no_auth_returns_401() {
    let (app, _state) = test_app().await;
    let fake_ws_id = Uuid::new_v4();

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/workspaces/{}/audit-log/actions", fake_ws_id))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_list_audit_actions_non_member_returns_403() {
    let (app, state) = test_app().await;
    let (_owner_tenant, _owner_id, ws_id) = setup_user_and_workspace(&state.db).await;
    let (outsider_tenant, outsider_id) = setup_user(&state.db).await;
    let outsider_token = test_jwt_token(&state, outsider_id, outsider_tenant);

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/workspaces/{}/audit-log/actions", ws_id))
                .header("Cookie", format!("access_token={}", outsider_token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}
