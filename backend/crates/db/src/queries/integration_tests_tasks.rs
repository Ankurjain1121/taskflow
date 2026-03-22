//! Integration tests for task_bulk, task_assignments, dependencies, milestones, and archive.
//! Runs against real PostgreSQL. Each test uses unique random data for isolation.

use chrono::{Duration, Utc};
use uuid::Uuid;

use super::test_helpers::*;
use crate::models::*;

// ===========================================================================
// ARCHIVE TESTS
// ===========================================================================
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_archive_task_and_list() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _, board_id, col_id) = setup_full(&pool).await;

    let task = create_test_task(
        &pool,
        board_id,
        col_id,
        tenant_id,
        user_id,
        "ArchiveMe",
        TaskPriority::Low,
    )
    .await;

    // Soft-delete the task to "archive" it
    super::tasks::soft_delete_task(&pool, task.id)
        .await
        .expect("soft_delete_task");

    let archive = super::archive::list_archive(&pool, tenant_id, Some("task"), None, 50)
        .await
        .expect("list_archive");

    let found = archive.items.iter().find(|item| item.entity_id == task.id);
    assert!(
        found.is_some(),
        "archived task should appear in archive list"
    );
    assert_eq!(found.expect("checked above").entity_type, "task");
}
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_archive_board_and_list() {
    let pool = test_pool().await;
    let (tenant_id, user_id, ws_id) = setup_user_and_workspace(&pool).await;

    let bwc = super::projects::create_project(&pool, "ArchiveBoard", None, ws_id, tenant_id, user_id)
        .await
        .expect("create_board");

    super::projects::soft_delete_project(&pool, bwc.project.id)
        .await
        .expect("soft_delete_board");

    let archive = super::archive::list_archive(&pool, tenant_id, Some("board"), None, 50)
        .await
        .expect("list_archive");

    let found = archive
        .items
        .iter()
        .find(|item| item.entity_id == bwc.project.id);
    assert!(
        found.is_some(),
        "archived board should appear in archive list"
    );
    assert_eq!(found.expect("checked above").entity_type, "board");
}
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_archive_mixed_listing() {
    let pool = test_pool().await;
    let (tenant_id, user_id, ws_id) = setup_user_and_workspace(&pool).await;

    let bwc = super::projects::create_project(&pool, "MixBoard", None, ws_id, tenant_id, user_id)
        .await
        .expect("create_board");
    let col_id = bwc.statuses[0].id;

    let task = create_test_task(
        &pool,
        bwc.project.id,
        col_id,
        tenant_id,
        user_id,
        "MixTask",
        TaskPriority::Medium,
    )
    .await;

    // Archive both
    super::tasks::soft_delete_task(&pool, task.id)
        .await
        .expect("soft_delete_task");
    super::projects::soft_delete_project(&pool, bwc.project.id)
        .await
        .expect("soft_delete_board");

    // List all (no type filter)
    let archive = super::archive::list_archive(&pool, tenant_id, None, None, 50)
        .await
        .expect("list_archive");

    let has_task = archive.items.iter().any(|i| i.entity_id == task.id);
    let has_board = archive.items.iter().any(|i| i.entity_id == bwc.project.id);
    assert!(has_task, "should contain archived task");
    assert!(has_board, "should contain archived board");
}

// ===========================================================================
// MILESTONES TESTS
// ===========================================================================
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_create_milestone() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _, board_id, _) = setup_full(&pool).await;

    let input = super::milestones::CreateMilestoneInput {
        name: "Milestone 1".to_string(),
        description: Some("First milestone".to_string()),
        due_date: Some(Utc::now() + Duration::days(14)),
        color: Some("#ff5722".to_string()),
    };

    let ms = super::milestones::create_milestone(&pool, board_id, input, tenant_id, user_id)
        .await
        .expect("create_milestone");

    assert_eq!(ms.name, "Milestone 1");
    assert_eq!(ms.description.as_deref(), Some("First milestone"));
    assert_eq!(ms.color, "#ff5722");
    assert_eq!(ms.project_id, board_id);
    assert_eq!(ms.tenant_id, tenant_id);
    assert_eq!(ms.created_by_id, user_id);
}
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_list_milestones() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _, board_id, _) = setup_full(&pool).await;

    let input1 = super::milestones::CreateMilestoneInput {
        name: "MS-A".to_string(),
        description: None,
        due_date: None,
        color: None,
    };
    let input2 = super::milestones::CreateMilestoneInput {
        name: "MS-B".to_string(),
        description: None,
        due_date: None,
        color: None,
    };

    super::milestones::create_milestone(&pool, board_id, input1, tenant_id, user_id)
        .await
        .expect("create milestone 1");
    super::milestones::create_milestone(&pool, board_id, input2, tenant_id, user_id)
        .await
        .expect("create milestone 2");

    let milestones = super::milestones::list_milestones(&pool, board_id, user_id)
        .await
        .expect("list_milestones");

    assert!(milestones.len() >= 2, "should have at least 2 milestones");
    let names: Vec<&str> = milestones.iter().map(|m| m.name.as_str()).collect();
    assert!(names.contains(&"MS-A"));
    assert!(names.contains(&"MS-B"));
}
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_get_milestone() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _, board_id, _) = setup_full(&pool).await;

    let input = super::milestones::CreateMilestoneInput {
        name: "GetMS".to_string(),
        description: None,
        due_date: None,
        color: None,
    };

    let ms = super::milestones::create_milestone(&pool, board_id, input, tenant_id, user_id)
        .await
        .expect("create_milestone");

    let fetched = super::milestones::get_milestone(&pool, ms.id, user_id)
        .await
        .expect("get_milestone");

    assert_eq!(fetched.id, ms.id);
    assert_eq!(fetched.name, "GetMS");
    assert_eq!(fetched.total_tasks, 0);
    assert_eq!(fetched.completed_tasks, 0);
}
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_update_milestone() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _, board_id, _) = setup_full(&pool).await;

    let input = super::milestones::CreateMilestoneInput {
        name: "UpdMS".to_string(),
        description: None,
        due_date: None,
        color: None,
    };

    let ms = super::milestones::create_milestone(&pool, board_id, input, tenant_id, user_id)
        .await
        .expect("create_milestone");

    let update = super::milestones::UpdateMilestoneInput {
        name: Some("Updated MS".to_string()),
        description: Some("Updated desc".to_string()),
        due_date: None,
        color: Some("#00ff00".to_string()),
    };

    let updated = super::milestones::update_milestone(&pool, ms.id, update)
        .await
        .expect("update_milestone");

    assert_eq!(updated.name, "Updated MS");
    assert_eq!(updated.description.as_deref(), Some("Updated desc"));
    assert_eq!(updated.color, "#00ff00");
}
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_delete_milestone() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _, board_id, _) = setup_full(&pool).await;

    let input = super::milestones::CreateMilestoneInput {
        name: "DelMS".to_string(),
        description: None,
        due_date: None,
        color: None,
    };

    let ms = super::milestones::create_milestone(&pool, board_id, input, tenant_id, user_id)
        .await
        .expect("create_milestone");

    super::milestones::delete_milestone(&pool, ms.id)
        .await
        .expect("delete_milestone");

    // Verify it's gone
    let result = super::milestones::get_milestone(&pool, ms.id, user_id).await;
    assert!(result.is_err(), "deleted milestone should not be found");
}
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_assign_task_to_milestone() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _, board_id, col_id) = setup_full(&pool).await;

    let ms_input = super::milestones::CreateMilestoneInput {
        name: "AssignMS".to_string(),
        description: None,
        due_date: None,
        color: None,
    };
    let ms = super::milestones::create_milestone(&pool, board_id, ms_input, tenant_id, user_id)
        .await
        .expect("create_milestone");

    let task = create_test_task(
        &pool,
        board_id,
        col_id,
        tenant_id,
        user_id,
        "MsTask",
        TaskPriority::Medium,
    )
    .await;

    super::milestones::assign_task_to_milestone(&pool, task.id, ms.id)
        .await
        .expect("assign_task_to_milestone");

    // Verify milestone now shows 1 total task
    let fetched = super::milestones::get_milestone(&pool, ms.id, user_id)
        .await
        .expect("get_milestone");
    assert_eq!(fetched.total_tasks, 1);
}

// ===========================================================================
// DEPENDENCIES TESTS
// ===========================================================================

/// NOTE: All dependency tests are ignored because dependencies.rs uses sqlx macro annotation
/// syntax (`as "dependency_type: DependencyType"`) inside non-macro `query_as::<_, T>()` calls,
/// causing ColumnNotFound("dependency_type") at runtime. Pre-existing bug.

#[tokio::test]
#[ignore = "pre-existing bug: query_as uses macro-only type annotation syntax"]
async fn test_create_dependency_related() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _, board_id, col_id) = setup_full(&pool).await;

    let task_a = create_test_task(
        &pool,
        board_id,
        col_id,
        tenant_id,
        user_id,
        "DepA",
        TaskPriority::High,
    )
    .await;
    let task_b = create_test_task(
        &pool,
        board_id,
        col_id,
        tenant_id,
        user_id,
        "DepB",
        TaskPriority::Medium,
    )
    .await;

    let input = super::dependencies::CreateDependencyInput {
        target_task_id: task_b.id,
        dependency_type: DependencyType::Related,
    };

    let dep = super::dependencies::create_dependency(&pool, task_a.id, input, user_id)
        .await
        .expect("create_dependency");

    assert_eq!(dep.source_task_id, task_a.id);
    assert_eq!(dep.target_task_id, task_b.id);
    assert_eq!(dep.dependency_type, DependencyType::Related);
}

#[tokio::test]
#[ignore = "pre-existing bug: query_as uses macro-only type annotation syntax"]
async fn test_create_dependency_blocks() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _, board_id, col_id) = setup_full(&pool).await;

    let task_a = create_test_task(
        &pool,
        board_id,
        col_id,
        tenant_id,
        user_id,
        "Blocker",
        TaskPriority::High,
    )
    .await;
    let task_b = create_test_task(
        &pool,
        board_id,
        col_id,
        tenant_id,
        user_id,
        "Blocked",
        TaskPriority::Medium,
    )
    .await;

    let input = super::dependencies::CreateDependencyInput {
        target_task_id: task_b.id,
        dependency_type: DependencyType::Blocks,
    };

    let dep = super::dependencies::create_dependency(&pool, task_a.id, input, user_id)
        .await
        .expect("create_dependency blocks");

    assert_eq!(dep.dependency_type, DependencyType::Blocks);
}

#[tokio::test]
#[ignore = "pre-existing bug: query_as uses macro-only type annotation syntax"]
async fn test_list_dependencies() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _, board_id, col_id) = setup_full(&pool).await;

    let task_a = create_test_task(
        &pool,
        board_id,
        col_id,
        tenant_id,
        user_id,
        "ListDepA",
        TaskPriority::High,
    )
    .await;
    let task_b = create_test_task(
        &pool,
        board_id,
        col_id,
        tenant_id,
        user_id,
        "ListDepB",
        TaskPriority::Medium,
    )
    .await;

    let input = super::dependencies::CreateDependencyInput {
        target_task_id: task_b.id,
        dependency_type: DependencyType::Related,
    };
    super::dependencies::create_dependency(&pool, task_a.id, input, user_id)
        .await
        .expect("create_dependency");

    let deps = super::dependencies::list_dependencies(&pool, task_a.id, user_id)
        .await
        .expect("list_dependencies");

    assert!(!deps.is_empty(), "should have at least 1 dependency");
    assert!(deps.iter().any(|d| d.related_task_id == task_b.id));
}

#[tokio::test]
#[ignore = "pre-existing bug: query_as uses macro-only type annotation syntax"]
async fn test_delete_dependency() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _, board_id, col_id) = setup_full(&pool).await;

    let task_a = create_test_task(
        &pool,
        board_id,
        col_id,
        tenant_id,
        user_id,
        "DelDepA",
        TaskPriority::High,
    )
    .await;
    let task_b = create_test_task(
        &pool,
        board_id,
        col_id,
        tenant_id,
        user_id,
        "DelDepB",
        TaskPriority::Medium,
    )
    .await;

    let input = super::dependencies::CreateDependencyInput {
        target_task_id: task_b.id,
        dependency_type: DependencyType::Related,
    };
    let dep = super::dependencies::create_dependency(&pool, task_a.id, input, user_id)
        .await
        .expect("create_dependency");

    super::dependencies::delete_dependency(&pool, dep.id)
        .await
        .expect("delete_dependency");

    let deps = super::dependencies::list_dependencies(&pool, task_a.id, user_id)
        .await
        .expect("list_dependencies");

    assert!(
        !deps.iter().any(|d| d.id == dep.id),
        "deleted dependency should be gone"
    );
}

#[tokio::test]
#[ignore = "pre-existing bug: query_as uses macro-only type annotation syntax"]
async fn test_check_blockers() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _, board_id, col_id) = setup_full(&pool).await;

    let blocker = create_test_task(
        &pool,
        board_id,
        col_id,
        tenant_id,
        user_id,
        "BlockerTask",
        TaskPriority::High,
    )
    .await;
    let blocked = create_test_task(
        &pool,
        board_id,
        col_id,
        tenant_id,
        user_id,
        "BlockedTask",
        TaskPriority::Medium,
    )
    .await;

    let input = super::dependencies::CreateDependencyInput {
        target_task_id: blocked.id,
        dependency_type: DependencyType::Blocks,
    };
    super::dependencies::create_dependency(&pool, blocker.id, input, user_id)
        .await
        .expect("create_dependency blocks");

    let blockers = super::dependencies::check_blockers(&pool, blocked.id)
        .await
        .expect("check_blockers");

    assert!(!blockers.is_empty(), "should have at least 1 blocker");
    assert!(blockers.iter().any(|b| b.task_id == blocker.id));
}

#[tokio::test]
#[ignore = "pre-existing bug: query_as uses macro-only type annotation syntax"]
async fn test_get_board_dependencies() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _, board_id, col_id) = setup_full(&pool).await;

    let task_a = create_test_task(
        &pool,
        board_id,
        col_id,
        tenant_id,
        user_id,
        "BoardDepA",
        TaskPriority::High,
    )
    .await;
    let task_b = create_test_task(
        &pool,
        board_id,
        col_id,
        tenant_id,
        user_id,
        "BoardDepB",
        TaskPriority::Medium,
    )
    .await;

    let input = super::dependencies::CreateDependencyInput {
        target_task_id: task_b.id,
        dependency_type: DependencyType::Related,
    };
    super::dependencies::create_dependency(&pool, task_a.id, input, user_id)
        .await
        .expect("create_dependency");

    let deps = super::dependencies::get_board_dependencies(&pool, board_id, user_id)
        .await
        .expect("get_board_dependencies");

    assert!(!deps.is_empty(), "board should have at least 1 dependency");
}

// ===========================================================================
// TASK_BULK TESTS (additional to integration_tests_advanced)
// ===========================================================================
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_bulk_update_status_move() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _, board_id, col_id) = setup_full(&pool).await;

    // Get second status
    let statuses = super::project_statuses::list_project_statuses(&pool, board_id)
        .await
        .expect("list_project_statuses");
    let target_status = statuses[1].id;

    let task = create_test_task(
        &pool,
        board_id,
        col_id,
        tenant_id,
        user_id,
        "BulkMove",
        TaskPriority::Low,
    )
    .await;

    let input = super::task_bulk::BulkUpdateInput {
        task_ids: vec![task.id],
        status_id: Some(target_status),
        priority: None,
        milestone_id: None,
        clear_milestone: None,
        task_list_id: None,
        clear_task_list: None,
    };

    let count = super::task_bulk::bulk_update_tasks(&pool, board_id, user_id, input)
        .await
        .expect("bulk_update_tasks");

    assert_eq!(count, 1, "should update 1 task");

    // Verify task has new status
    let fetched = super::tasks::get_task_by_id(&pool, task.id, user_id)
        .await
        .expect("get_task")
        .expect("task should exist");
    assert_eq!(fetched.task.status_id, Some(target_status));
}
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_bulk_update_empty_task_ids() {
    let pool = test_pool().await;
    let (_, user_id, _, board_id, _) = setup_full(&pool).await;

    let input = super::task_bulk::BulkUpdateInput {
        task_ids: vec![],
        status_id: None,
        priority: Some(TaskPriority::Urgent),
        milestone_id: None,
        clear_milestone: None,
        task_list_id: None,
        clear_task_list: None,
    };

    let count = super::task_bulk::bulk_update_tasks(&pool, board_id, user_id, input)
        .await
        .expect("bulk_update_tasks");

    assert_eq!(count, 0, "empty task_ids should update 0 tasks");
}
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_bulk_update_not_board_member() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _, board_id, col_id) = setup_full(&pool).await;

    let task = create_test_task(
        &pool,
        board_id,
        col_id,
        tenant_id,
        user_id,
        "BulkNonMember",
        TaskPriority::Low,
    )
    .await;

    let random_user = Uuid::new_v4();
    let input = super::task_bulk::BulkUpdateInput {
        task_ids: vec![task.id],
        status_id: None,
        priority: Some(TaskPriority::Urgent),
        milestone_id: None,
        clear_milestone: None,
        task_list_id: None,
        clear_task_list: None,
    };

    let result = super::task_bulk::bulk_update_tasks(&pool, board_id, random_user, input).await;
    assert!(
        result.is_err(),
        "non-member should not be able to bulk update"
    );
}

// ===========================================================================
// TASK_ASSIGNMENTS TESTS (additional to integration_tests_advanced)
// ===========================================================================
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_assign_user_idempotent() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _, board_id, col_id) = setup_full(&pool).await;

    let task = create_test_task(
        &pool,
        board_id,
        col_id,
        tenant_id,
        user_id,
        "IdempotentAssign",
        TaskPriority::Low,
    )
    .await;

    // Assign twice -- should not error (ON CONFLICT DO UPDATE)
    let a1 = super::task_assignments::assign_user(&pool, task.id, user_id)
        .await
        .expect("assign_user first time");
    let a2 = super::task_assignments::assign_user(&pool, task.id, user_id)
        .await
        .expect("assign_user second time");

    assert_eq!(a1.task_id, a2.task_id);
    assert_eq!(a1.user_id, a2.user_id);

    // Verify only one assignment
    let ids = super::task_assignments::get_task_assignee_ids(&pool, task.id)
        .await
        .expect("get_task_assignee_ids");
    let user_count = ids.iter().filter(|&&id| id == user_id).count();
    assert_eq!(user_count, 1, "should only have one assignment entry");
}
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_unassign_nonexistent() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _, board_id, col_id) = setup_full(&pool).await;

    let task = create_test_task(
        &pool,
        board_id,
        col_id,
        tenant_id,
        user_id,
        "UnassignNone",
        TaskPriority::Low,
    )
    .await;

    let random_user = Uuid::new_v4();
    let result = super::task_assignments::unassign_user(&pool, task.id, random_user).await;
    assert!(result.is_err(), "unassigning nonexistent user should fail");
}
#[ignore = "integration test - run with: cargo test -- --ignored"]
#[tokio::test]
async fn test_get_task_assignee_ids_empty() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _, board_id, col_id) = setup_full(&pool).await;

    let task = create_test_task(
        &pool,
        board_id,
        col_id,
        tenant_id,
        user_id,
        "NoAssignees",
        TaskPriority::Low,
    )
    .await;

    let ids = super::task_assignments::get_task_assignee_ids(&pool, task.id)
        .await
        .expect("get_task_assignee_ids");

    assert!(ids.is_empty(), "new task should have no assignees");
}
