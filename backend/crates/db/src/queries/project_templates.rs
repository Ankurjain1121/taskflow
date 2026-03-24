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

use super::membership::verify_project_membership;

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
            id, template_id, name, position, color
        FROM project_template_groups
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
            priority,
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
        && (template.tenant_id != tenant_id
            || !matches!(user_role, UserRole::SuperAdmin | UserRole::Admin))
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
    if !verify_project_membership(pool, board_id, user_id).await? {
        return Err(ProjectTemplateQueryError::NotBoardMember);
    }

    let mut tx = pool
        .begin()
        .await
        .map_err(ProjectTemplateQueryError::Database)?;

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
    }

    let board_columns = sqlx::query_as::<_, BoardCol>(
        r#"
        SELECT id, name, position, color
        FROM project_statuses
        WHERE project_id = $1
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

        sqlx::query(
            r#"
            INSERT INTO project_template_groups (id, template_id, name, position, color)
            VALUES ($1, $2, $3, $4, $5)
            "#,
        )
        .bind(col_id)
        .bind(template_id)
        .bind(&col.name)
        .bind(position)
        .bind(&color)
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
        status_id: Option<Uuid>,
        #[allow(dead_code)]
        position: String,
    }

    let board_tasks = sqlx::query_as::<_, BoardTask>(
        r#"
        SELECT
            title, description,
            priority,
            status_id, position
        FROM tasks
        WHERE project_id = $1 AND deleted_at IS NULL
        ORDER BY status_id, position ASC
        "#,
    )
    .bind(board_id)
    .fetch_all(&mut *tx)
    .await?;

    for (task_idx, task) in board_tasks.iter().enumerate() {
        let column_index = task
            .status_id
            .and_then(|sid| column_id_to_index.get(&sid))
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

    tx.commit()
        .await
        .map_err(ProjectTemplateQueryError::Database)?;

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
            id, template_id, name, position, color
        FROM project_template_groups
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
            priority,
            position
        FROM project_template_tasks
        WHERE template_id = $1
        ORDER BY column_index ASC, position ASC
        "#,
    )
    .bind(template_id)
    .fetch_all(pool)
    .await?;

    let mut tx = pool
        .begin()
        .await
        .map_err(ProjectTemplateQueryError::Database)?;

    // Create the board
    let board_id = Uuid::new_v4();
    let now = chrono::Utc::now();

    sqlx::query(
        r#"
        INSERT INTO projects (id, name, workspace_id, tenant_id, created_by_id, created_at, updated_at)
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

    // Add creator as project member with editor role
    sqlx::query(
        r#"
        INSERT INTO project_members (project_id, user_id, role)
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

        sqlx::query(
            r#"
            INSERT INTO project_statuses (id, name, project_id, position, color, type, is_default, tenant_id, created_at)
            VALUES ($1, $2, $3, $4, $5, 'not_started', false, $6, $7)
            "#,
        )
        .bind(col_id)
        .bind(&col.name)
        .bind(board_id)
        .bind(&position)
        .bind(&col.color)
        .bind(tenant_id)
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
            INSERT INTO tasks (id, title, description, priority, status_id, project_id, position, tenant_id, created_by_id, created_at, updated_at)
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

    tx.commit()
        .await
        .map_err(ProjectTemplateQueryError::Database)?;

    Ok(board_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::UserRole;
    use crate::queries::{auth, projects, workspaces};
    use sqlx::PgPool;

    const FAKE_HASH: &str = "$argon2id$v=19$m=19456,t=2,p=1$fake_salt$fake_hash_for_test";

    fn unique_email() -> String {
        format!("inttest-ptmpl-{}@example.com", Uuid::new_v4())
    }

    async fn test_pool() -> PgPool {
        PgPool::connect(
            "postgresql://taskbolt:REDACTED_PG_PASSWORD@localhost:5433/taskbolt",
        )
        .await
        .expect("Failed to connect to test database")
    }

    async fn setup_user(pool: &PgPool) -> (Uuid, Uuid) {
        let user = auth::create_user_with_tenant(pool, &unique_email(), "ProjTmpl User", FAKE_HASH)
            .await
            .expect("create_user_with_tenant");
        (user.tenant_id, user.id)
    }

    async fn setup_user_and_workspace(pool: &PgPool) -> (Uuid, Uuid, Uuid) {
        let (tenant_id, user_id) = setup_user(pool).await;
        let ws = workspaces::create_workspace(pool, "ProjTmpl WS", None, tenant_id, user_id)
            .await
            .expect("create_workspace");
        (tenant_id, user_id, ws.id)
    }

    async fn setup_full(pool: &PgPool) -> (Uuid, Uuid, Uuid, Uuid, Uuid) {
        let (tenant_id, user_id, ws_id) = setup_user_and_workspace(pool).await;
        let bwc = projects::create_project(pool, "ProjTmpl Board", None, ws_id, tenant_id, user_id)
            .await
            .expect("create_board");
        let first_col_id = bwc.task_lists[0].id;
        (tenant_id, user_id, ws_id, bwc.project.id, first_col_id)
    }
    #[ignore = "integration test - run with: cargo test -- --ignored"]
    #[tokio::test]
    async fn test_create_template() {
        let pool = test_pool().await;
        let (tenant_id, user_id) = setup_user(&pool).await;

        let input = CreateTemplateInput {
            name: format!("Template-{}", Uuid::new_v4()),
            description: Some("A test project template".to_string()),
            category: Some("Development".to_string()),
        };
        let name_clone = input.name.clone();

        let template = create_template(&pool, input, user_id, tenant_id)
            .await
            .expect("create_template should succeed");

        assert_eq!(template.name, name_clone);
        assert_eq!(
            template.description.as_deref(),
            Some("A test project template")
        );
        assert_eq!(template.category.as_deref(), Some("Development"));
        assert!(!template.is_public);
        assert_eq!(template.tenant_id, tenant_id);
        assert_eq!(template.created_by_id, user_id);
    }
    #[ignore = "integration test - run with: cargo test -- --ignored"]
    #[tokio::test]
    async fn test_get_template() {
        let pool = test_pool().await;
        let (tenant_id, user_id) = setup_user(&pool).await;

        let input = CreateTemplateInput {
            name: format!("GetTemplate-{}", Uuid::new_v4()),
            description: None,
            category: None,
        };

        let created = create_template(&pool, input, user_id, tenant_id)
            .await
            .expect("create_template");

        let details = get_template(&pool, created.id)
            .await
            .expect("get_template should succeed");

        assert_eq!(details.template.id, created.id);
        assert_eq!(details.template.name, created.name);
        assert!(
            details.columns.is_empty(),
            "new template should have no columns"
        );
        assert!(
            details.tasks.is_empty(),
            "new template should have no tasks"
        );
    }
    #[ignore = "integration test - run with: cargo test -- --ignored"]
    #[tokio::test]
    async fn test_list_templates() {
        let pool = test_pool().await;
        let (tenant_id, user_id) = setup_user(&pool).await;

        let name1 = format!("ListTmpl1-{}", Uuid::new_v4());
        let name2 = format!("ListTmpl2-{}", Uuid::new_v4());

        create_template(
            &pool,
            CreateTemplateInput {
                name: name1.clone(),
                description: None,
                category: None,
            },
            user_id,
            tenant_id,
        )
        .await
        .expect("create_template 1");

        create_template(
            &pool,
            CreateTemplateInput {
                name: name2.clone(),
                description: None,
                category: None,
            },
            user_id,
            tenant_id,
        )
        .await
        .expect("create_template 2");

        let list = list_templates(&pool, tenant_id)
            .await
            .expect("list_templates should succeed");

        let names: Vec<&str> = list.iter().map(|t| t.name.as_str()).collect();
        assert!(
            names.contains(&name1.as_str()),
            "list should contain template 1"
        );
        assert!(
            names.contains(&name2.as_str()),
            "list should contain template 2"
        );
    }
    #[ignore = "integration test - run with: cargo test -- --ignored"]
    #[tokio::test]
    async fn test_create_board_from_template() {
        let pool = test_pool().await;
        let (tenant_id, user_id, ws_id, board_id, _col_id) = setup_full(&pool).await;

        // First, save the board as a template (this creates template with columns)
        let save_input = CreateTemplateFromBoardInput {
            name: format!("BoardTemplate-{}", Uuid::new_v4()),
            description: Some("Template from board".to_string()),
            category: None,
        };

        let template = save_board_as_template(&pool, board_id, save_input, user_id, tenant_id)
            .await
            .expect("save_board_as_template should succeed");

        // Verify template has columns copied from the board
        let details = get_template(&pool, template.id)
            .await
            .expect("get_template for saved board template");
        assert!(
            !details.columns.is_empty(),
            "template should have columns from board"
        );

        // Now create a board from this template
        let new_board_name = format!("FromTemplate-{}", Uuid::new_v4());
        let new_board_id = create_board_from_template(
            &pool,
            template.id,
            ws_id,
            new_board_name.clone(),
            user_id,
            tenant_id,
        )
        .await
        .expect("create_board_from_template should succeed");

        // Verify the new board exists
        let new_board = projects::get_project_by_id(&pool, new_board_id, user_id)
            .await
            .expect("get_board_by_id")
            .expect("new board should exist");

        assert_eq!(new_board.project.name, new_board_name);
        assert!(
            !new_board.task_lists.is_empty(),
            "new board should have task lists from template"
        );
    }
    #[ignore = "integration test - run with: cargo test -- --ignored"]
    #[tokio::test]
    async fn test_delete_template() {
        let pool = test_pool().await;
        let (tenant_id, user_id) = setup_user(&pool).await;

        let input = CreateTemplateInput {
            name: format!("DeleteTmpl-{}", Uuid::new_v4()),
            description: None,
            category: None,
        };

        let created = create_template(&pool, input, user_id, tenant_id)
            .await
            .expect("create_template");

        delete_template(&pool, created.id, user_id, tenant_id, UserRole::Admin)
            .await
            .expect("delete_template should succeed");

        let result = get_template(&pool, created.id).await;
        assert!(result.is_err(), "template should be deleted");
    }
}
