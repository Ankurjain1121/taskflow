//! Comment REST routes
//!
//! Provides CRUD endpoints for task comments with @mention extraction and real-time broadcasting.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    middleware::from_fn_with_state,
    routing::{delete, get, post, put},
    Json, Router,
};
use once_cell::sync::Lazy;
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::auth_middleware;
use crate::services::ActivityLogService;
use crate::state::AppState;
use taskflow_db::queries::comments::{
    create_comment, delete_comment, get_comment_author_id, get_comment_task_id,
    list_comments_by_task, update_comment, CommentWithAuthor,
};
use taskflow_db::queries::get_task_board_id;
use taskflow_services::broadcast::events;
use taskflow_services::BroadcastService;

/// Regex for extracting @mentions in format @[username](userId)
static MENTION_REGEX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"@\[([^\]]+)\]\(([a-f0-9-]+)\)").unwrap());

/// Response for listing comments
#[derive(Serialize)]
pub struct ListCommentsResponse {
    pub comments: Vec<CommentWithAuthor>,
}

/// Request body for creating a comment
#[derive(Deserialize)]
pub struct CreateCommentRequest {
    pub content: String,
    pub parent_id: Option<Uuid>,
}

/// Request body for updating a comment
#[derive(Deserialize)]
pub struct UpdateCommentRequest {
    pub content: String,
}

/// Extract mentioned user IDs from comment content
///
/// Parses @[username](userId) patterns and returns the user UUIDs
fn extract_mentioned_user_ids(content: &str) -> Vec<Uuid> {
    MENTION_REGEX
        .captures_iter(content)
        .filter_map(|cap| {
            cap.get(2)
                .and_then(|m| Uuid::parse_str(m.as_str()).ok())
        })
        .collect()
}

/// GET /api/tasks/:task_id/comments
///
/// List all comments for a task with author information
async fn list_comments_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
) -> Result<Json<ListCommentsResponse>> {
    // Verify user has access to the task's board
    let board_id = get_task_board_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    verify_board_membership(&state, board_id, tenant.user_id).await?;

    let comments = list_comments_by_task(&state.db, task_id)
        .await
        .map_err(|e| match e {
            taskflow_db::queries::comments::CommentQueryError::Database(e) => {
                AppError::SqlxError(e)
            }
            taskflow_db::queries::comments::CommentQueryError::NotFound => {
                AppError::NotFound("Comments not found".into())
            }
            taskflow_db::queries::comments::CommentQueryError::NotAuthorized => {
                AppError::Forbidden("Not authorized".into())
            }
        })?;

    Ok(Json(ListCommentsResponse { comments }))
}

/// POST /api/tasks/:task_id/comments
///
/// Create a new comment on a task with @mention extraction
async fn create_comment_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
    Json(body): Json<CreateCommentRequest>,
) -> Result<(StatusCode, Json<CommentWithAuthor>)> {
    // Verify user has access to the task's board
    let board_id = get_task_board_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    verify_board_membership(&state, board_id, tenant.user_id).await?;

    // Extract mentioned user IDs from content
    let mentioned_user_ids = extract_mentioned_user_ids(&body.content);

    // Create the comment
    let comment = create_comment(
        &state.db,
        task_id,
        tenant.user_id,
        &body.content,
        body.parent_id,
        &mentioned_user_ids,
    )
    .await
    .map_err(|e| match e {
        taskflow_db::queries::comments::CommentQueryError::Database(e) => AppError::SqlxError(e),
        taskflow_db::queries::comments::CommentQueryError::NotFound => {
            AppError::NotFound("Task not found".into())
        }
        taskflow_db::queries::comments::CommentQueryError::NotAuthorized => {
            AppError::Forbidden("Not authorized".into())
        }
    })?;

    // Record activity log entry (fire and forget)
    let db = state.db.clone();
    let comment_id = comment.id;
    tokio::spawn(async move {
        if let Err(e) =
            ActivityLogService::record_commented(&db, task_id, tenant.user_id, tenant.tenant_id, comment_id)
                .await
        {
            tracing::error!("Failed to record comment activity: {}", e);
        }
    });

    // Broadcast comment created event via Redis pub/sub
    let broadcast_service = BroadcastService::new(state.redis.clone());
    let comment_clone = comment.clone();
    tokio::spawn(async move {
        if let Err(e) = broadcast_service
            .broadcast_board_update(
                board_id,
                events::COMMENT_CREATED,
                json!({
                    "task_id": task_id,
                    "comment": {
                        "id": comment_clone.id,
                        "content": comment_clone.content,
                        "author_id": comment_clone.author_id,
                        "author_name": comment_clone.author_name,
                        "author_avatar_url": comment_clone.author_avatar_url,
                        "parent_id": comment_clone.parent_id,
                        "mentioned_user_ids": comment_clone.mentioned_user_ids,
                        "created_at": comment_clone.created_at,
                    }
                }),
            )
            .await
        {
            tracing::error!("Failed to broadcast comment created event: {}", e);
        }
    });

    // Send notifications for mentions (fire and forget)
    if !mentioned_user_ids.is_empty() {
        let broadcast_service = BroadcastService::new(state.redis.clone());
        let author_id = tenant.user_id;
        let comment_id = comment.id;
        tokio::spawn(async move {
            for user_id in mentioned_user_ids {
                if user_id != author_id {
                    if let Err(e) = broadcast_service
                        .broadcast_user_update(
                            user_id,
                            "mention-in-comment",
                            json!({
                                "task_id": task_id,
                                "comment_id": comment_id,
                                "mentioned_by": author_id
                            }),
                        )
                        .await
                    {
                        tracing::error!("Failed to send mention notification to {}: {}", user_id, e);
                    }
                }
            }
        });
    }

    // Send notifications to task assignees (fire and forget)
    let db = state.db.clone();
    let redis = state.redis.clone();
    let author_id = tenant.user_id;
    let comment_id = comment.id;
    tokio::spawn(async move {
        // Get task assignees
        let assignee_ids = taskflow_db::queries::get_task_assignee_ids(&db, task_id)
            .await
            .unwrap_or_default();

        let broadcast_service = BroadcastService::new(redis);
        for assignee_id in assignee_ids {
            if assignee_id != author_id {
                if let Err(e) = broadcast_service
                    .broadcast_user_update(
                        assignee_id,
                        "task-commented",
                        json!({
                            "task_id": task_id,
                            "comment_id": comment_id,
                            "commented_by": author_id
                        }),
                    )
                    .await
                {
                    tracing::error!(
                        "Failed to send task-commented notification to {}: {}",
                        assignee_id,
                        e
                    );
                }
            }
        }
    });

    Ok((StatusCode::CREATED, Json(comment)))
}

/// PUT /api/comments/:id
///
/// Update an existing comment (owner only)
async fn update_comment_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(comment_id): Path<Uuid>,
    Json(body): Json<UpdateCommentRequest>,
) -> Result<Json<CommentWithAuthor>> {
    // Verify ownership
    let author_id = get_comment_author_id(&state.db, comment_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Comment not found".into()))?;

    if author_id != tenant.user_id {
        return Err(AppError::Forbidden(
            "You can only update your own comments".into(),
        ));
    }

    // Verify user has access to the task's board
    let task_id = get_comment_task_id(&state.db, comment_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Comment not found".into()))?;

    let board_id = get_task_board_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    verify_board_membership(&state, board_id, tenant.user_id).await?;

    // Extract mentioned user IDs from updated content
    let mentioned_user_ids = extract_mentioned_user_ids(&body.content);

    // Update the comment
    let comment = update_comment(&state.db, comment_id, &body.content, &mentioned_user_ids)
        .await
        .map_err(|e| match e {
            taskflow_db::queries::comments::CommentQueryError::Database(e) => {
                AppError::SqlxError(e)
            }
            taskflow_db::queries::comments::CommentQueryError::NotFound => {
                AppError::NotFound("Comment not found".into())
            }
            taskflow_db::queries::comments::CommentQueryError::NotAuthorized => {
                AppError::Forbidden("Not authorized".into())
            }
        })?;

    Ok(Json(comment))
}

/// DELETE /api/comments/:id
///
/// Delete a comment (owner only)
async fn delete_comment_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(comment_id): Path<Uuid>,
) -> Result<StatusCode> {
    // Verify ownership
    let author_id = get_comment_author_id(&state.db, comment_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Comment not found".into()))?;

    if author_id != tenant.user_id {
        return Err(AppError::Forbidden(
            "You can only delete your own comments".into(),
        ));
    }

    // Verify user has access to the task's board
    let task_id = get_comment_task_id(&state.db, comment_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Comment not found".into()))?;

    let board_id = get_task_board_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    verify_board_membership(&state, board_id, tenant.user_id).await?;

    // Delete the comment
    delete_comment(&state.db, comment_id)
        .await
        .map_err(|e| match e {
            taskflow_db::queries::comments::CommentQueryError::Database(e) => {
                AppError::SqlxError(e)
            }
            taskflow_db::queries::comments::CommentQueryError::NotFound => {
                AppError::NotFound("Comment not found".into())
            }
            taskflow_db::queries::comments::CommentQueryError::NotAuthorized => {
                AppError::Forbidden("Not authorized".into())
            }
        })?;

    Ok(StatusCode::NO_CONTENT)
}

/// Helper to verify board membership
async fn verify_board_membership(
    state: &AppState,
    board_id: Uuid,
    user_id: Uuid,
) -> Result<()> {
    let is_member = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM board_members
            WHERE board_id = $1 AND user_id = $2
        ) as "exists!"
        "#,
        board_id,
        user_id
    )
    .fetch_one(&state.db)
    .await?;

    if !is_member {
        return Err(AppError::Forbidden("Not a board member".into()));
    }

    Ok(())
}

/// Create the comment router
pub fn comment_router(state: AppState) -> Router<AppState> {
    Router::new()
        // Task-scoped comment routes
        .route("/tasks/{task_id}/comments", get(list_comments_handler))
        .route("/tasks/{task_id}/comments", post(create_comment_handler))
        // Comment-specific routes
        .route("/comments/{id}", put(update_comment_handler))
        .route("/comments/{id}", delete(delete_comment_handler))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_mentioned_user_ids() {
        let content = "Hello @[John Doe](550e8400-e29b-41d4-a716-446655440000) and @[Jane](550e8400-e29b-41d4-a716-446655440001)!";
        let ids = extract_mentioned_user_ids(content);
        assert_eq!(ids.len(), 2);
        assert_eq!(
            ids[0],
            Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap()
        );
        assert_eq!(
            ids[1],
            Uuid::parse_str("550e8400-e29b-41d4-a716-446655440001").unwrap()
        );
    }

    #[test]
    fn test_extract_mentioned_user_ids_no_mentions() {
        let content = "Hello world! No mentions here.";
        let ids = extract_mentioned_user_ids(content);
        assert!(ids.is_empty());
    }

    #[test]
    fn test_extract_mentioned_user_ids_invalid_uuid() {
        let content = "Hello @[John](not-a-uuid) and @[Jane](550e8400-e29b-41d4-a716-446655440001)!";
        let ids = extract_mentioned_user_ids(content);
        assert_eq!(ids.len(), 1);
        assert_eq!(
            ids[0],
            Uuid::parse_str("550e8400-e29b-41d4-a716-446655440001").unwrap()
        );
    }
}
