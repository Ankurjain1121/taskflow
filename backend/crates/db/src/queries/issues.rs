use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use super::membership::verify_project_membership;
use crate::models::{
    Issue, IssueClassification, IssueReproducibility, IssueResolutionType, IssueSeverity,
    IssueStatus,
};

/// Error type for issue query operations
#[derive(Debug, thiserror::Error)]
pub enum IssueQueryError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("User is not a member of this project")]
    NotProjectMember,
    #[error("Issue not found")]
    NotFound,
    #[error("Invalid input: {0}")]
    Invalid(String),
}

/// Input for creating a new issue
#[derive(Debug, Deserialize)]
pub struct CreateIssueInput {
    pub title: String,
    pub description: Option<String>,
    pub assignee_id: Option<Uuid>,
    pub severity: Option<IssueSeverity>,
    pub classification: Option<IssueClassification>,
    pub reproducibility: Option<IssueReproducibility>,
    pub module: Option<String>,
    pub affected_milestone_id: Option<Uuid>,
    pub release_milestone_id: Option<Uuid>,
    pub due_date: Option<DateTime<Utc>>,
    pub flag: Option<String>,
}

/// Input for updating an issue
#[derive(Debug, Deserialize, Default)]
pub struct UpdateIssueInput {
    pub title: Option<String>,
    pub description: Option<String>,
    pub assignee_id: Option<Option<Uuid>>,
    pub status: Option<IssueStatus>,
    pub severity: Option<IssueSeverity>,
    pub classification: Option<IssueClassification>,
    pub reproducibility: Option<Option<IssueReproducibility>>,
    pub module: Option<Option<String>>,
    pub affected_milestone_id: Option<Option<Uuid>>,
    pub release_milestone_id: Option<Option<Uuid>>,
    pub due_date: Option<Option<DateTime<Utc>>>,
    pub flag: Option<String>,
}

/// Input for resolving an issue
#[derive(Debug, Deserialize)]
pub struct ResolveIssueInput {
    pub resolution_type: IssueResolutionType,
    pub resolution_notes: Option<String>,
}

/// Filters for listing issues
#[derive(Debug, Deserialize, Default)]
pub struct IssueFilters {
    pub status: Option<IssueStatus>,
    pub severity: Option<IssueSeverity>,
    pub assignee_id: Option<Uuid>,
    pub reporter_id: Option<Uuid>,
    pub classification: Option<IssueClassification>,
    pub search: Option<String>,
}

/// Issue with joined reporter/assignee display names
#[derive(Debug, Serialize, FromRow)]
pub struct IssueWithDetails {
    pub id: Uuid,
    pub project_id: Uuid,
    pub tenant_id: Uuid,
    pub issue_number: i32,
    pub title: String,
    pub description: Option<String>,
    pub reporter_id: Uuid,
    pub reporter_name: Option<String>,
    pub assignee_id: Option<Uuid>,
    pub assignee_name: Option<String>,
    pub status: IssueStatus,
    pub severity: IssueSeverity,
    pub classification: IssueClassification,
    pub reproducibility: Option<IssueReproducibility>,
    pub module: Option<String>,
    pub affected_milestone_id: Option<Uuid>,
    pub release_milestone_id: Option<Uuid>,
    pub due_date: Option<DateTime<Utc>>,
    pub resolution_type: Option<IssueResolutionType>,
    pub resolution_notes: Option<String>,
    pub resolved_by_id: Option<Uuid>,
    pub closed_at: Option<DateTime<Utc>>,
    pub flag: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Summary counts for an issue listing (used by dashboards)
#[derive(Debug, Serialize, FromRow)]
pub struct IssueSummary {
    pub total: i64,
    pub open: i64,
    pub closed: i64,
    pub critical: i64,
    pub show_stopper: i64,
}

// ============================================
// List / Get
// ============================================

/// List issues for a project with optional filters
pub async fn list_issues(
    pool: &PgPool,
    project_id: Uuid,
    user_id: Uuid,
    filters: IssueFilters,
) -> Result<Vec<IssueWithDetails>, IssueQueryError> {
    if !verify_project_membership(pool, project_id, user_id).await? {
        return Err(IssueQueryError::NotProjectMember);
    }

    let rows = sqlx::query_as::<_, IssueWithDetails>(
        r"
        SELECT
            i.id,
            i.project_id,
            i.tenant_id,
            i.issue_number,
            i.title,
            i.description,
            i.reporter_id,
            r.name AS reporter_name,
            i.assignee_id,
            a.name AS assignee_name,
            i.status,
            i.severity,
            i.classification,
            i.reproducibility,
            i.module,
            i.affected_milestone_id,
            i.release_milestone_id,
            i.due_date,
            i.resolution_type,
            i.resolution_notes,
            i.resolved_by_id,
            i.closed_at,
            i.flag,
            i.created_at,
            i.updated_at
        FROM issues i
        LEFT JOIN users r ON r.id = i.reporter_id
        LEFT JOIN users a ON a.id = i.assignee_id
        WHERE i.project_id = $1
          AND i.deleted_at IS NULL
          AND ($2::issue_status IS NULL OR i.status = $2)
          AND ($3::issue_severity IS NULL OR i.severity = $3)
          AND ($4::uuid IS NULL OR i.assignee_id = $4)
          AND ($5::uuid IS NULL OR i.reporter_id = $5)
          AND ($6::issue_classification IS NULL OR i.classification = $6)
          AND ($7::text IS NULL OR i.title ILIKE '%' || $7 || '%')
        ORDER BY
          CASE i.severity
            WHEN 'show_stopper' THEN 0
            WHEN 'critical'     THEN 1
            WHEN 'major'        THEN 2
            WHEN 'minor'        THEN 3
            WHEN 'none'         THEN 4
          END ASC,
          i.created_at DESC
        ",
    )
    .bind(project_id)
    .bind(filters.status)
    .bind(filters.severity)
    .bind(filters.assignee_id)
    .bind(filters.reporter_id)
    .bind(filters.classification)
    .bind(filters.search)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

/// Get a single issue by id
pub async fn get_issue(
    pool: &PgPool,
    issue_id: Uuid,
    user_id: Uuid,
) -> Result<IssueWithDetails, IssueQueryError> {
    let row = sqlx::query_as::<_, IssueWithDetails>(
        r"
        SELECT
            i.id,
            i.project_id,
            i.tenant_id,
            i.issue_number,
            i.title,
            i.description,
            i.reporter_id,
            r.name AS reporter_name,
            i.assignee_id,
            a.name AS assignee_name,
            i.status,
            i.severity,
            i.classification,
            i.reproducibility,
            i.module,
            i.affected_milestone_id,
            i.release_milestone_id,
            i.due_date,
            i.resolution_type,
            i.resolution_notes,
            i.resolved_by_id,
            i.closed_at,
            i.flag,
            i.created_at,
            i.updated_at
        FROM issues i
        LEFT JOIN users r ON r.id = i.reporter_id
        LEFT JOIN users a ON a.id = i.assignee_id
        WHERE i.id = $1 AND i.deleted_at IS NULL
        ",
    )
    .bind(issue_id)
    .fetch_optional(pool)
    .await?
    .ok_or(IssueQueryError::NotFound)?;

    if !verify_project_membership(pool, row.project_id, user_id).await? {
        return Err(IssueQueryError::NotProjectMember);
    }

    Ok(row)
}

/// Get the project_id for an issue (used for auth checks)
pub async fn get_issue_project_id(
    pool: &PgPool,
    issue_id: Uuid,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar::<_, Uuid>(
        "SELECT project_id FROM issues WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(issue_id)
    .fetch_optional(pool)
    .await
}

/// Summary counts for a project
pub async fn get_issue_summary(
    pool: &PgPool,
    project_id: Uuid,
    user_id: Uuid,
) -> Result<IssueSummary, IssueQueryError> {
    if !verify_project_membership(pool, project_id, user_id).await? {
        return Err(IssueQueryError::NotProjectMember);
    }

    let row = sqlx::query_as::<_, IssueSummary>(
        r"
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status IN ('open','in_progress','on_hold','reopened')) AS open,
            COUNT(*) FILTER (WHERE status = 'closed') AS closed,
            COUNT(*) FILTER (WHERE severity = 'critical') AS critical,
            COUNT(*) FILTER (WHERE severity = 'show_stopper') AS show_stopper
        FROM issues
        WHERE project_id = $1 AND deleted_at IS NULL
        ",
    )
    .bind(project_id)
    .fetch_one(pool)
    .await?;

    Ok(row)
}

// ============================================
// Create
// ============================================

/// Create a new issue. `issue_number` is auto-assigned by a DB trigger.
pub async fn create_issue(
    pool: &PgPool,
    project_id: Uuid,
    input: CreateIssueInput,
    tenant_id: Uuid,
    reporter_id: Uuid,
) -> Result<Issue, IssueQueryError> {
    if !verify_project_membership(pool, project_id, reporter_id).await? {
        return Err(IssueQueryError::NotProjectMember);
    }

    if input.title.trim().is_empty() {
        return Err(IssueQueryError::Invalid("title cannot be empty".into()));
    }

    let issue = sqlx::query_as::<_, Issue>(
        r"
        INSERT INTO issues (
            project_id, tenant_id, title, description,
            reporter_id, assignee_id,
            severity, classification, reproducibility,
            module, affected_milestone_id, release_milestone_id,
            due_date, flag
        )
        VALUES (
            $1, $2, $3, $4,
            $5, $6,
            COALESCE($7, 'none'::issue_severity),
            COALESCE($8, 'bug'::issue_classification),
            $9,
            $10, $11, $12,
            $13, COALESCE($14, 'internal')
        )
        RETURNING *
        ",
    )
    .bind(project_id)
    .bind(tenant_id)
    .bind(input.title.trim())
    .bind(input.description)
    .bind(reporter_id)
    .bind(input.assignee_id)
    .bind(input.severity)
    .bind(input.classification)
    .bind(input.reproducibility)
    .bind(input.module)
    .bind(input.affected_milestone_id)
    .bind(input.release_milestone_id)
    .bind(input.due_date)
    .bind(input.flag)
    .fetch_one(pool)
    .await?;

    Ok(issue)
}

// ============================================
// Update
// ============================================

/// Update an issue. Uses COALESCE for simple fields.
/// `Option<Option<T>>` lets us distinguish "unset" (None) from "set to null" (Some(None)).
pub async fn update_issue(
    pool: &PgPool,
    issue_id: Uuid,
    input: UpdateIssueInput,
) -> Result<Issue, IssueQueryError> {
    // We encode the nullable-override semantics by passing an extra "should_null" sentinel
    // via COALESCE is not enough. Use explicit CASE / WHERE for each nullable field.
    // Simpler: do a single UPDATE with COALESCE for non-nullable fields and explicit
    // nullable handling via "IS DISTINCT FROM" tricks — but Postgres bind simplest
    // is to just do conditional updates. Here we flatten: if Option<Option<T>> is Some,
    // we set that value (which may be NULL); otherwise we keep existing.

    let issue = sqlx::query_as::<_, Issue>(
        r"
        UPDATE issues
        SET
            title        = COALESCE($2, title),
            description  = COALESCE($3, description),
            assignee_id  = CASE WHEN $4 THEN $5 ELSE assignee_id END,
            status       = COALESCE($6, status),
            severity     = COALESCE($7, severity),
            classification = COALESCE($8, classification),
            reproducibility = CASE WHEN $9 THEN $10 ELSE reproducibility END,
            module       = CASE WHEN $11 THEN $12 ELSE module END,
            affected_milestone_id = CASE WHEN $13 THEN $14 ELSE affected_milestone_id END,
            release_milestone_id  = CASE WHEN $15 THEN $16 ELSE release_milestone_id END,
            due_date     = CASE WHEN $17 THEN $18 ELSE due_date END,
            flag         = COALESCE($19, flag),
            closed_at    = CASE
                             WHEN COALESCE($6, status) = 'closed' AND closed_at IS NULL THEN NOW()
                             WHEN COALESCE($6, status) <> 'closed' THEN NULL
                             ELSE closed_at
                           END,
            updated_at   = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING *
        ",
    )
    .bind(issue_id)
    .bind(input.title)
    .bind(input.description)
    .bind(input.assignee_id.is_some())
    .bind(input.assignee_id.flatten())
    .bind(input.status)
    .bind(input.severity)
    .bind(input.classification)
    .bind(input.reproducibility.is_some())
    .bind(input.reproducibility.flatten())
    .bind(input.module.is_some())
    .bind(input.module.flatten())
    .bind(input.affected_milestone_id.is_some())
    .bind(input.affected_milestone_id.flatten())
    .bind(input.release_milestone_id.is_some())
    .bind(input.release_milestone_id.flatten())
    .bind(input.due_date.is_some())
    .bind(input.due_date.flatten())
    .bind(input.flag)
    .fetch_optional(pool)
    .await?
    .ok_or(IssueQueryError::NotFound)?;

    Ok(issue)
}

/// Resolve an issue (close + set resolution metadata)
pub async fn resolve_issue(
    pool: &PgPool,
    issue_id: Uuid,
    resolver_id: Uuid,
    input: ResolveIssueInput,
) -> Result<Issue, IssueQueryError> {
    let issue = sqlx::query_as::<_, Issue>(
        r"
        UPDATE issues
        SET
            status           = 'closed'::issue_status,
            resolution_type  = $2,
            resolution_notes = $3,
            resolved_by_id   = $4,
            closed_at        = COALESCE(closed_at, NOW()),
            updated_at       = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING *
        ",
    )
    .bind(issue_id)
    .bind(input.resolution_type)
    .bind(input.resolution_notes)
    .bind(resolver_id)
    .fetch_optional(pool)
    .await?
    .ok_or(IssueQueryError::NotFound)?;

    Ok(issue)
}

/// Reopen a previously closed issue
pub async fn reopen_issue(pool: &PgPool, issue_id: Uuid) -> Result<Issue, IssueQueryError> {
    let issue = sqlx::query_as::<_, Issue>(
        r"
        UPDATE issues
        SET
            status           = 'reopened'::issue_status,
            resolution_type  = NULL,
            resolution_notes = NULL,
            resolved_by_id   = NULL,
            closed_at        = NULL,
            updated_at       = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING *
        ",
    )
    .bind(issue_id)
    .fetch_optional(pool)
    .await?
    .ok_or(IssueQueryError::NotFound)?;

    Ok(issue)
}

// ============================================
// Delete (soft)
// ============================================

pub async fn soft_delete_issue(pool: &PgPool, issue_id: Uuid) -> Result<(), IssueQueryError> {
    let rows = sqlx::query(
        "UPDATE issues SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(issue_id)
    .execute(pool)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(IssueQueryError::NotFound);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_filters_default_empty() {
        let f = IssueFilters::default();
        assert!(f.status.is_none());
        assert!(f.severity.is_none());
        assert!(f.assignee_id.is_none());
        assert!(f.search.is_none());
    }

    #[test]
    fn test_update_input_default() {
        let u = UpdateIssueInput::default();
        assert!(u.title.is_none());
        assert!(u.assignee_id.is_none());
    }

    #[test]
    fn test_update_input_nullable_set_to_null() {
        // Setting assignee_id to Some(None) means "clear the assignee"
        let u = UpdateIssueInput {
            assignee_id: Some(None),
            ..Default::default()
        };
        assert!(u.assignee_id.is_some());
        assert!(u.assignee_id.unwrap().is_none());
    }

    #[test]
    fn test_create_input_deserializes_from_minimal_json() {
        let json = r#"{"title":"Bug in login"}"#;
        let input: CreateIssueInput = serde_json::from_str(json).unwrap();
        assert_eq!(input.title, "Bug in login");
        assert!(input.assignee_id.is_none());
        assert!(input.severity.is_none());
    }

    #[test]
    fn test_resolve_input_deserializes() {
        let json = r#"{"resolution_type":"fixed","resolution_notes":"patched"}"#;
        let input: ResolveIssueInput = serde_json::from_str(json).unwrap();
        assert_eq!(input.resolution_type, IssueResolutionType::Fixed);
    }
}
