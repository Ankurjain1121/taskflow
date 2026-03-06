use super::common::*;

// =========================================================================
// project ROUTES — HAPPY PATH
// =========================================================================

#[tokio::test]
async fn test_list_boards_for_workspace() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, ws_id) = setup_user_and_workspace(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/workspaces/{}/projects", ws_id))
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_create_board() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, ws_id) = setup_user_and_workspace(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/workspaces/{}/projects", ws_id))
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "name": "Test Project"
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
    assert_eq!(json["name"], "Test Project");
    assert!(json.get("columns").is_some(), "Project should have columns");
}

#[tokio::test]
async fn test_get_board_by_id() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, project_id, _col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/projects/{}", project_id))
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
    assert_eq!(json["id"], project_id.to_string());
}

#[tokio::test]
async fn test_update_board() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, project_id, _col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(format!("/api/projects/{}", project_id))
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "name": "Renamed Project",
                        "description": "New desc"
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
    assert_eq!(json["name"], "Renamed Project");
}

#[tokio::test]
async fn test_delete_board() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, project_id, _col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/api/projects/{}", project_id))
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_get_board_full() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, project_id, _col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/projects/{}/full", project_id))
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
    assert!(json.get("project").is_some(), "Should have 'board'");
    assert!(json.get("tasks").is_some(), "Should have 'tasks'");
    assert!(json.get("members").is_some(), "Should have 'members'");
}

#[tokio::test]
async fn test_list_project_members() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, project_id, _col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/projects/{}/members", project_id))
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
    assert!(
        !json.as_array().expect("array").is_empty(),
        "Should have at least creator as member"
    );
}

#[tokio::test]
async fn test_board_templates_list() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/board-templates")
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
    assert!(json.is_array(), "Templates should be array");
}

// =========================================================================
// project ROUTES — ERROR SCENARIOS
// =========================================================================

#[tokio::test]
async fn test_create_board_empty_name_returns_400() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, ws_id) = setup_user_and_workspace(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/workspaces/{}/projects", ws_id))
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(r#"{"name": ""}"#))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_get_board_nonexistent_returns_404() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/projects/{}", Uuid::new_v4()))
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_create_board_invalid_workspace_returns_error() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/workspaces/{}/projects", Uuid::new_v4()))
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(r#"{"name": "Orphan Project"}"#))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    // Should be 404 or 403 depending on auth check order
    assert!(
        response.status() == StatusCode::NOT_FOUND
            || response.status() == StatusCode::FORBIDDEN
            || response.status() == StatusCode::INTERNAL_SERVER_ERROR,
        "Expected 404/403/500 for non-existent workspace, got {}",
        response.status()
    );
}

#[tokio::test]
async fn test_create_board_missing_body_returns_400() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, ws_id) = setup_user_and_workspace(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/workspaces/{}/projects", ws_id))
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_create_board_invalid_json_returns_400() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, ws_id) = setup_user_and_workspace(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/workspaces/{}/projects", ws_id))
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from("{invalid json"))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_update_board_nonexistent_returns_404() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(format!("/api/projects/{}", Uuid::new_v4()))
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(r#"{"name": "Ghost Project"}"#))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_delete_board_nonexistent_returns_404() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/api/projects/{}", Uuid::new_v4()))
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_get_board_full_nonexistent_returns_404() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/projects/{}/full", Uuid::new_v4()))
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_list_project_members_nonexistent_board() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/projects/{}/members", Uuid::new_v4()))
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    // Project members for non-existent project: could be 404 or empty array
    assert!(
        response.status() == StatusCode::NOT_FOUND || response.status() == StatusCode::OK,
        "Expected 404 or 200 (empty), got {}",
        response.status()
    );
}

// =========================================================================
// project SHARE ROUTES
// =========================================================================

#[tokio::test]
async fn test_list_project_shares() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, project_id, _col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/projects/{}/shares", project_id))
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::OK);
}

// =========================================================================
// REPORTS, WEBHOOKS, AUTOMATIONS
// =========================================================================

#[tokio::test]
async fn test_reports_board_auth_required() {
    let (app, _state) = test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/projects/{}/reports", Uuid::new_v4()))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_reports_board_returns_data() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, project_id, _col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/projects/{}/reports", project_id))
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_list_webhooks() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, project_id, _col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/projects/{}/webhooks", project_id))
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_list_automations() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, project_id, _col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/projects/{}/automations", project_id))
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::OK);
}

// =========================================================================
// MILESTONE ROUTES
// =========================================================================

#[tokio::test]
async fn test_list_milestones() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, project_id, _col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/projects/{}/milestones", project_id))
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_create_milestone() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, project_id, _col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/projects/{}/milestones", project_id))
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "name": "v1.0 Release"
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
// CUSTOM FIELDS
// =========================================================================

#[tokio::test]
async fn test_list_custom_fields() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, project_id, _col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/projects/{}/custom-fields", project_id))
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::OK);
}

// =========================================================================
// TASK GROUPS
// =========================================================================

#[tokio::test]
async fn test_list_task_groups() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, project_id, _col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/projects/{}/groups", project_id))
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::OK);
}
