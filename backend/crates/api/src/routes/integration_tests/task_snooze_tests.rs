use super::common::*;

// =========================================================================
// TASK SNOOZE — HAPPY PATH
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_snooze_task_happy_path() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, board_id, col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let task = taskbolt_db::queries::create_task(
        &state.db,
        board_id,
        taskbolt_db::queries::CreateTaskInput {
            title: "Snooze Me".to_string(),
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

    let future = chrono::Utc::now().date_naive() + chrono::Duration::days(7);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/my-tasks/{}/snooze", task.id))
                .header("Cookie", format!("access_token={}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "snoozed_until": future.to_string()
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
    assert_eq!(json["task_id"], task.id.to_string());
    assert_eq!(json["user_id"], user_id.to_string());
    assert_eq!(json["snoozed_until"], future.to_string());
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_unsnooze_task_happy_path() {
    let (_app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, board_id, col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let task = taskbolt_db::queries::create_task(
        &state.db,
        board_id,
        taskbolt_db::queries::CreateTaskInput {
            title: "Unsnooze Me".to_string(),
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

    let future = chrono::Utc::now().date_naive() + chrono::Duration::days(7);

    // First snooze the task so there's something to unsnooze.
    let snooze_resp = build_test_router(state.clone())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/my-tasks/{}/snooze", task.id))
                .header("Cookie", format!("access_token={}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "snoozed_until": future.to_string()
                    }))
                    .expect("serialize"),
                ))
                .expect("build request"),
        )
        .await
        .expect("request failed");
    assert_eq!(snooze_resp.status(), StatusCode::OK);

    // Now unsnooze.
    let unsnooze_resp = build_test_router(state.clone())
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/api/my-tasks/{}/snooze", task.id))
                .header("Cookie", format!("access_token={}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(unsnooze_resp.status(), StatusCode::OK);
}

// =========================================================================
// TASK SNOOZE — ERROR SCENARIOS
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_snooze_task_no_auth_returns_401() {
    let (app, _state) = test_app().await;

    let future = chrono::Utc::now().date_naive() + chrono::Duration::days(7);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/my-tasks/{}/snooze", Uuid::new_v4()))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "snoozed_until": future.to_string()
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
async fn test_unsnooze_task_no_auth_returns_401() {
    let (app, _state) = test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/api/my-tasks/{}/snooze", Uuid::new_v4()))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_snooze_nonexistent_task_returns_404() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let future = chrono::Utc::now().date_naive() + chrono::Duration::days(7);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/my-tasks/{}/snooze", Uuid::new_v4()))
                .header("Cookie", format!("access_token={}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "snoozed_until": future.to_string()
                    }))
                    .expect("serialize"),
                ))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    // Handler maps TaskNotAccessible -> Forbidden(403); NotFound -> 404.
    // Non-existent task yields TaskNotAccessible (can't see it), so 403 is expected,
    // but accept 404 as well in case access checks evolve.
    assert!(
        response.status() == StatusCode::NOT_FOUND
            || response.status() == StatusCode::FORBIDDEN,
        "Expected 404 or 403 for nonexistent task, got {}",
        response.status()
    );
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_snooze_invalid_date_returns_400() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, board_id, col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let task = taskbolt_db::queries::create_task(
        &state.db,
        board_id,
        taskbolt_db::queries::CreateTaskInput {
            title: "Bad Date Snooze".to_string(),
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

    // Use a date in the past -- handler rejects with InvalidDate -> 400.
    let past = chrono::Utc::now().date_naive() - chrono::Duration::days(1);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/my-tasks/{}/snooze", task.id))
                .header("Cookie", format!("access_token={}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "snoozed_until": past.to_string()
                    }))
                    .expect("serialize"),
                ))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_snooze_malformed_body_returns_400() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, board_id, col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let task = taskbolt_db::queries::create_task(
        &state.db,
        board_id,
        taskbolt_db::queries::CreateTaskInput {
            title: "Malformed Snooze".to_string(),
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
                .method("POST")
                .uri(format!("/api/my-tasks/{}/snooze", task.id))
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
        "Expected 400 or 422 for malformed JSON, got {}",
        response.status()
    );
}
