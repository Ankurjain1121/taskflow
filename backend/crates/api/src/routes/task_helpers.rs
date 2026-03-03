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
    pub column_id: Uuid,
    pub milestone_id: Option<Uuid>,
    pub group_id: Option<Uuid>,
    pub assignee_ids: Option<Vec<Uuid>>,
    pub label_ids: Option<Vec<Uuid>>,
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
    pub column_id: Uuid,
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
    sqlx::query_scalar!(
        r#"
        SELECT workspace_id FROM boards WHERE id = $1 AND deleted_at IS NULL
        "#,
        board_id
    )
    .fetch_optional(pool)
    .await
}

/// Helper to verify a user is a board member
pub async fn verify_board_membership(
    pool: &sqlx::PgPool,
    board_id: Uuid,
    user_id: Uuid,
) -> Result<bool> {
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
    .fetch_one(pool)
    .await?;

    Ok(is_member)
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
            "priority": "high",
            "column_id": "550e8400-e29b-41d4-a716-446655440000"
        });
        let req: CreateTaskRequest = serde_json::from_value(json).unwrap();
        assert_eq!(req.title, "My Task");
        assert_eq!(req.priority, TaskPriority::High);
        assert!(req.description.is_none());
        assert!(req.due_date.is_none());
        assert!(req.start_date.is_none());
        assert!(req.estimated_hours.is_none());
        assert!(req.milestone_id.is_none());
        assert!(req.group_id.is_none());
        assert!(req.assignee_ids.is_none());
        assert!(req.label_ids.is_none());
    }

    #[test]
    fn test_create_task_request_deserialize_full() {
        let col_id = Uuid::new_v4();
        let milestone_id = Uuid::new_v4();
        let group_id = Uuid::new_v4();
        let assignee = Uuid::new_v4();
        let label = Uuid::new_v4();
        let json = json!({
            "title": "Full Task",
            "description": "A detailed description",
            "priority": "urgent",
            "due_date": "2026-03-15T10:00:00Z",
            "start_date": "2026-03-01T08:00:00Z",
            "estimated_hours": 4.5,
            "column_id": col_id,
            "milestone_id": milestone_id,
            "group_id": group_id,
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
        assert_eq!(req.column_id, col_id);
        assert_eq!(req.milestone_id, Some(milestone_id));
        assert_eq!(req.group_id, Some(group_id));
        assert_eq!(req.assignee_ids.unwrap().len(), 1);
        assert_eq!(req.label_ids.unwrap().len(), 1);
    }

    #[test]
    fn test_create_task_request_all_priorities() {
        for priority in ["urgent", "high", "medium", "low"] {
            let json = json!({
                "title": "Test",
                "priority": priority,
                "column_id": Uuid::new_v4()
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
            "priority": "high",
            "column_id": Uuid::new_v4()
        });
        let result: std::result::Result<CreateTaskRequest, _> = serde_json::from_value(json);
        assert!(result.is_err());
    }

    #[test]
    fn test_create_task_request_invalid_priority() {
        let json = json!({
            "title": "Test",
            "priority": "critical",
            "column_id": Uuid::new_v4()
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
        let col_id = Uuid::new_v4();
        let json = json!({
            "column_id": col_id,
            "position": "a0b1c2"
        });
        let req: MoveTaskRequest = serde_json::from_value(json).unwrap();
        assert_eq!(req.column_id, col_id);
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

    #[test]
    fn test_list_tasks_response_serialize_with_data() {
        let col_id = Uuid::new_v4();
        let now = chrono::Utc::now();
        let task = taskflow_db::models::Task {
            id: Uuid::new_v4(),
            title: "Test Task".to_string(),
            description: None,
            priority: TaskPriority::Medium,
            due_date: None,
            start_date: None,
            estimated_hours: None,
            board_id: Uuid::new_v4(),
            column_id: col_id,
            group_id: None,
            position: "a0".to_string(),
            milestone_id: None,
            task_number: Some(1),
            eisenhower_urgency: None,
            eisenhower_importance: None,
            tenant_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            deleted_at: None,
            column_entered_at: now,
            created_at: now,
            updated_at: now,
            version: 1,
        };
        let mut tasks = std::collections::HashMap::new();
        tasks.insert(col_id, vec![task]);
        let resp = ListTasksResponse { tasks };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("Test Task"));
    }
}
