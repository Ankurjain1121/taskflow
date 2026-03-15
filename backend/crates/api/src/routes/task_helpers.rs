use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::errors::Result;
use taskflow_db::models::TaskPriority;
use taskflow_services::broadcast::events;
use taskflow_services::BroadcastService;

/// Sanitize HTML content from rich text editor.
/// Allows safe formatting tags, removes scripts and dangerous attributes.
pub fn sanitize_html(input: &str) -> String {
    ammonia::Builder::default()
        .tags(std::collections::HashSet::from([
            "p",
            "br",
            "strong",
            "b",
            "em",
            "i",
            "u",
            "s",
            "strike",
            "del",
            "ul",
            "ol",
            "li",
            "blockquote",
            "pre",
            "code",
            "a",
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
            "hr",
            "span",
        ]))
        .link_rel(Some("noopener noreferrer"))
        .url_relative(ammonia::UrlRelative::Deny)
        .clean(input)
        .to_string()
}

/// Response for listing tasks by board
#[derive(serde::Serialize)]
pub struct ListTasksResponse {
    pub tasks: std::collections::HashMap<Uuid, Vec<taskflow_db::models::Task>>,
}

/// Request body for creating a task
#[derive(Deserialize)]
pub struct CreateTaskRequest {
    pub title: String,
    pub description: Option<String>,
    pub priority: TaskPriority,
    pub due_date: Option<chrono::DateTime<chrono::Utc>>,
    pub start_date: Option<chrono::DateTime<chrono::Utc>>,
    pub estimated_hours: Option<f64>,
    pub status_id: Option<Uuid>,
    pub milestone_id: Option<Uuid>,
    pub task_list_id: Option<Uuid>,
    pub assignee_ids: Option<Vec<Uuid>>,
    pub label_ids: Option<Vec<Uuid>>,
    pub parent_task_id: Option<Uuid>,
}

/// Request body for updating a task
#[derive(Deserialize)]
pub struct UpdateTaskRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub priority: Option<TaskPriority>,
    pub due_date: Option<chrono::DateTime<chrono::Utc>>,
    pub start_date: Option<chrono::DateTime<chrono::Utc>>,
    pub estimated_hours: Option<f64>,
    pub milestone_id: Option<Uuid>,
    pub clear_description: Option<bool>,
    pub clear_due_date: Option<bool>,
    pub clear_start_date: Option<bool>,
    pub clear_estimated_hours: Option<bool>,
    pub clear_milestone: Option<bool>,
    /// For optimistic concurrency: the version the client last saw.
    pub expected_version: Option<i32>,
}

/// Request body for moving a task
#[derive(Deserialize)]
pub struct MoveTaskRequest {
    pub status_id: Uuid,
    pub position: String,
}

/// Request body for assigning a user
#[derive(Deserialize)]
pub struct AssignUserRequest {
    pub user_id: Uuid,
}

/// Helper to get workspace_id from board_id
pub async fn get_workspace_id_for_board(
    pool: &sqlx::PgPool,
    board_id: Uuid,
) -> std::result::Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar::<_, Uuid>(
        "SELECT workspace_id FROM projects WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(board_id)
    .fetch_optional(pool)
    .await
}

/// Helper to verify a user is a board member.
/// Returns `true` if the user is a member, `false` otherwise.
///
/// Prefer [`super::common::verify_project_membership`] for new code,
/// which returns `Result<()>` and handles the error internally.
pub async fn verify_board_membership(
    pool: &sqlx::PgPool,
    board_id: Uuid,
    user_id: Uuid,
) -> Result<bool> {
    super::common::verify_project_membership(pool, board_id, user_id)
        .await
        .map(|()| true)
        .or_else(|e| {
            if matches!(&e, crate::errors::AppError::Forbidden(_)) {
                Ok(false)
            } else {
                Err(e)
            }
        })
}

/// Helper to broadcast workspace update after task mutation
pub async fn broadcast_workspace_task_update(
    broadcast_service: &BroadcastService,
    workspace_id: Uuid,
    task_id: Uuid,
    board_id: Uuid,
    assignee_ids: &[Uuid],
) {
    // Broadcast to workspace channel
    if let Err(e) = broadcast_service
        .broadcast_workspace_update(
            workspace_id,
            events::WORKLOAD_CHANGED,
            json!({
                "task_id": task_id,
                "board_id": board_id
            }),
        )
        .await
    {
        tracing::error!("Failed to broadcast workspace update: {}", e);
    }

    // Broadcast to each assignee's user channel
    for assignee_id in assignee_ids {
        if let Err(e) = broadcast_service
            .broadcast_user_update(
                *assignee_id,
                events::TASK_UPDATED,
                json!({
                    "task_id": task_id,
                    "board_id": board_id,
                    "workspace_id": workspace_id
                }),
            )
            .await
        {
            tracing::error!("Failed to broadcast user task update: {}", e);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_create_task_request_deserialize_minimal() {
        let json = json!({
            "title": "My Task",
            "priority": "high"
        });
        let req: CreateTaskRequest = serde_json::from_value(json).unwrap();
        assert_eq!(req.title, "My Task");
        assert_eq!(req.priority, TaskPriority::High);
        assert!(req.description.is_none());
        assert!(req.due_date.is_none());
        assert!(req.start_date.is_none());
        assert!(req.estimated_hours.is_none());
        assert!(req.milestone_id.is_none());
        assert!(req.task_list_id.is_none());
        assert!(req.assignee_ids.is_none());
        assert!(req.label_ids.is_none());
    }

    #[test]
    fn test_create_task_request_deserialize_full() {
        let status_id = Uuid::new_v4();
        let milestone_id = Uuid::new_v4();
        let task_list_id = Uuid::new_v4();
        let assignee = Uuid::new_v4();
        let label = Uuid::new_v4();
        let json = json!({
            "title": "Full Task",
            "description": "A detailed description",
            "priority": "urgent",
            "due_date": "2026-03-15T10:00:00Z",
            "start_date": "2026-03-01T08:00:00Z",
            "estimated_hours": 4.5,
            "status_id": status_id,
            "milestone_id": milestone_id,
            "task_list_id": task_list_id,
            "assignee_ids": [assignee],
            "label_ids": [label]
        });
        let req: CreateTaskRequest = serde_json::from_value(json).unwrap();
        assert_eq!(req.title, "Full Task");
        assert_eq!(req.description, Some("A detailed description".to_string()));
        assert_eq!(req.priority, TaskPriority::Urgent);
        assert!(req.due_date.is_some());
        assert!(req.start_date.is_some());
        assert_eq!(req.estimated_hours, Some(4.5));
        assert_eq!(req.status_id, Some(status_id));
        assert_eq!(req.milestone_id, Some(milestone_id));
        assert_eq!(req.task_list_id, Some(task_list_id));
        assert_eq!(req.assignee_ids.unwrap().len(), 1);
        assert_eq!(req.label_ids.unwrap().len(), 1);
    }

    #[test]
    fn test_create_task_request_all_priorities() {
        for priority in ["urgent", "high", "medium", "low"] {
            let json = json!({
                "title": "Test",
                "priority": priority
            });
            let req: CreateTaskRequest = serde_json::from_value(json).unwrap();
            let expected = match priority {
                "urgent" => TaskPriority::Urgent,
                "high" => TaskPriority::High,
                "medium" => TaskPriority::Medium,
                "low" => TaskPriority::Low,
                _ => unreachable!(),
            };
            assert_eq!(req.priority, expected);
        }
    }

    #[test]
    fn test_create_task_request_missing_required_field() {
        // Missing title
        let json = json!({
            "priority": "high"
        });
        let result: std::result::Result<CreateTaskRequest, _> = serde_json::from_value(json);
        assert!(result.is_err());
    }

    #[test]
    fn test_create_task_request_invalid_priority() {
        let json = json!({
            "title": "Test",
            "priority": "critical"
        });
        let result: std::result::Result<CreateTaskRequest, _> = serde_json::from_value(json);
        assert!(result.is_err());
    }

    #[test]
    fn test_update_task_request_deserialize_empty() {
        let json = json!({});
        let req: UpdateTaskRequest = serde_json::from_value(json).unwrap();
        assert!(req.title.is_none());
        assert!(req.description.is_none());
        assert!(req.priority.is_none());
        assert!(req.due_date.is_none());
        assert!(req.start_date.is_none());
        assert!(req.estimated_hours.is_none());
        assert!(req.milestone_id.is_none());
        assert!(req.clear_description.is_none());
        assert!(req.clear_due_date.is_none());
        assert!(req.clear_start_date.is_none());
        assert!(req.clear_estimated_hours.is_none());
        assert!(req.clear_milestone.is_none());
    }

    #[test]
    fn test_update_task_request_partial_fields() {
        let json = json!({
            "title": "Updated Title",
            "priority": "low",
            "clear_due_date": true
        });
        let req: UpdateTaskRequest = serde_json::from_value(json).unwrap();
        assert_eq!(req.title, Some("Updated Title".to_string()));
        assert_eq!(req.priority, Some(TaskPriority::Low));
        assert_eq!(req.clear_due_date, Some(true));
        assert!(req.description.is_none());
    }

    #[test]
    fn test_move_task_request_deserialize() {
        let status_id = Uuid::new_v4();
        let json = json!({
            "status_id": status_id,
            "position": "a0b1c2"
        });
        let req: MoveTaskRequest = serde_json::from_value(json).unwrap();
        assert_eq!(req.status_id, status_id);
        assert_eq!(req.position, "a0b1c2");
    }

    #[test]
    fn test_assign_user_request_deserialize() {
        let user_id = Uuid::new_v4();
        let json = json!({ "user_id": user_id });
        let req: AssignUserRequest = serde_json::from_value(json).unwrap();
        assert_eq!(req.user_id, user_id);
    }

    #[test]
    fn test_list_tasks_response_serialize_empty() {
        let resp = ListTasksResponse {
            tasks: std::collections::HashMap::new(),
        };
        let json = serde_json::to_value(&resp).unwrap();
        assert!(json["tasks"].as_object().unwrap().is_empty());
    }

    // ========================================================================
    // HTML sanitization tests (XSS prevention — CRITICAL)
    // ========================================================================

    #[test]
    fn test_sanitize_html_removes_script_tags() {
        let input = r#"<p>Hello</p><script>alert('xss')</script>"#;
        let output = sanitize_html(input);
        assert!(!output.contains("<script>"), "Script tags must be removed");
        assert!(!output.contains("alert"), "Script content must be removed");
        assert!(output.contains("<p>Hello</p>"), "Safe tags should remain");
    }

    #[test]
    fn test_sanitize_html_removes_onerror_event() {
        let input = r#"<img onerror="alert('xss')" src="x">"#;
        let output = sanitize_html(input);
        assert!(
            !output.contains("onerror"),
            "Event handlers must be stripped"
        );
        assert!(
            !output.contains("alert"),
            "Event handler JS must be removed"
        );
    }

    #[test]
    fn test_sanitize_html_removes_javascript_href() {
        let input = r#"<a href="javascript:alert('xss')">Click</a>"#;
        let output = sanitize_html(input);
        assert!(
            !output.contains("javascript:"),
            "javascript: URIs must be removed"
        );
    }

    #[test]
    fn test_sanitize_html_allows_safe_tags() {
        let input = "<p><strong>Bold</strong> and <em>italic</em></p>";
        let output = sanitize_html(input);
        assert!(output.contains("<strong>Bold</strong>"));
        assert!(output.contains("<em>italic</em>"));
    }

    #[test]
    fn test_sanitize_html_allows_lists() {
        let input = "<ul><li>Item 1</li><li>Item 2</li></ul>";
        let output = sanitize_html(input);
        assert!(output.contains("<ul>"));
        assert!(output.contains("<li>Item 1</li>"));
    }

    #[test]
    fn test_sanitize_html_allows_headings() {
        let input = "<h1>Title</h1><h2>Subtitle</h2>";
        let output = sanitize_html(input);
        assert!(output.contains("<h1>Title</h1>"));
        assert!(output.contains("<h2>Subtitle</h2>"));
    }

    #[test]
    fn test_sanitize_html_removes_iframe() {
        let input = r#"<iframe src="http://evil.com"></iframe>"#;
        let output = sanitize_html(input);
        assert!(!output.contains("<iframe"), "iframes must be removed");
    }

    #[test]
    fn test_sanitize_html_removes_style_tag() {
        let input = "<style>body { display: none; }</style><p>Content</p>";
        let output = sanitize_html(input);
        assert!(!output.contains("<style>"), "Style tags must be removed");
        assert!(output.contains("<p>Content</p>"));
    }

    #[test]
    fn test_sanitize_html_adds_noopener_to_links() {
        let input = r#"<a href="https://example.com">Link</a>"#;
        let output = sanitize_html(input);
        assert!(
            output.contains("noopener"),
            "Links should have rel=noopener: {}",
            output
        );
    }

    #[test]
    fn test_sanitize_html_denies_relative_urls() {
        let input = r#"<a href="/internal/path">Link</a>"#;
        let output = sanitize_html(input);
        assert!(
            !output.contains("/internal/path"),
            "Relative URLs should be denied: {}",
            output
        );
    }

    #[test]
    fn test_sanitize_html_empty_input() {
        assert_eq!(sanitize_html(""), "");
    }

    #[test]
    fn test_sanitize_html_plain_text_passthrough() {
        let input = "Just plain text with no HTML";
        let output = sanitize_html(input);
        assert_eq!(output, input);
    }

    #[test]
    fn test_sanitize_html_removes_form_elements() {
        let input =
            r#"<form action="http://evil.com"><input type="text"><button>Submit</button></form>"#;
        let output = sanitize_html(input);
        assert!(!output.contains("<form"), "Form elements must be removed");
        assert!(!output.contains("<input"), "Input elements must be removed");
    }

    #[test]
    fn test_sanitize_html_nested_scripts() {
        let input = r#"<div><p>Text<script>alert(1)</script></p></div>"#;
        let output = sanitize_html(input);
        assert!(!output.contains("script"), "Nested scripts must be removed");
        assert!(output.contains("Text"), "Text content should remain");
    }

    #[test]
    fn test_list_tasks_response_serialize_with_data() {
        let status_id = Uuid::new_v4();
        let now = chrono::Utc::now();
        let task = taskflow_db::models::Task {
            id: Uuid::new_v4(),
            title: "Test Task".to_string(),
            description: None,
            priority: TaskPriority::Medium,
            due_date: None,
            start_date: None,
            estimated_hours: None,
            project_id: Uuid::new_v4(),
            status_id: Some(status_id),
            task_list_id: None,
            position: "a0".to_string(),
            milestone_id: None,
            task_number: Some(1),
            eisenhower_urgency: None,
            eisenhower_importance: None,
            tenant_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            deleted_at: None,
            created_at: now,
            updated_at: now,
            version: 1,
            parent_task_id: None,
            depth: 0,
        };
        let mut tasks = std::collections::HashMap::new();
        tasks.insert(status_id, vec![task]);
        let resp = ListTasksResponse { tasks };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("Test Task"));
    }
}
