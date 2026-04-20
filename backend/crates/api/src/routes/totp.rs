//! Two-Factor Authentication (TOTP) endpoints
//!
//! Provides setup, verification, disable, and login challenge for TOTP-based 2FA.
//! Uses `totp-lite` for TOTP code generation/validation and stores secrets in the
//! `user_2fa` table. Recovery codes are hashed with SHA-256 before storage.

use axum::{
    extract::State,
    http::HeaderMap,
    response::{IntoResponse, Response},
    routing::post,
    Json, Router,
};
use chrono::Utc;
use data_encoding::BASE32;
use rand::Rng;
use serde::Serialize;
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::{AuthUserExtractor, StrictJson};
use crate::state::AppState;

use super::auth_session::{build_auth_session, extract_session_metadata, SessionParams};
use super::common::MessageResponse;

/// Max TOTP verification attempts before rate limiting (5 per 5 minutes)
const MAX_TOTP_ATTEMPTS: i64 = 5;
const TOTP_RATE_LIMIT_SECS: i64 = 300;

// ============================================================================
// Request/Response DTOs
// ============================================================================

#[derive(Debug, Serialize)]
pub struct TwoFactorSetupResponse {
    pub secret: String,
    pub otpauth_uri: String,
}

#[strict_dto_derive::strict_dto]
#[derive(Debug)]
pub struct VerifyCodeRequest {
    pub code: String,
}

#[derive(Debug, Serialize)]
pub struct VerifyResponse {
    pub recovery_codes: Vec<String>,
}

#[strict_dto_derive::strict_dto]
#[derive(Debug)]
pub struct DisableRequest {
    pub code: Option<String>,
    pub recovery_code: Option<String>,
}

#[strict_dto_derive::strict_dto]
#[derive(Debug)]
pub struct ChallengeRequest {
    pub temp_token: String,
    pub code: Option<String>,
    pub recovery_code: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TwoFactorStatusResponse {
    pub enabled: bool,
}

// ============================================================================
// Helpers
// ============================================================================

/// Generate a random 20-byte secret and return it as base32.
fn generate_totp_secret() -> String {
    let mut rng = rand::rng();
    let secret: [u8; 20] = rng.random();
    BASE32.encode(&secret)
}

/// Build an otpauth:// URI for QR code generation.
fn build_otpauth_uri(secret_base32: &str, email: &str) -> String {
    let issuer = "TaskBolt";
    format!(
        "otpauth://totp/{issuer}:{email}?secret={secret_base32}&issuer={issuer}&algorithm=SHA1&digits=6&period=30"
    )
}

/// Validate a TOTP code against a base32-encoded secret.
/// Allows a 1-step time skew (previous and next period).
fn validate_totp_code(secret_base32: &str, code: &str) -> bool {
    let Ok(secret_bytes) = BASE32.decode(secret_base32.as_bytes()) else {
        return false;
    };

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    // Check current period and +/- 1 period (30s each)
    for offset in [0i64, -1, 1] {
        let adjusted = (i64::try_from(now).unwrap_or(i64::MAX) + offset * 30).max(0) as u64;
        let generated = totp_lite::totp_custom::<totp_lite::Sha1>(30, 6, &secret_bytes, adjusted);
        if generated == code {
            return true;
        }
    }
    false
}

/// Generate recovery codes (10 random hex strings, 8 chars each).
fn generate_recovery_codes() -> Vec<String> {
    let mut rng = rand::rng();
    (0..10)
        .map(|_| {
            let bytes: [u8; 4] = rng.random();
            hex::encode(&bytes)
        })
        .collect()
}

/// We don't have a `hex` crate, so use a simple inline hex encoder.
mod hex {
    pub fn encode(bytes: &[u8]) -> String {
        bytes.iter().fold(String::new(), |mut s, b| {
            use std::fmt::Write as _;
            let _ = write!(s, "{b:02x}");
            s
        })
    }
}

/// Hash a recovery code with SHA-256.
fn hash_recovery_code(code: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(code.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Check rate limit for TOTP attempts. Returns error if exceeded.
async fn check_totp_rate_limit(
    redis: &mut redis::aio::ConnectionManager,
    user_id: Uuid,
) -> Result<()> {
    let key = format!("totp_attempts:{user_id}");
    let attempts: Option<i64> = redis::cmd("GET")
        .arg(&key)
        .query_async(redis)
        .await
        .unwrap_or(None);

    if let Some(count) = attempts {
        if count >= MAX_TOTP_ATTEMPTS {
            return Err(AppError::TooManyRequests(
                "Too many 2FA attempts. Please try again in 5 minutes.".into(),
            ));
        }
    }
    Ok(())
}

/// Increment the TOTP attempt counter.
async fn increment_totp_attempts(redis: &mut redis::aio::ConnectionManager, user_id: Uuid) {
    let key = format!("totp_attempts:{user_id}");
    let _: () = redis::cmd("INCR")
        .arg(&key)
        .query_async(redis)
        .await
        .unwrap_or(());
    let _: () = redis::cmd("EXPIRE")
        .arg(&key)
        .arg(TOTP_RATE_LIMIT_SECS)
        .query_async(redis)
        .await
        .unwrap_or(());
}

/// Clear the TOTP attempt counter on success.
async fn clear_totp_attempts(redis: &mut redis::aio::ConnectionManager, user_id: Uuid) {
    let key = format!("totp_attempts:{user_id}");
    let _: () = redis::cmd("DEL")
        .arg(&key)
        .query_async(redis)
        .await
        .unwrap_or(());
}

// ============================================================================
// Route Handlers
// ============================================================================

/// POST /api/auth/2fa/setup
///
/// Generate a TOTP secret for the authenticated user.
/// Returns the secret (base32) and otpauth:// URI for QR code scanning.
/// Does NOT enable 2FA yet -- that happens after verification.
pub async fn setup_handler(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
) -> Result<Json<TwoFactorSetupResponse>> {
    let user_id = auth.0.user_id;

    // Check if 2FA is already enabled
    let row = sqlx::query_scalar::<_, bool>("SELECT totp_enabled FROM user_2fa WHERE user_id = $1")
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?;

    if row == Some(true) {
        return Err(AppError::Conflict(
            "Two-factor authentication is already enabled".into(),
        ));
    }

    // Generate secret
    let secret = generate_totp_secret();

    // Get user email for the otpauth URI
    let email: String = sqlx::query_scalar("SELECT email FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_one(&state.db)
        .await?;

    let otpauth_uri = build_otpauth_uri(&secret, &email);

    // Upsert the secret (not yet enabled)
    sqlx::query(
        r#"
        INSERT INTO user_2fa (user_id, totp_secret, totp_enabled, created_at, updated_at)
        VALUES ($1, $2, false, NOW(), NOW())
        ON CONFLICT (user_id) DO UPDATE
        SET totp_secret = $2, totp_enabled = false, updated_at = NOW()
        "#,
    )
    .bind(user_id)
    .bind(&secret)
    .execute(&state.db)
    .await?;

    Ok(Json(TwoFactorSetupResponse {
        secret,
        otpauth_uri,
    }))
}

/// POST /api/auth/2fa/verify
///
/// Verify the TOTP code after setup. If valid, enables 2FA and returns recovery codes.
pub async fn verify_handler(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    StrictJson(payload): StrictJson<VerifyCodeRequest>,
) -> Result<Json<VerifyResponse>> {
    let user_id = auth.0.user_id;

    // Rate limit check
    check_totp_rate_limit(&mut state.redis.clone(), user_id).await?;

    // Get the pending secret
    let row: Option<(String, bool)> =
        sqlx::query_as("SELECT totp_secret, totp_enabled FROM user_2fa WHERE user_id = $1")
            .bind(user_id)
            .fetch_optional(&state.db)
            .await?;

    let (secret, enabled) = row.ok_or_else(|| {
        AppError::BadRequest("Please set up 2FA first by calling /api/auth/2fa/setup".into())
    })?;

    if enabled {
        return Err(AppError::Conflict(
            "Two-factor authentication is already enabled".into(),
        ));
    }

    // Validate the code
    if !validate_totp_code(&secret, &payload.code) {
        increment_totp_attempts(&mut state.redis.clone(), user_id).await;
        return Err(AppError::Unauthorized("Invalid verification code".into()));
    }

    clear_totp_attempts(&mut state.redis.clone(), user_id).await;

    // Generate recovery codes
    let recovery_codes = generate_recovery_codes();
    let hashed_codes: Vec<String> = recovery_codes
        .iter()
        .map(|c| hash_recovery_code(c))
        .collect();
    let codes_json = serde_json::to_value(&hashed_codes)
        .map_err(|e| AppError::InternalError(format!("Failed to serialize recovery codes: {e}")))?;

    // Enable 2FA and store hashed recovery codes
    sqlx::query(
        r#"
        UPDATE user_2fa
        SET totp_enabled = true, recovery_codes = $2, updated_at = NOW()
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .bind(codes_json)
    .execute(&state.db)
    .await?;

    Ok(Json(VerifyResponse { recovery_codes }))
}

/// POST /api/auth/2fa/disable
///
/// Disable 2FA. Requires a valid TOTP code or recovery code.
pub async fn disable_handler(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    StrictJson(payload): StrictJson<DisableRequest>,
) -> Result<Json<MessageResponse>> {
    let user_id = auth.0.user_id;

    // Rate limit check
    check_totp_rate_limit(&mut state.redis.clone(), user_id).await?;

    // Get the current 2FA config
    let row: Option<(String, bool, Option<serde_json::Value>)> = sqlx::query_as(
        "SELECT totp_secret, totp_enabled, recovery_codes FROM user_2fa WHERE user_id = $1",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?;

    let (secret, enabled, recovery_codes_json) =
        row.ok_or_else(|| AppError::BadRequest("Two-factor authentication is not set up".into()))?;

    if !enabled {
        return Err(AppError::BadRequest(
            "Two-factor authentication is not enabled".into(),
        ));
    }

    // Validate via TOTP code or recovery code
    let valid = if let Some(code) = &payload.code {
        validate_totp_code(&secret, code)
    } else if let Some(recovery_code) = &payload.recovery_code {
        validate_and_consume_recovery_code(
            &state.db,
            user_id,
            recovery_code,
            recovery_codes_json.as_ref(),
        )
        .await?
    } else {
        return Err(AppError::BadRequest(
            "Either 'code' or 'recovery_code' is required".into(),
        ));
    };

    if !valid {
        increment_totp_attempts(&mut state.redis.clone(), user_id).await;
        return Err(AppError::Unauthorized("Invalid code".into()));
    }

    clear_totp_attempts(&mut state.redis.clone(), user_id).await;

    // Delete 2FA record
    sqlx::query("DELETE FROM user_2fa WHERE user_id = $1")
        .bind(user_id)
        .execute(&state.db)
        .await?;

    Ok(Json(MessageResponse {
        message: "Two-factor authentication has been disabled".into(),
    }))
}

/// POST /api/auth/2fa/challenge
///
/// Complete login after password verification when 2FA is enabled.
/// Validates TOTP code (or recovery code), then issues the real JWT.
pub async fn challenge_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    StrictJson(payload): StrictJson<ChallengeRequest>,
) -> Result<Response> {
    // Resolve temp token from Redis (stores JSON with user_id + persistent flag)
    let temp_key = format!("2fa_temp:{}", payload.temp_token);
    let temp_value_str: Option<String> = redis::cmd("GET")
        .arg(&temp_key)
        .query_async(&mut state.redis.clone())
        .await
        .unwrap_or(None);

    let temp_value_str = temp_value_str
        .ok_or_else(|| AppError::Unauthorized("Invalid or expired temporary token".into()))?;

    // Parse JSON; fall back to legacy plain user_id string for backward compatibility
    let (user_id, persistent): (Uuid, bool) = if let Ok(val) =
        serde_json::from_str::<serde_json::Value>(&temp_value_str)
    {
        let uid = val
            .get("user_id")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<Uuid>().ok())
            .ok_or_else(|| AppError::InternalError("Invalid user_id in temp token JSON".into()))?;
        let persist = val
            .get("persistent")
            .and_then(serde_json::Value::as_bool)
            .unwrap_or(true);
        (uid, persist)
    } else {
        // Legacy format: plain UUID string
        let uid = temp_value_str
            .parse::<Uuid>()
            .map_err(|_| AppError::InternalError("Invalid user ID in temp token".into()))?;
        (uid, true)
    };

    // Rate limit check
    check_totp_rate_limit(&mut state.redis.clone(), user_id).await?;

    // Get 2FA config
    let row: Option<(String, bool, Option<serde_json::Value>)> = sqlx::query_as(
        "SELECT totp_secret, totp_enabled, recovery_codes FROM user_2fa WHERE user_id = $1",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?;

    let (secret, enabled, recovery_codes_json) =
        row.ok_or_else(|| AppError::InternalError("2FA configuration not found".into()))?;

    if !enabled {
        return Err(AppError::InternalError("2FA is not enabled".into()));
    }

    // Validate code
    let valid = if let Some(code) = &payload.code {
        validate_totp_code(&secret, code)
    } else if let Some(recovery_code) = &payload.recovery_code {
        validate_and_consume_recovery_code(
            &state.db,
            user_id,
            recovery_code,
            recovery_codes_json.as_ref(),
        )
        .await?
    } else {
        return Err(AppError::BadRequest(
            "Either 'code' or 'recovery_code' is required".into(),
        ));
    };

    if !valid {
        increment_totp_attempts(&mut state.redis.clone(), user_id).await;
        return Err(AppError::Unauthorized("Invalid verification code".into()));
    }

    clear_totp_attempts(&mut state.redis.clone(), user_id).await;

    // Delete temp token
    let _: () = redis::cmd("DEL")
        .arg(&temp_key)
        .query_async(&mut state.redis.clone())
        .await
        .unwrap_or(());

    // Get full user data for session
    let full_user = taskbolt_db::queries::auth::get_user_by_id(&state.db, user_id)
        .await?
        .ok_or_else(|| AppError::InternalError("User not found after 2FA".into()))?;

    let (ip_address, user_agent) = extract_session_metadata(&headers);

    let session = build_auth_session(SessionParams {
        user_id: full_user.id,
        tenant_id: full_user.tenant_id,
        role: full_user.role,
        name: full_user.name,
        email: full_user.email,
        avatar_url: full_user.avatar_url,
        phone_number: full_user.phone_number,
        phone_verified: full_user.phone_verified,
        job_title: full_user.job_title,
        department: full_user.department,
        bio: full_user.bio,
        onboarding_completed: full_user.onboarding_completed,
        last_login_at: Some(Utc::now()),
        ip_address,
        user_agent,
        persistent,
        state: &state,
    })
    .await?;

    let mut response = Json(session.auth_response).into_response();
    response.headers_mut().extend(session.cookie_headers);
    Ok(response)
}

/// GET /api/auth/2fa/status
///
/// Check if the authenticated user has 2FA enabled.
pub async fn status_handler(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
) -> Result<Json<TwoFactorStatusResponse>> {
    let enabled: bool = sqlx::query_scalar(
        "SELECT COALESCE((SELECT totp_enabled FROM user_2fa WHERE user_id = $1), false)",
    )
    .bind(auth.0.user_id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(TwoFactorStatusResponse { enabled }))
}

// ============================================================================
// Recovery code validation
// ============================================================================

/// Validate a recovery code and consume it (remove from the stored list).
async fn validate_and_consume_recovery_code(
    db: &sqlx::PgPool,
    user_id: Uuid,
    recovery_code: &str,
    recovery_codes_json: Option<&serde_json::Value>,
) -> Result<bool> {
    let Some(codes_value) = recovery_codes_json else {
        return Ok(false);
    };

    let stored_hashes: Vec<String> =
        serde_json::from_value(codes_value.clone()).unwrap_or_default();

    let provided_hash = hash_recovery_code(recovery_code);

    let position = stored_hashes.iter().position(|h| h == &provided_hash);

    if let Some(idx) = position {
        // Remove the used recovery code
        let mut remaining = stored_hashes;
        remaining.remove(idx);
        let remaining_json = serde_json::to_value(&remaining).map_err(|e| {
            AppError::InternalError(format!("Failed to update recovery codes: {e}"))
        })?;

        sqlx::query(
            "UPDATE user_2fa SET recovery_codes = $2, updated_at = NOW() WHERE user_id = $1",
        )
        .bind(user_id)
        .bind(remaining_json)
        .execute(db)
        .await?;

        Ok(true)
    } else {
        Ok(false)
    }
}

// ============================================================================
// Router
// ============================================================================

pub fn totp_router() -> Router<AppState> {
    Router::new()
        .route("/setup", post(setup_handler))
        .route("/verify", post(verify_handler))
        .route("/disable", post(disable_handler))
        .route("/challenge", post(challenge_handler))
        .route("/status", axum::routing::get(status_handler))
}
