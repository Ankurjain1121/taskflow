use super::common::*;

// =========================================================================
// PERSONAL BOARD — GET /api/my-work/board
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_get_personal_board_happy_path() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/my-work/board")
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

    // Body shape: { backlog: [], today: [], in_progress: [], done: [] }
    assert!(json["backlog"].is_array(), "backlog should be an array");
    assert!(json["today"].is_array(), "today should be an array");
    assert!(
        json["in_progress"].is_array(),
        "in_progress should be an array"
    );
    assert!(json["done"].is_array(), "done should be an array");
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_get_personal_board_no_auth_returns_401() {
    let (app, _state) = test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/my-work/board")
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

// =========================================================================
// PERSONAL BOARD — PUT /api/my-work/board/:task_id
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_move_personal_task_happy_path() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, board_id, col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let task = taskbolt_db::queries::create_task(
        &state.db,
        board_id,
        taskbolt_db::queries::CreateTaskInput {
            title: "Move To Personal".to_string(),
            description: None,
            priority: TaskPriority::Medium,
            due_date: None,
            start_date: None,
            estimated_hours: None,
            status_id: None,
            milestone_id: None,
            task_list_id: Some(col_id),
            assignee_ids: None,
            label_ids: None,
            parent_task_id: None,
            reporting_person_id: None,
            rate_per_hour: None,
            budgeted_hours: None,
            budgeted_hours_threshold: None,
            cost_budget: None,
            cost_budget_threshold: None,
            cost_per_hour: None,
            revenue_budget: None,
        },
        tenant_id,
        user_id,
    )
    .await
    .expect("create task");

    let response = app
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(format!("/api/my-work/board/{}", task.id))
                .header("Cookie", format!("access_token={}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "column_name": "today",
                        "position": 0
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
    assert_eq!(json["message"], "Task moved");
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_move_personal_task_no_auth_returns_401() {
    let (app, _state) = test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(format!("/api/my-work/board/{}", Uuid::new_v4()))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "column_name": "today",
                        "position": 0
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
async fn test_move_personal_task_invalid_body_returns_400() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, _board_id, _col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(format!("/api/my-work/board/{}", Uuid::new_v4()))
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
async fn test_move_personal_task_nonexistent_returns_404() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(format!("/api/my-work/board/{}", Uuid::new_v4()))
                .header("Cookie", format!("access_token={}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "column_name": "today",
                        "position": 0
                    }))
                    .expect("serialize"),
                ))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    // Handler maps TaskNotAccessible -> Forbidden; nonexistent task also triggers this path.
    // Accept 403 or 404 since both indicate "not found / not accessible".
    // TODO: confirm exact status code — handler returns Forbidden for TaskNotAccessible,
    // but some deployments map missing resources to 404.
    assert!(
        response.status() == StatusCode::NOT_FOUND || response.status() == StatusCode::FORBIDDEN,
        "Expected 404 or 403 for nonexistent task, got {}",
        response.status()
    );
}
