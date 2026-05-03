//! Integration tests for `crm_workspace_links`.
//!
//! Marked `#[ignore]` so `cargo test --workspace` skips them when no DATABASE_URL
//! is configured. Run explicitly: `cargo-locked test -p taskbolt-db --test
//! crm_workspace_links -- --ignored --test-threads=1`.

use std::sync::Arc;

use sqlx::{PgPool, Row};
use uuid::Uuid;

use taskbolt_db::queries::crm_workspace_links::{self, CreateLinkInput, TenantScope};

fn database_url() -> Option<String> {
    let _ = dotenvy::from_path("../../.env");
    let _ = dotenvy::dotenv();
    std::env::var("DATABASE_URL").ok()
}

async fn pool() -> Option<PgPool> {
    let url = database_url()?;
    PgPool::connect(&url).await.ok()
}

async fn create_tenant_with_user(pool: &PgPool) -> (Uuid, Uuid) {
    let email = format!("crm-link-test-{}@example.com", Uuid::new_v4());
    let user = taskbolt_db::queries::auth::create_user_with_tenant(
        pool,
        &email,
        "CRM Link Test",
        "$argon2id$v=19$m=19456,t=2,p=1$test_salt$test_hash_for_crm_link",
        None,
        false,
    )
    .await
    .expect("create user with tenant");
    (user.tenant_id, user.id)
}

fn input<'a>(client_id: &'a str, secret: &'a [u8]) -> CreateLinkInput<'a> {
    CreateLinkInput {
        twenty_workspace_id: "tw-ws-test",
        twenty_oidc_client_id: client_id,
        twenty_oidc_client_secret_encrypted: secret,
        twenty_api_key_encrypted: None,
    }
}

#[ignore = "needs DATABASE_URL — run with cargo-locked test ... -- --ignored"]
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn create_then_get_active() {
    let Some(pool) = pool().await else {
        eprintln!("skipping: DATABASE_URL not set");
        return;
    };
    let (tenant_id, user_id) = create_tenant_with_user(&pool).await;
    let scope = TenantScope::new(tenant_id, user_id);

    let link = crm_workspace_links::create(&pool, &scope, input("client-1", b"enc-secret-1"))
        .await
        .expect("create");
    assert_eq!(link.tenant_id, tenant_id);
    assert!(link.is_active());

    let active = crm_workspace_links::get_active_for_tenant(&pool, &scope)
        .await
        .expect("get_active")
        .expect("some");
    assert_eq!(active.id, link.id);
}

#[ignore = "needs DATABASE_URL"]
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn partial_unique_index_blocks_second_active_row() {
    let Some(pool) = pool().await else {
        eprintln!("skipping: DATABASE_URL not set");
        return;
    };
    let (tenant_id, user_id) = create_tenant_with_user(&pool).await;
    let scope = TenantScope::new(tenant_id, user_id);

    // First insert succeeds
    let _first = crm_workspace_links::create(&pool, &scope, input("client-A", b"sec-A"))
        .await
        .expect("first create");

    // Second insert for same tenant + valid_to IS NULL must violate the partial unique index
    let second = crm_workspace_links::create(&pool, &scope, input("client-B", b"sec-B")).await;
    assert!(
        matches!(&second, Err(sqlx::Error::Database(db_err)) if db_err.constraint() == Some("crm_workspace_links_tenant_active")),
        "expected partial-unique-index violation, got {second:?}"
    );
}

#[ignore = "needs DATABASE_URL"]
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn revoke_clears_active_slot_and_allows_new_link() {
    let Some(pool) = pool().await else {
        eprintln!("skipping: DATABASE_URL not set");
        return;
    };
    let (tenant_id, user_id) = create_tenant_with_user(&pool).await;
    let scope = TenantScope::new(tenant_id, user_id);

    let first = crm_workspace_links::create(&pool, &scope, input("c1", b"s1"))
        .await
        .expect("first");
    let revoked = crm_workspace_links::revoke(&pool, &scope, first.id)
        .await
        .expect("revoke");
    assert!(revoked, "revoke should affect a row");

    let after_revoke = crm_workspace_links::get_active_for_tenant(&pool, &scope)
        .await
        .expect("lookup after revoke");
    assert!(after_revoke.is_none(), "no active link after revoke");

    // New link allowed
    let second = crm_workspace_links::create(&pool, &scope, input("c2", b"s2"))
        .await
        .expect("second create after revoke");
    assert_ne!(second.id, first.id);
}

#[ignore = "needs DATABASE_URL"]
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn pause_then_resume_round_trip() {
    let Some(pool) = pool().await else {
        return;
    };
    let (tenant_id, user_id) = create_tenant_with_user(&pool).await;
    let scope = TenantScope::new(tenant_id, user_id);
    let link = crm_workspace_links::create(&pool, &scope, input("c", b"s"))
        .await
        .expect("create");

    assert!(crm_workspace_links::pause(&pool, &scope, link.id).await.expect("pause"));
    let paused = crm_workspace_links::get_active_for_tenant(&pool, &scope)
        .await
        .expect("lookup");
    assert!(
        paused.is_none(),
        "paused link must not appear in get_active_for_tenant (status='paused' filter)"
    );

    assert!(crm_workspace_links::resume(&pool, &scope, link.id).await.expect("resume"));
    let resumed = crm_workspace_links::get_active_for_tenant(&pool, &scope)
        .await
        .expect("lookup")
        .expect("some");
    assert_eq!(resumed.id, link.id);
}

#[ignore = "needs DATABASE_URL"]
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn rls_blocks_cross_tenant_select() {
    let Some(pool) = pool().await else {
        return;
    };
    let (tenant_a, user_a) = create_tenant_with_user(&pool).await;
    let (tenant_b, _user_b) = create_tenant_with_user(&pool).await;
    let scope_a = TenantScope::new(tenant_a, user_a);

    let _link_a = crm_workspace_links::create(&pool, &scope_a, input("ca", b"sa"))
        .await
        .expect("create in tenant A");

    // Direct SELECT scoped to tenant B's session var must return zero rows due to RLS.
    let mut tx = pool.begin().await.expect("begin");
    sqlx::query("SELECT set_config('app.tenant_id', $1::text, true)")
        .bind(tenant_b.to_string())
        .execute(&mut *tx)
        .await
        .expect("set tenant B");
    let rows = sqlx::query("SELECT id FROM crm_workspace_links")
        .fetch_all(&mut *tx)
        .await
        .expect("select");
    assert!(
        rows.is_empty(),
        "RLS must hide tenant A's rows when session var = tenant B"
    );
    tx.rollback().await.expect("rollback");
}

#[ignore = "needs DATABASE_URL — concurrent SSO idempotency"]
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn concurrent_authorize_calls_yield_one_link() {
    let Some(pool) = pool().await else {
        return;
    };
    let (tenant_id, user_id) = create_tenant_with_user(&pool).await;
    let scope = TenantScope::new(tenant_id, user_id);
    let pool = Arc::new(pool);

    // Two concurrent attempts to create a link for the same tenant. Exactly one
    // must succeed; the other must fail with the partial-unique-index error.
    // This mirrors what happens when two browser tabs trigger SSO simultaneously
    // for a tenant that hasn't been linked yet.
    let scope1 = scope;
    let pool1 = pool.clone();
    let handle1 = tokio::spawn(async move {
        crm_workspace_links::create(&pool1, &scope1, input("c-tab-1", b"sec1")).await
    });
    let scope2 = scope;
    let pool2 = pool.clone();
    let handle2 = tokio::spawn(async move {
        crm_workspace_links::create(&pool2, &scope2, input("c-tab-2", b"sec2")).await
    });

    let r1 = handle1.await.expect("join 1");
    let r2 = handle2.await.expect("join 2");

    let successes = [&r1, &r2].iter().filter(|r| r.is_ok()).count();
    let failures = [&r1, &r2].iter().filter(|r| r.is_err()).count();
    assert_eq!(successes, 1, "exactly one create must win");
    assert_eq!(failures, 1, "the other must violate the unique index");

    // Ensure the surviving row is the unique active row.
    let row = sqlx::query("SELECT count(*)::bigint AS n FROM crm_workspace_links WHERE tenant_id = $1 AND valid_to IS NULL")
        .bind(tenant_id)
        .fetch_one(&*pool)
        .await
        .expect("count");
    let n: i64 = row.try_get("n").expect("read count");
    assert_eq!(n, 1, "exactly one active link per tenant");
}
