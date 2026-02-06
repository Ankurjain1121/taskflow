//! Admin audit log routes
//!
//! Provides endpoints for querying the audit log with filtering and pagination.
//! All endpoints require Admin role.

use axum::{
    extract::{Query, State},
    middleware::from_fn_with_state,
    routing::get,
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::errors::Result;
use crate::extractors::AdminUser;
use crate::middleware::auth_middleware;
use crate::state::AppState;
use taskflow_db::models::ActivityAction;

/// Query parameters for audit log listing
#[derive(Debug, Deserialize)]
pub struct AuditLogQuery {
    /// Cursor for pagination (activity log entry ID)
    pub cursor: Option<String>,
    /// Number of entries to return (default 20, max 100)
    #[serde(default = "default_page_size")]
    pub page_size: i64,
    /// Filter by user ID
    pub user_id: Option<Uuid>,
    /// Filter by action
    pub action: Option<String>,
    /// Filter by entity type
    pub entity_type: Option<String>,
    /// Filter by date from (inclusive)
    pub date_from: Option<DateTime<Utc>>,
    /// Filter by date to (inclusive)
    pub date_to: Option<DateTime<Utc>>,
    /// Search in metadata (JSON contains)
    pub search: Option<String>,
}

fn default_page_size() -> i64 {
    20
}

/// Audit log entry with user info
#[derive(Debug, Serialize)]
pub struct AuditLogEntry {
    pub id: Uuid,
    pub action: ActivityAction,
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

/// Paginated audit log response
#[derive(Debug, Serialize)]
pub struct PaginatedAuditLog {
    pub items: Vec<AuditLogEntry>,
    pub next_cursor: Option<String>,
    pub total_count: Option<i64>,
}

/// Distinct action values response
#[derive(Debug, Serialize)]
pub struct AuditActionsResponse {
    pub actions: Vec<String>,
}

/// GET /api/admin/audit-log
///
/// List audit log entries with filtering and cursor-based pagination.
/// Requires Admin role.
async fn list_audit_log(
    State(state): State<AppState>,
    admin: AdminUser,
    Query(query): Query<AuditLogQuery>,
) -> Result<Json<PaginatedAuditLog>> {
    let tenant_id = admin.0.tenant_id;
    let page_size = query.page_size.min(100).max(1);
    let fetch_limit = page_size + 1;

    // Parse cursor if provided
    let cursor_id = query
        .cursor
        .as_ref()
        .and_then(|c| Uuid::parse_str(c).ok());

    // Parse action filter
    let action_filter: Option<ActivityAction> = query.action.as_ref().and_then(|a| {
        match a.to_lowercase().as_str() {
            "created" => Some(ActivityAction::Created),
            "updated" => Some(ActivityAction::Updated),
            "moved" => Some(ActivityAction::Moved),
            "assigned" => Some(ActivityAction::Assigned),
            "unassigned" => Some(ActivityAction::Unassigned),
            "commented" => Some(ActivityAction::Commented),
            "attached" => Some(ActivityAction::Attached),
            "status_changed" => Some(ActivityAction::StatusChanged),
            "priority_changed" => Some(ActivityAction::PriorityChanged),
            "deleted" => Some(ActivityAction::Deleted),
            _ => None,
        }
    });

    // Get cursor timestamp if cursor provided
    let cursor_created_at: Option<DateTime<Utc>> = if let Some(cid) = cursor_id {
        sqlx::query_scalar!(
            r#"SELECT created_at FROM activity_log WHERE id = $1"#,
            cid
        )
        .fetch_optional(&state.db)
        .await?
    } else {
        None
    };

    // Build and execute query
    let items: Vec<AuditLogEntry> = sqlx::query_as!(
        AuditLogEntry,
        r#"
        SELECT
            al.id,
            al.action as "action: ActivityAction",
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
          AND ($2::uuid IS NULL OR al.user_id = $2)
          AND ($3::activity_action IS NULL OR al.action = $3)
          AND ($4::text IS NULL OR al.entity_type = $4)
          AND ($5::timestamptz IS NULL OR al.created_at >= $5)
          AND ($6::timestamptz IS NULL OR al.created_at <= $6)
          AND ($7::text IS NULL OR al.metadata::text ILIKE '%' || $7 || '%')
          AND ($8::timestamptz IS NULL OR al.created_at < $8 OR (al.created_at = $8 AND al.id < $9))
        ORDER BY al.created_at DESC, al.id DESC
        LIMIT $10
        "#,
        tenant_id,
        query.user_id,
        action_filter as Option<ActivityAction>,
        query.entity_type,
        query.date_from,
        query.date_to,
        query.search,
        cursor_created_at,
        cursor_id,
        fetch_limit
    )
    .fetch_all(&state.db)
    .await?;

    // Determine if there are more results
    let has_more = items.len() > page_size as usize;
    let items: Vec<_> = items.into_iter().take(page_size as usize).collect();

    let next_cursor = if has_more {
        items.last().map(|item| item.id.to_string())
    } else {
        None
    };

    Ok(Json(PaginatedAuditLog {
        items,
        next_cursor,
        total_count: None, // Expensive to compute, omit by default
    }))
}

/// GET /api/admin/audit-log/actions
///
/// Get distinct action values for filtering.
/// Requires Admin role.
async fn list_audit_actions(
    State(state): State<AppState>,
    admin: AdminUser,
) -> Result<Json<AuditActionsResponse>> {
    let tenant_id = admin.0.tenant_id;

    let actions: Vec<ActivityAction> = sqlx::query_scalar!(
        r#"
        SELECT DISTINCT action as "action!: ActivityAction"
        FROM activity_log
        WHERE tenant_id = $1
        ORDER BY action
        "#,
        tenant_id
    )
    .fetch_all(&state.db)
    .await?;

    let action_strings: Vec<String> = actions
        .into_iter()
        .map(|a| format!("{:?}", a).to_lowercase())
        .collect();

    Ok(Json(AuditActionsResponse {
        actions: action_strings,
    }))
}

/// Create the admin audit log router
pub fn admin_audit_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/admin/audit-log", get(list_audit_log))
        .route("/admin/audit-log/actions", get(list_audit_actions))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
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
