//! Webhook → cache → linked-task end-to-end integration tests.
//!
//! Verifies the full inbound path:
//!   1. Twenty fires `person.created` webhook → HMAC verified → mirror row upserted
//!   2. Task is linked to that contact → `task_crm_contacts_links` row created
//!   3. Twenty's `taskbolt_task_ids[]` custom field is updated (mocked)
//!
//! **All tests are `#[ignore]`** — require:
//!   - W4 (backend-sso): `crm_workspace_links`, webhook secret in config
//!   - W5 (backend-sync-in): `POST /api/webhooks/incoming/twenty/{tenant_id}` handler,
//!     HMAC verification, `crm_contacts_mirror` upsert
//!   - W8 (backend-links): `POST /api/tasks/{id}/linked-crm-contacts` handler

use super::common::*;

/// Build a minimal `person.created` Twenty webhook payload.
fn person_created_payload(twenty_person_id: &str, workspace_id: &str) -> serde_json::Value {
    serde_json::json!({
        "eventName": "person.created",
        "workspaceId": workspace_id,
        "record": {
            "id": twenty_person_id,
            "name": { "firstName": "Alice", "lastName": "Example" },
            "email": "alice@example.com",
            "createdAt": "2026-05-03T08:00:00Z",
            "updatedAt": "2026-05-03T08:00:00Z"
        },
        "eventId": format!("evt-{}", Uuid::new_v4()),
        "timestamp": "2026-05-03T08:00:00Z"
    })
}

/// Compute HMAC-SHA256 over `body` with `secret` and hex-encode.
fn hmac_sha256_hex(secret: &[u8], body: &[u8]) -> String {
    use hmac::{Hmac, Mac};
    use sha2::Sha256;
    let mut mac = Hmac::<Sha256>::new_from_slice(secret).expect("HMAC accepts any key length");
    mac.update(body);
    hex::encode(mac.finalize().into_bytes())
}

// ─── T-WH-1: person.created webhook upserts mirror row ───────────────────────

#[ignore = "requires CRM Phase 9 merge (W4 crm tables + W5 sync-in webhook handler)"]
#[tokio::test]
async fn test_person_created_webhook_upserts_mirror_row() {
    // TODO(W12): Before asserting the DB state, read the webhook secret from
    // crm_workspace_links for the test tenant and use it to compute the HMAC.
    let (app, state) = test_app().await;
    let (tenant_id, _user_id) = setup_user(&state.db).await;

    // TODO(W12): Insert a crm_workspace_links row with a known webhook_secret:
    // sqlx::query!("INSERT INTO crm_workspace_links (tenant_id, twenty_workspace_id, webhook_secret, ...) VALUES (...)")
    let test_webhook_secret = b"test-webhook-secret-32-bytes-long!";
    let twenty_workspace_id = "workspace-abc123";
    let twenty_person_id = Uuid::new_v4().to_string();

    let payload = person_created_payload(&twenty_person_id, twenty_workspace_id);
    let body_bytes = serde_json::to_vec(&payload).expect("serialize");
    let signature = hmac_sha256_hex(test_webhook_secret, &body_bytes);

    let resp = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/webhooks/incoming/twenty/{tenant_id}"))
                .header("Content-Type", "application/json")
                .header("x-twenty-signature", format!("sha256={signature}"))
                .body(Body::from(body_bytes))
                .expect("build"),
        )
        .await
        .expect("request");

    assert_eq!(resp.status(), StatusCode::OK);

    // TODO(W12): Assert mirror row exists:
    // let row = sqlx::query!("SELECT id FROM crm_contacts_mirror WHERE twenty_id = $1 AND tenant_id = $2", twenty_person_id, tenant_id)
    //     .fetch_one(&state.db).await.expect("mirror row");
    // assert_eq!(row.twenty_id, twenty_person_id);
}

// ─── T-WH-2: Replay (same event_id) is idempotent ────────────────────────────

#[ignore = "requires CRM Phase 9 merge (W4 crm tables + W5 sync-in webhook handler)"]
#[tokio::test]
async fn test_webhook_replay_same_event_id_idempotent() {
    let (_app, state) = test_app().await;
    let (tenant_id, _user_id) = setup_user(&state.db).await;

    let test_webhook_secret = b"test-webhook-secret-32-bytes-long!";
    let fixed_event_id = "evt-idempotency-test-001";
    let payload = serde_json::json!({
        "eventName": "person.created",
        "workspaceId": "ws-replay-test",
        "record": {
            "id": Uuid::new_v4().to_string(),
            "name": { "firstName": "Bob", "lastName": "Replay" },
            "createdAt": "2026-05-03T09:00:00Z",
            "updatedAt": "2026-05-03T09:00:00Z"
        },
        "eventId": fixed_event_id,
        "timestamp": "2026-05-03T09:00:00Z"
    });
    let body_bytes = serde_json::to_vec(&payload).expect("serialize");
    let signature = hmac_sha256_hex(test_webhook_secret, &body_bytes);

    let make_request = || {
        Request::builder()
            .method("POST")
            .uri(format!("/api/webhooks/incoming/twenty/{tenant_id}"))
            .header("Content-Type", "application/json")
            .header("x-twenty-signature", format!("sha256={}", &signature))
            .body(Body::from(body_bytes.clone()))
            .expect("build")
    };

    // First delivery: must process.
    let resp1 = build_test_router(state.clone())
        .oneshot(make_request())
        .await
        .expect("request 1");
    assert_eq!(resp1.status(), StatusCode::OK);

    // Second delivery (replay): must return 200 but NOT create duplicate row.
    let resp2 = build_test_router(state.clone())
        .oneshot(make_request())
        .await
        .expect("request 2");
    assert_eq!(resp2.status(), StatusCode::OK);

    // TODO(W12): Assert exactly one crm_contacts_mirror row exists for this event_id:
    // let count = sqlx::query_scalar!("SELECT COUNT(*) FROM processed_webhook_events WHERE event_id = $1", fixed_event_id)
    //     .fetch_one(&state.db).await.unwrap().unwrap_or(0);
    // assert_eq!(count, 1, "Replay must not insert duplicate processed_webhook_events row");
}

// ─── T-WH-3: HMAC mismatch → 401 + no DB write ───────────────────────────────

#[ignore = "requires CRM Phase 9 merge (W5 sync-in webhook handler)"]
#[tokio::test]
async fn test_webhook_hmac_mismatch_returns_401() {
    let (app, state) = test_app().await;
    let (tenant_id, _user_id) = setup_user(&state.db).await;

    let payload = person_created_payload("person-bad-sig", "ws-bad");
    let body_bytes = serde_json::to_vec(&payload).expect("serialize");
    // Deliberately wrong signature
    let bad_signature = "sha256=deadbeefdeadbeefdeadbeefdeadbeef";

    let resp = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/webhooks/incoming/twenty/{tenant_id}"))
                .header("Content-Type", "application/json")
                .header("x-twenty-signature", bad_signature)
                .body(Body::from(body_bytes))
                .expect("build"),
        )
        .await
        .expect("request");

    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

// ─── T-WH-4: Link task to contact → row created ──────────────────────────────

#[ignore = "requires CRM Phase 9 merge (W4 crm tables + W8 link routes)"]
#[tokio::test]
async fn test_link_task_to_contact_creates_row() {
    // TODO(W12): Create a real task + crm_contacts_mirror row before linking.
    let (app, state) = test_app().await;
    let (tenant_id, user_id) = setup_user(&state.db).await;
    let token = test_jwt_token(&state, user_id, tenant_id);

    let task_id = Uuid::new_v4(); // TODO(W12): create real task
    let crm_contact_id = Uuid::new_v4(); // TODO(W12): seed crm_contacts_mirror row

    let resp = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/tasks/{task_id}/linked-crm-contacts"))
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_string(&serde_json::json!({
                        "crm_contact_id": crm_contact_id
                    }))
                    .expect("serialize"),
                ))
                .expect("build"),
        )
        .await
        .expect("request");

    assert_eq!(resp.status(), StatusCode::CREATED);

    // TODO(W12): Assert task_crm_contacts_links row exists:
    // let row = sqlx::query!("SELECT task_id FROM task_crm_contacts_links WHERE task_id = $1 AND crm_contact_id = $2", task_id, crm_contact_id)
    //     .fetch_one(&state.db).await.expect("link row");
    // assert_eq!(row.task_id, task_id);
}
