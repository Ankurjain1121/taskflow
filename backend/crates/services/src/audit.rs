//! Audit service for recording activity log entries
//!
//! Provides centralized audit event recording with route-to-action mapping.

use once_cell::sync::Lazy;
use serde_json::Value as JsonValue;
use sqlx::PgPool;
use std::collections::HashMap;
use uuid::Uuid;

use taskflow_db::models::ActivityAction;

/// Maps route identifiers to activity actions
pub static ROUTE_ACTION_MAP: Lazy<HashMap<&'static str, ActivityAction>> = Lazy::new(|| {
    let mut map = HashMap::new();

    // Task actions
    map.insert("tasks.create", ActivityAction::Created);
    map.insert("tasks.update", ActivityAction::Updated);
    map.insert("tasks.move", ActivityAction::Moved);
    map.insert("tasks.assign", ActivityAction::Assigned);
    map.insert("tasks.unassign", ActivityAction::Unassigned);
    map.insert("tasks.delete", ActivityAction::Deleted);

    // Board actions
    map.insert("boards.create", ActivityAction::Created);
    map.insert("boards.update", ActivityAction::Updated);
    map.insert("boards.delete", ActivityAction::Deleted);

    // Comment actions
    map.insert("comments.create", ActivityAction::Commented);
    map.insert("comments.update", ActivityAction::Updated);
    map.insert("comments.delete", ActivityAction::Deleted);

    // Attachment actions
    map.insert("attachments.upload", ActivityAction::Attached);
    map.insert("attachments.delete", ActivityAction::Deleted);

    // Admin actions
    map.insert("admin.update_role", ActivityAction::Updated);
    map.insert("admin.delete_user", ActivityAction::Deleted);

    // Trash bin actions
    map.insert("trash.restore", ActivityAction::Updated);
    map.insert("trash.permanent_delete", ActivityAction::Deleted);

    // Workspace actions
    map.insert("workspaces.create", ActivityAction::Created);
    map.insert("workspaces.update", ActivityAction::Updated);
    map.insert("workspaces.delete", ActivityAction::Deleted);

    // Column actions
    map.insert("columns.create", ActivityAction::Created);
    map.insert("columns.update", ActivityAction::Updated);
    map.insert("columns.delete", ActivityAction::Deleted);

    map
});

/// Error type for audit operations
#[derive(Debug, thiserror::Error)]
pub enum AuditError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Invalid action: {0}")]
    InvalidAction(String),
}

/// Record an audit event in the activity log
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `action` - The action being performed
/// * `entity_type` - Type of entity (task, board, workspace, etc.)
/// * `entity_id` - UUID of the entity
/// * `user_id` - UUID of the user performing the action
/// * `tenant_id` - UUID of the tenant
/// * `metadata` - Optional JSON metadata about the action
/// * `ip_address` - Optional IP address of the request
/// * `user_agent` - Optional user agent string
#[allow(clippy::too_many_arguments)]
pub async fn record_audit_event(
    pool: &PgPool,
    action: ActivityAction,
    entity_type: &str,
    entity_id: Uuid,
    user_id: Uuid,
    tenant_id: Uuid,
    metadata: Option<JsonValue>,
    ip_address: Option<&str>,
    user_agent: Option<&str>,
) -> Result<Uuid, AuditError> {
    let id = Uuid::new_v4();

    sqlx::query!(
        r#"
        INSERT INTO activity_log (id, action, entity_type, entity_id, user_id, tenant_id, metadata, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        "#,
        id,
        action.clone() as ActivityAction,
        entity_type,
        entity_id,
        user_id,
        tenant_id,
        metadata,
        ip_address,
        user_agent
    )
    .execute(pool)
    .await?;

    tracing::debug!(
        audit_id = %id,
        action = ?action,
        entity_type = entity_type,
        entity_id = %entity_id,
        user_id = %user_id,
        "Audit event recorded"
    );

    Ok(id)
}

/// Get the action for a route identifier
pub fn get_action_for_route(route_id: &str) -> Option<&ActivityAction> {
    ROUTE_ACTION_MAP.get(route_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_route_action_map() {
        assert_eq!(ROUTE_ACTION_MAP.get("tasks.create"), Some(&ActivityAction::Created));
        assert_eq!(ROUTE_ACTION_MAP.get("tasks.move"), Some(&ActivityAction::Moved));
        assert_eq!(ROUTE_ACTION_MAP.get("comments.create"), Some(&ActivityAction::Commented));
        assert_eq!(ROUTE_ACTION_MAP.get("attachments.upload"), Some(&ActivityAction::Attached));
        assert_eq!(ROUTE_ACTION_MAP.get("nonexistent"), None);
    }

    #[test]
    fn test_get_action_for_route() {
        assert!(get_action_for_route("tasks.create").is_some());
        assert!(get_action_for_route("invalid.route").is_none());
    }
}
