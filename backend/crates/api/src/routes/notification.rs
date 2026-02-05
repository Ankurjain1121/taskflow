//! Notification REST routes
//!
//! Client-facing endpoints for reading and managing notifications.
//! NOTE: There is NO create endpoint - notifications are created server-side only.

use axum::{
    extract::{Path, Query, State},
    routing::{get, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::auth_middleware;
use crate::state::AppState;
use taskflow_db::queries::notifications::{
    get_unread_count, list_notifications, mark_all_read, mark_read, NotificationListResponse,
    NotificationQueryError,
};

/// Query parameters for listing notifications
#[derive(Deserialize)]
pub struct ListNotificationsQuery {
    pub cursor: Option<String>,
    pub limit: Option<i64>,
}

/// Response for unread count
#[derive(Serialize)]
pub struct UnreadCountResponse {
    pub count: i64,
}

/// GET /api/notifications
///
/// List notifications for the current user with cursor-based pagination.
/// Returns items, nextCursor, and unreadCount.
async fn list_notifications_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Query(params): Query<ListNotificationsQuery>,
) -> Result<Json<NotificationListResponse>> {
    // Parse cursor as UUID if provided
    let cursor = match params.cursor {
        Some(c) => match Uuid::parse_str(&c) {
            Ok(id) => Some(id),
            Err(_) => None, // Invalid cursor, start from beginning
        },
        None => None,
    };

    // Limit defaults to 20, max 100
    let limit = params.limit.unwrap_or(20).min(100).max(1);

    let response = list_notifications(&state.db, tenant.user_id, cursor, limit)
        .await
        .map_err(|e| match e {
            NotificationQueryError::Database(e) => AppError::SqlxError(e),
            NotificationQueryError::NotFound => AppError::NotFound("Notification not found".into()),
            NotificationQueryError::Unauthorized => {
                AppError::Forbidden("Not authorized to access this notification".into())
            }
        })?;

    Ok(Json(response))
}

/// GET /api/notifications/unread-count
///
/// Get the unread notification count for the current user.
async fn get_unread_count_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
) -> Result<Json<UnreadCountResponse>> {
    let count = get_unread_count(&state.db, tenant.user_id)
        .await
        .map_err(|e| match e {
            NotificationQueryError::Database(e) => AppError::SqlxError(e),
            _ => AppError::InternalError("Failed to get unread count".into()),
        })?;

    Ok(Json(UnreadCountResponse { count }))
}

/// PUT /api/notifications/:id/read
///
/// Mark a single notification as read.
async fn mark_read_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(notification_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    mark_read(&state.db, notification_id, tenant.user_id)
        .await
        .map_err(|e| match e {
            NotificationQueryError::Database(e) => AppError::SqlxError(e),
            NotificationQueryError::NotFound => {
                AppError::NotFound("Notification not found".into())
            }
            NotificationQueryError::Unauthorized => {
                AppError::Forbidden("Not authorized to modify this notification".into())
            }
        })?;

    Ok(Json(json!({ "success": true })))
}

/// PUT /api/notifications/read-all
///
/// Mark all notifications as read for the current user.
async fn mark_all_read_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
) -> Result<Json<serde_json::Value>> {
    let count = mark_all_read(&state.db, tenant.user_id)
        .await
        .map_err(|e| match e {
            NotificationQueryError::Database(e) => AppError::SqlxError(e),
            _ => AppError::InternalError("Failed to mark notifications as read".into()),
        })?;

    Ok(Json(json!({
        "success": true,
        "markedCount": count
    })))
}

/// Create the notification router
pub fn notification_router() -> Router<AppState> {
    Router::new()
        .route("/notifications", get(list_notifications_handler))
        .route("/notifications/unread-count", get(get_unread_count_handler))
        .route("/notifications/{id}/read", put(mark_read_handler))
        .route("/notifications/read-all", put(mark_all_read_handler))
        .layer(axum::middleware::from_fn(auth_middleware))
}
