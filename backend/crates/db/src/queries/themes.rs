use sqlx::PgPool;
use crate::models::theme::{Theme, ThemeListResponse};

/// Error type for theme query operations
#[derive(Debug, thiserror::Error)]
pub enum ThemeQueryError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Theme not found")]
    NotFound,
}

/// List all active themes, optionally filtered by is_dark
pub async fn list_themes(
    pool: &PgPool,
    is_dark: Option<bool>,
) -> Result<Vec<Theme>, ThemeQueryError> {
    let mut query = String::from(
        "SELECT slug, name, category, description, is_dark, sort_order, is_active, 
                colors, personality, preview, primeng_ramp, created_at, updated_at 
         FROM themes WHERE is_active = true"
    );
    
    if is_dark.is_some() {
        query.push_str(" AND is_dark = $1");
    }
    query.push_str(" ORDER BY category, sort_order, name");
    
    let themes = if let Some(dark) = is_dark {
        sqlx::query_as::<_, Theme>(&query)
            .bind(dark)
            .fetch_all(pool)
            .await?
    } else {
        sqlx::query_as::<_, Theme>(&query)
            .fetch_all(pool)
            .await?
    };
    
    Ok(themes)
}

/// Get a single theme by slug
pub async fn get_by_slug(
    pool: &PgPool,
    slug: &str,
) -> Result<Option<Theme>, ThemeQueryError> {
    let theme = sqlx::query_as::<_, Theme>(
        "SELECT slug, name, category, description, is_dark, sort_order, is_active, 
                colors, personality, preview, primeng_ramp, created_at, updated_at 
         FROM themes WHERE slug = $1 AND is_active = true"
    )
    .bind(slug)
    .fetch_optional(pool)
    .await?;
    
    Ok(theme)
}
