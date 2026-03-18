use axum::{
    middleware::from_fn_with_state,
    routing::{delete, get, patch, post},
    Router,
};

use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;

use super::task_bulk;
use super::task_collaboration::{
    add_watcher_handler, assign_user_handler, list_reminders_handler, remove_reminder_handler,
    remove_watcher_handler, set_reminder_handler, unassign_user_handler,
};
use super::task_crud::{
    complete_task_handler, create_task_handler, delete_task_handler, duplicate_task_handler,
    get_task, list_tasks, uncomplete_task_handler, update_task_handler,
};
use super::task_movement::{move_task_handler, move_task_to_project_handler};
use super::task_views;

/// Create the task router
pub fn task_router(state: AppState) -> Router<AppState> {
    Router::new()
        // Board-scoped task routes
        .route("/projects/{board_id}/tasks", get(list_tasks))
        .route(
            "/projects/{board_id}/tasks/list",
            get(task_views::list_tasks_flat_handler),
        )
        .route(
            "/projects/{board_id}/tasks/calendar",
            get(task_views::list_calendar_tasks_handler),
        )
        .route(
            "/projects/{board_id}/tasks/gantt",
            get(task_views::list_gantt_tasks_handler),
        )
        .route(
            "/projects/{board_id}/tasks/bulk-update",
            post(task_bulk::bulk_update_handler),
        )
        .route(
            "/projects/{board_id}/tasks/bulk-delete",
            post(task_bulk::bulk_delete_handler),
        )
        .route("/projects/{board_id}/tasks", post(create_task_handler))
        // Task-specific routes
        .route("/tasks/{id}", get(get_task))
        .route("/tasks/{id}", patch(update_task_handler))
        .route("/tasks/{id}", delete(delete_task_handler))
        .route("/tasks/{id}/move", patch(move_task_handler))
        .route(
            "/tasks/{id}/move-to-project",
            post(move_task_to_project_handler),
        )
        .route("/tasks/{id}/duplicate", post(duplicate_task_handler))
        .route("/tasks/{id}/complete", post(complete_task_handler))
        .route("/tasks/{id}/uncomplete", post(uncomplete_task_handler))
        .route("/tasks/{id}/assignees", post(assign_user_handler))
        .route(
            "/tasks/{id}/assignees/{user_id}",
            delete(unassign_user_handler),
        )
        // Watcher routes
        .route("/tasks/{id}/watchers", post(add_watcher_handler))
        .route(
            "/tasks/{id}/watchers/{user_id}",
            delete(remove_watcher_handler),
        )
        // Reminder routes
        .route(
            "/tasks/{id}/reminders",
            post(set_reminder_handler).get(list_reminders_handler),
        )
        .route(
            "/tasks/{id}/reminders/{reminder_id}",
            delete(remove_reminder_handler),
        )
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
