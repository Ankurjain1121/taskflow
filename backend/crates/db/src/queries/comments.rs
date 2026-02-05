//! Comment database queries
//!
//! Provides CRUD operations for task comments with author info and mention support.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::Comment;

/// Error type for comment query operations
#[derive(Debug, thiserror::Error)]
pub enum CommentQueryError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Comment not found")]
    NotFound,
    #[error("Not authorized to modify this comment")]
    NotAuthorized,
}

/// Comment with author information for API responses
#[derive(Debug, Serialize, Clone)]
pub struct CommentWithAuthor {
    pub id: Uuid,
    pub content: String,
    pub task_id: Uuid,
    pub author_id: Uuid,
    pub parent_id: Option<Uuid>,
    pub mentioned_user_ids: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub author_name: String,
    pub author_avatar_url: Option<String>,
}

/// Input for creating a comment
#[derive(Debug, Deserialize)]
pub struct CreateCommentInput {
    pub content: String,
    pub parent_id: Option<Uuid>,
    pub mentioned_user_ids: Vec<Uuid>,
}

/// Input for updating a comment
#[derive(Debug, Deserialize)]
pub struct UpdateCommentInput {
    pub content: String,
    pub mentioned_user_ids: Vec<Uuid>,
}

/// List all comments for a task with author information
///
/// Returns comments ordered by created_at ascending (oldest first)
pub async fn list_comments_by_task(
    pool: &PgPool,
    task_id: Uuid,
) -> Result<Vec<CommentWithAuthor>, CommentQueryError> {
    let comments = sqlx::query_as!(
        CommentWithAuthor,
        r#"
        SELECT
            c.id,
            c.content,
            c.task_id,
            c.author_id,
            c.parent_id,
            c.mentioned_user_ids,
            c.created_at,
            c.updated_at,
            u.name as author_name,
            u.avatar_url as author_avatar_url
        FROM comments c
        JOIN users u ON u.id = c.author_id
        WHERE c.task_id = $1 AND c.deleted_at IS NULL
        ORDER BY c.created_at ASC
        "#,
        task_id
    )
    .fetch_all(pool)
    .await?;

    Ok(comments)
}

/// Create a new comment on a task
pub async fn create_comment(
    pool: &PgPool,
    task_id: Uuid,
    author_id: Uuid,
    content: &str,
    parent_id: Option<Uuid>,
    mentioned_user_ids: &[Uuid],
) -> Result<CommentWithAuthor, CommentQueryError> {
    let comment_id = Uuid::new_v4();
    let mentioned_ids_json = serde_json::to_value(mentioned_user_ids)
        .unwrap_or_else(|_| serde_json::json!([]));

    let comment = sqlx::query_as!(
        CommentWithAuthor,
        r#"
        WITH inserted AS (
            INSERT INTO comments (id, content, task_id, author_id, parent_id, mentioned_user_ids)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, content, task_id, author_id, parent_id, mentioned_user_ids, created_at, updated_at
        )
        SELECT
            i.id,
            i.content,
            i.task_id,
            i.author_id,
            i.parent_id,
            i.mentioned_user_ids,
            i.created_at,
            i.updated_at,
            u.name as author_name,
            u.avatar_url as author_avatar_url
        FROM inserted i
        JOIN users u ON u.id = i.author_id
        "#,
        comment_id,
        content,
        task_id,
        author_id,
        parent_id,
        mentioned_ids_json
    )
    .fetch_one(pool)
    .await?;

    Ok(comment)
}

/// Update an existing comment
///
/// Re-extracts mentioned_user_ids and updates content
pub async fn update_comment(
    pool: &PgPool,
    comment_id: Uuid,
    content: &str,
    mentioned_user_ids: &[Uuid],
) -> Result<CommentWithAuthor, CommentQueryError> {
    let mentioned_ids_json = serde_json::to_value(mentioned_user_ids)
        .unwrap_or_else(|_| serde_json::json!([]));

    let comment = sqlx::query_as!(
        CommentWithAuthor,
        r#"
        WITH updated AS (
            UPDATE comments
            SET content = $2, mentioned_user_ids = $3, updated_at = NOW()
            WHERE id = $1 AND deleted_at IS NULL
            RETURNING id, content, task_id, author_id, parent_id, mentioned_user_ids, created_at, updated_at
        )
        SELECT
            u.id,
            u.content,
            u.task_id,
            u.author_id,
            u.parent_id,
            u.mentioned_user_ids,
            u.created_at,
            u.updated_at,
            usr.name as author_name,
            usr.avatar_url as author_avatar_url
        FROM updated u
        JOIN users usr ON usr.id = u.author_id
        "#,
        comment_id,
        content,
        mentioned_ids_json
    )
    .fetch_optional(pool)
    .await?
    .ok_or(CommentQueryError::NotFound)?;

    Ok(comment)
}

/// Soft delete a comment
pub async fn delete_comment(pool: &PgPool, comment_id: Uuid) -> Result<(), CommentQueryError> {
    let rows_affected = sqlx::query!(
        r#"
        UPDATE comments
        SET deleted_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        "#,
        comment_id
    )
    .execute(pool)
    .await?
    .rows_affected();

    if rows_affected == 0 {
        return Err(CommentQueryError::NotFound);
    }

    Ok(())
}

/// Get a comment by ID
pub async fn get_comment_by_id(
    pool: &PgPool,
    comment_id: Uuid,
) -> Result<Option<Comment>, CommentQueryError> {
    let comment = sqlx::query_as!(
        Comment,
        r#"
        SELECT id, content, task_id, author_id, parent_id, mentioned_user_ids, created_at, updated_at
        FROM comments
        WHERE id = $1 AND deleted_at IS NULL
        "#,
        comment_id
    )
    .fetch_optional(pool)
    .await?;

    Ok(comment)
}

/// Get comment's task_id (for authorization checks)
pub async fn get_comment_task_id(
    pool: &PgPool,
    comment_id: Uuid,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar!(
        r#"
        SELECT task_id FROM comments WHERE id = $1 AND deleted_at IS NULL
        "#,
        comment_id
    )
    .fetch_optional(pool)
    .await
}

/// Get comment's author_id (for ownership checks)
pub async fn get_comment_author_id(
    pool: &PgPool,
    comment_id: Uuid,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar!(
        r#"
        SELECT author_id FROM comments WHERE id = $1 AND deleted_at IS NULL
        "#,
        comment_id
    )
    .fetch_optional(pool)
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_comment_input_deserialize() {
        let json = r#"{
            "content": "Test comment @[John](00000000-0000-0000-0000-000000000001)",
            "parent_id": null,
            "mentioned_user_ids": ["00000000-0000-0000-0000-000000000001"]
        }"#;

        let input: CreateCommentInput = serde_json::from_str(json).unwrap();
        assert!(input.content.contains("Test comment"));
        assert_eq!(input.mentioned_user_ids.len(), 1);
    }
}
