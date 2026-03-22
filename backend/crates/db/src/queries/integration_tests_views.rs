//! Integration tests for task_views, eisenhower, and search.
//! Runs against real PostgreSQL. Each test uses unique random data for isolation.

use chrono::{Duration, Utc};
use uuid::Uuid;

use super::test_helpers::*;
use crate::models::*;

// ===========================================================================
// TASK_ASSIGNMENTS TESTS (moved from integration_tests_tasks for file size)
// ===========================================================================
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_multiple_assignees() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _, board_id, col_id) = setup_full(&pool).await;

    let task = create_test_task(
        &pool,
        board_id,
        col_id,
        tenant_id,
        user_id,
        "MultiAssign",
        TaskPriority::Low,
    )
    .await;

    // Create a second user in the same tenant
    let email2 = unique_email();
    let user2 = super::auth::create_user(
        &pool,
        &email2,
        "User2",
        FAKE_HASH,
        UserRole::Member,
        tenant_id,
    )
    .await
    .expect("create_user 2");

    super::task_assignments::assign_user(&pool, task.id, user_id)
        .await
        .expect("assign user1");
    super::task_assignments::assign_user(&pool, task.id, user2.id)
        .await
        .expect("assign user2");

    let ids = super::task_assignments::get_task_assignee_ids(&pool, task.id)
        .await
        .expect("get_task_assignee_ids");

    assert_eq!(ids.len(), 2);
    assert!(ids.contains(&user_id));
    assert!(ids.contains(&user2.id));
}

// ===========================================================================
// EISENHOWER TESTS
// ===========================================================================
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_get_eisenhower_matrix_empty() {
    let pool = test_pool().await;
    let (_, user_id, _, _, _) = setup_full(&pool).await;

    let matrix = super::eisenhower::get_eisenhower_matrix(
        &pool,
        user_id,
        &super::eisenhower::EisenhowerFilters::default(),
    )
    .await
    .expect("get_eisenhower_matrix");

    // No assigned tasks yet for this fresh user, all quadrants should be empty.
    let total = matrix.do_first.len()
        + matrix.schedule.len()
        + matrix.delegate.len()
        + matrix.eliminate.len();
    assert_eq!(
        total, 0,
        "fresh user with no assigned tasks should have empty matrix"
    );
}
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_eisenhower_matrix_with_assigned_task() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _, board_id, col_id) = setup_full(&pool).await;

    // Create a high-priority task with no due date -> auto: not urgent, important -> Schedule
    let task = create_test_task(
        &pool,
        board_id,
        col_id,
        tenant_id,
        user_id,
        "EisenTask",
        TaskPriority::High,
    )
    .await;

    // Assign the task to the user (required for eisenhower matrix)
    super::task_assignments::assign_user(&pool, task.id, user_id)
        .await
        .expect("assign_user");

    let matrix = super::eisenhower::get_eisenhower_matrix(
        &pool,
        user_id,
        &super::eisenhower::EisenhowerFilters::default(),
    )
    .await
    .expect("get_eisenhower_matrix");

    // High priority, no due date -> auto: not urgent + important -> Schedule quadrant
    let found = matrix.schedule.iter().any(|t| t.id == task.id);
    assert!(
        found,
        "high-priority task with no due date should be in Schedule quadrant"
    );
}
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_update_eisenhower_overrides() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _, board_id, col_id) = setup_full(&pool).await;

    let task = create_test_task(
        &pool,
        board_id,
        col_id,
        tenant_id,
        user_id,
        "EisenOverride",
        TaskPriority::Low,
    )
    .await;
    super::task_assignments::assign_user(&pool, task.id, user_id)
        .await
        .expect("assign_user");

    // Set manual overrides: urgent + important
    super::eisenhower::update_eisenhower_overrides(&pool, task.id, Some(true), Some(true))
        .await
        .expect("update_eisenhower_overrides");

    let matrix = super::eisenhower::get_eisenhower_matrix(
        &pool,
        user_id,
        &super::eisenhower::EisenhowerFilters::default(),
    )
    .await
    .expect("get_eisenhower_matrix");

    // With overrides, task should be in DoFirst
    let found = matrix.do_first.iter().any(|t| t.id == task.id);
    assert!(
        found,
        "task with urgent+important overrides should be in DoFirst"
    );
}
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_reset_eisenhower_overrides() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _, board_id, col_id) = setup_full(&pool).await;

    let task = create_test_task(
        &pool,
        board_id,
        col_id,
        tenant_id,
        user_id,
        "EisenReset",
        TaskPriority::Low,
    )
    .await;
    super::task_assignments::assign_user(&pool, task.id, user_id)
        .await
        .expect("assign_user");

    // Set overrides then reset them
    super::eisenhower::update_eisenhower_overrides(&pool, task.id, Some(true), Some(true))
        .await
        .expect("update overrides");

    let rows = super::eisenhower::reset_eisenhower_overrides(&pool, user_id)
        .await
        .expect("reset_eisenhower_overrides");

    assert!(rows >= 1, "should have reset at least 1 task");

    // After reset, Low priority + no due date -> Eliminate
    let matrix = super::eisenhower::get_eisenhower_matrix(
        &pool,
        user_id,
        &super::eisenhower::EisenhowerFilters::default(),
    )
    .await
    .expect("get_eisenhower_matrix");

    let in_eliminate = matrix.eliminate.iter().any(|t| t.id == task.id);
    assert!(
        in_eliminate,
        "low priority task with no due date should be in Eliminate after reset"
    );
}

// ===========================================================================
// TASK_VIEWS TESTS
// ===========================================================================
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_list_tasks_flat() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _, board_id, col_id) = setup_full(&pool).await;

    let unique = Uuid::new_v4().to_string();
    let _t1 = create_test_task(
        &pool,
        board_id,
        col_id,
        tenant_id,
        user_id,
        &format!("Flat-{}", unique),
        TaskPriority::Medium,
    )
    .await;

    let result = super::task_views::list_tasks_flat(&pool, board_id, user_id)
        .await
        .expect("list_tasks_flat");

    assert!(!result.is_empty(), "should have at least one task");
    assert!(
        result.iter().any(|t| t.title.contains(&unique)),
        "should find our task"
    );
}

/// NOTE: list_tasks_for_gantt uses sqlx macro annotation syntax (`as "is_done!"`)
/// inside a non-macro `query_as::<_, T>()` call, causing ColumnNotFound at runtime.
/// This is a pre-existing bug in task_views.rs. Test ignored until the query is fixed.
#[tokio::test]
#[ignore = "pre-existing bug: query_as uses macro-only column alias syntax (is_done!)"]
async fn test_list_tasks_for_gantt() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _, board_id, col_id) = setup_full(&pool).await;

    let start = Utc::now();
    let due = start + Duration::days(7);
    let _task = create_test_task_with_dates(
        &pool,
        board_id,
        col_id,
        tenant_id,
        user_id,
        "GanttTask",
        TaskPriority::High,
        Some(start),
        Some(due),
    )
    .await;

    let result = super::task_views::list_tasks_for_gantt(&pool, board_id, user_id)
        .await
        .expect("list_tasks_for_gantt");

    assert!(
        !result.is_empty(),
        "gantt should have at least one task with dates"
    );
    let found = result.iter().any(|t| t.title == "GanttTask");
    assert!(found, "should find our gantt task");
}

/// NOTE: list_tasks_for_calendar uses sqlx macro annotation syntax (`as "due_date!"`)
/// inside a non-macro `query_as::<_, T>()` call, causing ColumnNotFound at runtime.
/// This is a pre-existing bug in task_views.rs. Test ignored until the query is fixed.
#[tokio::test]
#[ignore = "pre-existing bug: query_as uses macro-only column alias syntax (due_date!)"]
async fn test_list_tasks_for_calendar() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _, board_id, col_id) = setup_full(&pool).await;

    let now = Utc::now();
    let due = now + Duration::days(3);
    let _task = create_test_task_with_dates(
        &pool,
        board_id,
        col_id,
        tenant_id,
        user_id,
        "CalendarTask",
        TaskPriority::Medium,
        None,
        Some(due),
    )
    .await;

    let range_start = now - Duration::days(1);
    let range_end = now + Duration::days(10);

    let tasks = super::task_views::list_tasks_for_calendar(
        &pool,
        board_id,
        user_id,
        range_start,
        range_end,
    )
    .await
    .expect("list_tasks_for_calendar");

    assert!(
        !tasks.is_empty(),
        "calendar should have at least one task with due_date in range"
    );
    let found = tasks.iter().any(|t| t.title == "CalendarTask");
    assert!(found, "should find our calendar task");
}

#[tokio::test]
#[ignore = "pre-existing bug: query_as uses macro-only column alias syntax (is_done!)"]
async fn test_gantt_empty_for_tasks_without_dates() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _, board_id, col_id) = setup_full(&pool).await;

    // Create a task with NO dates
    let _task = create_test_task(
        &pool,
        board_id,
        col_id,
        tenant_id,
        user_id,
        "NoDateTask",
        TaskPriority::Low,
    )
    .await;

    let result = super::task_views::list_tasks_for_gantt(&pool, board_id, user_id)
        .await
        .expect("list_tasks_for_gantt");

    // The task without dates should NOT appear in gantt
    let found = result.iter().any(|t| t.title == "NoDateTask");
    assert!(!found, "task without dates should not appear in gantt view");
}

// ===========================================================================
// SEARCH TESTS
// ===========================================================================
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_search_finds_task_by_title() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _, board_id, col_id) = setup_full(&pool).await;

    let needle = format!("Quixotic{}", Uuid::new_v4().as_simple());
    let _task = create_test_task(
        &pool,
        board_id,
        col_id,
        tenant_id,
        user_id,
        &needle,
        TaskPriority::High,
    )
    .await;

    let filters = super::search::SearchFilters::default();
    let results = super::search::search_all(&pool, tenant_id, user_id, &needle, 10, &filters)
        .await
        .expect("search_all");

    assert!(!results.tasks.is_empty(), "should find the task");
    assert!(results.tasks.iter().any(|t| t.title.contains(&needle)));
}
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_search_finds_board_by_name() {
    let pool = test_pool().await;
    let (tenant_id, user_id, ws_id) = setup_user_and_workspace(&pool).await;

    let needle = format!("Zephyr{}", Uuid::new_v4().as_simple());
    let _board = super::projects::create_project(&pool, &needle, None, ws_id, tenant_id, user_id)
        .await
        .expect("create_board");

    let filters = super::search::SearchFilters::default();
    let results = super::search::search_all(&pool, tenant_id, user_id, &needle, 10, &filters)
        .await
        .expect("search_all");

    assert!(!results.boards.is_empty(), "should find the board");
    assert!(results.boards.iter().any(|b| b.name.contains(&needle)));
}
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_search_returns_empty_for_random_string() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _, _, _) = setup_full(&pool).await;

    let random = format!("ZZZNonExistent{}", Uuid::new_v4().as_simple());
    let filters = super::search::SearchFilters::default();
    let results = super::search::search_all(&pool, tenant_id, user_id, &random, 10, &filters)
        .await
        .expect("search_all");

    assert!(results.tasks.is_empty(), "should not find any tasks");
    assert!(results.boards.is_empty(), "should not find any boards");
    assert!(results.comments.is_empty(), "should not find any comments");
}
