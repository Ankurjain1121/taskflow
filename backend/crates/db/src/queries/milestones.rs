use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use crate::models::Milestone;

/// Error type for milestone query operations
#[derive(Debug, thiserror::Error)]
pub enum MilestoneQueryError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("User is not a member of this board")]
    NotBoardMember,
    #[error("Milestone not found")]
    NotFound,
}

/// Input for creating a new milestone
#[derive(Debug, Deserialize)]
pub struct CreateMilestoneInput {
    pub name: String,
    pub description: Option<String>,
    pub due_date: Option<DateTime<Utc>>,
    pub color: Option<String>,
}

/// Input for updating an existing milestone
#[derive(Debug, Deserialize)]
pub struct UpdateMilestoneInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub due_date: Option<DateTime<Utc>>,
    pub color: Option<String>,
}

/// Milestone with progress information
#[derive(Debug, Serialize, FromRow)]
pub struct MilestoneWithProgress {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub due_date: Option<DateTime<Utc>>,
    pub color: String,
    pub project_id: Uuid,
    pub tenant_id: Uuid,
    pub created_by_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub total_tasks: i64,
    pub completed_tasks: i64,
}

use super::membership::verify_project_membership;

/// List all milestones for a board with progress info
pub async fn list_milestones(
    pool: &PgPool,
    board_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<MilestoneWithProgress>, MilestoneQueryError> {
    if !verify_project_membership(pool, board_id, user_id).await? {
        return Err(MilestoneQueryError::NotBoardMember);
    }

    let milestones = sqlx::query_as::<_, MilestoneWithProgress>(
        r#"
        SELECT
            m.id,
            m.name,
            m.description,
            m.due_date,
            m.color,
            m.project_id,
            m.tenant_id,
            m.created_by_id,
            m.created_at,
            m.updated_at,
            COALESCE(COUNT(t.id), 0) as total_tasks,
            COALESCE(SUM(
                CASE WHEN bc.type = 'done' THEN 1 ELSE 0 END
            ), 0) as completed_tasks
        FROM milestones m
        LEFT JOIN tasks t ON t.milestone_id = m.id AND t.deleted_at IS NULL
        LEFT JOIN project_statuses bc ON bc.id = t.status_id
        WHERE m.project_id = $1
        GROUP BY m.id, m.name, m.description, m.due_date, m.color,
                 m.project_id, m.tenant_id, m.created_by_id, m.created_at, m.updated_at
        ORDER BY m.due_date ASC NULLS LAST, m.created_at ASC
        "#,
    )
    .bind(board_id)
    .fetch_all(pool)
    .await?;

    Ok(milestones)
}

/// Get a single milestone by ID with progress info
pub async fn get_milestone(
    pool: &PgPool,
    milestone_id: Uuid,
    user_id: Uuid,
) -> Result<MilestoneWithProgress, MilestoneQueryError> {
    let milestone = sqlx::query_as::<_, MilestoneWithProgress>(
        r#"
        SELECT
            m.id,
            m.name,
            m.description,
            m.due_date,
            m.color,
            m.project_id,
            m.tenant_id,
            m.created_by_id,
            m.created_at,
            m.updated_at,
            COALESCE(COUNT(t.id), 0) as total_tasks,
            COALESCE(SUM(
                CASE WHEN bc.type = 'done' THEN 1 ELSE 0 END
            ), 0) as completed_tasks
        FROM milestones m
        LEFT JOIN tasks t ON t.milestone_id = m.id AND t.deleted_at IS NULL
        LEFT JOIN project_statuses bc ON bc.id = t.status_id
        WHERE m.id = $1
        GROUP BY m.id, m.name, m.description, m.due_date, m.color,
                 m.project_id, m.tenant_id, m.created_by_id, m.created_at, m.updated_at
        "#,
    )
    .bind(milestone_id)
    .fetch_optional(pool)
    .await?
    .ok_or(MilestoneQueryError::NotFound)?;

    // Verify board membership
    if !verify_project_membership(pool, milestone.project_id, user_id).await? {
        return Err(MilestoneQueryError::NotBoardMember);
    }

    Ok(milestone)
}

/// Create a new milestone
pub async fn create_milestone(
    pool: &PgPool,
    board_id: Uuid,
    input: CreateMilestoneInput,
    tenant_id: Uuid,
    user_id: Uuid,
) -> Result<Milestone, MilestoneQueryError> {
    if !verify_project_membership(pool, board_id, user_id).await? {
        return Err(MilestoneQueryError::NotBoardMember);
    }

    let milestone_id = Uuid::new_v4();
    let color = input.color.unwrap_or_else(|| "#6366f1".to_string());

    let milestone = sqlx::query_as::<_, Milestone>(
        r#"
        INSERT INTO milestones (id, name, description, due_date, color, project_id, tenant_id, created_by_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING
            id, name, description, due_date, color,
            project_id, tenant_id, created_by_id,
            created_at, updated_at
        "#,
    )
    .bind(milestone_id)
    .bind(&input.name)
    .bind(&input.description)
    .bind(input.due_date)
    .bind(&color)
    .bind(board_id)
    .bind(tenant_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    Ok(milestone)
}

/// Update an existing milestone
pub async fn update_milestone(
    pool: &PgPool,
    milestone_id: Uuid,
    input: UpdateMilestoneInput,
) -> Result<Milestone, MilestoneQueryError> {
    let milestone = sqlx::query_as::<_, Milestone>(
        r#"
        UPDATE milestones
        SET
            name = COALESCE($2, name),
            description = COALESCE($3, description),
            due_date = COALESCE($4, due_date),
            color = COALESCE($5, color),
            updated_at = NOW()
        WHERE id = $1
        RETURNING
            id, name, description, due_date, color,
            project_id, tenant_id, created_by_id,
            created_at, updated_at
        "#,
    )
    .bind(milestone_id)
    .bind(&input.name)
    .bind(&input.description)
    .bind(input.due_date)
    .bind(&input.color)
    .fetch_optional(pool)
    .await?
    .ok_or(MilestoneQueryError::NotFound)?;

    Ok(milestone)
}

/// Delete a milestone (CASCADE sets tasks.milestone_id = NULL)
pub async fn delete_milestone(
    pool: &PgPool,
    milestone_id: Uuid,
) -> Result<(), MilestoneQueryError> {
    let rows_affected = sqlx::query(
        r#"
        DELETE FROM milestones
        WHERE id = $1
        "#,
    )
    .bind(milestone_id)
    .execute(pool)
    .await?
    .rows_affected();

    if rows_affected == 0 {
        return Err(MilestoneQueryError::NotFound);
    }

    Ok(())
}

/// Assign a task to a milestone
pub async fn assign_task_to_milestone(
    pool: &PgPool,
    task_id: Uuid,
    milestone_id: Uuid,
) -> Result<(), MilestoneQueryError> {
    let rows_affected = sqlx::query(
        r#"
        UPDATE tasks
        SET milestone_id = $2, updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(task_id)
    .bind(milestone_id)
    .execute(pool)
    .await?
    .rows_affected();

    if rows_affected == 0 {
        return Err(MilestoneQueryError::NotFound);
    }

    Ok(())
}

/// Unassign a task from its milestone
pub async fn unassign_task_from_milestone(
    pool: &PgPool,
    task_id: Uuid,
) -> Result<(), MilestoneQueryError> {
    let rows_affected = sqlx::query(
        r#"
        UPDATE tasks
        SET milestone_id = NULL, updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(task_id)
    .execute(pool)
    .await?
    .rows_affected();

    if rows_affected == 0 {
        return Err(MilestoneQueryError::NotFound);
    }

    Ok(())
}

/// Get the project_id for a milestone (for authorization checks)
pub async fn get_milestone_board_id(
    pool: &PgPool,
    milestone_id: Uuid,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT project_id FROM milestones WHERE id = $1
        "#,
    )
    .bind(milestone_id)
    .fetch_optional(pool)
    .await
}
