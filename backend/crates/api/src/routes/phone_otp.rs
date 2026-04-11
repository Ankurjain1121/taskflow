//! Phone OTP verification endpoints
//!
//! Sends and verifies OTP codes via WhatsApp (WAHA) for phone number confirmation.

use axum::{Json, extract::State};
use rand::Rng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::errors::{AppError, Result};
use crate::state::AppState;

use taskbolt_services::notifications::whatsapp::{is_whatsapp_enabled, validate_e164_phone_number};

// ============================================================================
// Request/Response DTOs
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct SendOtpRequest {
    pub phone_number: String,
}

#[derive(Debug, Serialize)]
pub struct SendOtpResponse {
    pub message: String,
    pub expires_in: u64,
}

#[derive(Debug, Deserialize)]
pub struct VerifyOtpRequest {
    pub phone_number: String,
    pub code: String,
}

#[derive(Debug, Serialize)]
pub struct VerifyOtpResponse {
    pub message: String,
    pub verified: bool,
}

// ============================================================================
// Constants
// ============================================================================

/// OTP validity in seconds (5 minutes)
const OTP_TTL_SECS: i64 = 300;
/// Rate limit window in seconds (10 minutes)
const OTP_RATE_WINDOW_SECS: i64 = 600;
/// Max OTP sends per rate window
const OTP_RATE_MAX: i64 = 3;
/// Max wrong attempts per OTP
const OTP_MAX_ATTEMPTS: i64 = 5;
/// Verified flag TTL in seconds (10 minutes)
const OTP_VERIFIED_TTL_SECS: i64 = 600;

// ============================================================================
// Helpers
// ============================================================================

fn hash_otp(code: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(code.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn generate_otp() -> String {
    let mut rng = rand::rng();
    format!("{:06}", rng.random_range(0..1_000_000u32))
}

// ============================================================================
// Route Handlers
// ============================================================================

/// POST /api/auth/phone/send-otp
///
/// Send a 6-digit OTP to the given phone number via WhatsApp.
pub async fn send_otp_handler(
    State(state): State<AppState>,
    Json(payload): Json<SendOtpRequest>,
) -> Result<Json<SendOtpResponse>> {
    let phone = payload.phone_number.trim();

    // Validate E.164 format
    validate_e164_phone_number(phone).map_err(|e| AppError::BadRequest(e.to_string()))?;

    // Check if WhatsApp is enabled
    if !is_whatsapp_enabled() {
        return Err(AppError::ServiceUnavailable(
            "Phone verification is temporarily unavailable".into(),
        ));
    }

    // Rate limit: max 3 OTPs per 10 minutes per phone
    let rate_key = format!("otp_rate:{}", phone);
    let rate_count: i64 = redis::cmd("GET")
        .arg(&rate_key)
        .query_async(&mut state.redis.clone())
        .await
        .unwrap_or(0);

    if rate_count >= OTP_RATE_MAX {
        return Err(AppError::TooManyRequests(
            "Too many OTP requests. Please wait before trying again.".into(),
        ));
    }

    // Generate OTP and store hash in Redis
    let code = generate_otp();
    let code_hash = hash_otp(&code);

    let otp_key = format!("otp:{}", phone);
    redis::cmd("SET")
        .arg(&otp_key)
        .arg(&code_hash)
        .arg("EX")
        .arg(OTP_TTL_SECS)
        .query_async::<()>(&mut state.redis.clone())
        .await
        .map_err(|e| AppError::InternalError(format!("Failed to store OTP: {e}")))?;

    // Reset attempt counter for this OTP
    let attempts_key = format!("otp_attempts:{}", phone);
    redis::cmd("DEL")
        .arg(&attempts_key)
        .query_async::<()>(&mut state.redis.clone())
        .await
        .unwrap_or(());

    // Increment rate limit counter
    let script = redis::Script::new(
        r#"
        local count = redis.call('INCR', KEYS[1])
        redis.call('EXPIRE', KEYS[1], ARGV[1])
        return count
        "#,
    );
    let _: i64 = script
        .key(&rate_key)
        .arg(OTP_RATE_WINDOW_SECS)
        .invoke_async(&mut state.redis.clone())
        .await
        .unwrap_or(1);

    // Send OTP via WhatsApp
    let waha_client = state
        .waha_client
        .as_ref()
        .ok_or_else(|| AppError::ServiceUnavailable("WhatsApp client not configured".into()))?;

    let message = format!(
        "Your TaskBolt verification code is: *{}*\n\nThis code expires in 5 minutes. Do not share it with anyone.",
        code
    );

    waha_client
        .send_message(phone, &message)
        .await
        .map_err(|e| {
            tracing::error!(phone = phone, error = %e, "Failed to send OTP via WhatsApp");
            AppError::ServiceUnavailable(
                "Failed to send verification code. Please try again later.".into(),
            )
        })?;

    tracing::info!(phone = phone, "OTP sent successfully");

    Ok(Json(SendOtpResponse {
        message: "OTP sent".into(),
        expires_in: OTP_TTL_SECS as u64,
    }))
}

/// POST /api/auth/phone/verify-otp
///
/// Verify a 6-digit OTP code. On success, sets a verified flag in Redis
/// that the sign-up or profile update flow consumes.
pub async fn verify_otp_handler(
    State(state): State<AppState>,
    Json(payload): Json<VerifyOtpRequest>,
) -> Result<Json<VerifyOtpResponse>> {
    let phone = payload.phone_number.trim();
    let code = payload.code.trim();

    // Validate inputs
    validate_e164_phone_number(phone).map_err(|e| AppError::BadRequest(e.to_string()))?;

    if code.len() != 6 || !code.chars().all(|c| c.is_ascii_digit()) {
        return Err(AppError::BadRequest("OTP must be a 6-digit code".into()));
    }

    // Check attempt limit
    let attempts_key = format!("otp_attempts:{}", phone);
    let attempts: i64 = redis::cmd("GET")
        .arg(&attempts_key)
        .query_async(&mut state.redis.clone())
        .await
        .unwrap_or(0);

    if attempts >= OTP_MAX_ATTEMPTS {
        return Err(AppError::TooManyRequests(
            "Too many incorrect attempts. Please request a new OTP.".into(),
        ));
    }

    // Get stored OTP hash
    let otp_key = format!("otp:{}", phone);
    let stored_hash: Option<String> = redis::cmd("GET")
        .arg(&otp_key)
        .query_async(&mut state.redis.clone())
        .await
        .unwrap_or(None);

    let Some(stored_hash) = stored_hash else {
        return Err(AppError::Gone(
            "OTP has expired. Please request a new one.".into(),
        ));
    };

    // Compare hashes
    let provided_hash = hash_otp(code);
    if stored_hash != provided_hash {
        // Increment attempt counter
        let script = redis::Script::new(
            r#"
            local count = redis.call('INCR', KEYS[1])
            redis.call('EXPIRE', KEYS[1], ARGV[1])
            return count
            "#,
        );
        let _: i64 = script
            .key(&attempts_key)
            .arg(OTP_TTL_SECS)
            .invoke_async(&mut state.redis.clone())
            .await
            .unwrap_or(1);

        return Err(AppError::Unauthorized("Invalid OTP code".into()));
    }

    // OTP verified — clean up and set verified flag
    redis::cmd("DEL")
        .arg(&otp_key)
        .query_async::<()>(&mut state.redis.clone())
        .await
        .unwrap_or(());

    redis::cmd("DEL")
        .arg(&attempts_key)
        .query_async::<()>(&mut state.redis.clone())
        .await
        .unwrap_or(());

    // Set verified flag with TTL
    let verified_key = format!("otp_verified:{}", phone);
    redis::cmd("SET")
        .arg(&verified_key)
        .arg("1")
        .arg("EX")
        .arg(OTP_VERIFIED_TTL_SECS)
        .query_async::<()>(&mut state.redis.clone())
        .await
        .map_err(|e| AppError::InternalError(format!("Failed to store verification flag: {e}")))?;

    tracing::info!(phone = phone, "Phone OTP verified successfully");

    Ok(Json(VerifyOtpResponse {
        message: "Phone number verified".into(),
        verified: true,
    }))
}
