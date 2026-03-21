//! Integration tests for workspace_api_keys, themes, project_statuses, and invitations.
//! Runs against real PostgreSQL. Each test uses unique random data for isolation.

use chrono::{Duration, Utc};
use uuid::Uuid;

use crate::models::*;
use super::test_helpers::*;

// ===========================================================================
// WORKSPACE API KEYS TESTS
// ===========================================================================
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_create_workspace_api_key() {
    let pool = test_pool().await;
    let (_, user_id, ws_id) = setup_user_and_workspace(&pool).await;

    let key = super::workspace_api_keys::create_key(
        &pool,
        ws_id,
        "Test API Key",
        "hash_abc123",
        "tf_",
        user_id,
    )
    .await
    .expect("create_key");

    assert_eq!(key.workspace_id, ws_id);
    assert_eq!(key.name, "Test API Key");
    assert_eq!(key.key_hash, "hash_abc123");
    assert_eq!(key.key_prefix, "tf_");
    assert_eq!(key.created_by_id, user_id);
    assert!(key.revoked_at.is_none());
}
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_list_workspace_api_keys() {
    let pool = test_pool().await;
    let (_, user_id, ws_id) = setup_user_and_workspace(&pool).await;

    super::workspace_api_keys::create_key(&pool, ws_id, "Key1", "hash1", "tf1_", user_id)
        .await
        .expect("create_key 1");
    super::workspace_api_keys::create_key(&pool, ws_id, "Key2", "hash2", "tf2_", user_id)
        .await
        .expect("create_key 2");

    let keys = super::workspace_api_keys::list_keys(&pool, ws_id)
        .await
        .expect("list_keys");

    assert!(keys.len() >= 2, "should have at least 2 keys");
    let names: Vec<&str> = keys.iter().map(|k| k.name.as_str()).collect();
    assert!(names.contains(&"Key1"));
    assert!(names.contains(&"Key2"));
}
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_revoke_workspace_api_key() {
    let pool = test_pool().await;
    let (_, user_id, ws_id) = setup_user_and_workspace(&pool).await;

    let key = super::workspace_api_keys::create_key(
        &pool, ws_id, "RevokeMe", "hash_rev", "tfr_", user_id,
    )
    .await
    .expect("create_key");

    let revoked = super::workspace_api_keys::revoke_key(&pool, key.id, ws_id)
        .await
        .expect("revoke_key");
    assert!(revoked, "revoke should return true");

    // Revoked key should not appear in list (list_keys only returns non-revoked)
    let keys = super::workspace_api_keys::list_keys(&pool, ws_id)
        .await
        .expect("list_keys");
    assert!(
        !keys.iter().any(|k| k.id == key.id),
        "revoked key should not appear in list"
    );
}
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_revoke_nonexistent_key() {
    let pool = test_pool().await;
    let (_, _, ws_id) = setup_user_and_workspace(&pool).await;

    let revoked = super::workspace_api_keys::revoke_key(&pool, Uuid::new_v4(), ws_id)
        .await
        .expect("revoke_key");
    assert!(!revoked, "revoking nonexistent key should return false");
}

// ===========================================================================
// THEMES TESTS
// ===========================================================================
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_list_themes() {
    let pool = test_pool().await;

    let themes = super::themes::list_themes(&pool, None)
        .await
        .expect("list_themes");

    // Themes are seeded data; just verify the query returns without error.
    let _ = themes; // query executed successfully
}
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_list_themes_dark_filter() {
    let pool = test_pool().await;

    let dark_themes = super::themes::list_themes(&pool, Some(true))
        .await
        .expect("list_themes dark");

    let light_themes = super::themes::list_themes(&pool, Some(false))
        .await
        .expect("list_themes light");

    // All dark themes should have is_dark = true
    for theme in &dark_themes {
        assert!(theme.is_dark, "dark filter should only return dark themes");
    }
    for theme in &light_themes {
        assert!(
            !theme.is_dark,
            "light filter should only return light themes"
        );
    }
}
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_get_theme_by_slug() {
    let pool = test_pool().await;

    // First list themes to get a valid slug
    let themes = super::themes::list_themes(&pool, None)
        .await
        .expect("list_themes");

    if let Some(first_theme) = themes.first() {
        let fetched = super::themes::get_by_slug(&pool, &first_theme.slug)
            .await
            .expect("get_by_slug")
            .expect("theme should exist");

        assert_eq!(fetched.slug, first_theme.slug);
        assert_eq!(fetched.name, first_theme.name);
    }
}
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_get_theme_by_slug_not_found() {
    let pool = test_pool().await;

    let result = super::themes::get_by_slug(&pool, "nonexistent-theme-slug-xyz")
        .await
        .expect("get_by_slug");
    assert!(result.is_none(), "nonexistent slug should return None");
}

// ===========================================================================
// PROJECT STATUSES TESTS
// ===========================================================================
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_list_project_statuses() {
    let pool = test_pool().await;
    let (_, _, _, board_id, _) = setup_full(&pool).await;

    let statuses = super::project_statuses::list_project_statuses(&pool, board_id)
        .await
        .expect("list_project_statuses");

    // Default statuses: Open, In Progress, On Hold, Completed, Cancelled
    assert_eq!(statuses.len(), 5);
}
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_get_default_status() {
    let pool = test_pool().await;
    let (_, _, _, board_id, _) = setup_full(&pool).await;

    let default = super::project_statuses::get_default_status(&pool, board_id)
        .await
        .expect("get_default_status");

    assert!(default.is_some(), "should have a default status");
    let status = default.expect("checked above");
    assert!(status.is_default, "should be marked as default");
    assert_eq!(status.name, "Open");
}
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_update_project_status() {
    let pool = test_pool().await;
    let (_, _, _, board_id, _) = setup_full(&pool).await;

    let statuses = super::project_statuses::list_project_statuses(&pool, board_id)
        .await
        .expect("list_project_statuses");

    let updated = super::project_statuses::update_project_status(
        &pool,
        statuses[0].id,
        Some("Renamed"),
        Some("#abcdef"),
        None,
    )
    .await
    .expect("update_project_status");

    assert_eq!(updated.name, "Renamed");
    assert_eq!(updated.color, "#abcdef");
}
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_delete_project_status() {
    let pool = test_pool().await;
    let (tenant_id, _, _, board_id, _) = setup_full(&pool).await;

    // Create a new status to delete
    let new_status = super::project_statuses::create_project_status(
        &pool, board_id, "ToDelete", "#ff0000", "active", "z9", tenant_id,
    )
    .await
    .expect("create_project_status");

    let statuses = super::project_statuses::list_project_statuses(&pool, board_id)
        .await
        .expect("list before delete");

    // Delete the new status, replacing tasks with the default
    let default_id = statuses.iter().find(|s| s.is_default).expect("should have default").id;
    super::project_statuses::delete_project_status(&pool, new_status.id, default_id)
        .await
        .expect("delete_project_status");

    let after = super::project_statuses::list_project_statuses(&pool, board_id)
        .await
        .expect("list after delete");
    assert!(
        !after.iter().any(|s| s.id == new_status.id),
        "deleted status should not appear"
    );
}

// ===========================================================================
// INVITATIONS TESTS
// ===========================================================================
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_create_invitation() {
    let pool = test_pool().await;
    let (_, user_id, ws_id) = setup_user_and_workspace(&pool).await;

    let email = unique_email();
    let expires = Utc::now() + Duration::days(7);

    let inv = super::invitations::create_invitation(
        &pool,
        &email,
        ws_id,
        UserRole::Member,
        user_id,
        expires,
    )
    .await
    .expect("create_invitation");

    assert_eq!(inv.email, email);
    assert_eq!(inv.workspace_id, ws_id);
    assert_eq!(inv.role, UserRole::Member);
    assert_eq!(inv.invited_by_id, user_id);
    assert!(inv.accepted_at.is_none());
}
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_list_pending_invitations() {
    let pool = test_pool().await;
    let (_, user_id, ws_id) = setup_user_and_workspace(&pool).await;

    let email1 = unique_email();
    let email2 = unique_email();
    let expires = Utc::now() + Duration::days(7);

    super::invitations::create_invitation(
        &pool,
        &email1,
        ws_id,
        UserRole::Member,
        user_id,
        expires,
    )
    .await
    .expect("create_invitation 1");
    super::invitations::create_invitation(
        &pool,
        &email2,
        ws_id,
        UserRole::Member,
        user_id,
        expires,
    )
    .await
    .expect("create_invitation 2");

    let pending = super::invitations::list_pending_invitations(&pool, ws_id)
        .await
        .expect("list_pending_invitations");

    assert!(
        pending.len() >= 2,
        "should have at least 2 pending invitations"
    );
    let emails: Vec<&str> = pending.iter().map(|i| i.email.as_str()).collect();
    assert!(emails.contains(&email1.as_str()));
    assert!(emails.contains(&email2.as_str()));
}
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_get_invitation_by_token() {
    let pool = test_pool().await;
    let (_, user_id, ws_id) = setup_user_and_workspace(&pool).await;

    let email = unique_email();
    let expires = Utc::now() + Duration::days(7);

    let inv = super::invitations::create_invitation(
        &pool,
        &email,
        ws_id,
        UserRole::Member,
        user_id,
        expires,
    )
    .await
    .expect("create_invitation");

    let found = super::invitations::get_invitation_by_token(&pool, inv.token)
        .await
        .expect("get_invitation_by_token")
        .expect("invitation should exist");

    assert_eq!(found.id, inv.id);
    assert_eq!(found.email, email);
}
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_accept_invitation() {
    let pool = test_pool().await;
    let (_, user_id, ws_id) = setup_user_and_workspace(&pool).await;

    let email = unique_email();
    let expires = Utc::now() + Duration::days(7);

    let inv = super::invitations::create_invitation(
        &pool,
        &email,
        ws_id,
        UserRole::Member,
        user_id,
        expires,
    )
    .await
    .expect("create_invitation");

    super::invitations::accept_invitation(&pool, inv.token)
        .await
        .expect("accept_invitation");

    let found = super::invitations::get_invitation_by_token(&pool, inv.token)
        .await
        .expect("get_invitation_by_token")
        .expect("invitation should exist");

    assert!(
        found.accepted_at.is_some(),
        "accepted_at should be set after acceptance"
    );
}
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_delete_invitation() {
    let pool = test_pool().await;
    let (_, user_id, ws_id) = setup_user_and_workspace(&pool).await;

    let email = unique_email();
    let expires = Utc::now() + Duration::days(7);

    let inv = super::invitations::create_invitation(
        &pool,
        &email,
        ws_id,
        UserRole::Member,
        user_id,
        expires,
    )
    .await
    .expect("create_invitation");

    let deleted = super::invitations::delete_invitation(&pool, inv.id)
        .await
        .expect("delete_invitation");
    assert!(deleted, "delete_invitation should return true");

    // Verify it's gone
    let found = super::invitations::get_invitation_by_id(&pool, inv.id)
        .await
        .expect("get_invitation_by_id");
    assert!(found.is_none(), "deleted invitation should not exist");
}
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_resend_invitation() {
    let pool = test_pool().await;
    let (_, user_id, ws_id) = setup_user_and_workspace(&pool).await;

    let email = unique_email();
    let expires = Utc::now() + Duration::days(7);

    let inv = super::invitations::create_invitation(
        &pool,
        &email,
        ws_id,
        UserRole::Member,
        user_id,
        expires,
    )
    .await
    .expect("create_invitation");

    let old_token = inv.token;
    let new_expires = Utc::now() + Duration::days(14);

    let resent = super::invitations::resend_invitation(&pool, inv.id, new_expires)
        .await
        .expect("resend_invitation")
        .expect("should return updated invitation");

    assert_eq!(resent.id, inv.id);
    assert_ne!(
        resent.token, old_token,
        "token should be different after resend"
    );
    assert!(resent.accepted_at.is_none(), "accepted_at should be reset");
}
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_get_pending_invitation_by_email() {
    let pool = test_pool().await;
    let (_, user_id, ws_id) = setup_user_and_workspace(&pool).await;

    let email = unique_email();
    let expires = Utc::now() + Duration::days(7);

    super::invitations::create_invitation(&pool, &email, ws_id, UserRole::Member, user_id, expires)
        .await
        .expect("create_invitation");

    let found = super::invitations::get_pending_invitation_by_email(&pool, &email, ws_id)
        .await
        .expect("get_pending_invitation_by_email");

    assert!(found.is_some(), "should find pending invitation by email");
    assert_eq!(found.expect("checked above").email, email);
}
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_list_all_invitations() {
    let pool = test_pool().await;
    let (_, user_id, ws_id) = setup_user_and_workspace(&pool).await;

    let email = unique_email();
    let expires = Utc::now() + Duration::days(7);

    let inv = super::invitations::create_invitation(
        &pool,
        &email,
        ws_id,
        UserRole::Member,
        user_id,
        expires,
    )
    .await
    .expect("create_invitation");

    // Accept it
    super::invitations::accept_invitation(&pool, inv.token)
        .await
        .expect("accept_invitation");

    // list_all should include accepted invitations
    let all = super::invitations::list_all_invitations(&pool, ws_id)
        .await
        .expect("list_all_invitations");

    let found = all.iter().find(|i| i.id == inv.id);
    assert!(
        found.is_some(),
        "accepted invitation should appear in all list"
    );
    assert!(found.expect("checked above").accepted_at.is_some());
}
