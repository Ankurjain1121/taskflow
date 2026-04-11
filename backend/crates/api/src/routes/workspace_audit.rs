//! Workspace Audit Log REST endpoints
//!
//! Provides workspace-scoped audit log querying. Thin wrapper around
//! shared audit query logic in `audit_queries`.

use axum::{
    Json, Router,
    extract::{Path, Query, State},
    middleware::from_fn_with_state,
    routing::get,
};
use serde::Serialize;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::AuthUserExtractor;
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;

use super::helpers::audit_queries::{self, AuditLogQuery, AuditScope};

// ============================================================================
// Workspace-specific response DTOs (preserve original API shape)
// ============================================================================

#[derive(Debug, Serialize)]
pub struct WorkspaceAuditEntry {
    pub id: uuid::Uuid,
    pub action: String,
    pub entity_type: String,
    pub entity_id: uuid::Uuid,
    pub user_id: uuid::Uuid,
    pub user_name: String,
    pub metadata: Option<serde_json::Value>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct PaginatedWorkspaceAudit {
    pub items: Vec<WorkspaceAuditEntry>,
    pub next_cursor: Option<String>,
}

// ============================================================================
// Route Handlers
// ============================================================================

/// GET /api/workspaces/:workspace_id/audit-log
async fn list_workspace_audit_log(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(workspace_id): Path<Uuid>,
    Query(query): Query<AuditLogQuery>,
) -> Result<Json<PaginatedWorkspaceAudit>> {
    let is_member = taskbolt_db::queries::workspaces::is_workspace_member(
        &state.db,
        workspace_id,
        auth.0.user_id,
    )
    .await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    let scope = AuditScope::Workspace {
        tenant_id: auth.0.tenant_id,
        workspace_id,
    };
    let result = audit_queries::query_audit_log(&state.db, &scope, &query).await?;

    let items = result
        .items
        .into_iter()
        .map(|e| WorkspaceAuditEntry {
            id: e.id,
            action: e.action,
            entity_type: e.entity_type,
            entity_id: e.entity_id,
            user_id: e.user_id,
            user_name: e.user_name,
            metadata: e.metadata,
            created_at: e.created_at,
        })
        .collect();

    Ok(Json(PaginatedWorkspaceAudit {
        items,
        next_cursor: result.next_cursor,
    }))
}

/// GET /api/workspaces/:workspace_id/audit-log/actions
async fn list_workspace_audit_actions(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(workspace_id): Path<Uuid>,
) -> Result<Json<audit_queries::AuditActionsResponse>> {
    let is_member = taskbolt_db::queries::workspaces::is_workspace_member(
        &state.db,
        workspace_id,
        auth.0.user_id,
    )
    .await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    let scope = AuditScope::Workspace {
        tenant_id: auth.0.tenant_id,
        workspace_id,
    };
    let response = audit_queries::query_audit_actions(&state.db, &scope).await?;

    Ok(Json(response))
}

// ============================================================================
// Router
// ============================================================================

pub fn workspace_audit_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/audit-log", get(list_workspace_audit_log))
        .route("/audit-log/actions", get(list_workspace_audit_actions))
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
