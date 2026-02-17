use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{Invitation, UserRole};

/// Create a new invitation
pub async fn create_invitation(
    pool: &PgPool,
    email: &str,
    workspace_id: Uuid,
    role: UserRole,
    invited_by_id: Uuid,
    expires_at: DateTime<Utc>,
) -> Result<Invitation, sqlx::Error> {
    create_invitation_with_details(pool, email, workspace_id, role, invited_by_id, expires_at, None, None).await
}

/// Create a new invitation with optional message and board_ids
#[allow(clippy::too_many_arguments)]
pub async fn create_invitation_with_details(
    pool: &PgPool,
    email: &str,
    workspace_id: Uuid,
    role: UserRole,
    invited_by_id: Uuid,
    expires_at: DateTime<Utc>,
    message: Option<&str>,
    board_ids: Option<&serde_json::Value>,
) -> Result<Invitation, sqlx::Error> {
    let id = Uuid::new_v4();
    let token = Uuid::new_v4();

    sqlx::query_as::<_, Invitation>(
        r#"
        INSERT INTO invitations (id, email, workspace_id, role, token, invited_by_id, expires_at, message, board_ids, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING id, email, workspace_id, role, token, invited_by_id, expires_at, accepted_at, created_at, message, board_ids
        "#,
    )
    .bind(id)
    .bind(email)
    .bind(workspace_id)
    .bind(role)
    .bind(token)
    .bind(invited_by_id)
    .bind(expires_at)
    .bind(message)
    .bind(board_ids)
    .fetch_one(pool)
    .await
}

/// Get an invitation by its token
pub async fn get_invitation_by_token(
    pool: &PgPool,
    token: Uuid,
) -> Result<Option<Invitation>, sqlx::Error> {
    sqlx::query_as::<_, Invitation>(
        r#"
        SELECT id, email, workspace_id, role, token, invited_by_id, expires_at, accepted_at, created_at, message, board_ids
        FROM invitations
        WHERE token = $1
        "#,
    )
    .bind(token)
    .fetch_optional(pool)
    .await
}

/// Accept an invitation (sets accepted_at timestamp)
pub async fn accept_invitation(pool: &PgPool, token: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE invitations
        SET accepted_at = NOW()
        WHERE token = $1 AND accepted_at IS NULL
        "#,
    )
    .bind(token)
    .execute(pool)
    .await?;

    Ok(())
}

/// List pending (not accepted, not expired) invitations for a workspace
pub async fn list_pending_invitations(
    pool: &PgPool,
    workspace_id: Uuid,
) -> Result<Vec<Invitation>, sqlx::Error> {
    sqlx::query_as::<_, Invitation>(
        r#"
        SELECT id, email, workspace_id, role, token, invited_by_id, expires_at, accepted_at, created_at, message, board_ids
        FROM invitations
        WHERE workspace_id = $1
          AND accepted_at IS NULL
          AND expires_at > NOW()
        ORDER BY created_at DESC
        "#,
    )
    .bind(workspace_id)
    .fetch_all(pool)
    .await
}

/// Get workspace details by ID (for invitation acceptance context)
pub async fn get_workspace_tenant_id(
    pool: &PgPool,
    workspace_id: Uuid,
) -> Result<Option<Uuid>, sqlx::Error> {
    let result = sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT tenant_id FROM workspaces WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(workspace_id)
    .fetch_optional(pool)
    .await?;

    Ok(result)
}

/// Add a user to a workspace as a member
pub async fn add_workspace_member(
    pool: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO workspace_members (id, workspace_id, user_id, joined_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (workspace_id, user_id) DO NOTHING
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(workspace_id)
    .bind(user_id)
    .execute(pool)
    .await?;

    Ok(())
}

/// List ALL invitations (pending, accepted, expired) for a workspace
pub async fn list_all_invitations(
    pool: &PgPool,
    workspace_id: Uuid,
) -> Result<Vec<Invitation>, sqlx::Error> {
    sqlx::query_as::<_, Invitation>(
        r#"
        SELECT id, email, workspace_id, role, token, invited_by_id, expires_at, accepted_at, created_at, message, board_ids
        FROM invitations
        WHERE workspace_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(workspace_id)
    .fetch_all(pool)
    .await
}

/// Delete a pending invitation by ID
pub async fn delete_invitation(
    pool: &PgPool,
    id: Uuid,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        r#"
        DELETE FROM invitations
        WHERE id = $1 AND accepted_at IS NULL
        "#,
    )
    .bind(id)
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}

/// Resend an invitation: generates a new token and resets expiry to 7 days from now
pub async fn resend_invitation(
    pool: &PgPool,
    id: Uuid,
    new_expires_at: DateTime<Utc>,
) -> Result<Option<Invitation>, sqlx::Error> {
    let new_token = Uuid::new_v4();

    sqlx::query_as::<_, Invitation>(
        r#"
        UPDATE invitations
        SET token = $1, expires_at = $2, accepted_at = NULL
        WHERE id = $3
        RETURNING id, email, workspace_id, role, token, invited_by_id, expires_at, accepted_at, created_at, message, board_ids
        "#,
    )
    .bind(new_token)
    .bind(new_expires_at)
    .bind(id)
    .fetch_optional(pool)
    .await
}

/// Check if a pending invitation already exists for the given email and workspace
pub async fn get_pending_invitation_by_email(
    pool: &PgPool,
    email: &str,
    workspace_id: Uuid,
) -> Result<Option<Invitation>, sqlx::Error> {
    sqlx::query_as::<_, Invitation>(
        r#"
        SELECT id, email, workspace_id, role, token, invited_by_id, expires_at, accepted_at, created_at, message, board_ids
        FROM invitations
        WHERE email = $1
          AND workspace_id = $2
          AND accepted_at IS NULL
          AND expires_at > NOW()
        "#,
    )
    .bind(email)
    .bind(workspace_id)
    .fetch_optional(pool)
    .await
}
