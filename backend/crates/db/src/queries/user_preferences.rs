use chrono::NaiveTime;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::UserPreferences;

/// Allowed values for server-side enum validation
const VALID_DATE_FORMATS: &[&str] = &["MMM dd, yyyy", "dd/MM/yyyy", "yyyy-MM-dd", "MM/dd/yyyy"];
const VALID_BOARD_VIEWS: &[&str] = &["kanban", "list"];
const VALID_SIDEBAR_DENSITIES: &[&str] = &["compact", "comfortable"];
const VALID_DIGEST_FREQUENCIES: &[&str] = &["realtime", "hourly", "daily"];

/// Validate preference values server-side
pub fn validate_preferences(
    timezone: &str,
    date_format: &str,
    default_board_view: &str,
    sidebar_density: &str,
    digest_frequency: &str,
) -> Result<(), String> {
    if !VALID_DATE_FORMATS.contains(&date_format) {
        return Err(format!("Invalid date_format: {}", date_format));
    }
    if !VALID_BOARD_VIEWS.contains(&default_board_view) {
        return Err(format!(
            "Invalid default_board_view: {}",
            default_board_view
        ));
    }
    if !VALID_SIDEBAR_DENSITIES.contains(&sidebar_density) {
        return Err(format!("Invalid sidebar_density: {}", sidebar_density));
    }
    if !VALID_DIGEST_FREQUENCIES.contains(&digest_frequency) {
        return Err(format!("Invalid digest_frequency: {}", digest_frequency));
    }
    // Basic IANA timezone validation (must contain '/')
    if !timezone.contains('/') && timezone != "UTC" {
        return Err(format!("Invalid timezone: {}", timezone));
    }
    Ok(())
}

/// Get preferences for a user, returning defaults if none exist
pub async fn get_by_user_id(pool: &PgPool, user_id: Uuid) -> Result<UserPreferences, sqlx::Error> {
    let prefs = sqlx::query_as::<_, UserPreferences>(
        r#"
        SELECT id, user_id, timezone, date_format, default_board_view,
               sidebar_density, locale, quiet_hours_start, quiet_hours_end,
               digest_frequency, created_at, updated_at
        FROM user_preferences
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    match prefs {
        Some(p) => Ok(p),
        None => {
            // Return defaults without persisting
            let now = chrono::Utc::now();
            Ok(UserPreferences {
                id: Uuid::new_v4(),
                user_id,
                timezone: "UTC".to_string(),
                date_format: "MMM dd, yyyy".to_string(),
                default_board_view: "kanban".to_string(),
                sidebar_density: "comfortable".to_string(),
                locale: "en".to_string(),
                quiet_hours_start: None,
                quiet_hours_end: None,
                digest_frequency: "realtime".to_string(),
                created_at: now,
                updated_at: now,
            })
        }
    }
}

/// Upsert user preferences
#[allow(clippy::too_many_arguments)]
pub async fn upsert(
    pool: &PgPool,
    user_id: Uuid,
    timezone: &str,
    date_format: &str,
    default_board_view: &str,
    sidebar_density: &str,
    locale: &str,
    quiet_hours_start: Option<NaiveTime>,
    quiet_hours_end: Option<NaiveTime>,
    digest_frequency: &str,
) -> Result<UserPreferences, sqlx::Error> {
    sqlx::query_as::<_, UserPreferences>(
        r#"
        INSERT INTO user_preferences (
            id, user_id, timezone, date_format, default_board_view,
            sidebar_density, locale, quiet_hours_start, quiet_hours_end,
            digest_frequency, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        ON CONFLICT (user_id) DO UPDATE SET
            timezone = EXCLUDED.timezone,
            date_format = EXCLUDED.date_format,
            default_board_view = EXCLUDED.default_board_view,
            sidebar_density = EXCLUDED.sidebar_density,
            locale = EXCLUDED.locale,
            quiet_hours_start = EXCLUDED.quiet_hours_start,
            quiet_hours_end = EXCLUDED.quiet_hours_end,
            digest_frequency = EXCLUDED.digest_frequency,
            updated_at = NOW()
        RETURNING id, user_id, timezone, date_format, default_board_view,
                  sidebar_density, locale, quiet_hours_start, quiet_hours_end,
                  digest_frequency, created_at, updated_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(timezone)
    .bind(date_format)
    .bind(default_board_view)
    .bind(sidebar_density)
    .bind(locale)
    .bind(quiet_hours_start)
    .bind(quiet_hours_end)
    .bind(digest_frequency)
    .fetch_one(pool)
    .await
}
