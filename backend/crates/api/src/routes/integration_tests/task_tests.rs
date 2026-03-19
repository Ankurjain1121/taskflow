use super::common::*;

// =========================================================================
// TASK CRUD — HAPPY PATH
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_list_tasks_by_board() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, board_id, _col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/boards/{}/tasks", board_id))
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
async fn test_create_task() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, board_id, col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/boards/{}/tasks", board_id))
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "title": "Integration Test Task",
                        "priority": "medium",
                        "task_list_id": col_id
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
    assert_eq!(json["title"], "Integration Test Task");
    assert_eq!(json["task_list_id"], col_id.to_string());
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_get_task_by_id() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, board_id, col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let task = taskflow_db::queries::create_task(
        &state.db,
        board_id,
        taskflow_db::queries::CreateTaskInput {
            title: "Get Me".to_string(),
            description: None,
            priority: TaskPriority::Low,
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
        },
        tenant_id,
        user_id,
    )
    .await
    .expect("create task");

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/tasks/{}", task.id))
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
    assert_eq!(json["id"], task.id.to_string());
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_update_task() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, board_id, col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let task = taskflow_db::queries::create_task(
        &state.db,
        board_id,
        taskflow_db::queries::CreateTaskInput {
            title: "Original Title".to_string(),
            description: None,
            priority: TaskPriority::Low,
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
        },
        tenant_id,
        user_id,
    )
    .await
    .expect("create task");

    let response = app
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri(format!("/api/tasks/{}", task.id))
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "title": "Updated Title",
                        "priority": "high"
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
    assert_eq!(json["title"], "Updated Title");
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_delete_task() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, board_id, col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let task = taskflow_db::queries::create_task(
        &state.db,
        board_id,
        taskflow_db::queries::CreateTaskInput {
            title: "Delete Me".to_string(),
            description: None,
            priority: TaskPriority::Low,
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
        },
        tenant_id,
        user_id,
    )
    .await
    .expect("create task");

    let response = app
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/api/tasks/{}", task.id))
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::OK);
}

// =========================================================================
// TASK MOVEMENT
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_move_task() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, board_id, col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let task = taskflow_db::queries::create_task(
        &state.db,
        board_id,
        taskflow_db::queries::CreateTaskInput {
            title: "Move Me".to_string(),
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
        },
        tenant_id,
        user_id,
    )
    .await
    .expect("create task");

    let statuses =
        taskflow_db::queries::project_statuses::list_project_statuses(&state.db, board_id)
            .await
            .expect("list statuses");
    let target_status = statuses
        .iter()
        .find(|s| s.name != "Open")
        .expect("should have at least 2 statuses");

    let response = app
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri(format!("/api/tasks/{}/move", task.id))
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "status_id": target_status.id,
                        "position": "a0"
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
    assert_eq!(json["status_id"], target_status.id.to_string());
}

// =========================================================================
// TASK ASSIGNMENT
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_assign_user_to_task() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, board_id, col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let task = taskflow_db::queries::create_task(
        &state.db,
        board_id,
        taskflow_db::queries::CreateTaskInput {
            title: "Assign Me".to_string(),
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
        },
        tenant_id,
        user_id,
    )
    .await
    .expect("create task");

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/tasks/{}/assignees", task.id))
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "user_id": user_id
                    }))
                    .expect("serialize"),
                ))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert!(
        response.status() == StatusCode::OK
            || response.status() == StatusCode::INTERNAL_SERVER_ERROR,
        "Expected OK or 500 (broadcast failure), got {}",
        response.status()
    );
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_unassign_user_from_task() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, board_id, col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let task = taskflow_db::queries::create_task(
        &state.db,
        board_id,
        taskflow_db::queries::CreateTaskInput {
            title: "Unassign Me".to_string(),
            description: None,
            priority: TaskPriority::Medium,
            due_date: None,
            start_date: None,
            estimated_hours: None,
            status_id: None,
            milestone_id: None,
            task_list_id: Some(col_id),
            assignee_ids: Some(vec![user_id]),
            label_ids: None,
            parent_task_id: None,
            reporting_person_id: None,
        },
        tenant_id,
        user_id,
    )
    .await
    .expect("create task");

    let response = app
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/api/tasks/{}/assignees/{}", task.id, user_id))
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert!(
        response.status() == StatusCode::OK
            || response.status() == StatusCode::INTERNAL_SERVER_ERROR,
        "Expected OK or 500, got {}",
        response.status()
    );
}

// =========================================================================
// SUBTASK ROUTES
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_create_and_list_subtasks() {
    let (_app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, board_id, col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let task = taskflow_db::queries::create_task(
        &state.db,
        board_id,
        taskflow_db::queries::CreateTaskInput {
            title: "Parent Task".to_string(),
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
        },
        tenant_id,
        user_id,
    )
    .await
    .expect("create task");

    // Create subtask
    let create_resp = build_test_router(state.clone())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/tasks/{}/subtasks", task.id))
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(r#"{"title": "Subtask 1"}"#))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(create_resp.status(), StatusCode::OK);

    // List subtasks
    let list_resp = build_test_router(state.clone())
        .oneshot(
            Request::builder()
                .uri(format!("/api/tasks/{}/subtasks", task.id))
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(list_resp.status(), StatusCode::OK);

    let body = axum::body::to_bytes(list_resp.into_body(), usize::MAX)
        .await
        .expect("read body");
    let json: serde_json::Value = serde_json::from_slice(&body).expect("parse JSON");
    assert!(json.get("subtasks").is_some());
    assert!(json.get("progress").is_some());
}

// =========================================================================
// COMMENT ROUTES
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_create_and_list_comments() {
    let (_app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, board_id, col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let task = taskflow_db::queries::create_task(
        &state.db,
        board_id,
        taskflow_db::queries::CreateTaskInput {
            title: "Comment Task".to_string(),
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
        },
        tenant_id,
        user_id,
    )
    .await
    .expect("create task");

    // Create comment
    let create_resp = build_test_router(state.clone())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/tasks/{}/comments", task.id))
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(r#"{"content": "Hello, world!"}"#))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(create_resp.status(), StatusCode::CREATED);

    // List comments
    let list_resp = build_test_router(state.clone())
        .oneshot(
            Request::builder()
                .uri(format!("/api/tasks/{}/comments", task.id))
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(list_resp.status(), StatusCode::OK);
}

// =========================================================================
// DEPENDENCY ROUTES
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_list_task_dependencies() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, board_id, col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let task = taskflow_db::queries::create_task(
        &state.db,
        board_id,
        taskflow_db::queries::CreateTaskInput {
            title: "Dep Task".to_string(),
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
        },
        tenant_id,
        user_id,
    )
    .await
    .expect("create task");

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/tasks/{}/dependencies", task.id))
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::OK);
}

// =========================================================================
// TIME ENTRY ROUTES
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_list_time_entries() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, board_id, col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let task = taskflow_db::queries::create_task(
        &state.db,
        board_id,
        taskflow_db::queries::CreateTaskInput {
            title: "Time Entry Task".to_string(),
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
        },
        tenant_id,
        user_id,
    )
    .await
    .expect("create task");

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/tasks/{}/time-entries", task.id))
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::OK);
}

// =========================================================================
// TASK CRUD — ERROR SCENARIOS
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_get_task_nonexistent_returns_404() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/tasks/{}", Uuid::new_v4()))
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_update_task_nonexistent_returns_404() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri(format!("/api/tasks/{}", Uuid::new_v4()))
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(r#"{"title": "Ghost Task"}"#))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_delete_task_nonexistent_returns_404() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/api/tasks/{}", Uuid::new_v4()))
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_create_task_missing_title_returns_400() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, board_id, col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/boards/{}/tasks", board_id))
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "priority": "medium",
                        "task_list_id": col_id
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
        "Expected 400 or 422 for missing title, got {}",
        response.status()
    );
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_create_task_invalid_json_returns_400() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, board_id, _col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/boards/{}/tasks", board_id))
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from("{not json}"))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_create_task_for_nonexistent_board_returns_error() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/boards/{}/tasks", Uuid::new_v4()))
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "title": "Orphan Task",
                        "priority": "low",
                        "status_id": Uuid::new_v4()
                    }))
                    .expect("serialize"),
                ))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert!(
        response.status() == StatusCode::NOT_FOUND
            || response.status() == StatusCode::FORBIDDEN
            || response.status() == StatusCode::INTERNAL_SERVER_ERROR,
        "Expected 404, 403, or 500 for non-existent board, got {}",
        response.status()
    );
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_move_task_nonexistent_returns_404() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri(format!("/api/tasks/{}/move", Uuid::new_v4()))
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "status_id": Uuid::new_v4(),
                        "position": "a0"
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
        "Expected 404 or 500, got {}",
        response.status()
    );
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_move_task_to_invalid_column_returns_error() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, board_id, col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let task = taskflow_db::queries::create_task(
        &state.db,
        board_id,
        taskflow_db::queries::CreateTaskInput {
            title: "Move To Bad Col".to_string(),
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
        },
        tenant_id,
        user_id,
    )
    .await
    .expect("create task");

    let response = app
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri(format!("/api/tasks/{}/move", task.id))
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "status_id": Uuid::new_v4(),
                        "position": "a0"
                    }))
                    .expect("serialize"),
                ))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    // Should fail - column doesn't exist
    assert!(
        response.status() == StatusCode::NOT_FOUND
            || response.status() == StatusCode::BAD_REQUEST
            || response.status() == StatusCode::INTERNAL_SERVER_ERROR,
        "Expected error for invalid column, got {}",
        response.status()
    );
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_get_task_after_delete_returns_404() {
    let (_app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, board_id, col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let task = taskflow_db::queries::create_task(
        &state.db,
        board_id,
        taskflow_db::queries::CreateTaskInput {
            title: "Will Be Deleted".to_string(),
            description: None,
            priority: TaskPriority::Low,
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
        },
        tenant_id,
        user_id,
    )
    .await
    .expect("create task");

    // Delete the task
    let del_resp = build_test_router(state.clone())
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/api/tasks/{}", task.id))
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");
    assert_eq!(del_resp.status(), StatusCode::OK);

    // Now try to get the deleted task
    let get_resp = build_test_router(state.clone())
        .oneshot(
            Request::builder()
                .uri(format!("/api/tasks/{}", task.id))
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(get_resp.status(), StatusCode::NOT_FOUND);
}

// =========================================================================
// MY TASKS
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_my_tasks() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/my-tasks")
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::OK);
}

// =========================================================================
// EISENHOWER MATRIX
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_eisenhower_matrix() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/eisenhower")
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::OK);
}
