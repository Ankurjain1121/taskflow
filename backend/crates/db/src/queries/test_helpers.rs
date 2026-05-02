//! Shared helpers for integration tests.
//! Provides database connection, unique email generation, and common setup functions.

use sqlx::PgPool;
use uuid::Uuid;

use crate::models::TaskPriority;

pub const FAKE_HASH: &str = "$argon2id$v=19$m=19456,t=2,p=1$fakesalt$fakehash";

/// Connect to the real test database. Reads `TEST_DATABASE_URL` env var.
pub async fn test_pool() -> PgPool {
    let url = std::env::var("TEST_DATABASE_URL")
        .expect("TEST_DATABASE_URL must be set for integration tests");
    PgPool::connect(&url)
        .await
        .expect("Failed to connect to test database")
}

/// Unique email that won't collide across test runs.
pub fn unique_email() -> String {
    format!("inttest-{}@example.com", Uuid::new_v4())
}

/// Create user + tenant, return (tenant_id, user_id)
pub async fn setup_user(pool: &PgPool) -> (Uuid, Uuid) {
    let user = super::auth::create_user_with_tenant(
        pool,
        &unique_email(),
        "IntTest User",
        FAKE_HASH,
        None,
        false,
    )
    .await
    .expect("create_user_with_tenant");
    (user.tenant_id, user.id)
}

/// Create user + workspace, return (tenant_id, user_id, workspace_id)
pub async fn setup_user_and_workspace(pool: &PgPool) -> (Uuid, Uuid, Uuid) {
    let (tenant_id, user_id) = setup_user(pool).await;
    let ws = super::workspaces::create_workspace(pool, "IntTest WS", None, tenant_id, user_id)
        .await
        .expect("create_workspace");
    (tenant_id, user_id, ws.id)
}

/// Create user + workspace + project, return (tenant_id, user_id, workspace_id, project_id, default_task_list_id)
pub async fn setup_full(pool: &PgPool) -> (Uuid, Uuid, Uuid, Uuid, Uuid) {
    let (tenant_id, user_id, ws_id) = setup_user_and_workspace(pool).await;
    let bwc =
        super::projects::create_project(pool, "IntTest Board", None, ws_id, tenant_id, user_id)
            .await
            .expect("create_board");
    let first_list_id = bwc.task_lists[0].id;
    (tenant_id, user_id, ws_id, bwc.project.id, first_list_id)
}

/// Create a task with default values
pub async fn create_test_task(
    pool: &PgPool,
    board_id: Uuid,
    column_id: Uuid,
    tenant_id: Uuid,
    user_id: Uuid,
    title: &str,
    priority: TaskPriority,
) -> crate::models::Task {
    let input = super::tasks::CreateTaskInput {
        title: title.to_string(),
        description: None,
        priority,
        due_date: None,
        start_date: None,
        estimated_hours: None,
        status_id: None,
        task_list_id: Some(column_id),
        milestone_id: None,
        assignee_ids: None,
        label_ids: None,
        parent_task_id: None,
        reporting_person_id: None,
        rate_per_hour: None,
        budgeted_hours: None,
        budgeted_hours_threshold: None,
        cost_budget: None,
        cost_budget_threshold: None,
        cost_per_hour: None,
        revenue_budget: None,
    };
    super::tasks::create_task(pool, board_id, input, tenant_id, user_id)
        .await
        .expect("create_task")
}

/// Create a task with start/due dates
#[allow(clippy::too_many_arguments)]
pub async fn create_test_task_with_dates(
    pool: &PgPool,
    board_id: Uuid,
    column_id: Uuid,
    tenant_id: Uuid,
    user_id: Uuid,
    title: &str,
    priority: TaskPriority,
    start_date: Option<chrono::DateTime<chrono::Utc>>,
    due_date: Option<chrono::DateTime<chrono::Utc>>,
) -> crate::models::Task {
    let input = super::tasks::CreateTaskInput {
        title: title.to_string(),
        description: None,
        priority,
        due_date,
        start_date,
        estimated_hours: None,
        status_id: None,
        task_list_id: Some(column_id),
        milestone_id: None,
        assignee_ids: None,
        label_ids: None,
        parent_task_id: None,
        reporting_person_id: None,
        rate_per_hour: None,
        budgeted_hours: None,
        budgeted_hours_threshold: None,
        cost_budget: None,
        cost_budget_threshold: None,
        cost_per_hour: None,
        revenue_budget: None,
    };
    super::tasks::create_task(pool, board_id, input, tenant_id, user_id)
        .await
        .expect("create_task_with_dates")
}

/// Insert a notification directly via SQL (for testing)
#[allow(dead_code)] // Available for future integration tests
pub async fn insert_test_notification(
    pool: &PgPool,
    recipient_id: Uuid,
    title: &str,
    body: &str,
) -> Uuid {
    let id = Uuid::new_v4();
    sqlx::query(
        r"
        INSERT INTO notifications (id, recipient_id, event_type, title, body, link_url)
        VALUES ($1, $2, 'task_assigned', $3, $4, NULL)
        ",
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
