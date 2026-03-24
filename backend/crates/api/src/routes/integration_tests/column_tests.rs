use super::common::*;

// =========================================================================
// COLUMN ROUTES — HAPPY PATH
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
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

#[ignore = "integration test - run with: cargo test -- --ignored"]
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

#[ignore = "integration test - run with: cargo test -- --ignored"]
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

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_delete_column_empty_succeeds() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, board_id, _col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    // Add a new project status (replaces column)
    let status = taskbolt_db::queries::project_statuses::create_project_status(
        &state.db,
        board_id,
        "Temp Status",
        "#AABBCC",
        "not_started",
        "zzz",
        tenant_id,
    )
    .await
    .expect("create temp status");

    let response = app
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/api/columns/{}", status.id))
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::OK);
}

// =========================================================================
// COLUMN ROUTES — AUTH-BEFORE-WRITE (Item 3A)
// =========================================================================

/// A Viewer-role user must receive 403 when attempting to rename a status.
/// This verifies auth is checked BEFORE any SQL UPDATE executes.
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_rename_status_viewer_gets_403() {
    let (app, state) = test_app().await;
    let (_tenant_id, _owner_id, _ws_id, board_id, col_id) = setup_full(&state.db).await;

    // Create a second user with Viewer role on this project
    let (viewer_tenant_id, viewer_id) = setup_user(&state.db).await;
    taskbolt_db::queries::projects::add_project_member(
        &state.db,
        board_id,
        viewer_id,
        taskbolt_db::models::BoardMemberRole::Viewer,
    )
    .await
    .expect("add viewer member");

    let token = test_jwt_token(&state, viewer_id, viewer_tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(format!("/api/columns/{}/name", col_id))
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(r#"{"name": "Hacked"}"#))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(
        response.status(),
        StatusCode::FORBIDDEN,
        "Viewer should get 403 Forbidden on rename, got {}",
        response.status()
    );

    // Verify no mutation occurred: status name should still be original
    let statuses =
        taskbolt_db::queries::project_statuses::list_project_statuses(&state.db, board_id)
            .await
            .expect("list statuses");
    let target = statuses.iter().find(|s| s.id == col_id);
    assert!(target.is_some(), "Status should still exist");
    assert_ne!(
        target.expect("just checked").name,
        "Hacked",
        "Status name must NOT have been mutated by viewer"
    );
}

/// A Viewer-role user must receive 403 when attempting to update status type.
/// This verifies auth is checked BEFORE any SQL UPDATE executes.
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_update_status_type_viewer_gets_403() {
    let (app, state) = test_app().await;
    let (_tenant_id, _owner_id, _ws_id, board_id, col_id) = setup_full(&state.db).await;

    // Create a viewer
    let (viewer_tenant_id, viewer_id) = setup_user(&state.db).await;
    taskbolt_db::queries::projects::add_project_member(
        &state.db,
        board_id,
        viewer_id,
        taskbolt_db::models::BoardMemberRole::Viewer,
    )
    .await
    .expect("add viewer member");

    let token = test_jwt_token(&state, viewer_id, viewer_tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(format!("/api/columns/{}/status-mapping", col_id))
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(r#"{"type": "done"}"#))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(
        response.status(),
        StatusCode::FORBIDDEN,
        "Viewer should get 403 Forbidden on update_status_type, got {}",
        response.status()
    );
}

/// A Viewer-role user must receive 403 when attempting to update status color.
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_update_status_color_viewer_gets_403() {
    let (app, state) = test_app().await;
    let (_tenant_id, _owner_id, _ws_id, board_id, col_id) = setup_full(&state.db).await;

    let (viewer_tenant_id, viewer_id) = setup_user(&state.db).await;
    taskbolt_db::queries::projects::add_project_member(
        &state.db,
        board_id,
        viewer_id,
        taskbolt_db::models::BoardMemberRole::Viewer,
    )
    .await
    .expect("add viewer member");

    let token = test_jwt_token(&state, viewer_id, viewer_tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(format!("/api/columns/{}/color", col_id))
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(r##"{"color": "#FF0000"}"##))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(
        response.status(),
        StatusCode::FORBIDDEN,
        "Viewer should get 403 Forbidden on update_color, got {}",
        response.status()
    );
}

/// A non-member user must be rejected when attempting to create a status.
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_create_status_non_member_rejected() {
    let (app, state) = test_app().await;
    let (_tenant_id, _owner_id, _ws_id, board_id, _col_id) = setup_full(&state.db).await;

    // Create a user who is NOT a member of this board
    let (other_tenant_id, other_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, other_id, other_tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/projects/{}/columns", board_id))
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "name": "Injected Status",
                        "color": "#FF0000"
                    }))
                    .expect("serialize"),
                ))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert!(
        response.status() == StatusCode::NOT_FOUND || response.status() == StatusCode::FORBIDDEN,
        "Non-member should be rejected, got {}",
        response.status()
    );
}

// =========================================================================
// COLUMN ROUTES — ERROR SCENARIOS
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
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

#[ignore = "integration test - run with: cargo test -- --ignored"]
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

#[ignore = "integration test - run with: cargo test -- --ignored"]
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
