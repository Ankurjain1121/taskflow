use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::task_template::{TaskTemplate, TaskTemplateCustomField, TaskTemplateSubtask};

#[derive(Debug, thiserror::Error)]
pub enum TaskTemplateQueryError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Task template not found")]
    NotFound,
    #[error("Task not found")]
    TaskNotFound,
    #[error("Not authorized")]
    NotAuthorized,
}

/// A template with all its child data
#[derive(Debug, Serialize)]
pub struct TaskTemplateWithDetails {
    #[serde(flatten)]
    pub template: TaskTemplate,
    pub subtasks: Vec<TaskTemplateSubtask>,
    pub label_ids: Vec<Uuid>,
    pub custom_fields: Vec<TaskTemplateCustomField>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTaskTemplateInput {
    pub name: String,
    pub description: Option<String>,
    pub scope: Option<String>,
    pub board_id: Option<Uuid>,
    pub task_title: String,
    pub task_description: Option<String>,
    pub task_priority: Option<String>,
    pub task_estimated_hours: Option<f64>,
    pub subtasks: Option<Vec<String>>,
    pub label_ids: Option<Vec<Uuid>>,
    pub custom_fields: Option<Vec<TemplateCustomFieldInput>>,
}

#[derive(Debug, Deserialize)]
pub struct TemplateCustomFieldInput {
    pub field_id: Uuid,
    pub value: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTaskTemplateInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub task_title: Option<String>,
    pub task_description: Option<String>,
    pub task_priority: Option<String>,
    pub task_estimated_hours: Option<f64>,
}

/// List task templates for a tenant, optionally filtered by scope and board_id
pub async fn list_task_templates(
    pool: &PgPool,
    tenant_id: Uuid,
    scope: Option<&str>,
    board_id: Option<Uuid>,
    user_id: Uuid,
) -> Result<Vec<TaskTemplate>, TaskTemplateQueryError> {
    let templates = sqlx::query_as::<_, TaskTemplate>(
        r#"
        SELECT id, name, description, scope, board_id, tenant_id, created_by_id,
               task_title, task_description, task_priority, task_estimated_hours,
               created_at, updated_at
        FROM task_templates
        WHERE tenant_id = $1
          AND (
              $2::text IS NULL OR scope = $2
          )
          AND (
              $3::uuid IS NULL OR board_id = $3
          )
          AND (
              scope != 'personal' OR created_by_id = $4
          )
        ORDER BY name ASC
        "#,
    )
    .bind(tenant_id)
    .bind(scope)
    .bind(board_id)
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(templates)
}

/// Get a task template with all details
pub async fn get_task_template(
    pool: &PgPool,
    template_id: Uuid,
    tenant_id: Uuid,
) -> Result<TaskTemplateWithDetails, TaskTemplateQueryError> {
    let template = sqlx::query_as::<_, TaskTemplate>(
        r#"
        SELECT id, name, description, scope, board_id, tenant_id, created_by_id,
               task_title, task_description, task_priority, task_estimated_hours,
               created_at, updated_at
        FROM task_templates
        WHERE id = $1 AND tenant_id = $2
        "#,
    )
    .bind(template_id)
    .bind(tenant_id)
    .fetch_optional(pool)
    .await?
    .ok_or(TaskTemplateQueryError::NotFound)?;

    let subtasks = sqlx::query_as::<_, TaskTemplateSubtask>(
        r#"
        SELECT id, template_id, title, position
        FROM task_template_subtasks
        WHERE template_id = $1
        ORDER BY position ASC
        "#,
    )
    .bind(template_id)
    .fetch_all(pool)
    .await?;

    let label_ids = sqlx::query_scalar::<_, Uuid>(
        r#"SELECT label_id FROM task_template_labels WHERE template_id = $1"#,
    )
    .bind(template_id)
    .fetch_all(pool)
    .await?;

    let custom_fields = sqlx::query_as::<_, TaskTemplateCustomField>(
        r#"
        SELECT id, template_id, field_id, value
        FROM task_template_custom_fields
        WHERE template_id = $1
        "#,
    )
    .bind(template_id)
    .fetch_all(pool)
    .await?;

    Ok(TaskTemplateWithDetails {
        template,
        subtasks,
        label_ids,
        custom_fields,
    })
}

/// Create a task template from scratch
pub async fn create_task_template(
    pool: &PgPool,
    input: CreateTaskTemplateInput,
    tenant_id: Uuid,
    user_id: Uuid,
) -> Result<TaskTemplate, TaskTemplateQueryError> {
    let mut tx = pool.begin().await?;

    let id = Uuid::new_v4();
    let now = Utc::now();
    let scope = input.scope.unwrap_or_else(|| "workspace".to_string());

    let template = sqlx::query_as::<_, TaskTemplate>(
        r#"
        INSERT INTO task_templates (
            id, name, description, scope, board_id, tenant_id, created_by_id,
            task_title, task_description, task_priority, task_estimated_hours,
            created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
        RETURNING id, name, description, scope, board_id, tenant_id, created_by_id,
                  task_title, task_description, task_priority, task_estimated_hours,
                  created_at, updated_at
        "#,
    )
    .bind(id)
    .bind(&input.name)
    .bind(&input.description)
    .bind(&scope)
    .bind(input.board_id)
    .bind(tenant_id)
    .bind(user_id)
    .bind(&input.task_title)
    .bind(&input.task_description)
    .bind(&input.task_priority)
    .bind(input.task_estimated_hours)
    .bind(now)
    .fetch_one(&mut *tx)
    .await?;

    // Insert subtasks
    if let Some(subtask_titles) = &input.subtasks {
        for (i, title) in subtask_titles.iter().enumerate() {
            sqlx::query(
                r#"
                INSERT INTO task_template_subtasks (id, template_id, title, position)
                VALUES ($1, $2, $3, $4)
                "#,
            )
            .bind(Uuid::new_v4())
            .bind(id)
            .bind(title)
            .bind(i as i32)
            .execute(&mut *tx)
            .await?;
        }
    }

    // Insert label associations
    if let Some(label_ids) = &input.label_ids {
        for label_id in label_ids {
            sqlx::query(
                r#"
                INSERT INTO task_template_labels (id, template_id, label_id)
                VALUES ($1, $2, $3)
                ON CONFLICT DO NOTHING
                "#,
            )
            .bind(Uuid::new_v4())
            .bind(id)
            .bind(label_id)
            .execute(&mut *tx)
            .await?;
        }
    }

    // Insert custom field values
    if let Some(custom_fields) = &input.custom_fields {
        for cf in custom_fields {
            sqlx::query(
                r#"
                INSERT INTO task_template_custom_fields (id, template_id, field_id, value)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT DO NOTHING
                "#,
            )
            .bind(Uuid::new_v4())
            .bind(id)
            .bind(cf.field_id)
            .bind(&cf.value)
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;

    Ok(template)
}

/// Save an existing task as a template
pub async fn save_task_as_template(
    pool: &PgPool,
    task_id: Uuid,
    template_name: String,
    scope: Option<String>,
    user_id: Uuid,
    tenant_id: Uuid,
) -> Result<TaskTemplate, TaskTemplateQueryError> {
    // Fetch the source task
    let task = sqlx::query_as::<_, SourceTaskForTemplate>(
        r#"
        SELECT id, title, description, priority, estimated_hours, board_id
        FROM tasks
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(task_id)
    .fetch_optional(pool)
    .await?
    .ok_or(TaskTemplateQueryError::TaskNotFound)?;

    let mut tx = pool.begin().await?;

    let id = Uuid::new_v4();
    let now = Utc::now();
    let scope = scope.unwrap_or_else(|| "workspace".to_string());
    let board_id = if scope == "board" {
        Some(task.board_id)
    } else {
        None
    };
    let priority_str = format!("{:?}", task.priority).to_lowercase();

    let template = sqlx::query_as::<_, TaskTemplate>(
        r#"
        INSERT INTO task_templates (
            id, name, description, scope, board_id, tenant_id, created_by_id,
            task_title, task_description, task_priority, task_estimated_hours,
            created_at, updated_at
        )
        VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
        RETURNING id, name, description, scope, board_id, tenant_id, created_by_id,
                  task_title, task_description, task_priority, task_estimated_hours,
                  created_at, updated_at
        "#,
    )
    .bind(id)
    .bind(&template_name)
    .bind(&scope)
    .bind(board_id)
    .bind(tenant_id)
    .bind(user_id)
    .bind(&task.title)
    .bind(&task.description)
    .bind(&priority_str)
    .bind(task.estimated_hours)
    .bind(now)
    .fetch_one(&mut *tx)
    .await?;

    // Copy subtasks
    sqlx::query(
        r#"
        INSERT INTO task_template_subtasks (id, template_id, title, position)
        SELECT gen_random_uuid(), $2, title, position
        FROM subtasks WHERE task_id = $1
        ORDER BY position
        "#,
    )
    .bind(task_id)
    .bind(id)
    .execute(&mut *tx)
    .await?;

    // Copy labels
    sqlx::query(
        r#"
        INSERT INTO task_template_labels (id, template_id, label_id)
        SELECT gen_random_uuid(), $2, label_id
        FROM task_labels WHERE task_id = $1
        "#,
    )
    .bind(task_id)
    .bind(id)
    .execute(&mut *tx)
    .await?;

    // Copy custom field values
    sqlx::query(
        r#"
        INSERT INTO task_template_custom_fields (id, template_id, field_id, value)
        SELECT gen_random_uuid(), $2, field_id, value
        FROM task_custom_field_values WHERE task_id = $1
        "#,
    )
    .bind(task_id)
    .bind(id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(template)
}

/// Create a task from a template
pub async fn create_task_from_template(
    pool: &PgPool,
    template_id: Uuid,
    board_id: Uuid,
    column_id: Uuid,
    tenant_id: Uuid,
    user_id: Uuid,
) -> Result<Uuid, TaskTemplateQueryError> {
    let template = get_task_template(pool, template_id, tenant_id).await?;

    let mut tx = pool.begin().await?;

    let task_id = Uuid::new_v4();
    let now = Utc::now();
    let position = format!("a{}", now.timestamp_millis());

    sqlx::query(
        r#"
        INSERT INTO tasks (
            id, title, description, priority, board_id, column_id,
            position, estimated_hours, tenant_id, created_by_id,
            created_at, updated_at
        )
        VALUES ($1, $2, $3, $4::task_priority, $5, $6, $7, $8, $9, $10, $11, $11)
        "#,
    )
    .bind(task_id)
    .bind(&template.template.task_title)
    .bind(&template.template.task_description)
    .bind(
        template
            .template
            .task_priority
            .as_deref()
            .unwrap_or("medium"),
    )
    .bind(board_id)
    .bind(column_id)
    .bind(&position)
    .bind(template.template.task_estimated_hours)
    .bind(tenant_id)
    .bind(user_id)
    .bind(now)
    .execute(&mut *tx)
    .await?;

    // Create subtasks
    for subtask in &template.subtasks {
        sqlx::query(
            r#"
            INSERT INTO subtasks (id, task_id, title, is_completed, position, created_at, updated_at)
            VALUES ($1, $2, $3, false, $4, NOW(), NOW())
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(task_id)
        .bind(&subtask.title)
        .bind(subtask.position)
        .execute(&mut *tx)
        .await?;
    }

    // Add labels
    for label_id in &template.label_ids {
        sqlx::query(
            r#"
            INSERT INTO task_labels (id, task_id, label_id)
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(task_id)
        .bind(label_id)
        .execute(&mut *tx)
        .await?;
    }

    // Set custom field values
    for cf in &template.custom_fields {
        sqlx::query(
            r#"
            INSERT INTO task_custom_field_values (id, task_id, field_id, value, created_at, updated_at)
            VALUES ($1, $2, $3, $4, NOW(), NOW())
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(task_id)
        .bind(cf.field_id)
        .bind(&cf.value)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    Ok(task_id)
}

/// Update a task template
pub async fn update_task_template(
    pool: &PgPool,
    template_id: Uuid,
    input: UpdateTaskTemplateInput,
    tenant_id: Uuid,
    user_id: Uuid,
) -> Result<TaskTemplate, TaskTemplateQueryError> {
    // Verify ownership
    let existing = sqlx::query_as::<_, TaskTemplate>(
        r#"
        SELECT id, name, description, scope, board_id, tenant_id, created_by_id,
               task_title, task_description, task_priority, task_estimated_hours,
               created_at, updated_at
        FROM task_templates
        WHERE id = $1 AND tenant_id = $2
        "#,
    )
    .bind(template_id)
    .bind(tenant_id)
    .fetch_optional(pool)
    .await?
    .ok_or(TaskTemplateQueryError::NotFound)?;

    if existing.created_by_id != user_id {
        return Err(TaskTemplateQueryError::NotAuthorized);
    }

    let template = sqlx::query_as::<_, TaskTemplate>(
        r#"
        UPDATE task_templates
        SET name = COALESCE($2, name),
            task_title = COALESCE($3, task_title),
            task_description = COALESCE($4, task_description),
            task_priority = COALESCE($5, task_priority),
            task_estimated_hours = COALESCE($6, task_estimated_hours),
            description = COALESCE($7, description),
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, name, description, scope, board_id, tenant_id, created_by_id,
                  task_title, task_description, task_priority, task_estimated_hours,
                  created_at, updated_at
        "#,
    )
    .bind(template_id)
    .bind(&input.name)
    .bind(&input.task_title)
    .bind(&input.task_description)
    .bind(&input.task_priority)
    .bind(input.task_estimated_hours)
    .bind(&input.description)
    .fetch_one(pool)
    .await?;

    Ok(template)
}

/// Delete a task template
pub async fn delete_task_template(
    pool: &PgPool,
    template_id: Uuid,
    tenant_id: Uuid,
    user_id: Uuid,
) -> Result<(), TaskTemplateQueryError> {
    let existing = sqlx::query_scalar::<_, Uuid>(
        "SELECT created_by_id FROM task_templates WHERE id = $1 AND tenant_id = $2",
    )
    .bind(template_id)
    .bind(tenant_id)
    .fetch_optional(pool)
    .await?
    .ok_or(TaskTemplateQueryError::NotFound)?;

    if existing != user_id {
        return Err(TaskTemplateQueryError::NotAuthorized);
    }

    sqlx::query("DELETE FROM task_templates WHERE id = $1")
        .bind(template_id)
        .execute(pool)
        .await?;

    Ok(())
}

#[derive(sqlx::FromRow)]
struct SourceTaskForTemplate {
    #[allow(dead_code)]
    id: Uuid,
    title: String,
    description: Option<String>,
    priority: crate::models::TaskPriority,
    estimated_hours: Option<f64>,
    board_id: Uuid,
}
