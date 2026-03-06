use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::DependencyType;

/// Error type for dependency query operations
#[derive(Debug, thiserror::Error)]
pub enum DependencyQueryError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("User is not a member of this project")]
    NotProjectMember,
    #[error("Dependency not found")]
    NotFound,
    #[error("Circular dependency detected")]
    CircularDependency,
    #[error("Dependencies must be between tasks on the same board")]
    CrossProjectDependency,
}

/// Input for creating a new dependency
#[derive(Debug, Deserialize)]
pub struct CreateDependencyInput {
    pub target_task_id: uuid::Uuid,
    pub dependency_type: DependencyType,
}

/// Dependency with related task information
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DependencyWithTask {
    pub id: Uuid,
    pub source_task_id: Uuid,
    pub target_task_id: Uuid,
    pub dependency_type: DependencyType,
    pub related_task_id: Uuid,
    pub related_task_title: String,
    pub related_task_priority: String,
    pub related_task_column_name: String,
    pub is_blocked: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Information about a task that blocks another task
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct BlockerInfo {
    pub task_id: Uuid,
    pub title: String,
    pub is_resolved: bool,
}

/// List all dependencies for a task with related task info.
/// Queries both directions: where source=task_id OR target=task_id.
pub async fn list_dependencies(
    pool: &PgPool,
    task_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<DependencyWithTask>, DependencyQueryError> {
    // Verify user has access to the task's project
    let project_id = get_task_project_id_internal(pool, task_id).await?;
    if !verify_project_membership_internal(pool, project_id, user_id).await? {
        return Err(DependencyQueryError::NotProjectMember);
    }

    let deps = sqlx::query_as::<_, DependencyWithTask>(
        r#"
        SELECT
            td.id,
            td.source_task_id,
            td.target_task_id,
            td.dependency_type as "dependency_type: DependencyType",
            CASE
                WHEN td.source_task_id = $1 THEN td.target_task_id
                ELSE td.source_task_id
            END as related_task_id,
            t.title as related_task_title,
            t.priority::text as related_task_priority,
            bc.name as related_task_column_name,
            CASE
                WHEN td.dependency_type = 'blocks' AND td.target_task_id = $1 THEN true
                ELSE false
            END as is_blocked,
            td.created_at
        FROM task_dependencies td
        JOIN tasks t ON t.id = CASE
            WHEN td.source_task_id = $1 THEN td.target_task_id
            ELSE td.source_task_id
        END
        JOIN project_columns bc ON bc.id = t.column_id
        WHERE (td.source_task_id = $1 OR td.target_task_id = $1)
          AND t.deleted_at IS NULL
        ORDER BY td.created_at DESC
        "#,
    )
    .bind(task_id)
    .fetch_all(pool)
    .await?;

    Ok(deps)
}

/// Create a new dependency between two tasks.
/// Validates same project, checks for circular dependencies.
/// For `BlockedBy` type: swaps source/target and stores as `Blocks`.
pub async fn create_dependency(
    pool: &PgPool,
    source_task_id: Uuid,
    input: CreateDependencyInput,
    user_id: Uuid,
) -> Result<DependencyWithTask, DependencyQueryError> {
    // Get project IDs for both tasks
    let source_project_id = get_task_project_id_internal(pool, source_task_id).await?;
    let target_project_id = get_task_project_id_internal(pool, input.target_task_id).await?;

    // Verify same project
    if source_project_id != target_project_id {
        return Err(DependencyQueryError::CrossProjectDependency);
    }

    // Verify user is a project member
    if !verify_project_membership_internal(pool, source_project_id, user_id).await? {
        return Err(DependencyQueryError::NotProjectMember);
    }

    // Determine actual source and target based on dependency type
    let (actual_source, actual_target, actual_type) = match input.dependency_type {
        DependencyType::BlockedBy => (input.target_task_id, source_task_id, DependencyType::Blocks),
        _ => (source_task_id, input.target_task_id, input.dependency_type),
    };

    // Check for circular dependency (A blocks B, B blocks A)
    if actual_type == DependencyType::Blocks {
        let existing = sqlx::query_scalar::<_, bool>(
            r#"
            SELECT EXISTS(
                SELECT 1 FROM task_dependencies
                WHERE source_task_id = $1 AND target_task_id = $2
                  AND dependency_type = 'blocks'
            )
            "#,
        )
        .bind(actual_target)
        .bind(actual_source)
        .fetch_one(pool)
        .await?;

        if existing {
            return Err(DependencyQueryError::CircularDependency);
        }
    }

    // Insert the dependency
    let dep_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO task_dependencies (id, source_task_id, target_task_id, dependency_type, created_by_id)
        VALUES ($1, $2, $3, $4, $5)
        "#,
    )
    .bind(dep_id)
    .bind(actual_source)
    .bind(actual_target)
    .bind(&actual_type)
    .bind(user_id)
    .execute(pool)
    .await
    .map_err(|e| {
        // Handle unique constraint violation
        if let sqlx::Error::Database(ref db_err) = e {
            if db_err.constraint().is_some() {
                return DependencyQueryError::Database(e);
            }
        }
        DependencyQueryError::Database(e)
    })?;

    // Fetch the created dependency with task info
    let dep = sqlx::query_as::<_, DependencyWithTask>(
        r#"
        SELECT
            td.id,
            td.source_task_id,
            td.target_task_id,
            td.dependency_type as "dependency_type: DependencyType",
            CASE
                WHEN td.source_task_id = $2 THEN td.target_task_id
                ELSE td.source_task_id
            END as related_task_id,
            t.title as related_task_title,
            t.priority::text as related_task_priority,
            bc.name as related_task_column_name,
            CASE
                WHEN td.dependency_type = 'blocks' AND td.target_task_id = $2 THEN true
                ELSE false
            END as is_blocked,
            td.created_at
        FROM task_dependencies td
        JOIN tasks t ON t.id = CASE
            WHEN td.source_task_id = $2 THEN td.target_task_id
            ELSE td.source_task_id
        END
        JOIN project_columns bc ON bc.id = t.column_id
        WHERE td.id = $1
        "#,
    )
    .bind(dep_id)
    .bind(source_task_id)
    .fetch_one(pool)
    .await?;

    Ok(dep)
}

/// Delete a dependency by ID
pub async fn delete_dependency(pool: &PgPool, dep_id: Uuid) -> Result<(), DependencyQueryError> {
    let rows_affected = sqlx::query(
        r#"
        DELETE FROM task_dependencies
        WHERE id = $1
        "#,
    )
    .bind(dep_id)
    .execute(pool)
    .await?
    .rows_affected();

    if rows_affected == 0 {
        return Err(DependencyQueryError::NotFound);
    }

    Ok(())
}

/// Check tasks that block the given task and whether they are resolved (done).
/// A blocker is resolved if it sits in a column with status_mapping->>'done' = 'true'.
pub async fn check_blockers(
    pool: &PgPool,
    task_id: Uuid,
) -> Result<Vec<BlockerInfo>, DependencyQueryError> {
    let blockers = sqlx::query_as::<_, BlockerInfo>(
        r#"
        SELECT
            t.id as task_id,
            t.title,
            COALESCE(bc.status_mapping->>'done' = 'true', false) as is_resolved
        FROM task_dependencies td
        JOIN tasks t ON t.id = td.source_task_id
        JOIN project_columns bc ON bc.id = t.column_id
        WHERE td.target_task_id = $1
          AND td.dependency_type = 'blocks'
          AND t.deleted_at IS NULL
        ORDER BY td.created_at ASC
        "#,
    )
    .bind(task_id)
    .fetch_all(pool)
    .await?;

    Ok(blockers)
}

/// Get all dependencies for a project (for Gantt chart or project-level views).
pub async fn get_board_dependencies(
    pool: &PgPool,
    project_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<DependencyWithTask>, DependencyQueryError> {
    // Verify user is a project member
    if !verify_project_membership_internal(pool, project_id, user_id).await? {
        return Err(DependencyQueryError::NotProjectMember);
    }

    let deps = sqlx::query_as::<_, DependencyWithTask>(
        r#"
        SELECT
            td.id,
            td.source_task_id,
            td.target_task_id,
            td.dependency_type as "dependency_type: DependencyType",
            td.target_task_id as related_task_id,
            target_t.title as related_task_title,
            target_t.priority::text as related_task_priority,
            bc.name as related_task_column_name,
            false as is_blocked,
            td.created_at
        FROM task_dependencies td
        JOIN tasks source_t ON source_t.id = td.source_task_id
        JOIN tasks target_t ON target_t.id = td.target_task_id
        JOIN project_columns bc ON bc.id = target_t.column_id
        WHERE source_t.project_id = $1
          AND source_t.deleted_at IS NULL
          AND target_t.deleted_at IS NULL
        ORDER BY td.created_at DESC
        "#,
    )
    .bind(project_id)
    .fetch_all(pool)
    .await?;

    Ok(deps)
}

/// Internal helper: get task's project_id
async fn get_task_project_id_internal(
    pool: &PgPool,
    task_id: Uuid,
) -> Result<Uuid, DependencyQueryError> {
    let project_id = sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT project_id FROM tasks WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(task_id)
    .fetch_optional(pool)
    .await?
    .ok_or(DependencyQueryError::NotFound)?;

    Ok(project_id)
}

use super::verify_project_membership_internal;
