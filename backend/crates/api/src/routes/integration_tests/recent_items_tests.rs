use super::common::*;

// =========================================================================
// RECENT ITEMS — GET /api/recent-items
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_list_recent_items_empty_returns_ok() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/recent-items")
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

    // New user — should be an empty array
    assert!(json.is_array(), "response should be an array");
    assert_eq!(json.as_array().expect("array").len(), 0);
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_list_recent_items_no_auth_returns_401() {
    let (app, _state) = test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/recent-items")
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

// =========================================================================
// RECENT ITEMS — POST /api/recent-items
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_upsert_recent_item_happy_path() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, board_id, _col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/recent-items")
                .header("Cookie", format!("access_token={}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "entity_type": "project",
                        "entity_id": board_id
                    }))
                    .expect("serialize"),
                ))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    // Handler returns JSON {"success": true} with 200 OK on success.
    // Allow 201 as well in case the framework or future change returns Created.
    assert!(
        response.status() == StatusCode::OK || response.status() == StatusCode::CREATED,
        "Expected 200 or 201 for happy path, got {}",
        response.status()
    );

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read body");
    let json: serde_json::Value = serde_json::from_slice(&body).expect("parse JSON");
    assert_eq!(json["success"], true);
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_upsert_recent_item_no_auth_returns_401() {
    let (app, _state) = test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/recent-items")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "entity_type": "project",
                        "entity_id": Uuid::new_v4()
                    }))
                    .expect("serialize"),
                ))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_upsert_recent_item_invalid_body_returns_400() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/recent-items")
                .header("Cookie", format!("access_token={}", token))
                .header("Content-Type", "application/json")
                .body(Body::from("{not json}"))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert!(
        response.status() == StatusCode::BAD_REQUEST
            || response.status() == StatusCode::UNPROCESSABLE_ENTITY,
        "Expected 400 or 422 for invalid JSON, got {}",
        response.status()
    );
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_upsert_recent_item_invalid_entity_type_returns_400() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/recent-items")
                .header("Cookie", format!("access_token={}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "entity_type": "not_a_real_entity",
                        "entity_id": Uuid::new_v4()
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
// RECENT ITEMS — WRITE + READ ROUND TRIP
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_upsert_then_list_returns_item() {
    let (_app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, board_id, _col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    // Upsert a recent item (project)
    let upsert_resp = build_test_router(state.clone())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/recent-items")
                .header("Cookie", format!("access_token={}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "entity_type": "project",
                        "entity_id": board_id
                    }))
                    .expect("serialize"),
                ))
                .expect("build request"),
        )
        .await
        .expect("upsert request failed");

    assert!(
        upsert_resp.status() == StatusCode::OK || upsert_resp.status() == StatusCode::CREATED,
        "Expected 200/201 for upsert, got {}",
        upsert_resp.status()
    );

    // List and verify the upserted item is returned
    let list_resp = build_test_router(state.clone())
        .oneshot(
            Request::builder()
                .uri("/api/recent-items")
                .header("Cookie", format!("access_token={}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("list request failed");

    assert_eq!(list_resp.status(), StatusCode::OK);

    let body = axum::body::to_bytes(list_resp.into_body(), usize::MAX)
        .await
        .expect("read body");
    let json: serde_json::Value = serde_json::from_slice(&body).expect("parse JSON");

    let items = json.as_array().expect("response should be an array");
    assert!(
        !items.is_empty(),
        "expected at least one recent item after upsert"
    );

    let found = items
        .iter()
        .any(|item| item["entity_id"].as_str() == Some(board_id.to_string().as_str()));
    assert!(
        found,
        "expected upserted board to appear in recent items list"
    );
}
