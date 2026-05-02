use super::common::*;

// =========================================================================
// WORKSPACE EXPORT — JSON
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_export_json_happy_path() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, ws_id) = setup_user_and_workspace(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/workspaces/{}/export?format=json", ws_id))
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
        json.get("workspace").is_some(),
        "Expected 'workspace' key in export"
    );
    assert_eq!(json["workspace"]["id"], ws_id.to_string());
    assert!(
        json.get("members").is_some_and(serde_json::Value::is_array),
        "Expected 'members' array"
    );
    assert!(
        json.get("boards").is_some_and(serde_json::Value::is_array),
        "Expected 'boards' array"
    );
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_export_json_no_auth_returns_401() {
    let (app, state) = test_app().await;
    let (_tenant_id, _user_id, ws_id) = setup_user_and_workspace(&state.db).await;

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/workspaces/{}/export?format=json", ws_id))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_export_json_nonexistent_workspace_returns_404() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let random_ws = Uuid::new_v4();
    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/workspaces/{}/export?format=json", random_ws))
                .header("Cookie", format!("access_token={}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    // Handler checks workspace membership first, so a nonexistent ws returns 403.
    // Accept either 404 or 403 depending on check ordering.
    assert!(
        response.status() == StatusCode::NOT_FOUND || response.status() == StatusCode::FORBIDDEN,
        "Expected 404 or 403 for non-existent workspace, got {}",
        response.status()
    );
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_export_json_non_member_returns_403() {
    let (app, state) = test_app().await;
    // User #1 owns the workspace
    let (_tenant_id_1, _user_id_1, ws_id) = setup_user_and_workspace(&state.db).await;
    // User #2 is in a separate tenant and is NOT a member of ws_id
    let (tenant_id_2, user_id_2) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id_2, tenant_id_2);

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/workspaces/{}/export?format=json", ws_id))
                .header("Cookie", format!("access_token={}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

// =========================================================================
// WORKSPACE EXPORT — CSV
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_export_csv_happy_path() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, ws_id) = setup_user_and_workspace(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/workspaces/{}/export?format=csv", ws_id))
                .header("Cookie", format!("access_token={}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::OK);

    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    assert!(
        content_type.starts_with("text/csv"),
        "Expected text/csv content-type, got {}",
        content_type
    );

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read body");
    let csv = String::from_utf8(body.to_vec()).expect("CSV body should be UTF-8");
    // Header row should be present
    assert!(
        csv.starts_with("board_name,title,description,priority,status,due_date,created_at"),
        "Expected CSV header row, got: {}",
        csv.lines().next().unwrap_or("")
    );
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_export_csv_no_auth_returns_401() {
    let (app, state) = test_app().await;
    let (_tenant_id, _user_id, ws_id) = setup_user_and_workspace(&state.db).await;

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/workspaces/{}/export?format=csv", ws_id))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}
