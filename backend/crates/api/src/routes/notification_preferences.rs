//! Notification preferences REST routes
//!
//! Endpoints for managing user notification preferences per event type.

use axum::{
    extract::State,
    middleware::from_fn_with_state,
    routing::{delete, get, put},
    Json, Router,
};
use serde::Serialize;
use serde_json::json;

use crate::errors::{AppError, Result};
use crate::extractors::{StrictJson, TenantContext};
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;
use taskbolt_db::models::NotificationPreference;
use taskbolt_db::queries::notification_preferences::{
    list_by_user, reset_all, upsert, NotificationPreferenceError,
};

/// Response for listing preferences
#[derive(Serialize)]
pub struct ListPreferencesResponse {
    pub preferences: Vec<NotificationPreference>,
}

/// Request body for updating preferences
#[strict_dto_derive::strict_dto]
#[serde(rename_all = "camelCase")]
pub struct UpdatePreferenceRequest {
    pub event_type: String,
    pub in_app: bool,
    pub email: bool,
    pub slack: bool,
    pub whatsapp: bool,
}

/// GET /api/notification-preferences
///
/// List all notification preferences for the current user.
async fn list_preferences(
    State(state): State<AppState>,
    tenant: TenantContext,
) -> Result<Json<ListPreferencesResponse>> {
    let preferences = list_by_user(&state.db, tenant.user_id)
        .await
        .map_err(|e| match e {
            NotificationPreferenceError::Database(e) => AppError::SqlxError(e),
            NotificationPreferenceError::InvalidEventType(msg) => AppError::BadRequest(msg),
        })?;

    Ok(Json(ListPreferencesResponse { preferences }))
}

/// PUT /api/notification-preferences
///
/// Update a notification preference for a specific event type.
/// Creates the preference if it doesn't exist.
async fn update_preference(
    State(state): State<AppState>,
    tenant: TenantContext,
    StrictJson(body): StrictJson<UpdatePreferenceRequest>,
) -> Result<Json<NotificationPreference>> {
    let preference = upsert(
        &state.db,
        tenant.user_id,
        &body.event_type,
        body.in_app,
        body.email,
        body.slack,
        body.whatsapp,
    )
    .await
    .map_err(|e| match e {
        NotificationPreferenceError::Database(e) => AppError::SqlxError(e),
        NotificationPreferenceError::InvalidEventType(msg) => AppError::BadRequest(msg),
    })?;

    Ok(Json(preference))
}

/// DELETE /api/notification-preferences
///
/// Reset all notification preferences to defaults for the current user.
async fn reset_preferences(
    State(state): State<AppState>,
    tenant: TenantContext,
) -> Result<Json<serde_json::Value>> {
    let deleted_count = reset_all(&state.db, tenant.user_id)
        .await
        .map_err(|e| match e {
            NotificationPreferenceError::Database(e) => AppError::SqlxError(e),
            NotificationPreferenceError::InvalidEventType(msg) => AppError::BadRequest(msg),
        })?;

    Ok(Json(json!({
        "success": true,
        "deletedCount": deleted_count
    })))
}

/// Create the notification preferences router
pub fn notification_preferences_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/notification-preferences", get(list_preferences))
        .route("/notification-preferences", put(update_preference))
        .route("/notification-preferences", delete(reset_preferences))
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
