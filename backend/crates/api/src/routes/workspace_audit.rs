//! Workspace Audit Log REST endpoints
//!
//! Provides workspace-scoped audit log querying. Reuses the activity_log table
//! but filters by workspace through project membership.

use axum::{
    extract::{Path, Query, State},
    middleware::from_fn_with_state,
    routing::get,
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::AuthUserExtractor;
use crate::middleware::auth_middleware;
use crate::state::AppState;

// ============================================================================
// DTOs
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct WorkspaceAuditQuery {
    pub cursor: Option<String>,
    #[serde(default = "default_page_size")]
    pub page_size: i64,
    pub user_id: Option<Uuid>,
    pub action: Option<String>,
    pub entity_type: Option<String>,
    pub date_from: Option<DateTime<Utc>>,
    pub date_to: Option<DateTime<Utc>>,
}

fn default_page_size() -> i64 {
    20
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct WorkspaceAuditEntry {
    pub id: Uuid,
    pub action: String,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub user_id: Uuid,
    pub user_name: String,
    pub metadata: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct PaginatedWorkspaceAudit {
    pub items: Vec<WorkspaceAuditEntry>,
    pub next_cursor: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AuditActionsResponse {
    pub actions: Vec<String>,
}

// ============================================================================
// Route Handlers
// ============================================================================

/// GET /api/workspaces/:workspace_id/audit-log
async fn list_workspace_audit_log(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(workspace_id): Path<Uuid>,
    Query(query): Query<WorkspaceAuditQuery>,
) -> Result<Json<PaginatedWorkspaceAudit>> {
    // Verify workspace membership
    let is_member = taskflow_db::queries::workspaces::is_workspace_member(
        &state.db,
        workspace_id,
        auth.0.user_id,
    )
    .await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    let page_size = query.page_size.clamp(1, 100);
    let fetch_limit = page_size + 1;

    let cursor_id = query.cursor.as_ref().and_then(|c| Uuid::parse_str(c).ok());

    let cursor_created_at: Option<DateTime<Utc>> = if let Some(cid) = cursor_id {
        sqlx::query_scalar!(r#"SELECT created_at FROM activity_log WHERE id = $1"#, cid)
            .fetch_optional(&state.db)
            .await?
    } else {
        None
    };

    // Parse action filter to string for LIKE matching
    let action_filter = query.action.as_deref();

    // Query activity_log for entries related to this workspace's projects and tasks
    let items: Vec<WorkspaceAuditEntry> = sqlx::query_as(
        r#"
        SELECT
            al.id,
            al.action::text as action,
            al.entity_type,
            al.entity_id,
            al.user_id,
            u.name as user_name,
            al.metadata,
            al.created_at
        FROM activity_log al
        JOIN users u ON u.id = al.user_id
        WHERE al.tenant_id = $1
          AND (
            -- Project-related: entity is a project in this workspace
            (al.entity_type = 'board' AND al.entity_id IN (SELECT id FROM projects WHERE workspace_id = $2))
            -- Task-related: entity is a task in a project in this workspace
            OR (al.entity_type = 'task' AND al.entity_id IN (
              SELECT t.id FROM tasks t JOIN projects b ON b.id = t.project_id WHERE b.workspace_id = $2
            ))
            -- Workspace-related
            OR (al.entity_type = 'workspace' AND al.entity_id = $2)
          )
          AND ($3::uuid IS NULL OR al.user_id = $3)
          AND ($4::text IS NULL OR al.action::text = $4)
          AND ($5::text IS NULL OR al.entity_type = $5)
          AND ($6::timestamptz IS NULL OR al.created_at >= $6)
          AND ($7::timestamptz IS NULL OR al.created_at <= $7)
          AND ($8::timestamptz IS NULL OR al.created_at < $8 OR (al.created_at = $8 AND al.id < $9))
        ORDER BY al.created_at DESC, al.id DESC
        LIMIT $10
        "#,
    )
    .bind(auth.0.tenant_id)
    .bind(workspace_id)
    .bind(query.user_id)
    .bind(action_filter)
    .bind(query.entity_type.as_deref())
    .bind(query.date_from)
    .bind(query.date_to)
    .bind(cursor_created_at)
    .bind(cursor_id)
    .bind(fetch_limit)
    .fetch_all(&state.db)
    .await
    .map_err(AppError::from)?;

    let has_more = items.len() > page_size as usize;
    let items: Vec<_> = items.into_iter().take(page_size as usize).collect();

    let next_cursor = if has_more {
        items.last().map(|item| item.id.to_string())
    } else {
        None
    };

    Ok(Json(PaginatedWorkspaceAudit { items, next_cursor }))
}

/// GET /api/workspaces/:workspace_id/audit-log/actions
async fn list_workspace_audit_actions(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(workspace_id): Path<Uuid>,
) -> Result<Json<AuditActionsResponse>> {
    let is_member = taskflow_db::queries::workspaces::is_workspace_member(
        &state.db,
        workspace_id,
        auth.0.user_id,
    )
    .await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    let actions: Vec<String> = sqlx::query_scalar(
        r#"
        SELECT DISTINCT al.action::text
        FROM activity_log al
        WHERE al.tenant_id = $1
          AND (
            (al.entity_type = 'board' AND al.entity_id IN (SELECT id FROM projects WHERE workspace_id = $2))
            OR (al.entity_type = 'task' AND al.entity_id IN (
              SELECT t.id FROM tasks t JOIN projects b ON b.id = t.project_id WHERE b.workspace_id = $2
            ))
            OR (al.entity_type = 'workspace' AND al.entity_id = $2)
          )
        ORDER BY 1
        "#,
    )
    .bind(auth.0.tenant_id)
    .bind(workspace_id)
    .fetch_all(&state.db)
    .await
    .map_err(AppError::from)?;

    Ok(Json(AuditActionsResponse { actions }))
}

// ============================================================================
// Router
// ============================================================================

pub fn workspace_audit_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/audit-log", get(list_workspace_audit_log))
        .route("/audit-log/actions", get(list_workspace_audit_actions))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
