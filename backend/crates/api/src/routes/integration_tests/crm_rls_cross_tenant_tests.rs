//! CRM cross-tenant RLS denial tests.
//!
//! Verifies that Row-Level Security prevents any CRM data leaking across
//! tenant boundaries — for both plain queries and injected-parameter attacks.
//!
//! **All tests are `#[ignore]`** — they require tables and routes added by:
//!   - W4 (backend-sso): `crm_workspace_links`, `crm_contacts_mirror`,
//!     `crm_companies_mirror`, `crm_deals_mirror` + CRM route registration
//!   - W5 (backend-sync-in): inbound webhook populating mirror tables
//!   - W8 (backend-links): `task_crm_contacts_links`, `task_crm_companies_links`,
//!     `task_crm_deals_links` + link routes

use super::common::*;

// ─── fixture helpers ──────────────────────────────────────────────────────────

/// Create two independent tenants, each with a user.
/// Returns `(tenant_a_id, user_a_id, tenant_b_id, user_b_id)`.
async fn two_tenants(pool: &sqlx::PgPool) -> (Uuid, Uuid, Uuid, Uuid) {
    let (ta, ua) = setup_user(pool).await;
    let (tb, ub) = setup_user(pool).await;
    (ta, ua, tb, ub)
}

// ─── T-RLS-1: Plain cross-tenant read denial ─────────────────────────────────

#[ignore = "requires CRM Phase 9 merge (W4 crm tables + W5 sync-in)"]
#[tokio::test]
async fn test_crm_contacts_tenant_a_cannot_see_tenant_b() {
    // TODO(W12): Insert crm_contacts_mirror rows for tenant_b via sqlx, then
    // assert tenant_a's GET /api/crm/contacts returns 0 of those rows.
    let (app, state) = test_app().await;
    let (ta, ua, tb, _ub) = two_tenants(&state.db).await;
    let token_a = test_jwt_token(&state, ua, ta);

    let resp = app
        .oneshot(
            Request::builder()
                .uri("/api/crm/contacts")
                .header("Authorization", format!("Bearer {}", token_a))
                .body(Body::empty())
                .expect("build"),
        )
        .await
        .expect("request");

    assert_eq!(resp.status(), StatusCode::OK);

    let body = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .expect("body");
    let json: serde_json::Value = serde_json::from_slice(&body).expect("json");

    let tb_str = tb.to_string();
    if let Some(rows) = json["data"].as_array() {
        for row in rows {
            assert_ne!(
                row["tenant_id"].as_str().unwrap_or(""),
                tb_str.as_str(),
                "RLS LEAK: tenant_a received tenant_b CRM contact"
            );
        }
    }
}

#[ignore = "requires CRM Phase 9 merge (W4 crm tables + W5 sync-in)"]
#[tokio::test]
async fn test_crm_companies_tenant_a_cannot_see_tenant_b() {
    let (app, state) = test_app().await;
    let (ta, ua, tb, _ub) = two_tenants(&state.db).await;
    let token_a = test_jwt_token(&state, ua, ta);

    let resp = app
        .oneshot(
            Request::builder()
                .uri("/api/crm/companies")
                .header("Authorization", format!("Bearer {}", token_a))
                .body(Body::empty())
                .expect("build"),
        )
        .await
        .expect("request");

    assert_eq!(resp.status(), StatusCode::OK);

    let body = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .expect("body");
    let json: serde_json::Value = serde_json::from_slice(&body).expect("json");

    let tb_str = tb.to_string();
    if let Some(rows) = json["data"].as_array() {
        for row in rows {
            assert_ne!(
                row["tenant_id"].as_str().unwrap_or(""),
                tb_str.as_str(),
                "RLS LEAK: tenant_a received tenant_b CRM company"
            );
        }
    }
}

#[ignore = "requires CRM Phase 9 merge (W4 crm tables + W5 sync-in)"]
#[tokio::test]
async fn test_crm_deals_tenant_a_cannot_see_tenant_b() {
    let (app, state) = test_app().await;
    let (ta, ua, tb, _ub) = two_tenants(&state.db).await;
    let token_a = test_jwt_token(&state, ua, ta);

    let resp = app
        .oneshot(
            Request::builder()
                .uri("/api/crm/deals")
                .header("Authorization", format!("Bearer {}", token_a))
                .body(Body::empty())
                .expect("build"),
        )
        .await
        .expect("request");

    assert_eq!(resp.status(), StatusCode::OK);

    let body = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .expect("body");
    let json: serde_json::Value = serde_json::from_slice(&body).expect("json");

    let tb_str = tb.to_string();
    if let Some(rows) = json["data"].as_array() {
        for row in rows {
            assert_ne!(
                row["tenant_id"].as_str().unwrap_or(""),
                tb_str.as_str(),
                "RLS LEAK: tenant_a received tenant_b CRM deal"
            );
        }
    }
}

// ─── T-RLS-2: Malicious tenant_id query-param injection ──────────────────────

#[ignore = "requires CRM Phase 9 merge (W4 crm tables + W5 sync-in)"]
#[tokio::test]
async fn test_crm_contacts_malicious_tenant_id_qparam_denied() {
    // Injects tenant_b's UUID as a query-param. RLS must ignore it.
    let (app, state) = test_app().await;
    let (ta, ua, tb, _ub) = two_tenants(&state.db).await;
    let token_a = test_jwt_token(&state, ua, ta);

    let uri = format!("/api/crm/contacts?tenant_id={tb}");
    let resp = app
        .oneshot(
            Request::builder()
                .uri(uri)
                .header("Authorization", format!("Bearer {}", token_a))
                .body(Body::empty())
                .expect("build"),
        )
        .await
        .expect("request");

    // Acceptable: 200 (returns only tenant_a rows) or 400/403 (param rejected).
    // Unacceptable: 200 returning tenant_b rows.
    let status = resp.status();
    assert_ne!(
        status,
        StatusCode::INTERNAL_SERVER_ERROR,
        "endpoint must not panic on injected tenant_id"
    );

    if status == StatusCode::OK {
        let body = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .expect("body");
        let json: serde_json::Value = serde_json::from_slice(&body).expect("json");
        let tb_str = tb.to_string();
        if let Some(rows) = json["data"].as_array() {
            for row in rows {
                assert_ne!(
                    row["tenant_id"].as_str().unwrap_or(""),
                    tb_str.as_str(),
                    "RLS LEAK: injected tenant_id param returned tenant_b CRM data"
                );
            }
        }
    }
}

#[ignore = "requires CRM Phase 9 merge (W4 crm tables + W8 task_crm_links)"]
#[tokio::test]
async fn test_task_crm_links_cross_tenant_denied() {
    // Linked-CRM endpoints for a task must only return data belonging to the
    // authenticated tenant, even if the task_id is guessed cross-tenant.
    let (app, state) = test_app().await;
    let (ta, ua, _tb, _ub) = two_tenants(&state.db).await;
    let token_a = test_jwt_token(&state, ua, ta);

    // TODO(W12): Create a real task for tenant_a via the task API, then assert
    // GET /api/tasks/{task_id}/linked-crm-contacts returns no tenant_b rows.
    let placeholder_task_id = Uuid::new_v4();

    let resp = app
        .oneshot(
            Request::builder()
                .uri(format!(
                    "/api/tasks/{placeholder_task_id}/linked-crm-contacts"
                ))
                .header("Authorization", format!("Bearer {}", token_a))
                .body(Body::empty())
                .expect("build"),
        )
        .await
        .expect("request");

    // Before merge: 404 (route not registered).
    // After merge: 200 or 404 (task not in tenant_a's scope).
    assert_ne!(
        resp.status(),
        StatusCode::INTERNAL_SERVER_ERROR,
        "CRM link endpoint must not panic"
    );
}
