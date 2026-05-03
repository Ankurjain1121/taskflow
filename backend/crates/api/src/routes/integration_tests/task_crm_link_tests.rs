use super::common::*;

// =========================================================================
// Helper: create a task in a project for happy-path tests
// =========================================================================

async fn setup_task(
    state: &crate::state::AppState,
    tenant_id: Uuid,
    user_id: Uuid,
    project_id: Uuid,
    col_id: Uuid,
) -> Uuid {
    let task = taskbolt_db::queries::create_task(
        &state.db,
        project_id,
        taskbolt_db::queries::CreateTaskInput {
            title: "CRM Link Test Task".to_string(),
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
    task.id
}

// =========================================================================
// LINK CONTACT — HAPPY PATH
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_link_crm_contact_to_task_happy_path() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, project_id, col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);
    let task_id = setup_task(&state, tenant_id, user_id, project_id, col_id).await;
    let crm_contact_id = Uuid::new_v4();

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/tasks/{}/linked-crm-contacts", task_id))
                .header("Cookie", format!("access_token={}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "crm_contact_id": crm_contact_id,
                        "twenty_workspace_id": "ws-test-1"
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
// LINK CONTACT — AUTH CHECK
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_link_crm_contact_no_auth_returns_401() {
    let (app, _state) = test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/tasks/{}/linked-crm-contacts", Uuid::new_v4()))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "crm_contact_id": Uuid::new_v4(),
                        "twenty_workspace_id": "ws-test-1"
                    }))
                    .expect("serialize"),
                ))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

// =========================================================================
// LINK CONTACT — NONEXISTENT TASK → 404
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_link_crm_contact_nonexistent_task_returns_404() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/tasks/{}/linked-crm-contacts", Uuid::new_v4()))
                .header("Cookie", format!("access_token={}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "crm_contact_id": Uuid::new_v4(),
                        "twenty_workspace_id": "ws-test-1"
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
// DUPLICATE CONTACT LINK → 409
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_duplicate_crm_contact_link_returns_409() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, project_id, col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);
    let task_id = setup_task(&state, tenant_id, user_id, project_id, col_id).await;
    let crm_contact_id = Uuid::new_v4();
    let body = serde_json::to_string(&serde_json::json!({
        "crm_contact_id": crm_contact_id,
        "twenty_workspace_id": "ws-test-1"
    }))
    .expect("serialize");

    // First create
    let resp1 = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/tasks/{}/linked-crm-contacts", task_id))
                .header("Cookie", format!("access_token={}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(body.clone()))
                .expect("build request"),
        )
        .await
        .expect("request failed");
    assert_eq!(resp1.status(), StatusCode::OK);

    // Duplicate
    let resp2 = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/tasks/{}/linked-crm-contacts", task_id))
                .header("Cookie", format!("access_token={}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(body))
                .expect("build request"),
        )
        .await
        .expect("request failed");
    assert_eq!(resp2.status(), StatusCode::CONFLICT);
}

// =========================================================================
// UNLINK CONTACT — HAPPY PATH (includes twenty_workspace_id in path)
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_unlink_crm_contact_happy_path() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, project_id, col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);
    let task_id = setup_task(&state, tenant_id, user_id, project_id, col_id).await;
    let crm_contact_id = Uuid::new_v4();
    let twenty_workspace_id = "ws-unlink-test-1";

    // Seed a link via the DB layer directly (bypasses HTTP to keep test focused)
    taskbolt_db::queries::task_crm_links::create_contact_link(
        &state.db,
        tenant_id,
        task_id,
        twenty_workspace_id.to_string(),
        crm_contact_id,
        user_id,
    )
    .await
    .expect("seed contact link");

    // Delete via HTTP
    let response = app
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!(
                    "/api/tasks/{}/linked-crm-contacts/{}/{}",
                    task_id, crm_contact_id, twenty_workspace_id
                ))
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

// =========================================================================
// LIST ALL CRM LINKS — HAPPY PATH (verifies N+1 fix: parallel fetch)
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_list_all_crm_links_returns_all_types() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id, project_id, col_id) = setup_full(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);
    let task_id = setup_task(&state, tenant_id, user_id, project_id, col_id).await;

    // Seed one of each type
    taskbolt_db::queries::task_crm_links::create_contact_link(
        &state.db,
        tenant_id,
        task_id,
        "ws-all-test".to_string(),
        Uuid::new_v4(),
        user_id,
    )
    .await
    .expect("seed contact");
    taskbolt_db::queries::task_crm_links::create_company_link(
        &state.db,
        tenant_id,
        task_id,
        "ws-all-test".to_string(),
        Uuid::new_v4(),
        user_id,
    )
    .await
    .expect("seed company");
    taskbolt_db::queries::task_crm_links::create_deal_link(
        &state.db,
        tenant_id,
        task_id,
        "ws-all-test".to_string(),
        Uuid::new_v4(),
        user_id,
    )
    .await
    .expect("seed deal");

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/tasks/{}/linked-crm-all", task_id))
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

    assert!(json["contacts"].is_array(), "contacts must be array");
    assert!(json["companies"].is_array(), "companies must be array");
    assert!(json["deals"].is_array(), "deals must be array");

    assert_eq!(json["contacts"].as_array().unwrap().len(), 1);
    assert_eq!(json["companies"].as_array().unwrap().len(), 1);
    assert_eq!(json["deals"].as_array().unwrap().len(), 1);
}

// =========================================================================
// TENANT ISOLATION — cross-tenant task must return 403/404
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_crm_contact_link_cross_tenant_returns_403_or_404() {
    let (app, state) = test_app().await;

    // Two separate tenants
    let (_tenant_a, user_a, _ws_a, project_a, col_a) = setup_full(&state.db).await;
    let (tenant_b, user_b) = setup_user(&state.db).await;
    let token_b = test_jwt_token(&state, user_b, tenant_b);

    // Task belongs to tenant A
    let task_id = setup_task(&state, _tenant_a, user_a, project_a, col_a).await;

    // Tenant B tries to link a contact to tenant A's task
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/tasks/{}/linked-crm-contacts", task_id))
                .header("Cookie", format!("access_token={}", token_b))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "crm_contact_id": Uuid::new_v4(),
                        "twenty_workspace_id": "ws-xsec"
                    }))
                    .expect("serialize"),
                ))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    let status = response.status();
    assert!(
        status == StatusCode::FORBIDDEN || status == StatusCode::NOT_FOUND,
        "Expected 403 or 404 for cross-tenant access, got {}",
        status
    );
}
