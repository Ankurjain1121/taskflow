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

/// Internal helper: verify board membership
async fn verify_board_membership_internal(
    pool: &PgPool,
    board_id: Uuid,
    user_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM board_members
            WHERE board_id = $1 AND user_id = $2
        )
        "#,
    )
    .bind(board_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    Ok(result)
}

/// Internal helper: get task's board_id
async fn get_task_board_id_internal(
    pool: &PgPool,
    task_id: Uuid,
) -> Result<Uuid, CustomFieldQueryError> {
    let board_id = sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT board_id FROM tasks WHERE id = $1 AND deleted_at IS NULL
        "#,
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
    if !verify_board_membership_internal(pool, board_id, user_id).await? {
        return Err(CustomFieldQueryError::NotBoardMember);
    }

    let fields = sqlx::query_as::<_, BoardCustomField>(
        r#"
        SELECT
            id, board_id, name,
            field_type as "field_type: CustomFieldType",
            options, is_required, position,
            tenant_id, created_by_id,
            created_at, updated_at
        FROM board_custom_fields
        WHERE board_id = $1
        ORDER BY position ASC, created_at ASC
        "#,
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
    if !verify_board_membership_internal(pool, input.board_id, input.created_by_id).await? {
        return Err(CustomFieldQueryError::NotBoardMember);
    }

    // Get next position
    let next_pos = sqlx::query_scalar::<_, Option<i32>>(
        r#"
        SELECT MAX(position) FROM board_custom_fields WHERE board_id = $1
        "#,
    )
    .bind(input.board_id)
    .fetch_one(pool)
    .await?
    .unwrap_or(0)
    + 1;

    let id = Uuid::new_v4();
    let now = Utc::now();

    let field = sqlx::query_as::<_, BoardCustomField>(
        r#"
        INSERT INTO board_custom_fields (id, board_id, name, field_type, options, is_required, position, tenant_id, created_by_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING
            id, board_id, name,
            field_type as "field_type: CustomFieldType",
            options, is_required, position,
            tenant_id, created_by_id,
            created_at, updated_at
        "#,
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
        r#"
        SELECT board_id FROM board_custom_fields WHERE id = $1
        "#,
    )
    .bind(field_id)
    .fetch_optional(pool)
    .await?
    .ok_or(CustomFieldQueryError::NotFound)?;

    if !verify_board_membership_internal(pool, existing, user_id).await? {
        return Err(CustomFieldQueryError::NotBoardMember);
    }

    let field = sqlx::query_as::<_, BoardCustomField>(
        r#"
        UPDATE board_custom_fields
        SET
            name = COALESCE($2, name),
            options = COALESCE($3, options),
            is_required = COALESCE($4, is_required),
            position = COALESCE($5, position),
            updated_at = NOW()
        WHERE id = $1
        RETURNING
            id, board_id, name,
            field_type as "field_type: CustomFieldType",
            options, is_required, position,
            tenant_id, created_by_id,
            created_at, updated_at
        "#,
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
        r#"
        SELECT board_id FROM board_custom_fields WHERE id = $1
        "#,
    )
    .bind(field_id)
    .fetch_optional(pool)
    .await?
    .ok_or(CustomFieldQueryError::NotFound)?;

    if !verify_board_membership_internal(pool, board_id, user_id).await? {
        return Err(CustomFieldQueryError::NotBoardMember);
    }

    // Delete associated task values first
    sqlx::query(
        r#"
        DELETE FROM task_custom_field_values WHERE field_id = $1
        "#,
    )
    .bind(field_id)
    .execute(pool)
    .await?;

    // Delete the field itself
    let rows_affected = sqlx::query(
        r#"
        DELETE FROM board_custom_fields WHERE id = $1
        "#,
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

    if !verify_board_membership_internal(pool, board_id, user_id).await? {
        return Err(CustomFieldQueryError::NotBoardMember);
    }

    let values = sqlx::query_as::<_, TaskCustomFieldValueWithField>(
        r#"
        SELECT
            COALESCE(v.id, '00000000-0000-0000-0000-000000000000'::uuid) as id,
            $1::uuid as task_id,
            f.id as field_id,
            f.name as field_name,
            f.field_type as "field_type: CustomFieldType",
            f.options,
            f.is_required,
            v.value_text,
            v.value_number,
            v.value_date,
            v.value_bool
        FROM board_custom_fields f
        LEFT JOIN task_custom_field_values v ON v.field_id = f.id AND v.task_id = $1
        WHERE f.board_id = $2
        ORDER BY f.position ASC, f.created_at ASC
        "#,
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

    if !verify_board_membership_internal(pool, board_id, user_id).await? {
        return Err(CustomFieldQueryError::NotBoardMember);
    }

    let mut results = Vec::with_capacity(values.len());

    for val in values {
        let result = sqlx::query_as::<_, TaskCustomFieldValue>(
            r#"
            INSERT INTO task_custom_field_values (id, task_id, field_id, value_text, value_number, value_date, value_bool, created_at, updated_at)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW())
            ON CONFLICT (task_id, field_id) DO UPDATE SET
                value_text = EXCLUDED.value_text,
                value_number = EXCLUDED.value_number,
                value_date = EXCLUDED.value_date,
                value_bool = EXCLUDED.value_bool,
                updated_at = NOW()
            RETURNING id, task_id, field_id, value_text, value_number, value_date, value_bool, created_at, updated_at
            "#,
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
