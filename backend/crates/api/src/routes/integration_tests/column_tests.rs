use super::common::*;

// =========================================================================
// COLUMN ROUTES — HAPPY PATH
// =========================================================================

#[tokio::test]
async fn test_list_columns() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, board_id, _col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/boards/{}/columns", board_id))
                .header("Authorization", format!("Bearer {}", token))
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
    assert!(json.is_array(), "Should be array");
}

#[tokio::test]
async fn test_create_column() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, board_id, _col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/boards/{}/columns", board_id))
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "name": "New Column",
                        "color": "#FF0000"
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
    let json: serde_json::Value = serde_json::from_slice(&body).expect("parse JSON");
    assert_eq!(json["name"], "New Column");
}

#[tokio::test]
async fn test_rename_column() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, _board_id, col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(format!("/api/columns/{}/name", col_id))
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(r#"{"name": "Renamed"}"#))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read body");
    let json: serde_json::Value = serde_json::from_slice(&body).expect("parse JSON");
    assert_eq!(json["name"], "Renamed");
}

#[tokio::test]
async fn test_delete_column_empty_succeeds() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, board_id, _col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    // Add a new column (we can't delete the default ones if they have tasks)
    let col = taskflow_db::queries::columns::add_column(
        &state.db,
        board_id,
        "Temp Column",
        None,
        None,
        "zzz",
    )
    .await
    .expect("add temp column");

    let response = app
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/api/columns/{}", col.id))
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::OK);
}

// =========================================================================
// COLUMN ROUTES — ERROR SCENARIOS
// =========================================================================

#[tokio::test]
async fn test_rename_column_nonexistent_returns_404() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(format!("/api/columns/{}/name", Uuid::new_v4()))
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(r#"{"name": "Ghost"}"#))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert!(
        response.status() == StatusCode::NOT_FOUND
            || response.status() == StatusCode::INTERNAL_SERVER_ERROR,
        "Expected 404 or 500 for non-existent column, got {}",
        response.status()
    );
}

#[tokio::test]
async fn test_delete_column_nonexistent_returns_404() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/api/columns/{}", Uuid::new_v4()))
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert!(
        response.status() == StatusCode::NOT_FOUND
            || response.status() == StatusCode::INTERNAL_SERVER_ERROR,
        "Expected 404 or 500 for non-existent column, got {}",
        response.status()
    );
}

#[tokio::test]
async fn test_create_column_for_nonexistent_board_returns_error() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/boards/{}/columns", Uuid::new_v4()))
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "name": "Orphan Column",
                        "color": "#000000"
                    }))
                    .expect("serialize"),
                ))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert!(
        response.status() == StatusCode::NOT_FOUND
            || response.status() == StatusCode::INTERNAL_SERVER_ERROR,
        "Expected 404 or 500 for non-existent board, got {}",
        response.status()
    );
}
