//! Admin audit log routes
//!
//! Provides tenant-wide audit log querying. Thin wrapper around
//! shared audit query logic in `audit_queries`. All endpoints require Admin role.

use axum::{
    extract::{Query, State},
    middleware::from_fn_with_state,
    routing::get,
    Json, Router,
};

use crate::errors::Result;
use crate::extractors::AdminUser;
use crate::middleware::auth_middleware;
use crate::state::AppState;

use super::helpers::audit_queries::{self, AuditLogQuery, AuditScope};

// ============================================================================
// Route Handlers
// ============================================================================

/// GET /api/admin/audit-log
///
/// List audit log entries with filtering and cursor-based pagination.
/// Requires Admin role.
async fn list_audit_log(
    State(state): State<AppState>,
    admin: AdminUser,
    Query(query): Query<AuditLogQuery>,
) -> Result<Json<audit_queries::PaginatedAuditLog>> {
    let scope = AuditScope::Tenant {
        tenant_id: admin.0.tenant_id,
    };
    let response = audit_queries::query_audit_log(&state.db, &scope, &query).await?;

    Ok(Json(response))
}

/// GET /api/admin/audit-log/actions
///
/// Get distinct action values for filtering.
/// Requires Admin role.
async fn list_audit_actions(
    State(state): State<AppState>,
    admin: AdminUser,
) -> Result<Json<audit_queries::AuditActionsResponse>> {
    let scope = AuditScope::Tenant {
        tenant_id: admin.0.tenant_id,
    };
    let response = audit_queries::query_audit_actions(&state.db, &scope).await?;

    Ok(Json(response))
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
    use crate::routes::helpers::audit_queries::AuditLogQuery;

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
