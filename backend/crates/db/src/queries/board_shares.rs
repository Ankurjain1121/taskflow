use chrono::{DateTime, Utc};
use serde::Deserialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::BoardShare;

/// Error type for board share query operations
#[derive(Debug, thiserror::Error)]
pub enum BoardShareQueryError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("User is not a member of this board")]
    NotBoardMember,
    #[error("Board share not found")]
    NotFound,
    #[error("Invalid share token")]
    InvalidToken,
    #[error("Share link has expired")]
    Expired,
    #[error("Share link is inactive")]
    Inactive,
    #[error("Invalid password")]
    InvalidPassword,
}

/// Input for creating a board share link
#[derive(Debug, Deserialize)]
pub struct CreateBoardShareInput {
    pub name: Option<String>,
    pub password: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
    pub permissions: Option<serde_json::Value>,
}

/// Internal helper: verify board membership
async fn verify_board_membership_internal(
    pool: &PgPool,
    board_id: Uuid,
    user_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM board_members
            WHERE board_id = $1 AND user_id = $2
        )
        "#,
    )
    .bind(board_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    Ok(result)
}

/// Generate a unique share token using UUIDs
fn generate_share_token() -> String {
    // Concatenate two UUID v4s for a 64-char hex token
    let a = Uuid::new_v4().simple().to_string();
    let b = Uuid::new_v4().simple().to_string();
    format!("{}{}", a, b)
}

/// List all share links for a board.
/// Verifies board membership.
pub async fn list_board_shares(
    pool: &PgPool,
    board_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<BoardShare>, BoardShareQueryError> {
    if !verify_board_membership_internal(pool, board_id, user_id).await? {
        return Err(BoardShareQueryError::NotBoardMember);
    }

    let shares = sqlx::query_as::<_, BoardShare>(
        r#"
        SELECT id, board_id, share_token, name, password_hash,
               expires_at, is_active, permissions, tenant_id,
               created_by_id, created_at
        FROM board_shares
        WHERE board_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(board_id)
    .fetch_all(pool)
    .await?;

    Ok(shares)
}

/// Create a new share link for a board.
/// Verifies board membership.
pub async fn create_board_share(
    pool: &PgPool,
    board_id: Uuid,
    input: CreateBoardShareInput,
    user_id: Uuid,
    tenant_id: Uuid,
) -> Result<BoardShare, BoardShareQueryError> {
    if !verify_board_membership_internal(pool, board_id, user_id).await? {
        return Err(BoardShareQueryError::NotBoardMember);
    }

    let id = Uuid::new_v4();
    let token = generate_share_token();
    let now = Utc::now();

    // Salted SHA-256 hash for share link password
    let password_hash = input.password.as_ref().map(|p| {
        use sha2::{Sha256, Digest};
        let salt = Uuid::new_v4().to_string();
        let mut hasher = Sha256::new();
        hasher.update(format!("{}:{}", salt, p));
        format!("{}:{:x}", salt, hasher.finalize())
    });

    let permissions = input.permissions.unwrap_or_else(|| {
        serde_json::json!({"view_tasks": true, "view_comments": false})
    });

    let share = sqlx::query_as::<_, BoardShare>(
        r#"
        INSERT INTO board_shares (
            id, board_id, share_token, name, password_hash,
            expires_at, is_active, permissions, tenant_id,
            created_by_id, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9, $10)
        RETURNING id, board_id, share_token, name, password_hash,
                  expires_at, is_active, permissions, tenant_id,
                  created_by_id, created_at
        "#,
    )
    .bind(id)
    .bind(board_id)
    .bind(&token)
    .bind(&input.name)
    .bind(&password_hash)
    .bind(input.expires_at)
    .bind(&permissions)
    .bind(tenant_id)
    .bind(user_id)
    .bind(now)
    .fetch_one(pool)
    .await?;

    Ok(share)
}

/// Delete a board share link.
/// Verifies board membership.
pub async fn delete_board_share(
    pool: &PgPool,
    share_id: Uuid,
    user_id: Uuid,
) -> Result<(), BoardShareQueryError> {
    // Get share to find board_id
    let board_id = sqlx::query_scalar::<_, Uuid>(
        r#"SELECT board_id FROM board_shares WHERE id = $1"#,
    )
    .bind(share_id)
    .fetch_optional(pool)
    .await?
    .ok_or(BoardShareQueryError::NotFound)?;

    if !verify_board_membership_internal(pool, board_id, user_id).await? {
        return Err(BoardShareQueryError::NotBoardMember);
    }

    sqlx::query(r#"DELETE FROM board_shares WHERE id = $1"#)
        .bind(share_id)
        .execute(pool)
        .await?;

    Ok(())
}

/// Toggle active status of a share link.
pub async fn toggle_board_share(
    pool: &PgPool,
    share_id: Uuid,
    is_active: bool,
    user_id: Uuid,
) -> Result<BoardShare, BoardShareQueryError> {
    let board_id = sqlx::query_scalar::<_, Uuid>(
        r#"SELECT board_id FROM board_shares WHERE id = $1"#,
    )
    .bind(share_id)
    .fetch_optional(pool)
    .await?
    .ok_or(BoardShareQueryError::NotFound)?;

    if !verify_board_membership_internal(pool, board_id, user_id).await? {
        return Err(BoardShareQueryError::NotBoardMember);
    }

    let share = sqlx::query_as::<_, BoardShare>(
        r#"
        UPDATE board_shares SET is_active = $2
        WHERE id = $1
        RETURNING id, board_id, share_token, name, password_hash,
                  expires_at, is_active, permissions, tenant_id,
                  created_by_id, created_at
        "#,
    )
    .bind(share_id)
    .bind(is_active)
    .fetch_one(pool)
    .await?;

    Ok(share)
}

/// Public: Access a shared board by token.
/// Validates token, expiry, active status, and optional password.
pub async fn access_shared_board(
    pool: &PgPool,
    token: &str,
    password: Option<&str>,
) -> Result<SharedBoardAccess, BoardShareQueryError> {
    let share = sqlx::query_as::<_, BoardShare>(
        r#"
        SELECT id, board_id, share_token, name, password_hash,
               expires_at, is_active, permissions, tenant_id,
               created_by_id, created_at
        FROM board_shares
        WHERE share_token = $1
        "#,
    )
    .bind(token)
    .fetch_optional(pool)
    .await?
    .ok_or(BoardShareQueryError::InvalidToken)?;

    // Check active
    if !share.is_active {
        return Err(BoardShareQueryError::Inactive);
    }

    // Check expiry
    if let Some(expires_at) = share.expires_at {
        if Utc::now() > expires_at {
            return Err(BoardShareQueryError::Expired);
        }
    }

    // Check password
    if let Some(ref hash) = share.password_hash {
        let provided = password.ok_or(BoardShareQueryError::InvalidPassword)?;
        use sha2::{Sha256, Digest};
        let parts: Vec<&str> = hash.splitn(2, ':').collect();
        if parts.len() != 2 {
            return Err(BoardShareQueryError::InvalidPassword);
        }
        let salt = parts[0];
        let stored_hash = parts[1];
        let mut hasher = Sha256::new();
        hasher.update(format!("{}:{}", salt, provided));
        let computed = format!("{:x}", hasher.finalize());
        if computed != stored_hash {
            return Err(BoardShareQueryError::InvalidPassword);
        }
    }

    // Fetch board info
    let board_name = sqlx::query_scalar::<_, String>(
        r#"SELECT name FROM boards WHERE id = $1 AND deleted_at IS NULL"#,
    )
    .bind(share.board_id)
    .fetch_optional(pool)
    .await?
    .ok_or(BoardShareQueryError::NotFound)?;

    // Fetch columns
    let columns = sqlx::query_as::<_, SharedColumn>(
        r#"
        SELECT id, name, position, color
        FROM board_columns
        WHERE board_id = $1
        ORDER BY position ASC
        "#,
    )
    .bind(share.board_id)
    .fetch_all(pool)
    .await?;

    // Fetch tasks (only if view_tasks is allowed)
    let view_tasks = share.permissions
        .get("view_tasks")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);

    let tasks = if view_tasks {
        sqlx::query_as::<_, SharedTask>(
            r#"
            SELECT t.id, t.title, t.description,
                   t.priority as "priority: TaskPriority",
                   t.due_date, t.column_id, c.name as column_name
            FROM tasks t
            JOIN board_columns c ON c.id = t.column_id
            WHERE t.board_id = $1 AND t.deleted_at IS NULL
            ORDER BY t.position ASC
            "#,
        )
        .bind(share.board_id)
        .fetch_all(pool)
        .await?
    } else {
        vec![]
    };

    Ok(SharedBoardAccess {
        board_id: share.board_id,
        board_name,
        permissions: share.permissions,
        columns,
        tasks,
    })
}

/// Shared column info (public view)
#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct SharedColumn {
    pub id: Uuid,
    pub name: String,
    pub position: String,
    pub color: Option<String>,
}

/// Shared task info (public view)
#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct SharedTask {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub priority: crate::models::TaskPriority,
    pub due_date: Option<DateTime<Utc>>,
    pub column_id: Uuid,
    pub column_name: String,
}

/// Full shared board access response
#[derive(Debug, serde::Serialize)]
pub struct SharedBoardAccess {
    pub board_id: Uuid,
    pub board_name: String,
    pub permissions: serde_json::Value,
    pub columns: Vec<SharedColumn>,
    pub tasks: Vec<SharedTask>,
}
