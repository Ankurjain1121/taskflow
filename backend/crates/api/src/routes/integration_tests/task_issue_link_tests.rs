use super::common::*;
use taskbolt_db::queries::issues::{create_issue, CreateIssueInput};

// =========================================================================
// Helper: create a task + an issue in the same project for happy-path tests
// =========================================================================

async fn setup_task_and_issue(
    state: &crate::state::AppState,
    tenant_id: Uuid,
    user_id: Uuid,
    project_id: Uuid,
    col_id: Uuid,
) -> (Uuid, Uuid) {
    let task = taskbolt_db::queries::create_task(
        &state.db,
        project_id,
        taskbolt_db::queries::CreateTaskInput {
            title: "Link Me".to_string(),
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

    let issue = create_issue(
        &state.db,
        project_id,
        CreateIssueInput {
            title: "Test Issue".to_string(),
            description: None,
            assignee_id: None,
            severity: None,
            classification: None,
            reproducibility: None,
            module: None,
            affected_milestone_id: None,
            release_milestone_id: None,
            due_date: None,
            flag: None,
        },
        tenant_id,
        user_id,
    )
    .await
    .expect("create issue");

    (task.id, issue.id)
}

// =========================================================================
// LINK ISSUE — HAPPY PATH
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_link_issue_to_task_happy_path() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, project_id, col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);
    let (task_id, issue_id) =
        setup_task_and_issue(&state, tenant_id, user_id, project_id, col_id).await;

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/tasks/{}/linked-issues", task_id))
                .header("Cookie", format!("access_token={}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "issue_id": issue_id
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
    assert_eq!(json["success"], true);
}

// =========================================================================
// LINK ISSUE — AUTH / VALIDATION ERRORS
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_link_issue_no_auth_returns_401() {
    let (app, _state) = test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/tasks/{}/linked-issues", Uuid::new_v4()))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "issue_id": Uuid::new_v4()
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
async fn test_link_issue_nonexistent_task_returns_404() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/tasks/{}/linked-issues", Uuid::new_v4()))
                .header("Cookie", format!("access_token={}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "issue_id": Uuid::new_v4()
                    }))
                    .expect("serialize"),
                ))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_link_issue_invalid_body_returns_400() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, project_id, col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let task = taskbolt_db::queries::create_task(
        &state.db,
        project_id,
        taskbolt_db::queries::CreateTaskInput {
            title: "Bad Body Task".to_string(),
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
                .uri(format!("/api/tasks/{}/linked-issues", task.id))
                .header("Cookie", format!("access_token={}", token))
                .header("Content-Type", "application/json")
                // Missing `issue_id` field — strict JSON should reject.
                .body(Body::from(r#"{}"#))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert!(
        response.status() == StatusCode::BAD_REQUEST
            || response.status() == StatusCode::UNPROCESSABLE_ENTITY,
        "Expected 400 or 422 for invalid body, got {}",
        response.status()
    );
}

// =========================================================================
// UNLINK ISSUE
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_unlink_issue_happy_path() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, project_id, col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);
    let (task_id, issue_id) =
        setup_task_and_issue(&state, tenant_id, user_id, project_id, col_id).await;

    // Seed a link directly so we can delete it.
    taskbolt_db::queries::task_issue_links::create_link(&state.db, task_id, issue_id, user_id)
        .await
        .expect("seed link");

    let response = app
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/api/tasks/{}/linked-issues/{}", task_id, issue_id))
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
    assert_eq!(json["success"], true);
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_unlink_issue_nonexistent_returns_404() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    // Nonexistent task → handler resolves task project first → 404.
    let response = app
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!(
                    "/api/tasks/{}/linked-issues/{}",
                    Uuid::new_v4(),
                    Uuid::new_v4()
                ))
                .header("Cookie", format!("access_token={}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

// =========================================================================
// LIST LINKED ISSUES / TASKS
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_list_issues_for_task_returns_linked() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, project_id, col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);
    let (task_id, issue_id) =
        setup_task_and_issue(&state, tenant_id, user_id, project_id, col_id).await;

    taskbolt_db::queries::task_issue_links::create_link(&state.db, task_id, issue_id, user_id)
        .await
        .expect("seed link");

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/tasks/{}/linked-issues", task_id))
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
    assert!(json.is_array(), "expected array of linked issues");
    let arr = json.as_array().expect("array");
    assert!(
        arr.iter().any(
            |row| row["issue_id"].as_str() == Some(&issue_id.to_string())
                || row["id"].as_str() == Some(&issue_id.to_string())
        ),
        "expected linked issue {} to be present, got: {}",
        issue_id,
        json
    );
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_list_tasks_for_issue_returns_linked() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, project_id, col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);
    let (task_id, issue_id) =
        setup_task_and_issue(&state, tenant_id, user_id, project_id, col_id).await;

    taskbolt_db::queries::task_issue_links::create_link(&state.db, task_id, issue_id, user_id)
        .await
        .expect("seed link");

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/issues/{}/linked-tasks", issue_id))
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
    assert!(json.is_array(), "expected array of linked tasks");
    let arr = json.as_array().expect("array");
    assert!(
        arr.iter()
            .any(|row| row["task_id"].as_str() == Some(&task_id.to_string())
                || row["id"].as_str() == Some(&task_id.to_string())),
        "expected linked task {} to be present, got: {}",
        task_id,
        json
    );
}
