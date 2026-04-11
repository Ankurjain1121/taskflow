use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{BoardCustomField, CustomFieldType, TaskCustomFieldValue};

/// Error type for custom field query operations
#[derive(Debug, thiserror::Error)]
pub enum CustomFieldQueryError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("User is not a member of this board")]
    NotBoardMember,
    #[error("Custom field not found")]
    NotFound,
}

/// Input for creating a new custom field
#[derive(Debug, Deserialize)]
pub struct CreateCustomFieldInput {
    pub board_id: Uuid,
    pub name: String,
    pub field_type: CustomFieldType,
    pub options: Option<serde_json::Value>,
    pub is_required: bool,
    pub tenant_id: Uuid,
    pub created_by_id: Uuid,
}

/// Input for updating an existing custom field
#[derive(Debug, Deserialize)]
pub struct UpdateCustomFieldInput {
    pub name: Option<String>,
    pub options: Option<serde_json::Value>,
    pub is_required: Option<bool>,
    pub position: Option<i32>,
}

/// Input for setting a single field value on a task
#[derive(Debug, Deserialize)]
pub struct SetFieldValue {
    pub field_id: Uuid,
    pub value_text: Option<String>,
    pub value_number: Option<f64>,
    pub value_date: Option<DateTime<Utc>>,
    pub value_bool: Option<bool>,
}

/// Task custom field value joined with field metadata
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TaskCustomFieldValueWithField {
    pub id: Uuid,
    pub task_id: Uuid,
    pub field_id: Uuid,
    pub field_name: String,
    pub field_type: CustomFieldType,
    pub options: Option<serde_json::Value>,
    pub is_required: bool,
    pub value_text: Option<String>,
    pub value_number: Option<f64>,
    pub value_date: Option<DateTime<Utc>>,
    pub value_bool: Option<bool>,
}

use super::membership::verify_project_membership;

/// Internal helper: get task's board_id
async fn get_task_board_id_internal(
    pool: &PgPool,
    task_id: Uuid,
) -> Result<Uuid, CustomFieldQueryError> {
    let board_id = sqlx::query_scalar::<_, Uuid>(
        r"
        SELECT project_id FROM tasks WHERE id = $1 AND deleted_at IS NULL
        ",
    )
    .bind(task_id)
    .fetch_optional(pool)
    .await?
    .ok_or(CustomFieldQueryError::NotFound)?;

    Ok(board_id)
}

/// List all custom fields for a board, ordered by position.
/// Verifies board membership before returning.
pub async fn list_board_custom_fields(
    pool: &PgPool,
    board_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<BoardCustomField>, CustomFieldQueryError> {
    if !verify_project_membership(pool, board_id, user_id).await? {
        return Err(CustomFieldQueryError::NotBoardMember);
    }

    let fields = sqlx::query_as::<_, BoardCustomField>(
        r"
        SELECT
            id, project_id, name,
            field_type,
            options, is_required, position,
            tenant_id, created_by_id,
            created_at, updated_at
        FROM project_custom_fields
        WHERE project_id = $1
        ORDER BY position ASC, created_at ASC
        ",
    )
    .bind(board_id)
    .fetch_all(pool)
    .await?;

    Ok(fields)
}

/// Create a new custom field on a board.
/// Verifies board membership. Assigns position as max+1.
pub async fn create_custom_field(
    pool: &PgPool,
    input: CreateCustomFieldInput,
) -> Result<BoardCustomField, CustomFieldQueryError> {
    if !verify_project_membership(pool, input.board_id, input.created_by_id).await? {
        return Err(CustomFieldQueryError::NotBoardMember);
    }

    // Get next position
    let next_pos = sqlx::query_scalar::<_, Option<i32>>(
        r"
        SELECT MAX(position) FROM project_custom_fields WHERE project_id = $1
        ",
    )
    .bind(input.board_id)
    .fetch_one(pool)
    .await?
    .unwrap_or(0)
        + 1;

    let id = Uuid::new_v4();
    let now = Utc::now();

    let field = sqlx::query_as::<_, BoardCustomField>(
        r"
        INSERT INTO project_custom_fields (id, project_id, name, field_type, options, is_required, position, tenant_id, created_by_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING
            id, project_id, name,
            field_type,
            options, is_required, position,
            tenant_id, created_by_id,
            created_at, updated_at
        ",
    )
    .bind(id)
    .bind(input.board_id)
    .bind(&input.name)
    .bind(&input.field_type)
    .bind(&input.options)
    .bind(input.is_required)
    .bind(next_pos)
    .bind(input.tenant_id)
    .bind(input.created_by_id)
    .bind(now)
    .bind(now)
    .fetch_one(pool)
    .await?;

    Ok(field)
}

/// Update an existing custom field.
/// Verifies board membership via the field's board_id.
pub async fn update_custom_field(
    pool: &PgPool,
    field_id: Uuid,
    input: UpdateCustomFieldInput,
    user_id: Uuid,
) -> Result<BoardCustomField, CustomFieldQueryError> {
    // Get the field to find its board_id
    let existing = sqlx::query_scalar::<_, Uuid>(
        r"
        SELECT project_id FROM project_custom_fields WHERE id = $1
        ",
    )
    .bind(field_id)
    .fetch_optional(pool)
    .await?
    .ok_or(CustomFieldQueryError::NotFound)?;

    if !verify_project_membership(pool, existing, user_id).await? {
        return Err(CustomFieldQueryError::NotBoardMember);
    }

    let field = sqlx::query_as::<_, BoardCustomField>(
        r"
        UPDATE project_custom_fields
        SET
            name = COALESCE($2, name),
            options = COALESCE($3, options),
            is_required = COALESCE($4, is_required),
            position = COALESCE($5, position),
            updated_at = NOW()
        WHERE id = $1
        RETURNING
            id, project_id, name,
            field_type,
            options, is_required, position,
            tenant_id, created_by_id,
            created_at, updated_at
        ",
    )
    .bind(field_id)
    .bind(&input.name)
    .bind(&input.options)
    .bind(input.is_required)
    .bind(input.position)
    .fetch_one(pool)
    .await?;

    Ok(field)
}

/// Delete a custom field by ID.
/// Verifies board membership via the field's board_id.
/// Also deletes all associated task field values (cascade).
pub async fn delete_custom_field(
    pool: &PgPool,
    field_id: Uuid,
    user_id: Uuid,
) -> Result<(), CustomFieldQueryError> {
    // Get the field to find its board_id
    let board_id = sqlx::query_scalar::<_, Uuid>(
        r"
        SELECT project_id FROM project_custom_fields WHERE id = $1
        ",
    )
    .bind(field_id)
    .fetch_optional(pool)
    .await?
    .ok_or(CustomFieldQueryError::NotFound)?;

    if !verify_project_membership(pool, board_id, user_id).await? {
        return Err(CustomFieldQueryError::NotBoardMember);
    }

    // Delete associated task values first
    sqlx::query(
        r"
        DELETE FROM task_custom_field_values WHERE field_id = $1
        ",
    )
    .bind(field_id)
    .execute(pool)
    .await?;

    // Delete the field itself
    let rows_affected = sqlx::query(
        r"
        DELETE FROM project_custom_fields WHERE id = $1
        ",
    )
    .bind(field_id)
    .execute(pool)
    .await?
    .rows_affected();

    if rows_affected == 0 {
        return Err(CustomFieldQueryError::NotFound);
    }

    Ok(())
}

/// Get all custom field values for a task, joined with field metadata.
/// Verifies board membership via the task's board_id.
pub async fn get_task_custom_field_values(
    pool: &PgPool,
    task_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<TaskCustomFieldValueWithField>, CustomFieldQueryError> {
    let board_id = get_task_board_id_internal(pool, task_id).await?;

    if !verify_project_membership(pool, board_id, user_id).await? {
        return Err(CustomFieldQueryError::NotBoardMember);
    }

    let values = sqlx::query_as::<_, TaskCustomFieldValueWithField>(
        r"
        SELECT
            COALESCE(v.id, '00000000-0000-0000-0000-000000000000'::uuid) as id,
            $1::uuid as task_id,
            f.id as field_id,
            f.name as field_name,
            f.field_type,
            f.options,
            f.is_required,
            v.value_text,
            v.value_number,
            v.value_date,
            v.value_bool
        FROM project_custom_fields f
        LEFT JOIN task_custom_field_values v ON v.field_id = f.id AND v.task_id = $1
        WHERE f.project_id = $2
        ORDER BY f.position ASC, f.created_at ASC
        ",
    )
    .bind(task_id)
    .bind(board_id)
    .fetch_all(pool)
    .await?;

    Ok(values)
}

/// Set (upsert) custom field values for a task.
/// Uses INSERT ON CONFLICT UPDATE for each value.
/// Verifies board membership via the task's board_id.
pub async fn set_task_custom_field_values(
    pool: &PgPool,
    task_id: Uuid,
    user_id: Uuid,
    values: Vec<SetFieldValue>,
) -> Result<Vec<TaskCustomFieldValue>, CustomFieldQueryError> {
    let board_id = get_task_board_id_internal(pool, task_id).await?;

    if !verify_project_membership(pool, board_id, user_id).await? {
        return Err(CustomFieldQueryError::NotBoardMember);
    }

    let mut results = Vec::with_capacity(values.len());

    for val in values {
        let result = sqlx::query_as::<_, TaskCustomFieldValue>(
            r"
            INSERT INTO task_custom_field_values (id, task_id, field_id, value_text, value_number, value_date, value_bool, created_at, updated_at)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW())
            ON CONFLICT (task_id, field_id) DO UPDATE SET
                value_text = EXCLUDED.value_text,
                value_number = EXCLUDED.value_number,
                value_date = EXCLUDED.value_date,
                value_bool = EXCLUDED.value_bool,
                updated_at = NOW()
            RETURNING id, task_id, field_id, value_text, value_number, value_date, value_bool, created_at, updated_at
            ",
        )
        .bind(task_id)
        .bind(val.field_id)
        .bind(&val.value_text)
        .bind(val.value_number)
        .bind(val.value_date)
        .bind(val.value_bool)
        .fetch_one(pool)
        .await?;

        results.push(result);
    }

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{CustomFieldType, TaskPriority, UserRole};
    use crate::queries::{auth, projects, tasks, workspaces};
    use crate::test_helpers::test_pool;

    const FAKE_HASH: &str = "$argon2id$v=19$m=19456,t=2,p=1$fake_salt$fake_hash_for_test";

    fn unique_email() -> String {
        format!("inttest-cf-{}@example.com", Uuid::new_v4())
    }

    async fn setup_user(pool: &PgPool) -> (Uuid, Uuid) {
        let user = auth::create_user_with_tenant(
            pool,
            &unique_email(),
            "CF Test User",
            FAKE_HASH,
            None,
            false,
        )
        .await
        .expect("create_user_with_tenant");
        (user.tenant_id, user.id)
    }

    async fn setup_user_and_workspace(pool: &PgPool) -> (Uuid, Uuid, Uuid) {
        let (tenant_id, user_id) = setup_user(pool).await;
        let ws = workspaces::create_workspace(pool, "CF Test WS", None, tenant_id, user_id)
            .await
            .expect("create_workspace");
        (tenant_id, user_id, ws.id)
    }

    async fn setup_full(pool: &PgPool) -> (Uuid, Uuid, Uuid, Uuid, Uuid) {
        let (tenant_id, user_id, ws_id) = setup_user_and_workspace(pool).await;
        let bwc = projects::create_project(pool, "CF Test Board", None, ws_id, tenant_id, user_id)
            .await
            .expect("create_board");
        let first_list_id = bwc.task_lists[0].id;
        (tenant_id, user_id, ws_id, bwc.project.id, first_list_id)
    }

    async fn setup_full_with_task(pool: &PgPool) -> (Uuid, Uuid, Uuid, Uuid) {
        let (tenant_id, user_id, _ws_id, board_id, col_id) = setup_full(pool).await;
        let input = tasks::CreateTaskInput {
            title: "CF Test Task".to_string(),
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
            reporting_person_id: None,
            rate_per_hour: None,
            budgeted_hours: None,
            budgeted_hours_threshold: None,
            cost_budget: None,
            cost_budget_threshold: None,
            cost_per_hour: None,
            revenue_budget: None,
        };
        let task = tasks::create_task(pool, board_id, input, tenant_id, user_id)
            .await
            .expect("create_task for custom field tests");
        (tenant_id, user_id, board_id, task.id)
    }
    #[ignore = "integration test - run with: cargo test -- --ignored"]
    #[tokio::test]
    async fn test_create_custom_field() {
        let pool = test_pool().await;
        let (tenant_id, user_id, _ws_id, board_id, _col_id) = setup_full(&pool).await;

        let input = CreateCustomFieldInput {
            board_id,
            name: "Priority Level".to_string(),
            field_type: CustomFieldType::Text,
            options: None,
            is_required: false,
            tenant_id,
            created_by_id: user_id,
        };

        let field = create_custom_field(&pool, input)
            .await
            .expect("create_custom_field");

        assert_eq!(field.name, "Priority Level");
        assert_eq!(field.project_id, board_id);
        assert_eq!(field.field_type, CustomFieldType::Text);
        assert!(!field.is_required);
        assert_eq!(field.tenant_id, tenant_id);
        assert_eq!(field.created_by_id, user_id);
        assert_eq!(field.position, 1);
    }
    #[ignore = "integration test - run with: cargo test -- --ignored"]
    #[tokio::test]
    async fn test_list_board_custom_fields() {
        let pool = test_pool().await;
        let (tenant_id, user_id, _ws_id, board_id, _col_id) = setup_full(&pool).await;

        // Create two fields
        let input1 = CreateCustomFieldInput {
            board_id,
            name: "Field One".to_string(),
            field_type: CustomFieldType::Text,
            options: None,
            is_required: false,
            tenant_id,
            created_by_id: user_id,
        };
        create_custom_field(&pool, input1)
            .await
            .expect("create field 1");

        let input2 = CreateCustomFieldInput {
            board_id,
            name: "Field Two".to_string(),
            field_type: CustomFieldType::Number,
            options: None,
            is_required: true,
            tenant_id,
            created_by_id: user_id,
        };
        create_custom_field(&pool, input2)
            .await
            .expect("create field 2");

        let fields = list_board_custom_fields(&pool, board_id, user_id)
            .await
            .expect("list_board_custom_fields");

        assert!(fields.len() >= 2);
        let names: Vec<&str> = fields.iter().map(|f| f.name.as_str()).collect();
        assert!(names.contains(&"Field One"));
        assert!(names.contains(&"Field Two"));
    }
    #[ignore = "integration test - run with: cargo test -- --ignored"]
    #[tokio::test]
    async fn test_set_and_get_task_custom_field_values() {
        let pool = test_pool().await;
        let (tenant_id, user_id, board_id, task_id) = setup_full_with_task(&pool).await;

        // Create a text field
        let field_input = CreateCustomFieldInput {
            board_id,
            name: "Notes".to_string(),
            field_type: CustomFieldType::Text,
            options: None,
            is_required: false,
            tenant_id,
            created_by_id: user_id,
        };
        let field = create_custom_field(&pool, field_input)
            .await
            .expect("create_custom_field for value test");

        // Set a value on the task
        let values = vec![SetFieldValue {
            field_id: field.id,
            value_text: Some("Important note".to_string()),
            value_number: None,
            value_date: None,
            value_bool: None,
        }];

        let results = set_task_custom_field_values(&pool, task_id, user_id, values)
            .await
            .expect("set_task_custom_field_values");

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].task_id, task_id);
        assert_eq!(results[0].field_id, field.id);
        assert_eq!(results[0].value_text.as_deref(), Some("Important note"));

        // Get the values back
        let fetched = get_task_custom_field_values(&pool, task_id, user_id)
            .await
            .expect("get_task_custom_field_values");

        assert!(!fetched.is_empty());
        let notes_field = fetched.iter().find(|v| v.field_id == field.id);
        assert!(notes_field.is_some(), "should find the Notes field value");
        assert_eq!(
            notes_field.expect("notes field").value_text.as_deref(),
            Some("Important note")
        );
    }
    #[ignore = "integration test - run with: cargo test -- --ignored"]
    #[tokio::test]
    async fn test_delete_custom_field() {
        let pool = test_pool().await;
        let (tenant_id, user_id, _ws_id, board_id, _col_id) = setup_full(&pool).await;

        let input = CreateCustomFieldInput {
            board_id,
            name: "To Delete".to_string(),
            field_type: CustomFieldType::Checkbox,
            options: None,
            is_required: false,
            tenant_id,
            created_by_id: user_id,
        };
        let field = create_custom_field(&pool, input)
            .await
            .expect("create field to delete");

        delete_custom_field(&pool, field.id, user_id)
            .await
            .expect("delete_custom_field");

        // Verify it no longer appears in list
        let fields = list_board_custom_fields(&pool, board_id, user_id)
            .await
            .expect("list after delete");
        assert!(
            !fields.iter().any(|f| f.id == field.id),
            "deleted field should not appear in list"
        );
    }
    #[ignore = "integration test - run with: cargo test -- --ignored"]
    #[tokio::test]
    async fn test_create_custom_field_not_board_member() {
        let pool = test_pool().await;
        let (tenant_id, _user_id, _ws_id, board_id, _col_id) = setup_full(&pool).await;

        // Create a second user who is NOT a board member
        let other_user = auth::create_user(
            &pool,
            &unique_email(),
            "Other",
            FAKE_HASH,
            UserRole::Member,
            tenant_id,
        )
        .await
        .expect("create other user");

        let input = CreateCustomFieldInput {
            board_id,
            name: "Unauthorized Field".to_string(),
            field_type: CustomFieldType::Text,
            options: None,
            is_required: false,
            tenant_id,
            created_by_id: other_user.id,
        };

        let result = create_custom_field(&pool, input).await;
        assert!(
            result.is_err(),
            "non-member should not be able to create custom field"
        );
    }
}
