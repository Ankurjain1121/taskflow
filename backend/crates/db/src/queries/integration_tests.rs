//! Integration tests for query layer -- runs against real PostgreSQL.
//! Each test uses unique random identifiers to avoid conflicts.
//! Data created by `create_user_with_tenant` is committed (it uses its own tx),
//! so we rely on unique emails/UUIDs for isolation.

use chrono::{Duration, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{BoardMemberRole, TaskPriority, UserRole};
use crate::queries::{auth, boards, comments, tasks, workspaces};

/// Connect to the real test database.
async fn test_pool() -> PgPool {
    PgPool::connect(
        "postgresql://taskflow:REDACTED_PG_PASSWORD@localhost:5433/taskflow",
    )
    .await
    .expect("Failed to connect to test database")
}

/// Unique email that won't collide across test runs.
fn unique_email() -> String {
    format!("inttest-{}@example.com", Uuid::new_v4())
}

const FAKE_HASH: &str = "$argon2id$v=19$m=19456,t=2,p=1$fake_salt$fake_hash_for_test";

// ---------------------------------------------------------------------------
// Helper: create a user+tenant and return (tenant_id, user_id)
// ---------------------------------------------------------------------------
async fn setup_user(pool: &PgPool) -> (Uuid, Uuid) {
    let user = auth::create_user_with_tenant(pool, &unique_email(), "IntTest User", FAKE_HASH)
        .await
        .expect("create_user_with_tenant");
    (user.tenant_id, user.id)
}

/// Helper: create user + workspace, return (tenant_id, user_id, workspace_id)
async fn setup_user_and_workspace(pool: &PgPool) -> (Uuid, Uuid, Uuid) {
    let (tenant_id, user_id) = setup_user(pool).await;
    let ws = workspaces::create_workspace(pool, "IntTest WS", None, tenant_id, user_id)
        .await
        .expect("create_workspace");
    (tenant_id, user_id, ws.id)
}

/// Helper: create user + workspace + project, return (tenant_id, user_id, workspace_id, project_id, default_task_list_id)
async fn setup_full(pool: &PgPool) -> (Uuid, Uuid, Uuid, Uuid, Uuid) {
    let (tenant_id, user_id, ws_id) = setup_user_and_workspace(pool).await;
    let bwc = projects::create_board(pool, "IntTest Board", None, ws_id, tenant_id, user_id)
        .await
        .expect("create_board");
    let first_list_id = bwc.task_lists[0].id;
    (tenant_id, user_id, ws_id, bwc.project.id, first_list_id)
}

// ===========================================================================
// AUTH TESTS
// ===========================================================================

#[tokio::test]
async fn test_create_user_with_tenant() {
    let pool = test_pool().await;
    let email = unique_email();
    let user = auth::create_user_with_tenant(&pool, &email, "Create Test", FAKE_HASH)
        .await
        .expect("create_user_with_tenant");

    assert_eq!(user.email, email);
    assert_eq!(user.name, "Create Test");
    assert_eq!(user.role, UserRole::Admin);
    assert!(!user.onboarding_completed);
    assert!(user.deleted_at.is_none());
}

#[tokio::test]
async fn test_get_user_by_email() {
    let pool = test_pool().await;
    let email = unique_email();
    let created = auth::create_user_with_tenant(&pool, &email, "ByEmail", FAKE_HASH)
        .await
        .unwrap();

    let found = auth::get_user_by_email(&pool, &email)
        .await
        .expect("get_user_by_email")
        .expect("should find user");

    assert_eq!(found.id, created.id);
    assert_eq!(found.email, email);
}

#[tokio::test]
async fn test_get_user_by_email_not_found() {
    let pool = test_pool().await;
    let result = auth::get_user_by_email(&pool, "nonexistent-xyz@example.com")
        .await
        .expect("get_user_by_email");
    assert!(result.is_none());
}

#[tokio::test]
async fn test_get_user_by_id() {
    let pool = test_pool().await;
    let (_, user_id) = setup_user(&pool).await;

    let found = auth::get_user_by_id(&pool, user_id)
        .await
        .expect("get_user_by_id")
        .expect("should find user");

    assert_eq!(found.id, user_id);
}

#[tokio::test]
async fn test_create_and_get_refresh_token() {
    let pool = test_pool().await;
    let (_, user_id) = setup_user(&pool).await;

    let expires = Utc::now() + Duration::hours(24);
    let token_hash = format!("hash-{}", Uuid::new_v4());
    let token_id = auth::create_refresh_token(
        &pool,
        Uuid::new_v4(),
        user_id,
        &token_hash,
        expires,
        None,
        None,
    )
    .await
    .expect("create_refresh_token");

    let token = auth::get_refresh_token(&pool, token_id)
        .await
        .expect("get_refresh_token")
        .expect("should find token");

    assert_eq!(token.id, token_id);
    assert_eq!(token.user_id, user_id);
    assert_eq!(token.token_hash, token_hash);
    assert!(token.revoked_at.is_none());
}

#[tokio::test]
async fn test_revoke_refresh_token() {
    let pool = test_pool().await;
    let (_, user_id) = setup_user(&pool).await;

    let expires = Utc::now() + Duration::hours(24);
    let token_id = auth::create_refresh_token(
        &pool,
        Uuid::new_v4(),
        user_id,
        "revoke-test",
        expires,
        None,
        None,
    )
    .await
    .unwrap();

    auth::revoke_refresh_token(&pool, token_id).await.unwrap();

    let token = auth::get_refresh_token(&pool, token_id)
        .await
        .unwrap()
        .expect("token should still exist");

    assert!(token.revoked_at.is_some());
}

#[tokio::test]
async fn test_revoke_all_user_tokens() {
    let pool = test_pool().await;
    let (_, user_id) = setup_user(&pool).await;

    let expires = Utc::now() + Duration::hours(24);
    let id1 =
        auth::create_refresh_token(&pool, Uuid::new_v4(), user_id, "all-1", expires, None, None)
            .await
            .unwrap();
    let id2 =
        auth::create_refresh_token(&pool, Uuid::new_v4(), user_id, "all-2", expires, None, None)
            .await
            .unwrap();

    auth::revoke_all_user_tokens(&pool, user_id).await.unwrap();

    let t1 = auth::get_refresh_token(&pool, id1).await.unwrap().unwrap();
    let t2 = auth::get_refresh_token(&pool, id2).await.unwrap().unwrap();
    assert!(t1.revoked_at.is_some());
    assert!(t2.revoked_at.is_some());
}

#[tokio::test]
async fn test_create_password_reset_token() {
    let pool = test_pool().await;
    let (_, user_id) = setup_user(&pool).await;

    let expires = Utc::now() + Duration::hours(1);
    let token_hash = format!("reset-{}", Uuid::new_v4());
    let token_id = auth::create_password_reset_token(&pool, user_id, &token_hash, expires)
        .await
        .expect("create_password_reset_token");

    let found = auth::get_valid_reset_token(&pool, &token_hash)
        .await
        .expect("get_valid_reset_token")
        .expect("should find token");

    assert_eq!(found.0, token_id);
    assert_eq!(found.1, user_id);
}

#[tokio::test]
async fn test_update_user_password() {
    let pool = test_pool().await;
    let email = unique_email();
    let user = auth::create_user_with_tenant(&pool, &email, "PwdUpdate", FAKE_HASH)
        .await
        .unwrap();

    let new_hash = "$argon2id$v=19$m=19456,t=2,p=1$new_salt$new_hash_updated";
    auth::update_user_password(&pool, user.id, new_hash)
        .await
        .unwrap();

    let updated = auth::get_user_by_id(&pool, user.id).await.unwrap().unwrap();
    assert_eq!(updated.password_hash, new_hash);
}

#[tokio::test]
async fn test_create_user_via_invitation() {
    let pool = test_pool().await;
    let (tenant_id, _) = setup_user(&pool).await;

    let email = unique_email();
    let user = auth::create_user(
        &pool,
        &email,
        "Invited User",
        FAKE_HASH,
        UserRole::Member,
        tenant_id,
    )
    .await
    .expect("create_user (invitation)");

    assert_eq!(user.email, email);
    assert_eq!(user.role, UserRole::Member);
    assert_eq!(user.tenant_id, tenant_id);
    assert!(!user.onboarding_completed);
}

// ===========================================================================
// WORKSPACE TESTS
// ===========================================================================

#[tokio::test]
async fn test_create_workspace() {
    let pool = test_pool().await;
    let (tenant_id, user_id) = setup_user(&pool).await;

    let ws =
        workspaces::create_workspace(&pool, "WS Create Test", Some("A desc"), tenant_id, user_id)
            .await
            .expect("create_workspace");

    assert_eq!(ws.name, "WS Create Test");
    assert_eq!(ws.description.as_deref(), Some("A desc"));
    assert_eq!(ws.tenant_id, tenant_id);
    assert_eq!(ws.created_by_id, user_id);
    assert!(ws.deleted_at.is_none());

    // Creator should be a member
    let is_member = workspaces::is_workspace_member(&pool, ws.id, user_id)
        .await
        .unwrap();
    assert!(is_member);
}

#[tokio::test]
async fn test_list_workspaces_for_user() {
    let pool = test_pool().await;
    let (tenant_id, user_id) = setup_user(&pool).await;

    workspaces::create_workspace(&pool, "List WS 1", None, tenant_id, user_id)
        .await
        .unwrap();
    workspaces::create_workspace(&pool, "List WS 2", None, tenant_id, user_id)
        .await
        .unwrap();

    let list = workspaces::list_workspaces_for_user(&pool, user_id, tenant_id)
        .await
        .expect("list_workspaces_for_user");

    assert!(list.len() >= 2);
    let names: Vec<&str> = list.iter().map(|w| w.name.as_str()).collect();
    assert!(names.contains(&"List WS 1"));
    assert!(names.contains(&"List WS 2"));
}

#[tokio::test]
async fn test_get_workspace_by_id() {
    let pool = test_pool().await;
    let (tenant_id, user_id, ws_id) = setup_user_and_workspace(&pool).await;

    let ws_with_members = workspaces::get_workspace_by_id(&pool, ws_id, tenant_id)
        .await
        .expect("get_workspace_by_id")
        .expect("should find workspace");

    assert_eq!(ws_with_members.workspace.id, ws_id);
    assert!(!ws_with_members.members.is_empty());
    assert_eq!(ws_with_members.members[0].user_id, user_id);
}

#[tokio::test]
async fn test_update_workspace() {
    let pool = test_pool().await;
    let (_, _, ws_id) = setup_user_and_workspace(&pool).await;

    let updated = workspaces::update_workspace(&pool, ws_id, "Updated Name", Some("New desc"))
        .await
        .expect("update_workspace")
        .expect("should return updated workspace");

    assert_eq!(updated.name, "Updated Name");
    assert_eq!(updated.description.as_deref(), Some("New desc"));
}

#[tokio::test]
async fn test_soft_delete_workspace() {
    let pool = test_pool().await;
    let (tenant_id, user_id, ws_id) = setup_user_and_workspace(&pool).await;

    let deleted = workspaces::soft_delete_workspace(&pool, ws_id)
        .await
        .unwrap();
    assert!(deleted);

    // Should no longer appear in list
    let list = workspaces::list_workspaces_for_user(&pool, user_id, tenant_id)
        .await
        .unwrap();
    assert!(!list.iter().any(|w| w.id == ws_id));
}

#[tokio::test]
async fn test_is_workspace_member() {
    let pool = test_pool().await;
    let (_, user_id, ws_id) = setup_user_and_workspace(&pool).await;

    let is_member = workspaces::is_workspace_member(&pool, ws_id, user_id)
        .await
        .unwrap();
    assert!(is_member);

    let random_user = Uuid::new_v4();
    let not_member = workspaces::is_workspace_member(&pool, ws_id, random_user)
        .await
        .unwrap();
    assert!(!not_member);
}

#[tokio::test]
async fn test_add_workspace_member() {
    let pool = test_pool().await;
    let (tenant_id, _user_id, ws_id) = setup_user_and_workspace(&pool).await;

    // Create a second user in the same tenant
    let email2 = unique_email();
    let user2 = auth::create_user(
        &pool,
        &email2,
        "WS Member 2",
        FAKE_HASH,
        UserRole::Member,
        tenant_id,
    )
    .await
    .unwrap();

    let member = workspaces::add_workspace_member(&pool, ws_id, user2.id)
        .await
        .unwrap();
    assert_eq!(member.workspace_id, ws_id);
    assert_eq!(member.user_id, user2.id);

    let is_member = workspaces::is_workspace_member(&pool, ws_id, user2.id)
        .await
        .unwrap();
    assert!(is_member);
}

#[tokio::test]
async fn test_remove_workspace_member() {
    let pool = test_pool().await;
    let (tenant_id, _, ws_id) = setup_user_and_workspace(&pool).await;

    let email2 = unique_email();
    let user2 = auth::create_user(
        &pool,
        &email2,
        "WS Remove",
        FAKE_HASH,
        UserRole::Member,
        tenant_id,
    )
    .await
    .unwrap();

    workspaces::add_workspace_member(&pool, ws_id, user2.id)
        .await
        .unwrap();

    let removed = workspaces::remove_workspace_member(&pool, ws_id, user2.id)
        .await
        .unwrap();
    assert!(removed);

    let still_member = workspaces::is_workspace_member(&pool, ws_id, user2.id)
        .await
        .unwrap();
    assert!(!still_member);
}

// ===========================================================================
// BOARD TESTS
// ===========================================================================

#[tokio::test]
async fn test_create_board() {
    let pool = test_pool().await;
    let (tenant_id, user_id, ws_id) = setup_user_and_workspace(&pool).await;

    let bwc = projects::create_board(
        &pool,
        "Board Create",
        Some("desc"),
        ws_id,
        tenant_id,
        user_id,
    )
    .await
    .expect("create_board");

    assert_eq!(bwc.project.name, "Board Create");
    assert_eq!(bwc.project.description.as_deref(), Some("desc"));
    assert_eq!(bwc.project.workspace_id, ws_id);
    assert_eq!(bwc.project.tenant_id, tenant_id);
    assert_eq!(bwc.project.created_by_id, user_id);
    // Default columns: To Do, In Progress, Done
    assert_eq!(bwc.statuses.len(), 5);

    // Creator should be a board member
    let is_member = projects::is_board_member(&pool, bwc.project.id, user_id)
        .await
        .unwrap();
    assert!(is_member);
}

#[tokio::test]
async fn test_list_boards_by_workspace() {
    let pool = test_pool().await;
    let (tenant_id, user_id, ws_id) = setup_user_and_workspace(&pool).await;

    projects::create_board(&pool, "List Board 1", None, ws_id, tenant_id, user_id)
        .await
        .unwrap();
    projects::create_board(&pool, "List Board 2", None, ws_id, tenant_id, user_id)
        .await
        .unwrap();

    let list = projects::list_boards_by_workspace(&pool, ws_id, user_id)
        .await
        .unwrap();
    assert!(list.len() >= 2);
    let names: Vec<&str> = list.iter().map(|b| b.name.as_str()).collect();
    assert!(names.contains(&"List Board 1"));
    assert!(names.contains(&"List Board 2"));
}

#[tokio::test]
async fn test_get_board_by_id() {
    let pool = test_pool().await;
    let (tenant_id, user_id, ws_id) = setup_user_and_workspace(&pool).await;

    let bwc = projects::create_board(&pool, "Get Board", None, ws_id, tenant_id, user_id)
        .await
        .unwrap();

    let fetched = projects::get_board_by_id(&pool, bwc.project.id, user_id)
        .await
        .unwrap()
        .expect("should find board");

    assert_eq!(fetched.project.id, bwc.project.id);
    assert_eq!(fetched.statuses.len(), 5);
}

#[tokio::test]
async fn test_get_board_by_id_non_member() {
    let pool = test_pool().await;
    let (tenant_id, user_id, ws_id) = setup_user_and_workspace(&pool).await;

    let bwc = projects::create_board(&pool, "NonMember Board", None, ws_id, tenant_id, user_id)
        .await
        .unwrap();

    // A random user who is NOT a member should get None
    let random_user = Uuid::new_v4();
    let result = projects::get_board_by_id(&pool, bwc.project.id, random_user)
        .await
        .unwrap();
    assert!(result.is_none());
}

#[tokio::test]
async fn test_soft_delete_board() {
    let pool = test_pool().await;
    let (tenant_id, user_id, ws_id) = setup_user_and_workspace(&pool).await;

    let bwc = projects::create_board(&pool, "Delete Board", None, ws_id, tenant_id, user_id)
        .await
        .unwrap();

    let deleted = projects::soft_delete_board(&pool, bwc.project.id)
        .await
        .unwrap();
    assert!(deleted);

    // Should not appear in list
    let list = projects::list_boards_by_workspace(&pool, ws_id, user_id)
        .await
        .unwrap();
    assert!(!list.iter().any(|b| b.id == bwc.project.id));
}

#[tokio::test]
async fn test_add_board_member() {
    let pool = test_pool().await;
    let (tenant_id, user_id, ws_id) = setup_user_and_workspace(&pool).await;

    let bwc = projects::create_board(&pool, "AddMember Board", None, ws_id, tenant_id, user_id)
        .await
        .unwrap();

    let email2 = unique_email();
    let user2 = auth::create_user(
        &pool,
        &email2,
        "Board Member",
        FAKE_HASH,
        UserRole::Member,
        tenant_id,
    )
    .await
    .unwrap();

    let member = projects::add_board_member(&pool, bwc.project.id, user2.id, BoardMemberRole::Viewer)
        .await
        .unwrap();

    assert_eq!(member.project_id, bwc.project.id);
    assert_eq!(member.user_id, user2.id);
    assert_eq!(member.role, BoardMemberRole::Viewer);

    let is_member = projects::is_board_member(&pool, bwc.project.id, user2.id)
        .await
        .unwrap();
    assert!(is_member);
}

#[tokio::test]
async fn test_remove_board_member() {
    let pool = test_pool().await;
    let (tenant_id, user_id, ws_id) = setup_user_and_workspace(&pool).await;

    let bwc = projects::create_board(&pool, "RemoveMember Board", None, ws_id, tenant_id, user_id)
        .await
        .unwrap();

    let email2 = unique_email();
    let user2 = auth::create_user(
        &pool,
        &email2,
        "RemBoardMem",
        FAKE_HASH,
        UserRole::Member,
        tenant_id,
    )
    .await
    .unwrap();

    projects::add_board_member(&pool, bwc.project.id, user2.id, BoardMemberRole::Editor)
        .await
        .unwrap();

    let removed = projects::remove_board_member(&pool, bwc.project.id, user2.id)
        .await
        .unwrap();
    assert!(removed);

    let still_member = projects::is_board_member(&pool, bwc.project.id, user2.id)
        .await
        .unwrap();
    assert!(!still_member);
}

// ===========================================================================
// COMMENT TESTS
// ===========================================================================

/// Helper: create a task inside a board for comment testing.
async fn create_test_task(pool: &PgPool) -> (Uuid, Uuid, Uuid) {
    let (tenant_id, user_id, _, board_id, col_id) = setup_full(pool).await;

    let input = tasks::CreateTaskInput {
        title: "Comment Task".to_string(),
        description: None,
        priority: TaskPriority::Medium,
        due_date: None,
        start_date: None,
        estimated_hours: None,
        status_id: None,
        task_list_id: Some(col_id),
        milestone_id: None,
        assignee_ids: None,
        label_ids: None,
        parent_task_id: None,
    };

    let task = tasks::create_task(pool, board_id, input, tenant_id, user_id)
        .await
        .expect("create_task for comment tests");

    (task.id, user_id, tenant_id)
}

#[tokio::test]
async fn test_create_comment() {
    let pool = test_pool().await;
    let (task_id, user_id, _) = create_test_task(&pool).await;

    let comment = comments::create_comment(
        &pool,
        task_id,
        user_id,
        "Hello from integration test",
        None,
        &[],
    )
    .await
    .expect("create_comment");

    assert_eq!(comment.content, "Hello from integration test");
    assert_eq!(comment.task_id, task_id);
    assert_eq!(comment.author_id, user_id);
    assert!(comment.parent_id.is_none());
}

#[tokio::test]
async fn test_list_comments_by_task() {
    let pool = test_pool().await;
    let (task_id, user_id, _) = create_test_task(&pool).await;

    comments::create_comment(&pool, task_id, user_id, "Comment 1", None, &[])
        .await
        .unwrap();
    comments::create_comment(&pool, task_id, user_id, "Comment 2", None, &[])
        .await
        .unwrap();

    let list = comments::list_comments_by_task(&pool, task_id)
        .await
        .expect("list_comments_by_task");

    assert!(list.len() >= 2);
    let contents: Vec<&str> = list.iter().map(|c| c.content.as_str()).collect();
    assert!(contents.contains(&"Comment 1"));
    assert!(contents.contains(&"Comment 2"));
}
