use axum::{
    extract::State,
    middleware::from_fn_with_state,
    routing::{get, put},
    Json, Router,
};

use crate::errors::{AppError, Result};
use crate::extractors::{AuthUserExtractor, StrictJson};
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::services::cache;
use crate::state::AppState;

use super::validation::validate_locale;

use taskbolt_db::queries::user_prefs;

#[strict_dto_derive::strict_dto]
#[derive(Debug)]
pub struct UpdatePreferencesRequest {
    #[serde(default)]
    pub timezone: Option<String>,
    #[serde(default)]
    pub date_format: Option<String>,
    #[serde(default)]
    #[serde(alias = "default_board_view")]
    pub default_project_view: Option<String>,
    #[serde(default)]
    pub sidebar_density: Option<String>,
    #[serde(default)]
    pub locale: Option<String>,
    #[serde(default)]
    pub quiet_hours_start: Option<String>,
    #[serde(default)]
    pub quiet_hours_end: Option<String>,
    #[serde(default)]
    pub digest_frequency: Option<String>,
    #[serde(default)]
    pub accent_color: Option<String>,
    #[serde(default)]
    pub color_mode: Option<String>,
    #[serde(default)]
    pub dark_theme: Option<String>,
}

/// GET /api/users/me/preferences
async fn get_preferences(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
) -> Result<Json<taskbolt_db::models::UserPreferences>> {
    // Check Redis cache first (5 minute TTL)
    let cache_key = cache::user_prefs_key(&auth.0.user_id);
    if let Some(cached) =
        cache::cache_get::<taskbolt_db::models::UserPreferences>(&state.redis, &cache_key).await
    {
        return Ok(Json(cached));
    }

    let prefs = user_prefs::get_by_user_id(&state.db, auth.0.user_id).await?;

    // Store in cache (5 minute TTL)
    cache::cache_set(&state.redis, &cache_key, &prefs, 300).await;

    Ok(Json(prefs))
}

/// PUT /api/users/me/preferences
async fn update_preferences(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    StrictJson(body): StrictJson<UpdatePreferencesRequest>,
) -> Result<Json<taskbolt_db::models::UserPreferences>> {
    // Validate input BEFORE merging with DB fallback. A stale DB row
    // (pre-allowlist) must not 400 unrelated PUTs that do not touch locale.
    if let Some(ref new_locale) = body.locale {
        validate_locale(new_locale)?;
    }

    // Fetch existing prefs so partial updates merge correctly. Reuse the
    // cache entry written by GET so hot users skip the DB round-trip.
    let cache_key = cache::user_prefs_key(&auth.0.user_id);
    let existing =
        match cache::cache_get::<taskbolt_db::models::UserPreferences>(&state.redis, &cache_key)
            .await
        {
            Some(cached) => cached,
            None => user_prefs::get_by_user_id(&state.db, auth.0.user_id).await?,
        };

    let timezone = body.timezone.unwrap_or(existing.timezone);
    let date_format = body.date_format.unwrap_or(existing.date_format);
    let default_project_view = body
        .default_project_view
        .unwrap_or(existing.default_project_view);
    let sidebar_density = body.sidebar_density.unwrap_or(existing.sidebar_density);
    let locale = body.locale.unwrap_or(existing.locale);
    let digest_frequency = body.digest_frequency.unwrap_or(existing.digest_frequency);

    let accent_color = body.accent_color.or(existing.accent_color);
    let color_mode = body.color_mode.or(existing.color_mode);
    let dark_theme = body.dark_theme.or(existing.dark_theme);

    // Server-side enum validation
    user_prefs::validate_preferences(
        &timezone,
        &date_format,
        &default_project_view,
        &sidebar_density,
        &digest_frequency,
    )
    .map_err(AppError::BadRequest)?;

    // Validate theme preferences
    user_prefs::validate_theme_preferences(
        color_mode.as_deref(),
        accent_color.as_deref(),
        dark_theme.as_deref(),
    )
    .map_err(AppError::BadRequest)?;

    // Parse quiet hours — prefer body value, fall back to existing
    let quiet_start = match body.quiet_hours_start {
        Some(ref s) if !s.is_empty() => {
            Some(chrono::NaiveTime::parse_from_str(s, "%H:%M").map_err(|_| {
                AppError::BadRequest("Invalid quiet_hours_start format, use HH:MM".into())
            })?)
        }
        Some(_) => None, // empty string = clear
        None => existing.quiet_hours_start,
    };

    let quiet_end = match body.quiet_hours_end {
        Some(ref s) if !s.is_empty() => {
            Some(chrono::NaiveTime::parse_from_str(s, "%H:%M").map_err(|_| {
                AppError::BadRequest("Invalid quiet_hours_end format, use HH:MM".into())
            })?)
        }
        Some(_) => None,
        None => existing.quiet_hours_end,
    };

    let prefs = user_prefs::upsert(
        &state.db,
        auth.0.user_id,
        &timezone,
        &date_format,
        &default_project_view,
        &sidebar_density,
        &locale,
        quiet_start,
        quiet_end,
        &digest_frequency,
        accent_color.as_deref(),
        color_mode.as_deref(),
        dark_theme.as_deref(),
    )
    .await?;

    // Invalidate preferences cache (reuse key computed for the merge-read)
    cache::cache_del(&state.redis, &cache_key).await;

    Ok(Json(prefs))
}

pub fn user_preferences_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/users/me/preferences", get(get_preferences))
        .route("/users/me/preferences", put(update_preferences))
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
