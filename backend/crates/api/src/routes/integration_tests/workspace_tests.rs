use super::common::*;

// =========================================================================
// WORKSPACE ROUTES — HAPPY PATH
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_list_workspaces_empty() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

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

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read body");
    let json: serde_json::Value = serde_json::from_slice(&body).expect("parse JSON");
    assert!(json.is_array(), "Expected JSON array");
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_create_workspace() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/workspaces")
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "name": "Test Workspace",
                        "description": "A test workspace"
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
    assert_eq!(json["name"], "Test Workspace");
    assert!(json.get("id").is_some(), "Response should have 'id'");
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_get_workspace_by_id() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, ws_id) = setup_user_and_workspace(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/workspaces/{}", ws_id))
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
    assert_eq!(json["id"], ws_id.to_string());
    assert!(json.get("members").is_some(), "Should include members list");
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_update_workspace() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, ws_id) = setup_user_and_workspace(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(format!("/api/workspaces/{}", ws_id))
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "name": "Updated WS Name",
                        "description": "Updated description"
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
    assert_eq!(json["name"], "Updated WS Name");
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_delete_workspace() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, ws_id) = setup_user_and_workspace(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/api/workspaces/{}", ws_id))
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::OK);
}

// =========================================================================
// WORKSPACE ROUTES — ERROR SCENARIOS
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_create_workspace_empty_name_returns_400() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/workspaces")
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(r#"{"name": ""}"#))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_workspace_member_role_enforcement() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, ws_id) = setup_user_and_workspace(&state.db).await;
    // Member role cannot update workspace
    let token = test_jwt_token_with_role(&state, user_id, tenant_id, UserRole::Member);

    let response = app
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(format!("/api/workspaces/{}", ws_id))
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(r#"{"name": "Should Fail"}"#))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_get_workspace_nonexistent_returns_404() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/workspaces/{}", Uuid::new_v4()))
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert!(
        response.status() == StatusCode::NOT_FOUND || response.status() == StatusCode::FORBIDDEN,
        "Expected 404 or 403 for non-existent workspace, got {}",
        response.status()
    );
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_update_workspace_nonexistent_returns_404() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(format!("/api/workspaces/{}", Uuid::new_v4()))
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(r#"{"name": "Phantom"}"#))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    // Should be 404 or 403 depending on authorization check order
    assert!(
        response.status() == StatusCode::NOT_FOUND || response.status() == StatusCode::FORBIDDEN,
        "Expected 404 or 403, got {}",
        response.status()
    );
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_delete_workspace_nonexistent_returns_404() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/api/workspaces/{}", Uuid::new_v4()))
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert!(
        response.status() == StatusCode::NOT_FOUND || response.status() == StatusCode::FORBIDDEN,
        "Expected 404 or 403, got {}",
        response.status()
    );
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_create_workspace_missing_body_returns_400() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/workspaces")
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
async fn test_create_workspace_invalid_json_returns_400() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/workspaces")
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from("not valid json"))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

// =========================================================================
// FIX #8: workspace add_member self-reject
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_add_member_self_rejected() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, ws_id) = setup_user_and_workspace(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/workspaces/{}/members", ws_id))
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "user_id": user_id,
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
// NEW: GET /api/workspaces/:id/members/addable
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_addable_members_excludes_existing() {
    let (app, state) = test_app().await;
    let (tenant_id, owner_id, ws_id) = setup_user_and_workspace(&state.db).await;

    // Same-tenant user NOT in workspace
    let outsider_id = Uuid::new_v4();
    let outsider_email = unique_email();
    sqlx::query(
        r"INSERT INTO users (id, email, name, password_hash, role, tenant_id, onboarding_completed, created_at, updated_at)
          VALUES ($1, $2, 'Outsider', '$argon2id$dummy', 'member', $3, true, NOW(), NOW())",
    )
    .bind(outsider_id)
    .bind(&outsider_email)
    .bind(tenant_id)
    .execute(&state.db)
    .await
    .expect("create outsider");

    let token = test_jwt_token(&state, owner_id, tenant_id);
    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/workspaces/{}/members/addable", ws_id))
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
    let users: Vec<serde_json::Value> = serde_json::from_slice(&body).expect("parse");
    let ids: Vec<String> = users
        .iter()
        .filter_map(|u| u["id"].as_str().map(String::from))
        .collect();
    assert!(
        ids.contains(&outsider_id.to_string()),
        "outsider should be addable, got: {:?}",
        ids
    );
    assert!(
        !ids.contains(&owner_id.to_string()),
        "current ws member must not appear, got: {:?}",
        ids
    );
}
