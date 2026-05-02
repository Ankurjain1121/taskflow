use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{RefreshToken, User};

/// Get a user by email address
pub async fn get_user_by_email(pool: &PgPool, email: &str) -> Result<Option<User>, sqlx::Error> {
    sqlx::query_as::<_, User>(
        r"
        SELECT id, email, name, password_hash, avatar_url, phone_number, phone_verified, job_title, department, bio, role,
               tenant_id, onboarding_completed, last_login_at, deleted_at, created_at, updated_at
        FROM users
        WHERE email = $1 AND deleted_at IS NULL
        ",
    )
    .bind(email)
    .fetch_optional(pool)
    .await
}

/// Get a user by ID
pub async fn get_user_by_id(pool: &PgPool, user_id: Uuid) -> Result<Option<User>, sqlx::Error> {
    sqlx::query_as::<_, User>(
        r"
        SELECT id, email, name, password_hash, avatar_url, phone_number, phone_verified, job_title, department, bio, role,
               tenant_id, onboarding_completed, last_login_at, deleted_at, created_at, updated_at
        FROM users
        WHERE id = $1 AND deleted_at IS NULL
        ",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
}

/// Live role lookup for auth middleware. Returns `(role, tenant_id)` for an
/// active user. Returns `None` when the user is missing or soft-deleted —
/// callers MUST treat that as 401.
pub async fn get_active_user_auth(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Option<(crate::models::UserRole, Uuid)>, sqlx::Error> {
    sqlx::query_as::<_, (crate::models::UserRole, Uuid)>(
        r"
        SELECT role, tenant_id
        FROM users
        WHERE id = $1 AND deleted_at IS NULL
        ",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
}

/// Create a new refresh token record with pre-generated ID and optional metadata
#[allow(clippy::too_many_arguments)]
pub async fn create_refresh_token(
    pool: &PgPool,
    id: Uuid,
    user_id: Uuid,
    token_hash: &str,
    expires_at: DateTime<Utc>,
    ip_address: Option<&str>,
    user_agent: Option<&str>,
    persistent: bool,
) -> Result<Uuid, sqlx::Error> {
    sqlx::query(
        r"
        INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, ip_address, user_agent, persistent, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ",
    )
    .bind(id)
    .bind(user_id)
    .bind(token_hash)
    .bind(expires_at)
    .bind(ip_address)
    .bind(user_agent)
    .bind(persistent)
    .execute(pool)
    .await?;

    Ok(id)
}

/// Get a refresh token by ID
pub async fn get_refresh_token(
    pool: &PgPool,
    token_id: Uuid,
) -> Result<Option<RefreshToken>, sqlx::Error> {
    sqlx::query_as::<_, RefreshToken>(
        r"
        SELECT id, user_id, token_hash, expires_at, revoked_at,
               ip_address, user_agent, device_name, last_active_at,
               persistent, created_at
        FROM refresh_tokens
        WHERE id = $1
        ",
    )
    .bind(token_id)
    .fetch_optional(pool)
    .await
}

/// Revoke a refresh token
pub async fn revoke_refresh_token(pool: &PgPool, token_id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query(
        r"
        UPDATE refresh_tokens
        SET revoked_at = NOW()
        WHERE id = $1
        ",
    )
    .bind(token_id)
    .execute(pool)
    .await?;

    Ok(())
}

/// Revoke all refresh tokens for a user (sign-out-all)
pub async fn revoke_all_user_refresh_tokens(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r"
        UPDATE refresh_tokens
        SET revoked_at = NOW()
        WHERE user_id = $1 AND revoked_at IS NULL
        ",
    )
    .bind(user_id)
    .execute(pool)
    .await?;

    Ok(())
}

/// Create a new user with a new tenant (for self-registration)
///
/// Wrapped in a transaction so that a failed user insert does not leave an orphaned tenant.
pub async fn create_user_with_tenant(
    pool: &PgPool,
    email: &str,
    name: &str,
    password_hash: &str,
    phone_number: Option<&str>,
    phone_verified: bool,
) -> Result<User, sqlx::Error> {
    let tenant_id = Uuid::new_v4();
    let slug = format!(
        "{}-{}",
        name.to_lowercase().replace(' ', "-"),
        &tenant_id.to_string()[..8]
    );

    let mut tx = pool.begin().await?;

    // Create tenant
    sqlx::query(r"INSERT INTO tenants (id, name, slug) VALUES ($1, $2, $3)")
        .bind(tenant_id)
        .bind(format!("{}'s Team", name))
        .bind(&slug)
        .execute(&mut *tx)
        .await?;

    // Create user as super_admin of the new tenant
    let user = sqlx::query_as::<_, User>(
        r"
        INSERT INTO users (id, email, name, password_hash, phone_number, phone_verified, role, tenant_id, onboarding_completed, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, 'super_admin', $7, false, NOW(), NOW())
        RETURNING id, email, name, password_hash, avatar_url, phone_number, phone_verified, job_title, department, bio, role,
                  tenant_id, onboarding_completed, last_login_at, deleted_at, created_at, updated_at
        ",
    )
    .bind(Uuid::new_v4())
    .bind(email)
    .bind(name)
    .bind(password_hash)
    .bind(phone_number)
    .bind(phone_verified)
    .bind(tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(user)
}

/// Revoke all refresh tokens for a user
pub async fn revoke_all_user_tokens(pool: &PgPool, user_id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query(
        r"UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL",
    )
    .bind(user_id)
    .execute(pool)
    .await?;
    Ok(())
}

/// Create a new user (used during invitation acceptance)
pub async fn create_user(
    pool: &PgPool,
    email: &str,
    name: &str,
    password_hash: &str,
    role: crate::models::UserRole,
    tenant_id: Uuid,
) -> Result<User, sqlx::Error> {
    sqlx::query_as::<_, User>(
        r"
        INSERT INTO users (id, email, name, password_hash, role, tenant_id, onboarding_completed, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, false, NOW(), NOW())
        RETURNING id, email, name, password_hash, avatar_url, phone_number, phone_verified, job_title, department, bio, role,
                  tenant_id, onboarding_completed, last_login_at, deleted_at, created_at, updated_at
        ",
    )
    .bind(Uuid::new_v4())
    .bind(email)
    .bind(name)
    .bind(password_hash)
    .bind(role)
    .bind(tenant_id)
    .fetch_one(pool)
    .await
}

/// Get a user by phone number
pub async fn get_user_by_phone(pool: &PgPool, phone: &str) -> Result<Option<User>, sqlx::Error> {
    sqlx::query_as::<_, User>(
        r"
        SELECT id, email, name, password_hash, avatar_url, phone_number, phone_verified, job_title, department, bio, role,
               tenant_id, onboarding_completed, last_login_at, deleted_at, created_at, updated_at
        FROM users
        WHERE phone_number = $1 AND deleted_at IS NULL
        ",
    )
    .bind(phone)
    .fetch_optional(pool)
    .await
}

/// Create a password reset token
pub async fn create_password_reset_token(
    pool: &PgPool,
    user_id: Uuid,
    token_hash: &str,
    expires_at: DateTime<Utc>,
) -> Result<Uuid, sqlx::Error> {
    let id = Uuid::new_v4();
    sqlx::query(
        r"
        INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
        VALUES ($1, $2, $3, $4)
        ",
    )
    .bind(id)
    .bind(user_id)
    .bind(token_hash)
    .bind(expires_at)
    .execute(pool)
    .await?;
    Ok(id)
}

/// Find a valid (unexpired, unused) password reset token by hash
pub async fn get_valid_reset_token(
    pool: &PgPool,
    token_hash: &str,
) -> Result<Option<(Uuid, Uuid)>, sqlx::Error> {
    // Returns (token_id, user_id)
    let row = sqlx::query_as::<_, (Uuid, Uuid)>(
        r"
        SELECT id, user_id FROM password_reset_tokens
        WHERE token_hash = $1 AND expires_at > NOW() AND used_at IS NULL
        ",
    )
    .bind(token_hash)
    .fetch_optional(pool)
    .await?;
    Ok(row)
}

/// Mark a password reset token as used
pub async fn mark_reset_token_used(pool: &PgPool, token_id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1")
        .bind(token_id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Update a user's password hash
pub async fn update_user_password(
    pool: &PgPool,
    user_id: Uuid,
    new_password_hash: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2")
        .bind(new_password_hash)
        .bind(user_id)
        .execute(pool)
        .await?;
    Ok(())
}
