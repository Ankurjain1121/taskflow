//! Audit middleware for recording activity events
//!
//! Tower middleware that records audit events after successful mutations (POST/PUT/DELETE).

use axum::{
    body::Body,
    extract::State,
    http::{Method, Request},
    middleware::Next,
    response::Response,
};
use uuid::Uuid;

use crate::middleware::auth::AuthUser;
use crate::state::AppState;
use taskbolt_services::audit::{record_audit_event, ROUTE_ACTION_MAP};

/// Extension to mark a route with its identifier for audit logging
#[derive(Debug, Clone)]
pub struct AuditRouteId(pub &'static str);

/// Extension to provide entity information for audit logging
#[derive(Debug, Clone)]
pub struct AuditEntity {
    pub entity_type: String,
    pub entity_id: Uuid,
}

/// Extract IP address from request headers.
/// Delegates to the shared `extract_client_ip` utility which takes the first
/// entry in X-Forwarded-For (original client behind single-hop nginx).
fn extract_ip_address(req: &Request<Body>) -> Option<String> {
    super::extract_client_ip(req.headers())
}

/// Extract user agent from request headers
fn extract_user_agent(req: &Request<Body>) -> Option<String> {
    req.headers()
        .get("User-Agent")
        .and_then(|v| v.to_str().ok())
        .map(std::string::ToString::to_string)
}

/// Audit middleware that records events after successful mutations
///
/// This middleware:
/// 1. Only processes mutation methods (POST, PUT, PATCH, DELETE)
/// 2. Only records on successful responses (2xx status codes)
/// 3. Extracts route identifier from AuditRouteId extension
/// 4. Gets entity info from AuditEntity extension or path parameters
/// 5. Records to activity_log table
pub async fn audit_middleware(
    State(state): State<AppState>,
    request: Request<Body>,
    next: Next,
) -> Response {
    let method = request.method().clone();

    // Only audit mutations
    let is_mutation = matches!(
        method,
        Method::POST | Method::PUT | Method::PATCH | Method::DELETE
    );

    if !is_mutation {
        return next.run(request).await;
    }

    // Extract info before passing request
    let auth_user = request.extensions().get::<AuthUser>().cloned();
    let route_id = request.extensions().get::<AuditRouteId>().cloned();
    let audit_entity = request.extensions().get::<AuditEntity>().cloned();
    let ip_address = extract_ip_address(&request);
    let user_agent = extract_user_agent(&request);
    let path = request.uri().path().to_string();

    // Run the actual handler
    let response = next.run(request).await;

    // Only audit successful responses
    let status = response.status();
    if !status.is_success() {
        return response;
    }

    // Need auth user for audit
    let Some(auth_user) = auth_user else { return response };

    // Get route identifier
    let route_id = match route_id {
        Some(id) => id.0,
        None => {
            // Try to infer from path and method
            match infer_route_id(&path, &method) {
                Some(inferred) => inferred,
                None => {
                    tracing::debug!(path = %path, method = %method, "Could not infer audit route ID");
                    return response;
                }
            }
        }
    };

    // Get action from route map
    let action = match ROUTE_ACTION_MAP.get(route_id) {
        Some(a) => a.clone(),
        None => {
            tracing::debug!(route_id = route_id, "No action mapping for route");
            return response;
        }
    };

    // Get entity info
    let (entity_type, entity_id) = match audit_entity {
        Some(e) => (e.entity_type, e.entity_id),
        None => {
            // Try to extract from path
            match extract_entity_from_path(&path) {
                Some((t, id)) => (t, id),
                None => {
                    tracing::debug!(path = %path, "Could not extract entity from path");
                    return response;
                }
            }
        }
    };

    // Record the audit event (fire and forget - don't block response)
    let pool = state.db.clone();
    let tenant_id = auth_user.tenant_id;
    let user_id = auth_user.user_id;

    tokio::spawn(async move {
        if let Err(e) = record_audit_event(
            &pool,
            action,
            &entity_type,
            entity_id,
            user_id,
            tenant_id,
            None,
            ip_address.as_deref(),
            user_agent.as_deref(),
        )
        .await
        {
            tracing::error!(error = %e, "Failed to record audit event");
        }
    });

    response
}

/// Try to infer route ID from path and method
fn infer_route_id(path: &str, method: &Method) -> Option<&'static str> {
    let parts: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();

    // Match common patterns
    match (method, parts.as_slice()) {
        // Tasks
        (&Method::POST, ["api", "boards", _, "tasks"]) => Some("tasks.create"),
        (&Method::PUT, ["api", "tasks", _]) => Some("tasks.update"),
        (&Method::DELETE, ["api", "tasks", _]) => Some("tasks.delete"),
        (&Method::POST, ["api", "tasks", _, "move"]) => Some("tasks.move"),
        (&Method::POST, ["api", "tasks", _, "assign"]) => Some("tasks.assign"),
        (&Method::DELETE, ["api", "tasks", _, "assignees", _]) => Some("tasks.unassign"),

        // Boards
        (&Method::POST, ["api", "workspaces", _, "boards"]) => Some("boards.create"),
        (&Method::PUT, ["api", "boards", _]) => Some("boards.update"),
        (&Method::DELETE, ["api", "boards", _]) => Some("boards.delete"),

        // Comments
        (&Method::POST, ["api", "tasks", _, "comments"]) => Some("comments.create"),
        (&Method::PUT, ["api", "comments", _]) => Some("comments.update"),
        (&Method::DELETE, ["api", "comments", _]) => Some("comments.delete"),

        // Attachments
        (&Method::POST, ["api", "tasks", _, "attachments"]) => Some("attachments.upload"),
        (&Method::DELETE, ["api", "attachments", _]) => Some("attachments.delete"),

        // Workspaces
        (&Method::POST, ["api", "workspaces"]) => Some("workspaces.create"),
        (&Method::PUT, ["api", "workspaces", _]) => Some("workspaces.update"),
        (&Method::DELETE, ["api", "workspaces", _]) => Some("workspaces.delete"),

        // Admin
        (&Method::PUT, ["api", "admin", "users", _, "role"]) => Some("admin.update_role"),
        (&Method::DELETE, ["api", "admin", "users", _]) => Some("admin.delete_user"),

        // Trash
        (&Method::POST, ["api", "admin", "trash", "restore"]) => Some("trash.restore"),
        (&Method::DELETE, ["api", "admin", "trash", _, _]) => Some("trash.permanent_delete"),

        _ => None,
    }
}

/// Extract entity type and ID from path
fn extract_entity_from_path(path: &str) -> Option<(String, Uuid)> {
    let parts: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();

    // Look for patterns like /api/{entity_type}/{uuid}
    for i in 0..parts.len().saturating_sub(1) {
        if let Ok(uuid) = Uuid::parse_str(parts[i + 1]) {
            let entity_type = match parts[i] {
                "tasks" => "task",
                "boards" => "board",
                "workspaces" => "workspace",
                "comments" => "comment",
                "attachments" => "attachment",
                "columns" => "column",
                "users" => "user",
                _ => parts[i],
            };
            return Some((entity_type.to_string(), uuid));
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_infer_route_id() {
        // Use a valid UUID in place of 123
        let uuid = "12345678-1234-1234-1234-123456789abc";
        assert_eq!(
            infer_route_id(&format!("/api/boards/{}/tasks", uuid), &Method::POST),
            Some("tasks.create")
        );
        assert_eq!(
            infer_route_id(&format!("/api/tasks/{}", uuid), &Method::DELETE),
            Some("tasks.delete")
        );
        assert_eq!(infer_route_id("/api/unknown/path", &Method::POST), None);
    }

    #[test]
    fn test_extract_entity_from_path() {
        let uuid = Uuid::new_v4();
        let path = format!("/api/tasks/{}", uuid);
        let result = extract_entity_from_path(&path);
        assert!(result.is_some());
        let (entity_type, entity_id) = result.unwrap();
        assert_eq!(entity_type, "task");
        assert_eq!(entity_id, uuid);
    }

    #[test]
    fn test_infer_route_id_task_update() {
        let uuid = "12345678-1234-1234-1234-123456789abc";
        assert_eq!(
            infer_route_id(&format!("/api/tasks/{}", uuid), &Method::PUT),
            Some("tasks.update")
        );
    }

    #[test]
    fn test_infer_route_id_task_move() {
        let uuid = "12345678-1234-1234-1234-123456789abc";
        assert_eq!(
            infer_route_id(&format!("/api/tasks/{}/move", uuid), &Method::POST),
            Some("tasks.move")
        );
    }

    #[test]
    fn test_infer_route_id_task_assign() {
        let uuid = "12345678-1234-1234-1234-123456789abc";
        assert_eq!(
            infer_route_id(&format!("/api/tasks/{}/assign", uuid), &Method::POST),
            Some("tasks.assign")
        );
    }

    #[test]
    fn test_infer_route_id_board_create() {
        let uuid = "12345678-1234-1234-1234-123456789abc";
        assert_eq!(
            infer_route_id(&format!("/api/workspaces/{}/boards", uuid), &Method::POST),
            Some("boards.create")
        );
    }

    #[test]
    fn test_infer_route_id_comment_create() {
        let uuid = "12345678-1234-1234-1234-123456789abc";
        assert_eq!(
            infer_route_id(&format!("/api/tasks/{}/comments", uuid), &Method::POST),
            Some("comments.create")
        );
    }

    #[test]
    fn test_infer_route_id_workspace_create() {
        assert_eq!(
            infer_route_id("/api/workspaces", &Method::POST),
            Some("workspaces.create")
        );
    }

    #[test]
    fn test_extract_entity_from_path_board() {
        let uuid = Uuid::new_v4();
        let path = format!("/api/boards/{}", uuid);
        let result = extract_entity_from_path(&path);
        assert!(result.is_some());
        let (entity_type, entity_id) = result.unwrap();
        assert_eq!(entity_type, "board");
        assert_eq!(entity_id, uuid);
    }

    #[test]
    fn test_extract_entity_from_path_no_uuid() {
        let result = extract_entity_from_path("/api/health");
        assert!(result.is_none());
    }

    #[test]
    fn test_infer_route_id_admin_trash() {
        let uuid = "12345678-1234-1234-1234-123456789abc";
        assert_eq!(
            infer_route_id(&format!("/api/admin/trash/tasks/{}", uuid), &Method::DELETE),
            Some("trash.permanent_delete")
        );
    }

    #[test]
    fn test_infer_route_id_trash_restore() {
        assert_eq!(
            infer_route_id("/api/admin/trash/restore", &Method::POST),
            Some("trash.restore")
        );
    }

    #[test]
    fn test_infer_route_id_admin_update_role() {
        let uuid = "12345678-1234-1234-1234-123456789abc";
        assert_eq!(
            infer_route_id(&format!("/api/admin/users/{}/role", uuid), &Method::PUT),
            Some("admin.update_role")
        );
    }

    #[test]
    fn test_infer_route_id_admin_delete_user() {
        let uuid = "12345678-1234-1234-1234-123456789abc";
        assert_eq!(
            infer_route_id(&format!("/api/admin/users/{}", uuid), &Method::DELETE),
            Some("admin.delete_user")
        );
    }

    #[test]
    fn test_infer_route_id_task_unassign() {
        let task_uuid = "12345678-1234-1234-1234-123456789abc";
        let assignee_uuid = "abcdef12-3456-7890-abcd-ef1234567890";
        assert_eq!(
            infer_route_id(
                &format!("/api/tasks/{}/assignees/{}", task_uuid, assignee_uuid),
                &Method::DELETE,
            ),
            Some("tasks.unassign")
        );
    }

    #[test]
    fn test_infer_route_id_board_update() {
        let uuid = "12345678-1234-1234-1234-123456789abc";
        assert_eq!(
            infer_route_id(&format!("/api/boards/{}", uuid), &Method::PUT),
            Some("boards.update")
        );
    }

    #[test]
    fn test_infer_route_id_board_delete() {
        let uuid = "12345678-1234-1234-1234-123456789abc";
        assert_eq!(
            infer_route_id(&format!("/api/boards/{}", uuid), &Method::DELETE),
            Some("boards.delete")
        );
    }

    #[test]
    fn test_infer_route_id_attachment_upload() {
        let uuid = "12345678-1234-1234-1234-123456789abc";
        assert_eq!(
            infer_route_id(&format!("/api/tasks/{}/attachments", uuid), &Method::POST),
            Some("attachments.upload")
        );
    }

    #[test]
    fn test_infer_route_id_attachment_delete() {
        let uuid = "12345678-1234-1234-1234-123456789abc";
        assert_eq!(
            infer_route_id(&format!("/api/attachments/{}", uuid), &Method::DELETE),
            Some("attachments.delete")
        );
    }

    #[test]
    fn test_infer_route_id_workspace_update() {
        let uuid = "12345678-1234-1234-1234-123456789abc";
        assert_eq!(
            infer_route_id(&format!("/api/workspaces/{}", uuid), &Method::PUT),
            Some("workspaces.update")
        );
    }

    #[test]
    fn test_infer_route_id_workspace_delete() {
        let uuid = "12345678-1234-1234-1234-123456789abc";
        assert_eq!(
            infer_route_id(&format!("/api/workspaces/{}", uuid), &Method::DELETE),
            Some("workspaces.delete")
        );
    }

    #[test]
    fn test_infer_route_id_get_requests_not_matched() {
        let uuid = "12345678-1234-1234-1234-123456789abc";
        assert_eq!(
            infer_route_id(&format!("/api/tasks/{}", uuid), &Method::GET),
            None,
        );
    }

    // --- extract_entity_from_path additional tests ---

    #[test]
    fn test_extract_entity_workspace() {
        let uuid = Uuid::new_v4();
        let path = format!("/api/workspaces/{}", uuid);
        let result = extract_entity_from_path(&path);
        assert!(result.is_some());
        let (entity_type, entity_id) = result.expect("should extract workspace");
        assert_eq!(entity_type, "workspace");
        assert_eq!(entity_id, uuid);
    }

    #[test]
    fn test_extract_entity_comment() {
        let uuid = Uuid::new_v4();
        let path = format!("/api/comments/{}", uuid);
        let result = extract_entity_from_path(&path).expect("should extract comment");
        assert_eq!(result.0, "comment");
        assert_eq!(result.1, uuid);
    }

    #[test]
    fn test_extract_entity_attachment() {
        let uuid = Uuid::new_v4();
        let path = format!("/api/attachments/{}", uuid);
        let result = extract_entity_from_path(&path).expect("should extract attachment");
        assert_eq!(result.0, "attachment");
        assert_eq!(result.1, uuid);
    }

    #[test]
    fn test_extract_entity_column() {
        let uuid = Uuid::new_v4();
        let path = format!("/api/columns/{}", uuid);
        let result = extract_entity_from_path(&path).expect("should extract column");
        assert_eq!(result.0, "column");
        assert_eq!(result.1, uuid);
    }

    #[test]
    fn test_extract_entity_user() {
        let uuid = Uuid::new_v4();
        let path = format!("/api/users/{}", uuid);
        let result = extract_entity_from_path(&path).expect("should extract user");
        assert_eq!(result.0, "user");
        assert_eq!(result.1, uuid);
    }

    #[test]
    fn test_extract_entity_nested_path() {
        let board_uuid = Uuid::new_v4();
        let task_uuid = Uuid::new_v4();
        let path = format!("/api/boards/{}/tasks/{}", board_uuid, task_uuid);
        // Should find the first UUID (boards -> board)
        let result = extract_entity_from_path(&path).expect("should extract first entity");
        assert_eq!(result.0, "board");
        assert_eq!(result.1, board_uuid);
    }

    // --- extract_ip_address tests ---

    #[test]
    fn test_extract_ip_x_forwarded_for_single() {
        let req = Request::builder()
            .header("X-Forwarded-For", "203.0.113.50")
            .body(Body::empty())
            .expect("build request");
        let ip = extract_ip_address(&req);
        assert_eq!(ip, Some("203.0.113.50".to_string()));
    }

    #[test]
    fn test_extract_ip_x_forwarded_for_multiple() {
        let req = Request::builder()
            .header(
                "X-Forwarded-For",
                "203.0.113.50, 70.41.3.18, 150.172.238.178",
            )
            .body(Body::empty())
            .expect("build request");
        // Takes the first IP (client IP)
        let ip = extract_ip_address(&req);
        assert_eq!(ip, Some("203.0.113.50".to_string()));
    }

    #[test]
    fn test_extract_ip_x_real_ip() {
        let req = Request::builder()
            .header("X-Real-IP", "10.0.0.1")
            .body(Body::empty())
            .expect("build request");
        let ip = extract_ip_address(&req);
        assert_eq!(ip, Some("10.0.0.1".to_string()));
    }

    #[test]
    fn test_extract_ip_x_forwarded_for_takes_priority() {
        let req = Request::builder()
            .header("X-Forwarded-For", "1.2.3.4")
            .header("X-Real-IP", "5.6.7.8")
            .body(Body::empty())
            .expect("build request");
        let ip = extract_ip_address(&req);
        assert_eq!(ip, Some("1.2.3.4".to_string()));
    }

    #[test]
    fn test_extract_ip_no_headers() {
        let req = Request::builder()
            .body(Body::empty())
            .expect("build request");
        let ip = extract_ip_address(&req);
        assert_eq!(ip, None);
    }

    // --- extract_user_agent tests ---

    #[test]
    fn test_extract_user_agent_present() {
        let req = Request::builder()
            .header("User-Agent", "Mozilla/5.0 (Linux; TaskBolt/1.0)")
            .body(Body::empty())
            .expect("build request");
        let ua = extract_user_agent(&req);
        assert_eq!(ua, Some("Mozilla/5.0 (Linux; TaskBolt/1.0)".to_string()));
    }

    #[test]
    fn test_extract_user_agent_missing() {
        let req = Request::builder()
            .body(Body::empty())
            .expect("build request");
        let ua = extract_user_agent(&req);
        assert_eq!(ua, None);
    }

    // --- AuditRouteId and AuditEntity tests ---

    #[test]
    fn test_audit_route_id_debug() {
        let route_id = AuditRouteId("tasks.create");
        let debug = format!("{:?}", route_id);
        assert!(debug.contains("tasks.create"), "got: {}", debug);
    }

    #[test]
    fn test_audit_route_id_clone() {
        let route_id = AuditRouteId("boards.update");
        let cloned = route_id.clone();
        assert_eq!(cloned.0, "boards.update");
    }

    #[test]
    fn test_audit_entity_debug_and_clone() {
        let entity = AuditEntity {
            entity_type: "task".to_string(),
            entity_id: Uuid::new_v4(),
        };
        let cloned = entity.clone();
        assert_eq!(cloned.entity_type, entity.entity_type);
        assert_eq!(cloned.entity_id, entity.entity_id);

        let debug = format!("{:?}", entity);
        assert!(debug.contains("AuditEntity"), "got: {}", debug);
        assert!(debug.contains("task"), "got: {}", debug);
    }
}
