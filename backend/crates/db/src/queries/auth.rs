use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{RefreshToken, User};

/// Get a user by email address
pub async fn get_user_by_email(pool: &PgPool, email: &str) -> Result<Option<User>, sqlx::Error> {
    sqlx::query_as::<_, User>(
        r#"
        SELECT id, email, name, password_hash, avatar_url, phone_number, role,
               tenant_id, onboarding_completed, deleted_at, created_at, updated_at
        FROM users
        WHERE email = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(email)
    .fetch_optional(pool)
    .await
}

/// Get a user by ID
pub async fn get_user_by_id(pool: &PgPool, user_id: Uuid) -> Result<Option<User>, sqlx::Error> {
    sqlx::query_as::<_, User>(
        r#"
        SELECT id, email, name, password_hash, avatar_url, phone_number, role,
               tenant_id, onboarding_completed, deleted_at, created_at, updated_at
        FROM users
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
}

/// Create a new refresh token record
pub async fn create_refresh_token(
    pool: &PgPool,
    user_id: Uuid,
    token_hash: &str,
    expires_at: DateTime<Utc>,
) -> Result<Uuid, sqlx::Error> {
    let id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        "#,
    )
    .bind(id)
    .bind(user_id)
    .bind(token_hash)
    .bind(expires_at)
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
        r#"
        SELECT id, user_id, token_hash, expires_at, revoked_at, created_at
        FROM refresh_tokens
        WHERE id = $1
        "#,
    )
    .bind(token_id)
    .fetch_optional(pool)
    .await
}

/// Revoke a refresh token
pub async fn revoke_refresh_token(pool: &PgPool, token_id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE refresh_tokens
        SET revoked_at = NOW()
        WHERE id = $1
        "#,
    )
    .bind(token_id)
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
        r#"
        INSERT INTO users (id, email, name, password_hash, role, tenant_id, onboarding_completed, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, false, NOW(), NOW())
        RETURNING id, email, name, password_hash, avatar_url, phone_number, role,
                  tenant_id, onboarding_completed, deleted_at, created_at, updated_at
        "#,
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
