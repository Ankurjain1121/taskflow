//! Advanced integration tests -- tasks, search, dashboard, notifications, subtasks, activity log.
//! Runs against real PostgreSQL. Each test uses unique random data.

use sqlx::PgPool;
use uuid::Uuid;

use crate::models::*;

async fn test_pool() -> PgPool {
    PgPool::connect(
        "postgresql://taskflow:189015388bb0f90c999ea6b975d7e494@localhost:5433/taskflow",
    )
    .await
    .expect("Failed to connect to test database")
}

/// Create a full test scenario: tenant + user + workspace + board (with columns) + board membership
/// Returns (tenant_id, user_id, workspace_id, board_id, column_id)
async fn create_full_test_setup(pool: &PgPool) -> (Uuid, Uuid, Uuid, Uuid, Uuid) {
    let email = format!("test-adv-{}@example.com", Uuid::new_v4());
    let user = super::auth::create_user_with_tenant(
        pool,
        &email,
        "Test Adv User",
        "$argon2id$v=19$m=19456,t=2,p=1$fakesalt$fakehash",
    )
    .await
    .expect("create user");

    let workspace =
        super::workspaces::create_workspace(pool, "Test Workspace", None, user.tenant_id, user.id)
            .await
            .expect("create workspace");

    let board = super::boards::create_board(
        pool,
        "Test Board",
        None,
        workspace.id,
        user.tenant_id,
        user.id,
    )
    .await
    .expect("create board");

    let first_column_id = board.columns.first().expect("board should have columns").id;

    (
        user.tenant_id,
        user.id,
        workspace.id,
        board.board.id,
        first_column_id,
    )
}

/// Helper: create a task with default values
async fn create_test_task(
    pool: &PgPool,
    board_id: Uuid,
    column_id: Uuid,
    tenant_id: Uuid,
    user_id: Uuid,
    title: &str,
    priority: TaskPriority,
) -> Task {
    let input = super::tasks::CreateTaskInput {
        title: title.to_string(),
        description: None,
        priority,
        due_date: None,
        start_date: None,
        estimated_hours: None,
        column_id,
        group_id: None,
        milestone_id: None,
        assignee_ids: None,
        label_ids: None,
    };

    super::tasks::create_task(pool, board_id, input, tenant_id, user_id)
        .await
        .expect("create task")
}

// ============================================================================
// Task query tests
// ============================================================================

#[tokio::test]
async fn test_create_task() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _ws_id, board_id, column_id) = create_full_test_setup(&pool).await;

    let title = format!("Task-{}", Uuid::new_v4());
    let task = create_test_task(
        &pool,
        board_id,
        column_id,
        tenant_id,
        user_id,
        &title,
        TaskPriority::High,
    )
    .await;

    assert_eq!(task.title, title);
    assert_eq!(task.priority, TaskPriority::High);
    assert_eq!(task.board_id, board_id);
    assert_eq!(task.column_id, column_id);
    assert_eq!(task.tenant_id, tenant_id);
    assert_eq!(task.created_by_id, user_id);
    assert!(task.deleted_at.is_none());
    assert!(task.description.is_none());
}

#[tokio::test]
async fn test_get_task_by_id() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _ws_id, board_id, column_id) = create_full_test_setup(&pool).await;

    let title = format!("GetById-{}", Uuid::new_v4());
    let created = create_test_task(
        &pool,
        board_id,
        column_id,
        tenant_id,
        user_id,
        &title,
        TaskPriority::Medium,
    )
    .await;

    let fetched = super::tasks::get_task_by_id(&pool, created.id, user_id)
        .await
        .expect("get_task_by_id should not error")
        .expect("task should exist");

    assert_eq!(fetched.task.id, created.id);
    assert_eq!(fetched.task.title, title);
    assert_eq!(fetched.task.priority, TaskPriority::Medium);
    assert_eq!(fetched.comment_count, 0);
    assert_eq!(fetched.attachment_count, 0);
    assert!(fetched.assignees.is_empty());
    assert!(fetched.labels.is_empty());
}

#[tokio::test]
async fn test_get_task_by_id_not_found() {
    let pool = test_pool().await;
    let (_, user_id, _, _, _) = create_full_test_setup(&pool).await;

    let result = super::tasks::get_task_by_id(&pool, Uuid::new_v4(), user_id)
        .await
        .expect("should not error on missing task");

    assert!(result.is_none(), "non-existent task should return None");
}

#[tokio::test]
async fn test_update_task_title() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _ws_id, board_id, column_id) = create_full_test_setup(&pool).await;

    let task = create_test_task(
        &pool,
        board_id,
        column_id,
        tenant_id,
        user_id,
        "Original Title",
        TaskPriority::Low,
    )
    .await;

    let new_title = format!("Updated-{}", Uuid::new_v4());
    let input = super::tasks::UpdateTaskInput {
        title: Some(new_title.clone()),
        description: None,
        priority: None,
        due_date: None,
        start_date: None,
        estimated_hours: None,
        milestone_id: None,
        clear_description: None,
        clear_due_date: None,
        clear_start_date: None,
        clear_estimated_hours: None,
        clear_milestone: None,
        expected_version: None,
    };

    let updated = super::tasks::update_task(&pool, task.id, input)
        .await
        .expect("update_task should succeed");

    assert_eq!(updated.title, new_title);
    assert_eq!(updated.id, task.id);
}

#[tokio::test]
async fn test_update_task_priority() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _ws_id, board_id, column_id) = create_full_test_setup(&pool).await;

    let task = create_test_task(
        &pool,
        board_id,
        column_id,
        tenant_id,
        user_id,
        "Priority Task",
        TaskPriority::Low,
    )
    .await;

    let input = super::tasks::UpdateTaskInput {
        title: None,
        description: None,
        priority: Some(TaskPriority::Urgent),
        due_date: None,
        start_date: None,
        estimated_hours: None,
        milestone_id: None,
        clear_description: None,
        clear_due_date: None,
        clear_start_date: None,
        clear_estimated_hours: None,
        clear_milestone: None,
        expected_version: None,
    };

    let updated = super::tasks::update_task(&pool, task.id, input)
        .await
        .expect("update priority should succeed");

    assert_eq!(updated.priority, TaskPriority::Urgent);
}

#[tokio::test]
async fn test_soft_delete_task() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _ws_id, board_id, column_id) = create_full_test_setup(&pool).await;

    let task = create_test_task(
        &pool,
        board_id,
        column_id,
        tenant_id,
        user_id,
        "ToDelete",
        TaskPriority::Medium,
    )
    .await;

    super::tasks::soft_delete_task(&pool, task.id)
        .await
        .expect("soft_delete_task should succeed");

    // Now get_task_by_id should return None (soft-deleted tasks have deleted_at set)
    let fetched = super::tasks::get_task_by_id(&pool, task.id, user_id)
        .await
        .expect("should not error");

    assert!(
        fetched.is_none(),
        "soft-deleted task should not be returned"
    );
}

#[tokio::test]
async fn test_move_task() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _ws_id, board_id, column_id) = create_full_test_setup(&pool).await;

    // Get a second column (board has 3 default columns: To Do, In Progress, Done)
    let columns = super::columns::list_columns_by_board(&pool, board_id)
        .await
        .expect("list columns");
    assert!(columns.len() >= 2, "board should have at least 2 columns");
    let target_column_id = columns[1].id;
    assert_ne!(column_id, target_column_id);

    let task = create_test_task(
        &pool,
        board_id,
        column_id,
        tenant_id,
        user_id,
        "MovableTask",
        TaskPriority::High,
    )
    .await;

    let moved = super::tasks::move_task(&pool, task.id, target_column_id, "m0".to_string())
        .await
        .expect("move_task should succeed");

    assert_eq!(moved.column_id, target_column_id);
    assert_eq!(moved.position, "m0");
}

#[tokio::test]
async fn test_assign_user_to_task() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _ws_id, board_id, column_id) = create_full_test_setup(&pool).await;

    let task = create_test_task(
        &pool,
        board_id,
        column_id,
        tenant_id,
        user_id,
        "AssignTask",
        TaskPriority::Low,
    )
    .await;

    let assignee = super::task_assignments::assign_user(&pool, task.id, user_id)
        .await
        .expect("assign_user should succeed");

    assert_eq!(assignee.task_id, task.id);
    assert_eq!(assignee.user_id, user_id);

    // Verify via get_task_assignee_ids
    let assignee_ids = super::task_assignments::get_task_assignee_ids(&pool, task.id)
        .await
        .expect("get_task_assignee_ids");

    assert!(assignee_ids.contains(&user_id));
}

#[tokio::test]
async fn test_unassign_user_from_task() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _ws_id, board_id, column_id) = create_full_test_setup(&pool).await;

    let task = create_test_task(
        &pool,
        board_id,
        column_id,
        tenant_id,
        user_id,
        "UnassignTask",
        TaskPriority::Low,
    )
    .await;

    // Assign first
    super::task_assignments::assign_user(&pool, task.id, user_id)
        .await
        .expect("assign_user");

    // Then unassign
    super::task_assignments::unassign_user(&pool, task.id, user_id)
        .await
        .expect("unassign_user should succeed");

    // Verify gone
    let assignee_ids = super::task_assignments::get_task_assignee_ids(&pool, task.id)
        .await
        .expect("get_task_assignee_ids");

    assert!(
        !assignee_ids.contains(&user_id),
        "user should be unassigned"
    );
}

#[tokio::test]
async fn test_list_tasks_by_board() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _ws_id, board_id, column_id) = create_full_test_setup(&pool).await;

    let unique = Uuid::new_v4().to_string();
    let t1 = create_test_task(
        &pool,
        board_id,
        column_id,
        tenant_id,
        user_id,
        &format!("List-A-{}", unique),
        TaskPriority::High,
    )
    .await;
    let t2 = create_test_task(
        &pool,
        board_id,
        column_id,
        tenant_id,
        user_id,
        &format!("List-B-{}", unique),
        TaskPriority::Low,
    )
    .await;

    let grouped = super::tasks::list_tasks_by_board(&pool, board_id, user_id)
        .await
        .expect("list_tasks_by_board");

    // All tasks should be in the first column
    let column_tasks = grouped.get(&column_id).expect("column should have tasks");
    let ids: Vec<Uuid> = column_tasks.iter().map(|t| t.id).collect();
    assert!(ids.contains(&t1.id));
    assert!(ids.contains(&t2.id));
}

#[tokio::test]
async fn test_bulk_update_tasks() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _ws_id, board_id, column_id) = create_full_test_setup(&pool).await;

    let t1 = create_test_task(
        &pool,
        board_id,
        column_id,
        tenant_id,
        user_id,
        "Bulk1",
        TaskPriority::Low,
    )
    .await;
    let t2 = create_test_task(
        &pool,
        board_id,
        column_id,
        tenant_id,
        user_id,
        "Bulk2",
        TaskPriority::Low,
    )
    .await;
    let t3 = create_test_task(
        &pool,
        board_id,
        column_id,
        tenant_id,
        user_id,
        "Bulk3",
        TaskPriority::Low,
    )
    .await;

    let input = super::task_bulk::BulkUpdateInput {
        task_ids: vec![t1.id, t2.id, t3.id],
        column_id: None,
        priority: Some(TaskPriority::Urgent),
        milestone_id: None,
        clear_milestone: None,
        group_id: None,
        clear_group: None,
    };

    let updated_count = super::task_bulk::bulk_update_tasks(&pool, board_id, user_id, input)
        .await
        .expect("bulk_update_tasks");

    assert_eq!(updated_count, 3);

    // Verify one of the tasks got the new priority
    let fetched = super::tasks::get_task_by_id(&pool, t1.id, user_id)
        .await
        .expect("get task")
        .expect("task should exist");
    assert_eq!(fetched.task.priority, TaskPriority::Urgent);
}

#[tokio::test]
async fn test_bulk_delete_tasks() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _ws_id, board_id, column_id) = create_full_test_setup(&pool).await;

    let t1 = create_test_task(
        &pool,
        board_id,
        column_id,
        tenant_id,
        user_id,
        "BulkDel1",
        TaskPriority::Low,
    )
    .await;
    let t2 = create_test_task(
        &pool,
        board_id,
        column_id,
        tenant_id,
        user_id,
        "BulkDel2",
        TaskPriority::Low,
    )
    .await;
    let t3 = create_test_task(
        &pool,
        board_id,
        column_id,
        tenant_id,
        user_id,
        "BulkDel3",
        TaskPriority::Low,
    )
    .await;

    let deleted_count =
        super::task_bulk::bulk_delete_tasks(&pool, board_id, user_id, &[t1.id, t2.id, t3.id])
            .await
            .expect("bulk_delete_tasks");

    assert_eq!(deleted_count, 3);

    // Verify tasks are soft-deleted
    for task_id in [t1.id, t2.id, t3.id] {
        let fetched = super::tasks::get_task_by_id(&pool, task_id, user_id)
            .await
            .expect("get task");
        assert!(fetched.is_none(), "bulk-deleted task should be gone");
    }
}

// ============================================================================
// Notification query tests
// ============================================================================

/// Helper to insert a notification directly via SQL (since the db crate has no create_notification fn)
async fn insert_test_notification(
    pool: &PgPool,
    recipient_id: Uuid,
    title: &str,
    body: &str,
) -> Uuid {
    let id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO notifications (id, recipient_id, event_type, title, body, link_url)
        VALUES ($1, $2, 'task_assigned', $3, $4, NULL)
        "#,
    )
    .bind(id)
    .bind(recipient_id)
    .bind(title)
    .bind(body)
    .execute(pool)
    .await
    .expect("insert notification");
    id
}

#[tokio::test]
async fn test_create_notification() {
    let pool = test_pool().await;
    let (_, user_id, _, _, _) = create_full_test_setup(&pool).await;

    let title = format!("Notif-{}", Uuid::new_v4());
    let id = insert_test_notification(&pool, user_id, &title, "Test body").await;

    // Verify it shows up in listing
    let result = super::notifications::list_notifications(&pool, user_id, None, 50)
        .await
        .expect("list_notifications");

    let found = result.items.iter().find(|n| n.id == id);
    assert!(found.is_some(), "notification should be in list");

    let notif = found.expect("just checked");
    assert_eq!(notif.title, title);
    assert_eq!(notif.body, "Test body");
    assert!(!notif.is_read);
    assert_eq!(notif.recipient_id, user_id);
}

#[tokio::test]
async fn test_list_notifications() {
    let pool = test_pool().await;
    let (_, user_id, _, _, _) = create_full_test_setup(&pool).await;

    let unique = Uuid::new_v4().to_string();
    let id1 = insert_test_notification(&pool, user_id, &format!("N1-{}", unique), "Body 1").await;
    let id2 = insert_test_notification(&pool, user_id, &format!("N2-{}", unique), "Body 2").await;
    let id3 = insert_test_notification(&pool, user_id, &format!("N3-{}", unique), "Body 3").await;

    let result = super::notifications::list_notifications(&pool, user_id, None, 50)
        .await
        .expect("list_notifications");

    let our_ids: Vec<Uuid> = result
        .items
        .iter()
        .filter(|n| [id1, id2, id3].contains(&n.id))
        .map(|n| n.id)
        .collect();

    assert_eq!(our_ids.len(), 3, "all 3 notifications should appear");
    assert!(
        result.unread_count >= 3,
        "unread count should be at least 3"
    );
}

#[tokio::test]
async fn test_mark_notification_read() {
    let pool = test_pool().await;
    let (_, user_id, _, _, _) = create_full_test_setup(&pool).await;

    let id = insert_test_notification(&pool, user_id, "MarkRead", "body").await;

    // Get unread count before
    let before = super::notifications::get_unread_count(&pool, user_id)
        .await
        .expect("get_unread_count");

    // Mark as read
    super::notifications::mark_read(&pool, id, user_id)
        .await
        .expect("mark_read should succeed");

    // Get unread count after
    let after = super::notifications::get_unread_count(&pool, user_id)
        .await
        .expect("get_unread_count");

    assert_eq!(after, before - 1, "unread count should decrease by 1");

    // Verify the notification is now read
    let result = super::notifications::list_notifications(&pool, user_id, None, 50)
        .await
        .expect("list");
    let notif = result.items.iter().find(|n| n.id == id).expect("found");
    assert!(notif.is_read, "notification should be marked as read");
}

// ============================================================================
// Search query tests
// ============================================================================

#[tokio::test]
async fn test_search_tasks_by_title() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _ws_id, board_id, column_id) = create_full_test_setup(&pool).await;

    let unique_needle = format!("Xylophone{}", Uuid::new_v4().as_simple());
    let _t1 = create_test_task(
        &pool,
        board_id,
        column_id,
        tenant_id,
        user_id,
        &format!("{} task alpha", unique_needle),
        TaskPriority::High,
    )
    .await;
    let _t2 = create_test_task(
        &pool,
        board_id,
        column_id,
        tenant_id,
        user_id,
        "Unrelated task name",
        TaskPriority::Low,
    )
    .await;

    let filters = super::search::SearchFilters::default();
    let results =
        super::search::search_all(&pool, tenant_id, user_id, &unique_needle, 10, &filters)
            .await
            .expect("search_all");

    assert!(
        !results.tasks.is_empty(),
        "search should find the task with the unique needle"
    );
    assert!(results
        .tasks
        .iter()
        .any(|t| t.title.contains(&unique_needle)));
}

// ============================================================================
// My Tasks query tests
// ============================================================================

#[tokio::test]
async fn test_my_tasks_returns_assigned_tasks() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _ws_id, board_id, column_id) = create_full_test_setup(&pool).await;

    let title = format!("MyTask-{}", Uuid::new_v4());
    let task = create_test_task(
        &pool,
        board_id,
        column_id,
        tenant_id,
        user_id,
        &title,
        TaskPriority::High,
    )
    .await;

    // Assign the task to the user
    super::task_assignments::assign_user(&pool, task.id, user_id)
        .await
        .expect("assign_user");

    let result = super::my_tasks::list_my_tasks(
        &pool,
        user_id,
        super::my_tasks::MyTasksSortBy::CreatedAt,
        super::my_tasks::SortOrder::Desc,
        None,
        None,
        50,
    )
    .await
    .expect("list_my_tasks");

    let found = result.items.iter().find(|item| item.id == task.id);
    assert!(found.is_some(), "assigned task should appear in my_tasks");
    let item = found.expect("just checked");
    assert_eq!(item.title, title);
    assert_eq!(item.board_id, board_id);
}

// ============================================================================
// Dashboard query tests
// ============================================================================

#[tokio::test]
async fn test_dashboard_stats() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _ws_id, board_id, column_id) = create_full_test_setup(&pool).await;

    // Create two tasks and assign them to the user
    let t1 = create_test_task(
        &pool,
        board_id,
        column_id,
        tenant_id,
        user_id,
        "DashTask1",
        TaskPriority::High,
    )
    .await;
    let t2 = create_test_task(
        &pool,
        board_id,
        column_id,
        tenant_id,
        user_id,
        "DashTask2",
        TaskPriority::Low,
    )
    .await;

    super::task_assignments::assign_user(&pool, t1.id, user_id)
        .await
        .expect("assign t1");
    super::task_assignments::assign_user(&pool, t2.id, user_id)
        .await
        .expect("assign t2");

    let stats = super::dashboard::get_dashboard_stats(&pool, user_id, None)
        .await
        .expect("get_dashboard_stats");

    assert!(
        stats.total_tasks >= 2,
        "total_tasks should be at least 2 (got {})",
        stats.total_tasks
    );
    // We cannot assert exact counts since other tests may leave data, but at least 2
}

// ============================================================================
// Subtask query tests
// ============================================================================

#[tokio::test]
async fn test_create_subtask() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _ws_id, board_id, column_id) = create_full_test_setup(&pool).await;

    let task = create_test_task(
        &pool,
        board_id,
        column_id,
        tenant_id,
        user_id,
        "ParentTask",
        TaskPriority::Medium,
    )
    .await;

    let subtask_title = format!("Subtask-{}", Uuid::new_v4());
    let subtask =
        super::subtasks::create_subtask(&pool, task.id, &subtask_title, user_id, None, None)
            .await
            .expect("create_subtask");

    assert_eq!(subtask.title, subtask_title);
    assert_eq!(subtask.task_id, task.id);
    assert_eq!(subtask.created_by_id, user_id);
    assert!(!subtask.is_completed);
    assert!(subtask.completed_at.is_none());
}

#[tokio::test]
async fn test_toggle_subtask() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _ws_id, board_id, column_id) = create_full_test_setup(&pool).await;

    let task = create_test_task(
        &pool,
        board_id,
        column_id,
        tenant_id,
        user_id,
        "ToggleParent",
        TaskPriority::Medium,
    )
    .await;

    let subtask = super::subtasks::create_subtask(&pool, task.id, "ToggleSub", user_id, None, None)
        .await
        .expect("create_subtask");

    assert!(!subtask.is_completed);

    // Toggle to completed
    let toggled = super::subtasks::toggle_subtask(&pool, subtask.id)
        .await
        .expect("toggle_subtask");

    assert!(toggled.is_completed, "should be completed after toggle");
    assert!(toggled.completed_at.is_some(), "completed_at should be set");

    // Toggle back to incomplete
    let toggled_back = super::subtasks::toggle_subtask(&pool, subtask.id)
        .await
        .expect("toggle_subtask back");

    assert!(
        !toggled_back.is_completed,
        "should be incomplete after second toggle"
    );
    assert!(
        toggled_back.completed_at.is_none(),
        "completed_at should be cleared"
    );
}

// ============================================================================
// Activity log query tests
// ============================================================================

#[tokio::test]
async fn test_record_activity() {
    let pool = test_pool().await;
    let (tenant_id, user_id, _ws_id, board_id, column_id) = create_full_test_setup(&pool).await;

    let task = create_test_task(
        &pool,
        board_id,
        column_id,
        tenant_id,
        user_id,
        "ActivityTask",
        TaskPriority::Medium,
    )
    .await;

    let metadata = Some(serde_json::json!({"field": "title", "old": "A", "new": "B"}));

    let entry = super::activity_log::insert_activity_log(
        &pool,
        task.id,
        user_id,
        ActivityAction::Updated,
        metadata.clone(),
        tenant_id,
    )
    .await
    .expect("insert_activity_log");

    assert_eq!(entry.entity_id, task.id);
    assert_eq!(entry.user_id, user_id);
    assert_eq!(entry.action, ActivityAction::Updated);
    assert_eq!(entry.entity_type, "task");
    assert_eq!(entry.tenant_id, tenant_id);
    assert_eq!(entry.actor_name, "Test Adv User");

    // Verify it appears in list_activity_by_task
    let log = super::activity_log::list_activity_by_task(&pool, task.id, None, 20)
        .await
        .expect("list_activity_by_task");

    let found = log.items.iter().find(|a| a.id == entry.id);
    assert!(found.is_some(), "activity entry should appear in task log");
}
