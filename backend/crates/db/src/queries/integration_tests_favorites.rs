//! Integration tests for favorites.
//! Runs against real PostgreSQL. Each test uses unique random data for isolation.

use uuid::Uuid;

use crate::models::*;
use super::test_helpers::*;

// ===========================================================================
// FAVORITES TESTS
// ===========================================================================
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_add_favorite_board() {
    let pool = test_pool().await;
    let (_, user_id, _, board_id, _) = setup_full(&pool).await;

    let fav_id = super::favorites::add_favorite(&pool, user_id, "board", board_id)
        .await
        .expect("add_favorite board");

    assert_ne!(fav_id, Uuid::nil(), "favorite id should be non-nil");

    // Verify it's favorited
    let is_fav = super::favorites::is_favorited(&pool, user_id, "board", board_id)
        .await
        .expect("is_favorited");
    assert!(is_fav, "board should be favorited");
}
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_add_favorite_task() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _, board_id, col_id) = setup_full(&pool).await;

    let task = create_test_task(
        &pool,
        board_id,
        col_id,
        tenant_id,
        user_id,
        "FavTask",
        TaskPriority::Medium,
    )
    .await;

    let fav_id = super::favorites::add_favorite(&pool, user_id, "task", task.id)
        .await
        .expect("add_favorite task");
    assert_ne!(fav_id, Uuid::nil());

    let is_fav = super::favorites::is_favorited(&pool, user_id, "task", task.id)
        .await
        .expect("is_favorited");
    assert!(is_fav);
}
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_list_favorites() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _, board_id, col_id) = setup_full(&pool).await;

    let task = create_test_task(
        &pool,
        board_id,
        col_id,
        tenant_id,
        user_id,
        "FavListTask",
        TaskPriority::High,
    )
    .await;

    super::favorites::add_favorite(&pool, user_id, "board", board_id)
        .await
        .expect("add_favorite board");
    super::favorites::add_favorite(&pool, user_id, "task", task.id)
        .await
        .expect("add_favorite task");

    let favorites = super::favorites::list_favorites(&pool, user_id)
        .await
        .expect("list_favorites");

    // Should contain both favorites
    let entity_ids: Vec<Uuid> = favorites.iter().map(|f| f.entity_id).collect();
    assert!(
        entity_ids.contains(&board_id),
        "should contain favorited board"
    );
    assert!(
        entity_ids.contains(&task.id),
        "should contain favorited task"
    );
}
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_remove_favorite() {
    let pool = test_pool().await;
    let (_, user_id, _, board_id, _) = setup_full(&pool).await;

    super::favorites::add_favorite(&pool, user_id, "board", board_id)
        .await
        .expect("add_favorite");

    let removed = super::favorites::remove_favorite(&pool, user_id, "board", board_id)
        .await
        .expect("remove_favorite");
    assert!(removed, "remove_favorite should return true");

    let is_fav = super::favorites::is_favorited(&pool, user_id, "board", board_id)
        .await
        .expect("is_favorited");
    assert!(!is_fav, "board should no longer be favorited");
}
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_remove_favorite_nonexistent() {
    let pool = test_pool().await;
    let (_, user_id) = setup_user(&pool).await;

    let removed = super::favorites::remove_favorite(&pool, user_id, "board", Uuid::new_v4())
        .await
        .expect("remove_favorite");
    assert!(
        !removed,
        "removing nonexistent favorite should return false"
    );
}
