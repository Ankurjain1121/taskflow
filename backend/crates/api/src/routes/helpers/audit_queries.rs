//! Shared audit log query logic
//!
//! Provides common types and a unified query function used by both
//! workspace-scoped and tenant-wide (admin) audit log endpoints.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::Result;

/// Escape ILIKE special characters (`%`, `_`, `\`) in a search string.
fn escape_ilike(input: &str) -> String {
    input
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

// ============================================================================
// Shared types
// ============================================================================

/// Scope for audit log queries.
pub enum AuditScope {
    /// Filter to entries related to boards/tasks/workspace within a specific workspace.
    Workspace { tenant_id: Uuid, workspace_id: Uuid },
    /// All entries for the entire tenant.
    Tenant { tenant_id: Uuid },
}

/// Unified query parameters accepted by the shared query function.
#[derive(Debug, Deserialize)]
pub struct AuditLogQuery {
    pub cursor: Option<String>,
    #[serde(default = "default_page_size")]
    pub page_size: i64,
    pub user_id: Option<Uuid>,
    pub action: Option<String>,
    pub entity_type: Option<String>,
    pub date_from: Option<DateTime<Utc>>,
    pub date_to: Option<DateTime<Utc>>,
    pub search: Option<String>,
}

fn default_page_size() -> i64 {
    20
}

/// A full audit log row returned by the shared query.
/// Contains all columns needed by both admin and workspace responses.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AuditLogEntry {
    pub id: Uuid,
    pub action: String,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub user_id: Uuid,
    pub user_name: String,
    pub user_email: String,
    pub metadata: Option<serde_json::Value>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Paginated response envelope.
#[derive(Debug, Serialize)]
pub struct PaginatedAuditLog {
    pub items: Vec<AuditLogEntry>,
    pub next_cursor: Option<String>,
    pub total_count: Option<i64>,
}

/// Distinct action values response.
#[derive(Debug, Serialize)]
pub struct AuditActionsResponse {
    pub actions: Vec<String>,
}

// ============================================================================
// Shared query functions
// ============================================================================

/// Query audit log entries with cursor-based pagination.
///
/// Builds SQL dynamically based on `AuditScope` to either filter by
/// workspace membership or return all tenant entries.
pub async fn query_audit_log(
    pool: &PgPool,
    scope: &AuditScope,
    query: &AuditLogQuery,
) -> Result<PaginatedAuditLog> {
    let page_size = query.page_size.clamp(1, 100);
    let fetch_limit = page_size + 1;

    let cursor_id = query.cursor.as_ref().and_then(|c| Uuid::parse_str(c).ok());

    let tenant_id = match scope {
        AuditScope::Workspace { tenant_id, .. } | AuditScope::Tenant { tenant_id } => *tenant_id,
    };

    let cursor_created_at: Option<DateTime<Utc>> = if let Some(cid) = cursor_id {
        sqlx::query_scalar!(
            r#"SELECT created_at FROM activity_log WHERE id = $1 AND tenant_id = $2"#,
            cid,
            tenant_id
        )
        .fetch_optional(pool)
        .await?
    } else {
        None
    };

    let (tenant_id, workspace_id) = match scope {
        AuditScope::Workspace {
            tenant_id,
            workspace_id,
        } => (*tenant_id, Some(*workspace_id)),
        AuditScope::Tenant { tenant_id } => (*tenant_id, None),
    };

    let action_filter = query.action.as_deref();

    // The workspace scope clause restricts to boards/tasks/workspace entities
    // that belong to the given workspace. The tenant scope has no such restriction.
    let items: Vec<AuditLogEntry> = sqlx::query_as(
        r#"
        SELECT
            al.id,
            al.action::text as action,
            al.entity_type,
            al.entity_id,
            al.user_id,
            u.name as user_name,
            u.email as user_email,
            al.metadata,
            al.ip_address,
            al.user_agent,
            al.created_at
        FROM activity_log al
        JOIN users u ON u.id = al.user_id
        WHERE al.tenant_id = $1
          AND (
            $2::uuid IS NULL
            OR (
              (al.entity_type IN ('board', 'project') AND al.entity_id IN (SELECT id FROM projects WHERE workspace_id = $2))
              OR (al.entity_type = 'task' AND al.entity_id IN (
                SELECT t.id FROM tasks t JOIN projects p ON p.id = t.project_id WHERE p.workspace_id = $2
              ))
              OR (al.entity_type = 'workspace' AND al.entity_id = $2)
            )
          )
          AND ($3::uuid IS NULL OR al.user_id = $3)
          AND ($4::text IS NULL OR al.action::text = $4)
          AND ($5::text IS NULL OR al.entity_type = $5)
          AND ($6::timestamptz IS NULL OR al.created_at >= $6)
          AND ($7::timestamptz IS NULL OR al.created_at <= $7)
          AND ($8::text IS NULL OR al.metadata::text ILIKE '%' || $8 || '%')
          AND ($9::timestamptz IS NULL OR al.created_at < $9 OR (al.created_at = $9 AND al.id < $10))
        ORDER BY al.created_at DESC, al.id DESC
        LIMIT $11
        "#,
    )
    .bind(tenant_id)
    .bind(workspace_id)
    .bind(query.user_id)
    .bind(action_filter)
    .bind(query.entity_type.as_deref())
    .bind(query.date_from)
    .bind(query.date_to)
    .bind(query.search.as_deref().map(escape_ilike))
    .bind(cursor_created_at)
    .bind(cursor_id)
    .bind(fetch_limit)
    .fetch_all(pool)
    .await?;

    let has_more = items.len() > page_size as usize;
    let items: Vec<_> = items.into_iter().take(page_size as usize).collect();

    let next_cursor = if has_more {
        items.last().map(|item| item.id.to_string())
    } else {
        None
    };

    Ok(PaginatedAuditLog {
        items,
        next_cursor,
        total_count: None,
    })
}

/// Query distinct audit log action values.
pub async fn query_audit_actions(
    pool: &PgPool,
    scope: &AuditScope,
) -> Result<AuditActionsResponse> {
    let (tenant_id, workspace_id) = match scope {
        AuditScope::Workspace {
            tenant_id,
            workspace_id,
        } => (*tenant_id, Some(*workspace_id)),
        AuditScope::Tenant { tenant_id } => (*tenant_id, None),
    };

    let actions: Vec<String> = sqlx::query_scalar(
        r#"
        SELECT DISTINCT al.action::text
        FROM activity_log al
        WHERE al.tenant_id = $1
          AND (
            $2::uuid IS NULL
            OR (
              (al.entity_type IN ('board', 'project') AND al.entity_id IN (SELECT id FROM projects WHERE workspace_id = $2))
              OR (al.entity_type = 'task' AND al.entity_id IN (
                SELECT t.id FROM tasks t JOIN projects p ON p.id = t.project_id WHERE p.workspace_id = $2
              ))
              OR (al.entity_type = 'workspace' AND al.entity_id = $2)
            )
          )
        ORDER BY 1
        "#,
    )
    .bind(tenant_id)
    .bind(workspace_id)
    .fetch_all(pool)
    .await?;

    Ok(AuditActionsResponse { actions })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_page_size() {
        assert_eq!(default_page_size(), 20);
    }

    #[test]
    fn test_query_params_deserialize() {
        let json = r#"{"cursor": "550e8400-e29b-41d4-a716-446655440000", "page_size": 50}"#;
        let query: AuditLogQuery = serde_json::from_str(json).unwrap();
        assert_eq!(
            query.cursor,
            Some("550e8400-e29b-41d4-a716-446655440000".to_string())
        );
        assert_eq!(query.page_size, 50);
    }
}
