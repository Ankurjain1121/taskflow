//! Password-related authentication endpoints
//!
//! Provides password change, account deletion, forgot/reset password.

use axum::{extract::State, Json};
use chrono::{Duration, Utc};
use serde::Deserialize;
use uuid::Uuid;

use taskflow_auth::password::verify_password;
use taskflow_db::models::UserRole;
use taskflow_db::queries::auth;
use taskflow_services::notifications::PostalClient;

use crate::errors::{AppError, Result};
use crate::extractors::AuthUserExtractor;
use crate::state::AppState;

use super::auth::hash_token;
use super::common::MessageResponse;

// ============================================================================
// Request DTOs
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct ChangePasswordRequest {
    pub current_password: String,
    pub new_password: String,
}

#[derive(Debug, Deserialize)]
pub struct DeleteAccountRequest {
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct ForgotPasswordRequest {
    pub email: String,
}

#[derive(Debug, Deserialize)]
pub struct ResetPasswordRequest {
    pub token: String,
    pub new_password: String,
}

// ============================================================================
// Route Handlers
// ============================================================================

/// POST /api/auth/change-password
///
/// Change password. Requires current password. Revokes all other sessions.
pub async fn change_password_handler(
    State(state): State<AppState>,
    auth_ext: AuthUserExtractor,
    Json(payload): Json<ChangePasswordRequest>,
) -> Result<Json<MessageResponse>> {
    if payload.new_password.len() < 8 {
        return Err(AppError::BadRequest(
            "New password must be at least 8 characters".into(),
        ));
    }

    let user = auth::get_user_by_id(&state.db, auth_ext.0.user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("User not found".into()))?;

    // Verify current password (timing-safe via Argon2)
    let valid = verify_password(&payload.current_password, &user.password_hash)
        .map_err(|_| AppError::InternalError("Password verification failed".into()))?;

    if !valid {
        return Err(AppError::Unauthorized(
            "Current password is incorrect".into(),
        ));
    }

    // Hash new password
    let new_hash = taskflow_auth::password::hash_password(&payload.new_password)
        .map_err(|_| AppError::InternalError("Failed to hash password".into()))?;

    // Update password
    auth::update_user_password(&state.db, user.id, &new_hash).await?;

    // Revoke all refresh tokens EXCEPT current session
    sqlx::query(
        r#"
        UPDATE refresh_tokens SET revoked_at = NOW()
        WHERE user_id = $1 AND id != $2 AND revoked_at IS NULL
        "#,
    )
    .bind(user.id)
    .bind(auth_ext.0.token_id)
    .execute(&state.db)
    .await?;

    // Audit log
    let metadata = serde_json::json!({ "action": "password_changed" });
    let _ = sqlx::query(
        r#"
        INSERT INTO activity_log (id, action, entity_type, entity_id, user_id, metadata, tenant_id)
        VALUES ($1, 'updated', 'user', $2, $2, $3, $4)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(user.id)
    .bind(metadata)
    .bind(auth_ext.0.tenant_id)
    .execute(&state.db)
    .await;

    Ok(Json(MessageResponse {
        message: "Password changed successfully. All other sessions have been revoked.".into(),
    }))
}

/// DELETE /api/auth/me
///
/// Delete the current user's account. Requires password confirmation.
pub async fn delete_account_handler(
    State(state): State<AppState>,
    auth_ext: AuthUserExtractor,
    Json(payload): Json<DeleteAccountRequest>,
) -> Result<Json<MessageResponse>> {
    let user = auth::get_user_by_id(&state.db, auth_ext.0.user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("User not found".into()))?;

    // Verify password
    let valid = verify_password(&payload.password, &user.password_hash)
        .map_err(|_| AppError::InternalError("Password verification failed".into()))?;

    if !valid {
        return Err(AppError::Unauthorized("Password is incorrect".into()));
    }

    // Check if user is the last admin of their tenant
    let admin_count: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*) FROM users
        WHERE tenant_id = $1 AND role = 'admin' AND deleted_at IS NULL
        "#,
    )
    .bind(user.tenant_id)
    .fetch_one(&state.db)
    .await?;

    if admin_count <= 1 && user.role == UserRole::Admin {
        return Err(AppError::BadRequest(
            "Cannot delete account: you are the last admin of this organization".into(),
        ));
    }

    // Revoke all tokens
    auth::revoke_all_user_tokens(&state.db, user.id).await?;

    // Remove workspace memberships
    sqlx::query("DELETE FROM workspace_members WHERE user_id = $1")
        .bind(user.id)
        .execute(&state.db)
        .await?;

    // Soft-delete the user
    sqlx::query("UPDATE users SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1")
        .bind(user.id)
        .execute(&state.db)
        .await?;

    // Audit log
    let metadata = serde_json::json!({ "action": "account_deleted" });
    let _ = sqlx::query(
        r#"
        INSERT INTO activity_log (id, action, entity_type, entity_id, user_id, metadata, tenant_id)
        VALUES ($1, 'deleted', 'user', $2, $2, $3, $4)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(user.id)
    .bind(metadata)
    .bind(user.tenant_id)
    .execute(&state.db)
    .await;

    Ok(Json(MessageResponse {
        message: "Account has been deleted".into(),
    }))
}

/// POST /api/auth/forgot-password
///
/// Request a password reset link. Always returns success to prevent email enumeration.
pub async fn forgot_password_handler(
    State(state): State<AppState>,
    Json(payload): Json<ForgotPasswordRequest>,
) -> Result<Json<MessageResponse>> {
    // Always return success to prevent email enumeration
    let user = auth::get_user_by_email(&state.db, &payload.email).await?;

    if let Some(user) = user {
        // Generate a random token
        let raw_token = Uuid::new_v4().to_string();
        let token_hash = hash_token(&raw_token);
        let expires_at = Utc::now() + Duration::hours(1);

        auth::create_password_reset_token(&state.db, user.id, &token_hash, expires_at).await?;

        // Send email (best effort - don't fail if email sending fails)
        let reset_url = format!(
            "{}/auth/reset-password?token={}",
            state.config.app_url, raw_token
        );
        tracing::info!(
            email = %payload.email,
            "Password reset requested"
        );

        let subject = "Reset your TaskFlow password";
        let html_body = format!(
            r#"<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
        <h1 style="color: #111827; font-size: 24px; margin: 0 0 16px 0;">Password Reset</h1>
        <p style="color: #4b5563; font-size: 16px; margin: 0 0 20px 0;">
            You requested a password reset. Click the button below to set a new password.
            This link expires in 1 hour.
        </p>
        <p><a href="{}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a></p>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 16px;">If you did not request this, you can safely ignore this email.</p>
    </div>
</body>
</html>"#,
            reset_url
        );

        let postal = PostalClient::new(
            state.config.postal_api_url.clone(),
            state.config.postal_api_key.clone(),
            state.config.postal_from_address.clone(),
            state.config.postal_from_name.clone(),
        );

        if let Err(e) = postal.send_email(&payload.email, subject, &html_body).await {
            tracing::error!(error = %e, email = %payload.email, "Failed to send password reset email");
        }
    }

    Ok(Json(MessageResponse {
        message: "If an account with that email exists, a password reset link has been sent."
            .into(),
    }))
}

/// POST /api/auth/reset-password
///
/// Reset password using a valid reset token.
pub async fn reset_password_handler(
    State(state): State<AppState>,
    Json(payload): Json<ResetPasswordRequest>,
) -> Result<Json<MessageResponse>> {
    if payload.new_password.len() < 8 {
        return Err(AppError::BadRequest(
            "Password must be at least 8 characters".into(),
        ));
    }

    let token_hash = hash_token(&payload.token);

    let (token_id, user_id) = auth::get_valid_reset_token(&state.db, &token_hash)
        .await?
        .ok_or_else(|| AppError::BadRequest("Invalid or expired reset token".into()))?;

    // Hash new password
    let password_hash = taskflow_auth::password::hash_password(&payload.new_password)
        .map_err(|_| AppError::InternalError("Failed to hash password".into()))?;

    // Update password
    auth::update_user_password(&state.db, user_id, &password_hash).await?;

    // Mark token as used
    auth::mark_reset_token_used(&state.db, token_id).await?;

    // Revoke all refresh tokens
    auth::revoke_all_user_tokens(&state.db, user_id).await?;

    Ok(Json(MessageResponse {
        message: "Password has been reset successfully. Please sign in with your new password."
            .into(),
    }))
}
