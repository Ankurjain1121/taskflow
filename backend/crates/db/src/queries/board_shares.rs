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
        use sha2::{Digest, Sha256};
        let salt = Uuid::new_v4().to_string();
        let mut hasher = Sha256::new();
        hasher.update(format!("{}:{}", salt, p));
        format!("{}:{:x}", salt, hasher.finalize())
    });

    let permissions = input
        .permissions
        .unwrap_or_else(|| serde_json::json!({"view_tasks": true, "view_comments": false}));

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
    let board_id =
        sqlx::query_scalar::<_, Uuid>(r#"SELECT board_id FROM board_shares WHERE id = $1"#)
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
    let board_id =
        sqlx::query_scalar::<_, Uuid>(r#"SELECT board_id FROM board_shares WHERE id = $1"#)
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
        use sha2::{Digest, Sha256};
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
    let view_tasks = share
        .permissions
        .get("view_tasks")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);

    let tasks = if view_tasks {
        sqlx::query_as::<_, SharedTask>(
            r#"
            SELECT t.id, t.title, t.description,
                   t.priority,
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::queries::{auth, boards, workspaces};
    use sqlx::PgPool;

    const FAKE_HASH: &str = "$argon2id$v=19$m=19456,t=2,p=1$fake_salt$fake_hash_for_test";

    fn unique_email() -> String {
        format!("inttest-bshare-{}@example.com", Uuid::new_v4())
    }

    async fn test_pool() -> PgPool {
        PgPool::connect(
            "postgresql://taskflow:189015388bb0f90c999ea6b975d7e494@localhost:5433/taskflow",
        )
        .await
        .expect("Failed to connect to test database")
    }

    async fn setup_user(pool: &PgPool) -> (Uuid, Uuid) {
        let user =
            auth::create_user_with_tenant(pool, &unique_email(), "BoardShare User", FAKE_HASH)
                .await
                .expect("create_user_with_tenant");
        (user.tenant_id, user.id)
    }

    async fn setup_user_and_workspace(pool: &PgPool) -> (Uuid, Uuid, Uuid) {
        let (tenant_id, user_id) = setup_user(pool).await;
        let ws = workspaces::create_workspace(pool, "BoardShare WS", None, tenant_id, user_id)
            .await
            .expect("create_workspace");
        (tenant_id, user_id, ws.id)
    }

    async fn setup_full(pool: &PgPool) -> (Uuid, Uuid, Uuid, Uuid, Uuid) {
        let (tenant_id, user_id, ws_id) = setup_user_and_workspace(pool).await;
        let bwc = boards::create_board(pool, "BoardShare Board", None, ws_id, tenant_id, user_id)
            .await
            .expect("create_board");
        let first_col_id = bwc.columns[0].id;
        (tenant_id, user_id, ws_id, bwc.board.id, first_col_id)
    }

    #[tokio::test]
    async fn test_create_share_link() {
        let pool = test_pool().await;
        let (tenant_id, user_id, _ws_id, board_id, _col_id) = setup_full(&pool).await;

        let input = CreateBoardShareInput {
            name: Some("My Share Link".to_string()),
            password: None,
            expires_at: None,
            permissions: None,
        };

        let share = create_board_share(&pool, board_id, input, user_id, tenant_id)
            .await
            .expect("create_board_share should succeed");

        assert_eq!(share.board_id, board_id);
        assert_eq!(share.name.as_deref(), Some("My Share Link"));
        assert!(share.is_active);
        assert!(share.password_hash.is_none());
        assert!(share.expires_at.is_none());
        assert!(!share.share_token.is_empty());
        assert_eq!(share.tenant_id, tenant_id);
        assert_eq!(share.created_by_id, user_id);
    }

    #[tokio::test]
    async fn test_access_shared_board() {
        let pool = test_pool().await;
        let (tenant_id, user_id, _ws_id, board_id, _col_id) = setup_full(&pool).await;

        let input = CreateBoardShareInput {
            name: Some("Access Test".to_string()),
            password: None,
            expires_at: None,
            permissions: Some(serde_json::json!({"view_tasks": true, "view_comments": true})),
        };

        let share = create_board_share(&pool, board_id, input, user_id, tenant_id)
            .await
            .expect("create_board_share");

        let access = access_shared_board(&pool, &share.share_token, None)
            .await
            .expect("access_shared_board should succeed");

        assert_eq!(access.board_id, board_id);
        assert_eq!(access.board_name, "BoardShare Board");
        assert!(!access.columns.is_empty(), "should have columns");
    }

    #[tokio::test]
    async fn test_access_shared_board_with_password() {
        let pool = test_pool().await;
        let (tenant_id, user_id, _ws_id, board_id, _col_id) = setup_full(&pool).await;

        let input = CreateBoardShareInput {
            name: Some("Password Protected".to_string()),
            password: Some("secret123".to_string()),
            expires_at: None,
            permissions: None,
        };

        let share = create_board_share(&pool, board_id, input, user_id, tenant_id)
            .await
            .expect("create_board_share with password");

        // Access with correct password should succeed
        let access = access_shared_board(&pool, &share.share_token, Some("secret123"))
            .await
            .expect("access with correct password should succeed");
        assert_eq!(access.board_id, board_id);

        // Access with wrong password should fail
        let result = access_shared_board(&pool, &share.share_token, Some("wrongpass")).await;
        assert!(result.is_err(), "wrong password should fail");

        // Access without password should fail
        let result = access_shared_board(&pool, &share.share_token, None).await;
        assert!(result.is_err(), "no password should fail");
    }

    #[tokio::test]
    async fn test_toggle_share() {
        let pool = test_pool().await;
        let (tenant_id, user_id, _ws_id, board_id, _col_id) = setup_full(&pool).await;

        let input = CreateBoardShareInput {
            name: None,
            password: None,
            expires_at: None,
            permissions: None,
        };

        let share = create_board_share(&pool, board_id, input, user_id, tenant_id)
            .await
            .expect("create_board_share");
        assert!(share.is_active, "should start active");

        // Deactivate
        let toggled = toggle_board_share(&pool, share.id, false, user_id)
            .await
            .expect("toggle_board_share to deactivate");
        assert!(!toggled.is_active, "should be inactive after toggle off");

        // Accessing an inactive share should fail
        let result = access_shared_board(&pool, &share.share_token, None).await;
        assert!(result.is_err(), "accessing inactive share should fail");

        // Reactivate
        let reactivated = toggle_board_share(&pool, share.id, true, user_id)
            .await
            .expect("toggle_board_share to reactivate");
        assert!(reactivated.is_active, "should be active after reactivation");

        // Access should work again
        let access = access_shared_board(&pool, &share.share_token, None)
            .await
            .expect("accessing reactivated share should succeed");
        assert_eq!(access.board_id, board_id);
    }

    #[tokio::test]
    async fn test_delete_share() {
        let pool = test_pool().await;
        let (tenant_id, user_id, _ws_id, board_id, _col_id) = setup_full(&pool).await;

        let input = CreateBoardShareInput {
            name: Some("Delete Me".to_string()),
            password: None,
            expires_at: None,
            permissions: None,
        };

        let share = create_board_share(&pool, board_id, input, user_id, tenant_id)
            .await
            .expect("create_board_share");

        delete_board_share(&pool, share.id, user_id)
            .await
            .expect("delete_board_share should succeed");

        // Accessing a deleted share should fail with InvalidToken
        let result = access_shared_board(&pool, &share.share_token, None).await;
        assert!(result.is_err(), "accessing deleted share should fail");
    }

    #[tokio::test]
    async fn test_list_board_shares() {
        let pool = test_pool().await;
        let (tenant_id, user_id, _ws_id, board_id, _col_id) = setup_full(&pool).await;

        create_board_share(
            &pool,
            board_id,
            CreateBoardShareInput {
                name: Some("Share A".to_string()),
                password: None,
                expires_at: None,
                permissions: None,
            },
            user_id,
            tenant_id,
        )
        .await
        .expect("create share A");

        create_board_share(
            &pool,
            board_id,
            CreateBoardShareInput {
                name: Some("Share B".to_string()),
                password: None,
                expires_at: None,
                permissions: None,
            },
            user_id,
            tenant_id,
        )
        .await
        .expect("create share B");

        let shares = list_board_shares(&pool, board_id, user_id)
            .await
            .expect("list_board_shares should succeed");

        assert!(shares.len() >= 2, "should have at least 2 shares");
        let names: Vec<Option<&str>> = shares.iter().map(|s| s.name.as_deref()).collect();
        assert!(names.contains(&Some("Share A")), "should contain share A");
        assert!(names.contains(&Some("Share B")), "should contain share B");
    }

    #[tokio::test]
    async fn test_expired_share_access() {
        let pool = test_pool().await;
        let (tenant_id, user_id, _ws_id, board_id, _col_id) = setup_full(&pool).await;

        // Create a share that has already expired
        let input = CreateBoardShareInput {
            name: Some("Expired Share".to_string()),
            password: None,
            expires_at: Some(Utc::now() - chrono::Duration::hours(1)),
            permissions: None,
        };

        let share = create_board_share(&pool, board_id, input, user_id, tenant_id)
            .await
            .expect("create expired share");

        let result = access_shared_board(&pool, &share.share_token, None).await;
        assert!(result.is_err(), "accessing expired share should fail");
    }
}
