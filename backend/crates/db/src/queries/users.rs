use chrono::{DateTime, Utc};
use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

use crate::models::{RefreshToken, User, UserRole};

/// Find a user by email address. Returns None if not found or soft-deleted.
pub async fn find_by_email(pool: &PgPool, email: &str) -> Result<Option<User>, sqlx::Error> {
    let user = sqlx::query_as::<_, User>(
        "SELECT id, email, name, password_hash, avatar_url, phone_number, \
                role, tenant_id, onboarding_completed, deleted_at, created_at, updated_at \
         FROM users \
         WHERE email = $1 AND deleted_at IS NULL"
    )
    .bind(email)
    .fetch_optional(pool)
    .await?;

    Ok(user)
}

/// Find a user by ID. Returns None if not found or soft-deleted.
pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<User>, sqlx::Error> {
    let user = sqlx::query_as::<_, User>(
        "SELECT id, email, name, password_hash, avatar_url, phone_number, \
                role, tenant_id, onboarding_completed, deleted_at, created_at, updated_at \
         FROM users \
         WHERE id = $1 AND deleted_at IS NULL"
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;

    Ok(user)
}

/// Create a new user and return the full User row.
pub async fn create_user(
    conn: &mut PgConnection,
    email: &str,
    name: &str,
    password_hash: &str,
    role: UserRole,
    tenant_id: Uuid,
) -> Result<User, sqlx::Error> {
    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (email, name, password_hash, role, tenant_id) \
         VALUES ($1, $2, $3, $4::user_role, $5) \
         RETURNING id, email, name, password_hash, avatar_url, phone_number, \
                   role, tenant_id, onboarding_completed, deleted_at, created_at, updated_at"
    )
    .bind(email)
    .bind(name)
    .bind(password_hash)
    .bind(role.as_str())
    .bind(tenant_id)
    .fetch_one(&mut *conn)
    .await?;

    Ok(user)
}

/// Store a new refresh token row.
pub async fn create_refresh_token(
    pool: &PgPool,
    user_id: Uuid,
    token_hash: &str,
    expires_at: DateTime<Utc>,
) -> Result<RefreshToken, sqlx::Error> {
    let token = sqlx::query_as::<_, RefreshToken>(
        "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) \
         VALUES ($1, $2, $3) \
         RETURNING id, user_id, token_hash, expires_at, revoked_at, created_at"
    )
    .bind(user_id)
    .bind(token_hash)
    .bind(expires_at)
    .fetch_one(pool)
    .await?;

    Ok(token)
}

/// Find a refresh token row by its hash. Returns None if not found.
pub async fn find_refresh_token_by_hash(
    pool: &PgPool,
    hash: &str,
) -> Result<Option<RefreshToken>, sqlx::Error> {
    let token = sqlx::query_as::<_, RefreshToken>(
        "SELECT id, user_id, token_hash, expires_at, revoked_at, created_at \
         FROM refresh_tokens \
         WHERE token_hash = $1"
    )
    .bind(hash)
    .fetch_optional(pool)
    .await?;

    Ok(token)
}

/// Revoke a refresh token by setting revoked_at to now().
pub async fn revoke_refresh_token(pool: &PgPool, id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1"
    )
    .bind(id)
    .execute(pool)
    .await?;

    Ok(())
}

/// Update user profile fields (name and/or avatar_url).
pub async fn update_user_profile(
    pool: &PgPool,
    user_id: Uuid,
    name: Option<&str>,
    avatar_url: Option<&str>,
) -> Result<User, sqlx::Error> {
    let user = sqlx::query_as::<_, User>(
        "UPDATE users \
         SET name = COALESCE($2, name), \
             avatar_url = COALESCE($3, avatar_url), \
             updated_at = now() \
         WHERE id = $1 AND deleted_at IS NULL \
         RETURNING id, email, name, password_hash, avatar_url, phone_number, \
                   role, tenant_id, onboarding_completed, deleted_at, created_at, updated_at"
    )
    .bind(user_id)
    .bind(name)
    .bind(avatar_url)
    .fetch_one(pool)
    .await?;

    Ok(user)
}

/// Update user password hash.
pub async fn update_user_password(
    pool: &PgPool,
    user_id: Uuid,
    password_hash: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE users SET password_hash = $2, updated_at = now() \
         WHERE id = $1 AND deleted_at IS NULL"
    )
    .bind(user_id)
    .bind(password_hash)
    .execute(pool)
    .await?;

    Ok(())
}

/// Helper: convert UserRole to the SQL enum string value.
trait UserRoleExt {
    fn as_str(&self) -> &'static str;
}

impl UserRoleExt for UserRole {
    fn as_str(&self) -> &'static str {
        match self {
            UserRole::Admin => "admin",
            UserRole::Manager => "manager",
            UserRole::Member => "member",
        }
    }
}
