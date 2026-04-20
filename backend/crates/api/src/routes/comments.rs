//! Comment REST routes
//!
//! Provides CRUD endpoints for task comments with @mention extraction and real-time broadcasting.

use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    middleware::from_fn_with_state,
    routing::{delete, get, post, put},
};
use regex::Regex;
use serde::Serialize;
use serde_json::json;
use std::sync::LazyLock;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::{StrictJson, TenantContext};
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::services::ActivityLogService;
use crate::state::AppState;
use taskbolt_db::queries::comments::{
    CommentWithAuthor, create_comment, delete_comment, get_comment_author_id, get_comment_task_id,
    list_comments_by_task, update_comment,
};
use taskbolt_db::queries::get_task_project_id;
use taskbolt_services::broadcast::events;
use taskbolt_services::notifications::dispatcher::notify;
use taskbolt_services::notifications::{NotificationEvent, NotificationService};
use taskbolt_services::{BroadcastService, NotifyContext};

use super::common::verify_project_membership;
use super::task_helpers::sanitize_html;
use super::validation::{MAX_DESCRIPTION_LEN, validate_required_string};

/// Regex for extracting @mentions in format @[username](userId)
static MENTION_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"@\[([^\]]+)\]\(([a-f0-9-]+)\)").unwrap());

/// Response for listing comments
#[derive(Serialize)]
pub struct ListCommentsResponse {
    pub comments: Vec<CommentWithAuthor>,
}

/// Request body for creating a comment
#[strict_dto_derive::strict_dto]
pub struct CreateCommentRequest {
    pub content: String,
    pub parent_id: Option<Uuid>,
}

/// Request body for updating a comment
#[strict_dto_derive::strict_dto]
pub struct UpdateCommentRequest {
    pub content: String,
}

/// Extract mentioned user IDs from comment content
///
/// Parses @[username](userId) patterns and returns the user UUIDs
fn extract_mentioned_user_ids(content: &str) -> Vec<Uuid> {
    MENTION_REGEX
        .captures_iter(content)
        .filter_map(|cap| cap.get(2).and_then(|m| Uuid::parse_str(m.as_str()).ok()))
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
    // Verify user has access to the task's project
    let project_id = get_task_project_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    verify_project_membership(&state.db, project_id, tenant.user_id, &tenant.role).await?;

    let comments = list_comments_by_task(&state.db, task_id).await?;

    Ok(Json(ListCommentsResponse { comments }))
}

/// POST /api/tasks/:task_id/comments
///
/// Create a new comment on a task with @mention extraction
async fn create_comment_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
    StrictJson(body): StrictJson<CreateCommentRequest>,
) -> Result<(StatusCode, Json<CommentWithAuthor>)> {
    // Verify user has access to the task's project
    let project_id = get_task_project_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    verify_project_membership(&state.db, project_id, tenant.user_id, &tenant.role).await?;

    // Validate comment length
    validate_required_string("Comment", &body.content, MAX_DESCRIPTION_LEN)?;

    // Sanitize and extract mentioned user IDs from content
    let sanitized_content = sanitize_html(&body.content);
    let mentioned_user_ids = extract_mentioned_user_ids(&sanitized_content);

    // Create the comment
    let comment = create_comment(
        &state.db,
        task_id,
        tenant.user_id,
        &sanitized_content,
        body.parent_id,
        &mentioned_user_ids,
    )
    .await?;

    // Record activity log entry (fire and forget)
    let db = state.db.clone();
    let comment_id = comment.id;
    tokio::spawn(async move {
        if let Err(e) = ActivityLogService::record_commented(
            &db,
            task_id,
            tenant.user_id,
            tenant.tenant_id,
            comment_id,
        )
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
            .broadcast_project_update(
                project_id,
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

    // Send notifications for mentions via the dispatcher (fire and forget)
    // This routes through in-app, email, and Slack channels based on user preferences.
    // Only notify mentioned users who are actually members of the task's project.
    if !mentioned_user_ids.is_empty() {
        let mentioned_user_ids =
            taskbolt_db::queries::filter_project_members(&state.db, project_id, &mentioned_user_ids)
                .await
                .unwrap_or_default();
    if !mentioned_user_ids.is_empty() {
        let db = state.db.clone();
        let redis = state.redis.clone();
        let waha_client = state.waha_client.clone();
        let author_id = tenant.user_id;
        let author_name = comment.author_name.clone();
        let app_url = state.config.app_url.clone();
        tokio::spawn(async move {
            // Fetch task title for notification body
            let task_title: String =
                sqlx::query_scalar("SELECT title FROM tasks WHERE id = $1 AND deleted_at IS NULL")
                    .bind(task_id)
                    .fetch_optional(&db)
                    .await
                    .ok()
                    .flatten()
                    .unwrap_or_else(|| "a task".to_string());

            // Fetch project's Slack webhook URL
            let slack_webhook: Option<String> = sqlx::query_scalar(
                r#"SELECT p.slack_webhook_url FROM projects p
                   JOIN tasks t ON t.project_id = p.id
                   WHERE t.id = $1 AND t.deleted_at IS NULL"#,
            )
            .bind(task_id)
            .fetch_optional(&db)
            .await
            .ok()
            .flatten();

            // Build the NotificationService for the dispatcher
            let broadcast = BroadcastService::new(redis.clone());
            let notification_svc =
                NotificationService::new(db.clone(), broadcast, None, app_url.clone());

            let notif_title = format!("{} mentioned you", author_name);
            let notif_body = format!("in a comment on \"{}\"", task_title);
            let link_url = format!("/task/{}", task_id);

            let notify_ctx = NotifyContext {
                pool: &db,
                redis: &redis,
                notification_svc: &notification_svc,
                app_url: &app_url,
                slack_webhook_url: slack_webhook.as_deref(),
                waha_client: waha_client.as_ref(),
            };

            for user_id in mentioned_user_ids {
                if user_id == author_id {
                    continue;
                }
                if let Err(e) = notify(
                    &notify_ctx,
                    NotificationEvent::MentionInComment,
                    user_id,
                    &notif_title,
                    &notif_body,
                    Some(link_url.as_str()),
                )
                .await
                {
                    tracing::error!(
                        user_id = %user_id,
                        error = %e,
                        "Failed to dispatch mention notification"
                    );
                }
            }
        });
    }
    } // outer: mentioned_user_ids not empty after filtering

    // Send task-commented notifications to assignees via dispatcher (fire and forget)
    {
        let db = state.db.clone();
        let redis = state.redis.clone();
        let waha_client = state.waha_client.clone();
        let author_id = tenant.user_id;
        let author_name = comment.author_name.clone();
        let app_url = state.config.app_url.clone();
        let mentioned = extract_mentioned_user_ids(&sanitized_content);
        tokio::spawn(async move {
            // Get task assignees
            let assignee_ids = taskbolt_db::queries::get_task_assignee_ids(&db, task_id)
                .await
                .unwrap_or_default();

            if assignee_ids.is_empty() {
                return;
            }

            // Fetch task title
            let task_title: String =
                sqlx::query_scalar("SELECT title FROM tasks WHERE id = $1 AND deleted_at IS NULL")
                    .bind(task_id)
                    .fetch_optional(&db)
                    .await
                    .ok()
                    .flatten()
                    .unwrap_or_else(|| "a task".to_string());

            // Fetch project's Slack webhook URL
            let slack_webhook: Option<String> = sqlx::query_scalar(
                r#"SELECT p.slack_webhook_url FROM projects p
                   JOIN tasks t ON t.project_id = p.id
                   WHERE t.id = $1 AND t.deleted_at IS NULL"#,
            )
            .bind(task_id)
            .fetch_optional(&db)
            .await
            .ok()
            .flatten();

            let broadcast = BroadcastService::new(redis.clone());
            let notification_svc =
                NotificationService::new(db.clone(), broadcast, None, app_url.clone());

            let notif_title = format!("{} commented", author_name);
            let notif_body = format!("on \"{}\"", task_title);
            let link_url = format!("/task/{}", task_id);

            let notify_ctx = NotifyContext {
                pool: &db,
                redis: &redis,
                notification_svc: &notification_svc,
                app_url: &app_url,
                slack_webhook_url: slack_webhook.as_deref(),
                waha_client: waha_client.as_ref(),
            };

            for assignee_id in assignee_ids {
                // Skip the comment author and users already notified via @mention
                if assignee_id == author_id || mentioned.contains(&assignee_id) {
                    continue;
                }
                if let Err(e) = notify(
                    &notify_ctx,
                    NotificationEvent::TaskCommented,
                    assignee_id,
                    &notif_title,
                    &notif_body,
                    Some(link_url.as_str()),
                )
                .await
                {
                    tracing::error!(
                        assignee_id = %assignee_id,
                        error = %e,
                        "Failed to dispatch task-commented notification"
                    );
                }
            }
        });
    }

    Ok((StatusCode::CREATED, Json(comment)))
}

/// PUT /api/comments/:id
///
/// Update an existing comment (owner only)
async fn update_comment_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(comment_id): Path<Uuid>,
    StrictJson(body): StrictJson<UpdateCommentRequest>,
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

    // Verify user has access to the task's project
    let task_id = get_comment_task_id(&state.db, comment_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Comment not found".into()))?;

    let project_id = get_task_project_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    verify_project_membership(&state.db, project_id, tenant.user_id, &tenant.role).await?;

    // Validate comment length
    validate_required_string("Comment", &body.content, MAX_DESCRIPTION_LEN)?;

    // Sanitize and extract mentioned user IDs from updated content
    let sanitized_content = sanitize_html(&body.content);
    let mentioned_user_ids = extract_mentioned_user_ids(&sanitized_content);

    // Update the comment
    let comment = update_comment(
        &state.db,
        comment_id,
        &sanitized_content,
        &mentioned_user_ids,
    )
    .await?;

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

    // Verify user has access to the task's project
    let task_id = get_comment_task_id(&state.db, comment_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Comment not found".into()))?;

    let project_id = get_task_project_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    verify_project_membership(&state.db, project_id, tenant.user_id, &tenant.role).await?;

    // Delete the comment
    delete_comment(&state.db, comment_id).await?;

    Ok(StatusCode::NO_CONTENT)
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
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
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
        let content =
            "Hello @[John](not-a-uuid) and @[Jane](550e8400-e29b-41d4-a716-446655440001)!";
        let ids = extract_mentioned_user_ids(content);
        assert_eq!(ids.len(), 1);
        assert_eq!(
            ids[0],
            Uuid::parse_str("550e8400-e29b-41d4-a716-446655440001").unwrap()
        );
    }

    /// Verify the MENTION_REGEX Lazy static compiles successfully.
    /// This documents that the .unwrap() in the Lazy::new is safe
    /// because the regex pattern is a compile-time constant.
    #[test]
    fn mention_regex_compiles() {
        assert!(MENTION_REGEX.is_match("@[User](550e8400-e29b-41d4-a716-446655440000)"));
        assert!(!MENTION_REGEX.is_match("plain text"));
    }
}
