use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{
    ProjectTemplate, ProjectTemplateColumn, ProjectTemplateTask, TaskPriority, UserRole,
};

/// Error type for project template query operations
#[derive(Debug, thiserror::Error)]
pub enum ProjectTemplateQueryError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Template not found")]
    NotFound,
    #[error("User is not a member of this board")]
    NotBoardMember,
    #[error("Forbidden")]
    Forbidden,
}

/// Input for creating a new project template
#[derive(Debug, Deserialize)]
pub struct CreateTemplateInput {
    pub name: String,
    pub description: Option<String>,
    pub category: Option<String>,
}

/// Input for saving a board as a template
#[derive(Debug, Deserialize)]
pub struct CreateTemplateFromBoardInput {
    pub name: String,
    pub description: Option<String>,
    pub category: Option<String>,
}

/// Input for creating a board from a template
#[derive(Debug, Deserialize)]
pub struct CreateBoardFromTemplateInput {
    pub workspace_id: Uuid,
    pub board_name: String,
}

/// Template with its columns and tasks
#[derive(Debug, Serialize)]
pub struct TemplateWithDetails {
    #[serde(flatten)]
    pub template: ProjectTemplate,
    pub columns: Vec<ProjectTemplateColumn>,
    pub tasks: Vec<ProjectTemplateTask>,
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

/// List all templates accessible to a tenant (own templates + public ones)
pub async fn list_templates(
    pool: &PgPool,
    tenant_id: Uuid,
) -> Result<Vec<ProjectTemplate>, ProjectTemplateQueryError> {
    let templates = sqlx::query_as::<_, ProjectTemplate>(
        r#"
        SELECT
            id, name, description, category, is_public,
            tenant_id, created_by_id, created_at, updated_at
        FROM project_templates
        WHERE tenant_id = $1 OR is_public = true
        ORDER BY created_at DESC
        "#,
    )
    .bind(tenant_id)
    .fetch_all(pool)
    .await?;

    Ok(templates)
}

/// Get a template by ID with its columns and tasks
pub async fn get_template(
    pool: &PgPool,
    template_id: Uuid,
) -> Result<TemplateWithDetails, ProjectTemplateQueryError> {
    let template = sqlx::query_as::<_, ProjectTemplate>(
        r#"
        SELECT
            id, name, description, category, is_public,
            tenant_id, created_by_id, created_at, updated_at
        FROM project_templates
        WHERE id = $1
        "#,
    )
    .bind(template_id)
    .fetch_optional(pool)
    .await?
    .ok_or(ProjectTemplateQueryError::NotFound)?;

    let columns = sqlx::query_as::<_, ProjectTemplateColumn>(
        r#"
        SELECT
            id, template_id, name, position, color,
            wip_limit, status_mapping
        FROM project_template_columns
        WHERE template_id = $1
        ORDER BY position ASC
        "#,
    )
    .bind(template_id)
    .fetch_all(pool)
    .await?;

    let tasks = sqlx::query_as::<_, ProjectTemplateTask>(
        r#"
        SELECT
            id, template_id, column_index, title, description,
            priority as "priority: TaskPriority",
            position
        FROM project_template_tasks
        WHERE template_id = $1
        ORDER BY column_index ASC, position ASC
        "#,
    )
    .bind(template_id)
    .fetch_all(pool)
    .await?;

    Ok(TemplateWithDetails {
        template,
        columns,
        tasks,
    })
}

/// Create a new empty project template
pub async fn create_template(
    pool: &PgPool,
    input: CreateTemplateInput,
    user_id: Uuid,
    tenant_id: Uuid,
) -> Result<ProjectTemplate, ProjectTemplateQueryError> {
    let id = Uuid::new_v4();
    let now = chrono::Utc::now();

    let template = sqlx::query_as::<_, ProjectTemplate>(
        r#"
        INSERT INTO project_templates (id, name, description, category, is_public, tenant_id, created_by_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, false, $5, $6, $7, $7)
        RETURNING
            id, name, description, category, is_public,
            tenant_id, created_by_id, created_at, updated_at
        "#,
    )
    .bind(id)
    .bind(&input.name)
    .bind(&input.description)
    .bind(&input.category)
    .bind(tenant_id)
    .bind(user_id)
    .bind(now)
    .fetch_one(pool)
    .await?;

    Ok(template)
}

/// Delete a project template (only creator or admin can delete)
pub async fn delete_template(
    pool: &PgPool,
    template_id: Uuid,
    user_id: Uuid,
    tenant_id: Uuid,
    user_role: UserRole,
) -> Result<(), ProjectTemplateQueryError> {
    let template = sqlx::query_as::<_, ProjectTemplate>(
        r#"
        SELECT
            id, name, description, category, is_public,
            tenant_id, created_by_id, created_at, updated_at
        FROM project_templates
        WHERE id = $1
        "#,
    )
    .bind(template_id)
    .fetch_optional(pool)
    .await?
    .ok_or(ProjectTemplateQueryError::NotFound)?;

    // Only the creator or an admin of the same tenant can delete
    if template.created_by_id != user_id
        && (template.tenant_id != tenant_id || user_role != UserRole::Admin)
    {
        return Err(ProjectTemplateQueryError::Forbidden);
    }

    // Cascade delete handles columns and tasks
    let rows_affected = sqlx::query(
        r#"
        DELETE FROM project_templates WHERE id = $1
        "#,
    )
    .bind(template_id)
    .execute(pool)
    .await?
    .rows_affected();

    if rows_affected == 0 {
        return Err(ProjectTemplateQueryError::NotFound);
    }

    Ok(())
}

/// Save an existing board as a project template.
/// Copies the board's columns and tasks into a new template.
pub async fn save_board_as_template(
    pool: &PgPool,
    board_id: Uuid,
    input: CreateTemplateFromBoardInput,
    user_id: Uuid,
    tenant_id: Uuid,
) -> Result<ProjectTemplate, ProjectTemplateQueryError> {
    // Verify user is a member of the board
    if !verify_board_membership_internal(pool, board_id, user_id).await? {
        return Err(ProjectTemplateQueryError::NotBoardMember);
    }

    let mut tx = pool.begin().await.map_err(ProjectTemplateQueryError::Database)?;

    // Create the template
    let template_id = Uuid::new_v4();
    let now = chrono::Utc::now();

    let template = sqlx::query_as::<_, ProjectTemplate>(
        r#"
        INSERT INTO project_templates (id, name, description, category, is_public, tenant_id, created_by_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, false, $5, $6, $7, $7)
        RETURNING
            id, name, description, category, is_public,
            tenant_id, created_by_id, created_at, updated_at
        "#,
    )
    .bind(template_id)
    .bind(&input.name)
    .bind(&input.description)
    .bind(&input.category)
    .bind(tenant_id)
    .bind(user_id)
    .bind(now)
    .fetch_one(&mut *tx)
    .await?;

    // Fetch board columns ordered by position
    #[derive(sqlx::FromRow)]
    struct BoardCol {
        id: Uuid,
        name: String,
        #[allow(dead_code)]
        position: String,
        color: Option<String>,
        status_mapping: Option<serde_json::Value>,
    }

    let board_columns = sqlx::query_as::<_, BoardCol>(
        r#"
        SELECT id, name, position, color, status_mapping
        FROM board_columns
        WHERE board_id = $1
        ORDER BY position ASC
        "#,
    )
    .bind(board_id)
    .fetch_all(&mut *tx)
    .await?;

    // Create template columns from board columns
    // Build a mapping from board column_id -> template column_index
    let mut column_id_to_index: std::collections::HashMap<Uuid, i32> =
        std::collections::HashMap::new();

    for (idx, col) in board_columns.iter().enumerate() {
        let col_id = Uuid::new_v4();
        let position = idx as i32;
        let color = col.color.clone().unwrap_or_else(|| "#6366f1".to_string());
        let status_mapping = col
            .status_mapping
            .clone()
            .unwrap_or_else(|| serde_json::json!({}));

        sqlx::query(
            r#"
            INSERT INTO project_template_columns (id, template_id, name, position, color, wip_limit, status_mapping)
            VALUES ($1, $2, $3, $4, $5, NULL, $6)
            "#,
        )
        .bind(col_id)
        .bind(template_id)
        .bind(&col.name)
        .bind(position)
        .bind(&color)
        .bind(&status_mapping)
        .execute(&mut *tx)
        .await?;

        column_id_to_index.insert(col.id, position);
    }

    // Fetch board tasks and copy them into template tasks
    #[derive(sqlx::FromRow)]
    struct BoardTask {
        title: String,
        description: Option<String>,
        priority: TaskPriority,
        column_id: Uuid,
        #[allow(dead_code)]
        position: String,
    }

    let board_tasks = sqlx::query_as::<_, BoardTask>(
        r#"
        SELECT
            title, description,
            priority as "priority: TaskPriority",
            column_id, position
        FROM tasks
        WHERE board_id = $1 AND deleted_at IS NULL
        ORDER BY column_id, position ASC
        "#,
    )
    .bind(board_id)
    .fetch_all(&mut *tx)
    .await?;

    for (task_idx, task) in board_tasks.iter().enumerate() {
        let column_index = column_id_to_index
            .get(&task.column_id)
            .copied()
            .unwrap_or(0);

        let task_id = Uuid::new_v4();

        sqlx::query(
            r#"
            INSERT INTO project_template_tasks (id, template_id, column_index, title, description, priority, position)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            "#,
        )
        .bind(task_id)
        .bind(template_id)
        .bind(column_index)
        .bind(&task.title)
        .bind(&task.description)
        .bind(&task.priority)
        .bind(task_idx as i32)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await.map_err(ProjectTemplateQueryError::Database)?;

    Ok(template)
}

/// Create a new board from a project template.
/// Creates a board with columns and tasks copied from the template.
/// Returns the new board ID.
pub async fn create_board_from_template(
    pool: &PgPool,
    template_id: Uuid,
    workspace_id: Uuid,
    board_name: String,
    user_id: Uuid,
    tenant_id: Uuid,
) -> Result<Uuid, ProjectTemplateQueryError> {
    // Verify the template exists
    let template = sqlx::query_as::<_, ProjectTemplate>(
        r#"
        SELECT
            id, name, description, category, is_public,
            tenant_id, created_by_id, created_at, updated_at
        FROM project_templates
        WHERE id = $1
        "#,
    )
    .bind(template_id)
    .fetch_optional(pool)
    .await?
    .ok_or(ProjectTemplateQueryError::NotFound)?;

    // Verify access: template must belong to same tenant or be public
    if template.tenant_id != tenant_id && !template.is_public {
        return Err(ProjectTemplateQueryError::Forbidden);
    }

    // Fetch template columns
    let template_columns = sqlx::query_as::<_, ProjectTemplateColumn>(
        r#"
        SELECT
            id, template_id, name, position, color,
            wip_limit, status_mapping
        FROM project_template_columns
        WHERE template_id = $1
        ORDER BY position ASC
        "#,
    )
    .bind(template_id)
    .fetch_all(pool)
    .await?;

    // Fetch template tasks
    let template_tasks = sqlx::query_as::<_, ProjectTemplateTask>(
        r#"
        SELECT
            id, template_id, column_index, title, description,
            priority as "priority: TaskPriority",
            position
        FROM project_template_tasks
        WHERE template_id = $1
        ORDER BY column_index ASC, position ASC
        "#,
    )
    .bind(template_id)
    .fetch_all(pool)
    .await?;

    let mut tx = pool.begin().await.map_err(ProjectTemplateQueryError::Database)?;

    // Create the board
    let board_id = Uuid::new_v4();
    let now = chrono::Utc::now();

    sqlx::query(
        r#"
        INSERT INTO boards (id, name, workspace_id, tenant_id, created_by_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $6)
        "#,
    )
    .bind(board_id)
    .bind(&board_name)
    .bind(workspace_id)
    .bind(tenant_id)
    .bind(user_id)
    .bind(now)
    .execute(&mut *tx)
    .await?;

    // Add creator as board member with editor role
    sqlx::query(
        r#"
        INSERT INTO board_members (board_id, user_id, role)
        VALUES ($1, $2, 'editor')
        "#,
    )
    .bind(board_id)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    // Create board columns from template columns
    // Build a mapping from template column position -> new board column_id
    let mut column_index_to_id: std::collections::HashMap<i32, Uuid> =
        std::collections::HashMap::new();

    for col in &template_columns {
        let col_id = Uuid::new_v4();
        // Use "a0", "a1", "a2" style position keys
        let position = format!("a{}", col.position);
        let status_mapping_val: Option<serde_json::Value> = {
            let v = &col.status_mapping;
            if v.is_object() && v.as_object().is_none_or(|m| m.is_empty()) {
                None
            } else {
                Some(v.clone())
            }
        };

        sqlx::query(
            r#"
            INSERT INTO board_columns (id, name, board_id, position, color, status_mapping, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            "#,
        )
        .bind(col_id)
        .bind(&col.name)
        .bind(board_id)
        .bind(&position)
        .bind(&col.color)
        .bind(&status_mapping_val)
        .bind(now)
        .execute(&mut *tx)
        .await?;

        column_index_to_id.insert(col.position, col_id);
    }

    // Create tasks from template tasks
    for task in &template_tasks {
        let task_id = Uuid::new_v4();
        let column_id = column_index_to_id
            .get(&task.column_index)
            .copied()
            .unwrap_or_else(|| {
                // Fallback to the first column if index doesn't match
                column_index_to_id
                    .values()
                    .next()
                    .copied()
                    .unwrap_or(Uuid::nil())
            });

        // Use "a0", "a1" style position keys
        let position = format!("a{}", task.position);

        sqlx::query(
            r#"
            INSERT INTO tasks (id, title, description, priority, column_id, board_id, position, tenant_id, created_by_id, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
            "#,
        )
        .bind(task_id)
        .bind(&task.title)
        .bind(&task.description)
        .bind(&task.priority)
        .bind(column_id)
        .bind(board_id)
        .bind(&position)
        .bind(tenant_id)
        .bind(user_id)
        .bind(now)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await.map_err(ProjectTemplateQueryError::Database)?;

    Ok(board_id)
}
