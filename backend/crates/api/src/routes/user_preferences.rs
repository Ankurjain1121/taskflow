use axum::{
    extract::State,
    middleware::from_fn_with_state,
    routing::{get, put},
    Json, Router,
};
use serde::Deserialize;

use crate::errors::{AppError, Result};
use crate::extractors::AuthUserExtractor;
use crate::middleware::auth_middleware;
use crate::state::AppState;

use taskflow_db::queries::user_prefs;

#[derive(Debug, Deserialize)]
pub struct UpdatePreferencesRequest {
    pub timezone: String,
    pub date_format: String,
    pub default_board_view: String,
    pub sidebar_density: String,
    pub locale: String,
    pub quiet_hours_start: Option<String>,
    pub quiet_hours_end: Option<String>,
    pub digest_frequency: String,
    #[serde(default)]
    pub light_theme_slug: Option<String>,
    #[serde(default)]
    pub dark_theme_slug: Option<String>,
    #[serde(default)]
    pub accent_color: Option<String>,
    #[serde(default)]
    pub color_mode: Option<String>,
}

/// GET /api/users/me/preferences
async fn get_preferences(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
) -> Result<Json<taskflow_db::models::UserPreferences>> {
    let prefs = user_prefs::get_by_user_id(&state.db, auth.0.user_id).await?;
    Ok(Json(prefs))
}

/// PUT /api/users/me/preferences
async fn update_preferences(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Json(body): Json<UpdatePreferencesRequest>,
) -> Result<Json<taskflow_db::models::UserPreferences>> {
    // Server-side enum validation
    user_prefs::validate_preferences(
        &body.timezone,
        &body.date_format,
        &body.default_board_view,
        &body.sidebar_density,
        &body.digest_frequency,
    )
    .map_err(AppError::BadRequest)?;

    // Validate theme preferences
    user_prefs::validate_theme_preferences(
        body.color_mode.as_deref(),
        body.accent_color.as_deref(),
        body.light_theme_slug.as_deref(),
        body.dark_theme_slug.as_deref(),
    )
    .map_err(AppError::BadRequest)?;

    // Parse quiet hours
    let quiet_start = body
        .quiet_hours_start
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(|s| {
            chrono::NaiveTime::parse_from_str(s, "%H:%M").map_err(|_| {
                AppError::BadRequest("Invalid quiet_hours_start format, use HH:MM".into())
            })
        })
        .transpose()?;

    let quiet_end = body
        .quiet_hours_end
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(|s| {
            chrono::NaiveTime::parse_from_str(s, "%H:%M").map_err(|_| {
                AppError::BadRequest("Invalid quiet_hours_end format, use HH:MM".into())
            })
        })
        .transpose()?;

    let prefs = user_prefs::upsert(
        &state.db,
        auth.0.user_id,
        &body.timezone,
        &body.date_format,
        &body.default_board_view,
        &body.sidebar_density,
        &body.locale,
        quiet_start,
        quiet_end,
        &body.digest_frequency,
        body.light_theme_slug.as_deref(),
        body.dark_theme_slug.as_deref(),
        body.accent_color.as_deref(),
        body.color_mode.as_deref(),
    )
    .await?;

    Ok(Json(prefs))
}

pub fn user_preferences_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/users/me/preferences", get(get_preferences))
        .route("/users/me/preferences", put(update_preferences))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
