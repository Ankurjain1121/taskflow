use super::common::*;

// =========================================================================
// INVITATION ROUTES — HAPPY PATH
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_list_invitations() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, ws_id) = setup_user_and_workspace(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/invitations?workspace_id={}", ws_id))
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
async fn test_create_invitation() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, ws_id) = setup_user_and_workspace(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/invitations")
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "email": unique_email(),
                        "workspace_id": ws_id,
                        "role": "Member"
                    }))
                    .expect("serialize"),
                ))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    // Route is reachable and auth works
    assert!(
        response.status() == StatusCode::OK
            || response.status() == StatusCode::UNPROCESSABLE_ENTITY,
        "Expected OK or 422, got {}",
        response.status()
    );
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_validate_invalid_invitation_token() {
    let (app, _state) = test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/invitations/validate/{}", Uuid::new_v4()))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    // Returns 200 with valid=false for nonexistent tokens (by design)
    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read body");
    let json: serde_json::Value = serde_json::from_slice(&body).expect("parse JSON");
    assert_eq!(
        json["valid"], false,
        "Nonexistent token should not be valid"
    );
}

// =========================================================================
// INVITATION ROUTES — ERROR SCENARIOS
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_create_invitation_missing_email_returns_400() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, ws_id) = setup_user_and_workspace(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/invitations")
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "workspace_id": ws_id,
                        "role": "Member"
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
        "Expected 400 or 422 for missing email, got {}",
        response.status()
    );
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_create_invitation_invalid_email_returns_error() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, ws_id) = setup_user_and_workspace(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/invitations")
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "email": "not-an-email",
                        "workspace_id": ws_id,
                        "role": "Member"
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
        "Expected 400 or 422 for invalid email, got {}",
        response.status()
    );
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_create_invitation_invalid_workspace_returns_error() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/invitations")
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "email": unique_email(),
                        "workspace_id": Uuid::new_v4(),
                        "role": "Member"
                    }))
                    .expect("serialize"),
                ))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    // Could be 404, 403, or 422 depending on validation order
    assert!(
        response.status() == StatusCode::NOT_FOUND
            || response.status() == StatusCode::FORBIDDEN
            || response.status() == StatusCode::UNPROCESSABLE_ENTITY
            || response.status() == StatusCode::INTERNAL_SERVER_ERROR,
        "Expected error for non-existent workspace, got {}",
        response.status()
    );
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_create_invitation_missing_body_returns_400() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, _ws_id) = setup_user_and_workspace(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/invitations")
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
async fn test_delete_nonexistent_invitation_returns_error() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let response = app
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/api/invitations/{}", Uuid::new_v4()))
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::empty())
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert!(
        response.status() == StatusCode::NOT_FOUND
            || response.status() == StatusCode::INTERNAL_SERVER_ERROR,
        "Expected 404 or 500 for non-existent invitation, got {}",
        response.status()
    );
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_accept_invitation_invalid_token_returns_error() {
    let (app, _state) = test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/invitations/accept")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "token": Uuid::new_v4(),
                        "name": "New User",
                        "password": "TestPassword123!"
                    }))
                    .expect("serialize"),
                ))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    // Should fail with invalid/expired token
    assert!(
        response.status() == StatusCode::NOT_FOUND
            || response.status() == StatusCode::BAD_REQUEST
            || response.status() == StatusCode::GONE
            || response.status() == StatusCode::UNPROCESSABLE_ENTITY
            || response.status() == StatusCode::INTERNAL_SERVER_ERROR,
        "Expected error for invalid invitation token, got {}",
        response.status()
    );
}

// =========================================================================
// FIX #2: Admin role gate on invitation create
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_invite_admin_role_blocked_for_member() {
    let (app, state) = test_app().await;
    let (tenant_id, user_id, ws_id) = setup_user_and_workspace(&state.db).await;
    // Caller has org Member role and is just a workspace member (creator role
    // for this helper is owner, so we instead add a fresh user as plain member)
    let (_t2, plain_user_id) = setup_user(&state.db).await;
    // Manually move plain_user into tenant + workspace as plain member
    sqlx::query("UPDATE users SET tenant_id = $1 WHERE id = $2")
        .bind(tenant_id)
        .bind(plain_user_id)
        .execute(&state.db)
        .await
        .expect("retag tenant");
    taskbolt_db::queries::workspaces::add_workspace_member(&state.db, ws_id, plain_user_id)
        .await
        .expect("add member");
    let token = test_jwt_token_with_role(&state, plain_user_id, tenant_id, UserRole::Member);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/invitations")
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "email": unique_email(),
                        "workspace_id": ws_id,
                        "role": "Admin"
                    }))
                    .expect("serialize"),
                ))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
    let _ = user_id; // silence unused
}

// =========================================================================
// FIX #9: existing same-tenant user auto-add
// =========================================================================

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_invite_existing_org_user_added_directly_by_admin() {
    let (app, state) = test_app().await;
    let (tenant_id, owner_id, ws_id) = setup_user_and_workspace(&state.db).await;
    // Create another same-tenant user via direct insert (helpers create new tenants).
    let target_email = unique_email();
    let target_id = Uuid::new_v4();
    sqlx::query(
        r"INSERT INTO users (id, email, name, password_hash, role, tenant_id, onboarding_completed, created_at, updated_at)
          VALUES ($1, $2, 'Target', '$argon2id$dummy', 'member', $3, true, NOW(), NOW())",
    )
    .bind(target_id)
    .bind(&target_email)
    .bind(tenant_id)
    .execute(&state.db)
    .await
    .expect("create target");

    let token = test_jwt_token(&state, owner_id, tenant_id);
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/invitations")
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "email": target_email,
                        "workspace_id": ws_id,
                        "role": "Member"
                    }))
                    .expect("serialize"),
                ))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::OK);

    // Verify target was added to workspace_members directly
    let is_member =
        taskbolt_db::queries::workspaces::is_workspace_member(&state.db, ws_id, target_id)
            .await
            .expect("check membership");
    assert!(is_member, "target user should be in workspace_members");
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_invite_existing_org_user_blocked_for_non_admin() {
    let (app, state) = test_app().await;
    let (tenant_id, _owner_id, ws_id) = setup_user_and_workspace(&state.db).await;

    // Plain member caller (org Member role + plain ws membership)
    let (_t2, plain_user_id) = setup_user(&state.db).await;
    sqlx::query("UPDATE users SET tenant_id = $1 WHERE id = $2")
        .bind(tenant_id)
        .bind(plain_user_id)
        .execute(&state.db)
        .await
        .expect("retag tenant");
    taskbolt_db::queries::workspaces::add_workspace_member(&state.db, ws_id, plain_user_id)
        .await
        .expect("add member");

    // Existing target user in same tenant
    let target_email = unique_email();
    sqlx::query(
        r"INSERT INTO users (id, email, name, password_hash, role, tenant_id, onboarding_completed, created_at, updated_at)
          VALUES ($1, $2, 'Target', '$argon2id$dummy', 'member', $3, true, NOW(), NOW())",
    )
    .bind(Uuid::new_v4())
    .bind(&target_email)
    .bind(tenant_id)
    .execute(&state.db)
    .await
    .expect("create target");

    let token = test_jwt_token_with_role(&state, plain_user_id, tenant_id, UserRole::Member);
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/invitations")
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "email": target_email,
                        "workspace_id": ws_id,
                        "role": "Member"
                    }))
                    .expect("serialize"),
                ))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    // ManagerOrAdmin extractor blocks at org-level first (403). If extractor
    // were to permit, the auto-add gate would 409. Either way, not 200.
    assert!(
        response.status() == StatusCode::FORBIDDEN || response.status() == StatusCode::CONFLICT,
        "Expected 403 or 409, got {}",
        response.status()
    );
}

#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_invite_existing_user_different_tenant_409() {
    let (app, state) = test_app().await;
    let (tenant_id, owner_id, ws_id) = setup_user_and_workspace(&state.db).await;
    // Target user in a DIFFERENT tenant
    let target_email = unique_email();
    taskbolt_db::queries::auth::create_user_with_tenant(
        &state.db,
        &target_email,
        "Other Tenant User",
        "$argon2id$dummy",
        None,
        false,
    )
    .await
    .expect("create target");

    let token = test_jwt_token(&state, owner_id, tenant_id);
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/invitations")
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "email": target_email,
                        "workspace_id": ws_id,
                        "role": "Member"
                    }))
                    .expect("serialize"),
                ))
                .expect("build request"),
        )
        .await
        .expect("request failed");

    assert_eq!(response.status(), StatusCode::CONFLICT);
}
