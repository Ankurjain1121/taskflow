//! Theme REST endpoints
//!
//! Provides public access to theme configurations for the theming system.

use axum::{
    extract::{Query, State},
    routing::get,
    Json, Router,
};
use serde::Deserialize;

use taskflow_db::queries::themes::{self, ThemeQueryError};

use crate::errors::{AppError, Result};
use crate::state::AppState;

/// Query params for listing themes
#[derive(Debug, Deserialize)]
pub struct ListThemesQuery {
    #[serde(default)]
    is_dark: Option<bool>,
}

/// Theme list response
#[derive(serde::Serialize)]
pub struct ThemesResponse {
    pub themes: Vec<taskflow_db::models::theme::Theme>,
}

/// GET /api/themes
///
/// List all active themes, optionally filtered by is_dark
async fn list_themes_handler(
    State(state): State<AppState>,
    Query(query): Query<ListThemesQuery>,
) -> Result<Json<ThemesResponse>> {
    let themes = themes::list_themes(&state.db, query.is_dark)
        .await
        .map_err(|e| match e {
            ThemeQueryError::Database(e) => AppError::SqlxError(e),
            ThemeQueryError::NotFound => AppError::NotFound("Theme not found".into()),
        })?;

    Ok(Json(ThemesResponse { themes }))
}

/// GET /api/themes/:slug
///
/// Get a single theme by slug
async fn get_theme_handler(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<taskflow_db::models::theme::Theme>> {
    let theme = themes::get_by_slug(&state.db, &slug)
        .await
        .map_err(|e| match e {
            ThemeQueryError::Database(e) => AppError::SqlxError(e),
            ThemeQueryError::NotFound => AppError::NotFound("Theme not found".into()),
        })?;

    match theme {
        Some(t) => Ok(Json(t)),
        None => Err(AppError::NotFound("Theme not found".into())),
    }
}

/// Build the themes router (public, no auth required)
pub fn themes_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/themes", get(list_themes_handler))
        .route("/themes/{slug}", get(get_theme_handler))
        .with_state(state)
}
