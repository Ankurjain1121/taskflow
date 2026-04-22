use super::common::*;

// =========================================================================
// FILTER PRESETS — LIST
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_list_presets_empty_returns_ok() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, board_id, _col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/projects/{}/filter-presets", board_id))
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
    assert!(json.is_array(), "presets response should be a JSON array");
    assert_eq!(
        json.as_array().expect("array").len(),
        0,
        "new project should have zero presets"
    );
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_list_presets_no_auth_returns_401() {
    let (app, state) = test_app().await;
    let (_tenant_id, _user_id, _ws_id, board_id, _col_id) = setup_full(&state.db).await;

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/projects/{}/filter-presets", board_id))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

// =========================================================================
// FILTER PRESETS — CREATE
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_create_preset_happy_path() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, board_id, _col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/projects/{}/filter-presets", board_id))
                .header("Cookie", format!("access_token={}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "name": "High Priority",
                        "filters": { "priority": ["high"] }
                    }))
                    .expect("serialize"),
                ))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    // Handler returns `Json<FilterPresetResponse>` which is 200 OK (not 201).
    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read body");
    let json: serde_json::Value = serde_json::from_slice(&body).expect("parse JSON");
    assert_eq!(json["name"], "High Priority");
    assert_eq!(json["project_id"], board_id.to_string());
    assert_eq!(json["user_id"], user_id.to_string());
    assert!(json["id"].is_string(), "id should be returned");
    assert_eq!(json["filters"]["priority"][0], "high");
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_create_preset_invalid_body_returns_400() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, board_id, _col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    // Body missing required `filters` field -> StrictJson rejects with 400,
    // or handler rejects empty-name with 400. Either way we expect 400.
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/projects/{}/filter-presets", board_id))
                .header("Cookie", format!("access_token={}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "name": "Missing Filters"
                    }))
                    .expect("serialize"),
                ))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

// =========================================================================
// FILTER PRESETS — UPDATE
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_update_preset_happy_path() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, board_id, _col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    // Create a preset first via the API.
    let create_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/projects/{}/filter-presets", board_id))
                .header("Cookie", format!("access_token={}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "name": "Original Name",
                        "filters": { "assignee": ["me"] }
                    }))
                    .expect("serialize"),
                ))
                .expect("build request"),
        )
        .await
        .expect("create request failed");

    assert_eq!(create_response.status(), StatusCode::OK);
    let create_body = axum::body::to_bytes(create_response.into_body(), usize::MAX)
        .await
        .expect("read create body");
    let created: serde_json::Value =
        serde_json::from_slice(&create_body).expect("parse create JSON");
    let preset_id = created["id"].as_str().expect("preset id").to_string();

    // Now update it.
    let response = app
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(format!(
                    "/api/projects/{}/filter-presets/{}",
                    board_id, preset_id
                ))
                .header("Cookie", format!("access_token={}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "name": "Updated Name",
                        "filters": { "assignee": ["team"] }
                    }))
                    .expect("serialize"),
                ))
                .expect("build request"),
        )
        .await
        .expect("update request failed");

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read body");
    let json: serde_json::Value = serde_json::from_slice(&body).expect("parse JSON");
    assert_eq!(json["id"], preset_id);
    assert_eq!(json["name"], "Updated Name");
    assert_eq!(json["filters"]["assignee"][0], "team");
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_update_preset_nonexistent_returns_404() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, board_id, _col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let fake_preset_id = Uuid::new_v4();

    let response = app
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(format!(
                    "/api/projects/{}/filter-presets/{}",
                    board_id, fake_preset_id
                ))
                .header("Cookie", format!("access_token={}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "name": "Ghost Preset",
                        "filters": {}
                    }))
                    .expect("serialize"),
                ))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

// =========================================================================
// FILTER PRESETS — DELETE
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_delete_preset_happy_path() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, board_id, _col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    // Create a preset first so we have something to delete.
    let create_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/projects/{}/filter-presets", board_id))
                .header("Cookie", format!("access_token={}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "name": "Delete Me",
                        "filters": { "status": ["done"] }
                    }))
                    .expect("serialize"),
                ))
                .expect("build request"),
        )
        .await
        .expect("create request failed");

    assert_eq!(create_response.status(), StatusCode::OK);
    let create_body = axum::body::to_bytes(create_response.into_body(), usize::MAX)
        .await
        .expect("read create body");
    let created: serde_json::Value =
        serde_json::from_slice(&create_body).expect("parse create JSON");
    let preset_id = created["id"].as_str().expect("preset id").to_string();

    // Delete it.
    let response = app
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!(
                    "/api/projects/{}/filter-presets/{}",
                    board_id, preset_id
                ))
                .header("Cookie", format!("access_token={}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("delete request failed");

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read body");
    let json: serde_json::Value = serde_json::from_slice(&body).expect("parse JSON");
    assert!(
        json["message"].is_string(),
        "delete response should include a message"
    );
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_delete_preset_nonexistent_returns_404() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, board_id, _col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let fake_preset_id = Uuid::new_v4();

    let response = app
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!(
                    "/api/projects/{}/filter-presets/{}",
                    board_id, fake_preset_id
                ))
                .header("Cookie", format!("access_token={}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}
