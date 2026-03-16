use chrono::NaiveTime;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::UserPreferences;

/// Allowed values for server-side enum validation
const VALID_DATE_FORMATS: &[&str] = &["MMM dd, yyyy", "dd/MM/yyyy", "yyyy-MM-dd", "MM/dd/yyyy"];
const VALID_PROJECT_VIEWS: &[&str] = &["kanban", "list"];
const VALID_SIDEBAR_DENSITIES: &[&str] = &["compact", "comfortable"];
const VALID_DIGEST_FREQUENCIES: &[&str] = &["realtime", "hourly", "daily"];
const VALID_COLOR_MODES: &[&str] = &["light", "dark", "system"];
const VALID_ACCENT_COLORS: &[&str] = &[
    "indigo", "blue", "green", "orange", "rose", "violet", "amber", "slate",
];

/// Validate preference values server-side
pub fn validate_preferences(
    timezone: &str,
    date_format: &str,
    default_project_view: &str,
    sidebar_density: &str,
    digest_frequency: &str,
) -> Result<(), String> {
    if !VALID_DATE_FORMATS.contains(&date_format) {
        return Err(format!("Invalid date_format: {}", date_format));
    }
    if !VALID_PROJECT_VIEWS.contains(&default_project_view) {
        return Err(format!(
            "Invalid default_project_view: {}",
            default_project_view
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

/// Validate theme-related preferences
pub fn validate_theme_preferences(
    color_mode: Option<&str>,
    accent_color: Option<&str>,
) -> Result<(), String> {
    if let Some(mode) = color_mode {
        if !VALID_COLOR_MODES.contains(&mode) {
            return Err(format!("Invalid color_mode: {}", mode));
        }
    }
    if let Some(accent) = accent_color {
        if !VALID_ACCENT_COLORS.contains(&accent) {
            return Err(format!("Invalid accent_color: {}", accent));
        }
    }
    Ok(())
}

/// Get preferences for a user, returning defaults if none exist
pub async fn get_by_user_id(pool: &PgPool, user_id: Uuid) -> Result<UserPreferences, sqlx::Error> {
    let prefs = sqlx::query_as::<_, UserPreferences>(
        r#"
        SELECT id, user_id, timezone, date_format, default_project_view,
               sidebar_density, locale, quiet_hours_start, quiet_hours_end,
               digest_frequency, created_at, updated_at,
               accent_color, color_mode
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
                default_project_view: "kanban".to_string(),
                sidebar_density: "comfortable".to_string(),
                locale: "en".to_string(),
                quiet_hours_start: None,
                quiet_hours_end: None,
                digest_frequency: "realtime".to_string(),
                created_at: now,
                updated_at: now,
                accent_color: Some("indigo".to_string()),
                color_mode: Some("system".to_string()),
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
    default_project_view: &str,
    sidebar_density: &str,
    locale: &str,
    quiet_hours_start: Option<NaiveTime>,
    quiet_hours_end: Option<NaiveTime>,
    digest_frequency: &str,
    accent_color: Option<&str>,
    color_mode: Option<&str>,
) -> Result<UserPreferences, sqlx::Error> {
    sqlx::query_as::<_, UserPreferences>(
        r#"
        INSERT INTO user_preferences (
            id, user_id, timezone, date_format, default_project_view,
            sidebar_density, locale, quiet_hours_start, quiet_hours_end,
            digest_frequency, created_at, updated_at,
            accent_color, color_mode
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW(), $11, $12)
        ON CONFLICT (user_id) DO UPDATE SET
            timezone = EXCLUDED.timezone,
            date_format = EXCLUDED.date_format,
            default_project_view = EXCLUDED.default_project_view,
            sidebar_density = EXCLUDED.sidebar_density,
            locale = EXCLUDED.locale,
            quiet_hours_start = EXCLUDED.quiet_hours_start,
            quiet_hours_end = EXCLUDED.quiet_hours_end,
            digest_frequency = EXCLUDED.digest_frequency,
            accent_color = COALESCE(EXCLUDED.accent_color, (SELECT accent_color FROM user_preferences WHERE user_id = $2)),
            color_mode = COALESCE(EXCLUDED.color_mode, (SELECT color_mode FROM user_preferences WHERE user_id = $2)),
            updated_at = NOW()
        RETURNING id, user_id, timezone, date_format, default_project_view,
                  sidebar_density, locale, quiet_hours_start, quiet_hours_end,
                  digest_frequency, created_at, updated_at,
                  accent_color, color_mode
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(timezone)
    .bind(date_format)
    .bind(default_project_view)
    .bind(sidebar_density)
    .bind(locale)
    .bind(quiet_hours_start)
    .bind(quiet_hours_end)
    .bind(digest_frequency)
    .bind(accent_color.unwrap_or("indigo"))
    .bind(color_mode.unwrap_or("system"))
    .fetch_one(pool)
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::queries::auth;
    use crate::test_helpers::test_pool;

    const FAKE_HASH: &str = "$argon2id$v=19$m=19456,t=2,p=1$fake_salt$fake_hash_for_test";

    fn unique_email() -> String {
        format!("inttest-up-{}@example.com", Uuid::new_v4())
    }

    async fn setup_user(pool: &PgPool) -> (Uuid, Uuid) {
        let user = auth::create_user_with_tenant(pool, &unique_email(), "UP Test User", FAKE_HASH)
            .await
            .expect("create_user_with_tenant");
        (user.tenant_id, user.id)
    }

    #[tokio::test]
    async fn test_get_preferences_defaults() {
        let pool = test_pool().await;
        let (_tenant_id, user_id) = setup_user(&pool).await;

        let prefs = get_by_user_id(&pool, user_id)
            .await
            .expect("get_by_user_id");

        // Should return defaults since no preferences exist yet
        assert_eq!(prefs.user_id, user_id);
        assert_eq!(prefs.timezone, "UTC");
        assert_eq!(prefs.date_format, "MMM dd, yyyy");
        assert_eq!(prefs.default_project_view, "kanban");
        assert_eq!(prefs.sidebar_density, "comfortable");
        assert_eq!(prefs.locale, "en");
        assert_eq!(prefs.digest_frequency, "realtime");
        assert!(prefs.quiet_hours_start.is_none());
        assert!(prefs.quiet_hours_end.is_none());
        assert_eq!(prefs.color_mode.as_deref(), Some("system"));
        assert_eq!(prefs.accent_color.as_deref(), Some("indigo"));
    }

    #[tokio::test]
    async fn test_upsert_preferences() {
        let pool = test_pool().await;
        let (_tenant_id, user_id) = setup_user(&pool).await;

        let prefs = upsert(
            &pool,
            user_id,
            "America/New_York",
            "yyyy-MM-dd",
            "list",
            "compact",
            "en-US",
            None,
            None,
            "daily",
            Some("blue"),
            Some("dark"),
        )
        .await
        .expect("upsert preferences");

        assert_eq!(prefs.user_id, user_id);
        assert_eq!(prefs.timezone, "America/New_York");
        assert_eq!(prefs.date_format, "yyyy-MM-dd");
        assert_eq!(prefs.default_project_view, "list");
        assert_eq!(prefs.sidebar_density, "compact");
        assert_eq!(prefs.locale, "en-US");
        assert_eq!(prefs.digest_frequency, "daily");
        assert_eq!(prefs.accent_color.as_deref(), Some("blue"));
        assert_eq!(prefs.color_mode.as_deref(), Some("dark"));
    }

    #[tokio::test]
    async fn test_upsert_preferences_update_existing() {
        let pool = test_pool().await;
        let (_tenant_id, user_id) = setup_user(&pool).await;

        // First upsert to create
        upsert(
            &pool,
            user_id,
            "UTC",
            "MMM dd, yyyy",
            "kanban",
            "comfortable",
            "en",
            None,
            None,
            "realtime",
            Some("indigo"),
            Some("system"),
        )
        .await
        .expect("first upsert");

        // Second upsert to update
        let updated = upsert(
            &pool,
            user_id,
            "Europe/London",
            "dd/MM/yyyy",
            "list",
            "compact",
            "en-GB",
            Some(NaiveTime::from_hms_opt(22, 0, 0).expect("valid time")),
            Some(NaiveTime::from_hms_opt(8, 0, 0).expect("valid time")),
            "hourly",
            Some("green"),
            Some("light"),
        )
        .await
        .expect("second upsert");

        assert_eq!(updated.timezone, "Europe/London");
        assert_eq!(updated.date_format, "dd/MM/yyyy");
        assert_eq!(updated.default_project_view, "list");
        assert_eq!(updated.sidebar_density, "compact");
        assert_eq!(updated.locale, "en-GB");
        assert_eq!(updated.digest_frequency, "hourly");
        assert!(updated.quiet_hours_start.is_some());
        assert!(updated.quiet_hours_end.is_some());
        assert_eq!(updated.accent_color.as_deref(), Some("green"));
        assert_eq!(updated.color_mode.as_deref(), Some("light"));

        // Verify by reading back
        let fetched = get_by_user_id(&pool, user_id)
            .await
            .expect("get after update");
        assert_eq!(fetched.timezone, "Europe/London");
        assert_eq!(fetched.accent_color.as_deref(), Some("green"));
    }

    #[tokio::test]
    async fn test_validate_preferences_valid() {
        let result = validate_preferences(
            "America/Chicago",
            "yyyy-MM-dd",
            "kanban",
            "comfortable",
            "daily",
        );
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_validate_preferences_invalid_date_format() {
        let result =
            validate_preferences("UTC", "invalid-format", "kanban", "comfortable", "realtime");
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_validate_preferences_invalid_project_view() {
        let result = validate_preferences(
            "UTC",
            "yyyy-MM-dd",
            "invalid-view",
            "comfortable",
            "realtime",
        );
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_validate_theme_preferences_valid() {
        let result = validate_theme_preferences(Some("dark"), Some("blue"));
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_validate_theme_preferences_invalid_color_mode() {
        let result = validate_theme_preferences(Some("neon"), Some("blue"));
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_validate_theme_preferences_invalid_accent() {
        let result = validate_theme_preferences(Some("dark"), Some("rainbow"));
        assert!(result.is_err());
    }
}
