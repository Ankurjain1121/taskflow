//! Export REST endpoints
//!
//! Provides export (CSV, JSON) for board tasks.

use axum::{
    extract::{Path, Query, State},
    http::header,
    middleware::from_fn_with_state,
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;

use super::common::{verify_project_membership, Capability, require_capability};

// ============================================================================
// DTOs
// ============================================================================

#[derive(Deserialize)]
struct ExportQuery {
    format: String,
}

#[derive(Serialize)]
struct ExportBoardJson {
    board: ExportBoardMeta,
    columns: Vec<ExportColumnJson>,
    tasks: Vec<ExportTaskJson>,
}

#[derive(Serialize)]
struct ExportBoardMeta {
    id: Uuid,
    name: String,
    description: Option<String>,
    exported_at: DateTime<Utc>,
}

#[derive(Serialize)]
struct ExportColumnJson {
    id: Uuid,
    name: String,
    position: String,
    color: Option<String>,
}

#[derive(Serialize)]
struct ExportTaskJson {
    title: String,
    description: Option<String>,
    priority: String,
    column_name: String,
    due_date: Option<DateTime<Utc>>,
    assignees: Vec<String>,
    created_at: DateTime<Utc>,
}

// Internal row types for sqlx
#[derive(sqlx::FromRow)]
struct BoardRow {
    id: Uuid,
    name: String,
    description: Option<String>,
}

#[derive(sqlx::FromRow)]
struct ColumnRow {
    id: Uuid,
    name: String,
    position: String,
    color: Option<String>,
}

#[derive(sqlx::FromRow)]
struct ExportTaskRow {
    title: String,
    description: Option<String>,
    priority: String,
    column_name: String,
    due_date: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
}

#[derive(sqlx::FromRow)]
struct TaskAssigneeRow {
    task_title: String,
    assignee_name: String,
}

// ============================================================================
// Helpers
// ============================================================================

/// Escape a field for CSV output (wrap in quotes if it contains comma, quote, or newline).
fn csv_escape(field: &str) -> String {
    if field.contains(',') || field.contains('"') || field.contains('\n') {
        format!("\"{}\"", field.replace('"', "\"\""))
    } else {
        field.to_string()
    }
}

// ============================================================================
// Route Handlers
// ============================================================================

/// GET /boards/{board_id}/export?format=csv|json
///
/// Export board tasks in the requested format.
async fn export_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(board_id): Path<Uuid>,
    Query(query): Query<ExportQuery>,
) -> Result<Response> {
    verify_project_membership(&state.db, board_id, tenant.user_id, &tenant.role).await?;
    require_capability(&state.db, tenant.user_id, &tenant.role, board_id, Capability::Export).await?;

    match query.format.as_str() {
        "csv" => export_csv(&state.db, board_id).await,
        "json" => export_json(&state.db, board_id).await,
        _ => Err(AppError::BadRequest(
            "Invalid format. Use 'csv' or 'json'.".into(),
        )),
    }
}

async fn export_csv(db: &sqlx::PgPool, board_id: Uuid) -> Result<Response> {
    // Fetch tasks with column names
    let tasks: Vec<ExportTaskRow> = sqlx::query_as(
        r#"
        SELECT
            t.title,
            t.description,
            t.priority::text AS priority,
            bc.name AS column_name,
            t.due_date,
            t.created_at
        FROM tasks t
        JOIN board_columns bc ON bc.id = t.column_id
        WHERE t.board_id = $1 AND t.deleted_at IS NULL
        ORDER BY bc.position, t.position
        "#,
    )
    .bind(board_id)
    .fetch_all(db)
    .await
    .map_err(AppError::from)?;

    // Fetch assignees for all tasks on this board
    let assignees: Vec<TaskAssigneeRow> = sqlx::query_as(
        r#"
        SELECT
            t.title AS task_title,
            u.name AS assignee_name
        FROM task_assignees ta
        JOIN tasks t ON t.id = ta.task_id
        JOIN users u ON u.id = ta.user_id
        WHERE t.board_id = $1 AND t.deleted_at IS NULL
        ORDER BY t.title, u.name
        "#,
    )
    .bind(board_id)
    .fetch_all(db)
    .await
    .map_err(AppError::from)?;

    // Build assignee lookup by task title
    let mut assignee_map: std::collections::HashMap<String, Vec<String>> =
        std::collections::HashMap::new();
    for row in &assignees {
        assignee_map
            .entry(row.task_title.clone())
            .or_default()
            .push(row.assignee_name.clone());
    }

    // Build CSV
    let mut csv = String::from("title,description,priority,status,due_date,assignee,created_at\n");

    for task in &tasks {
        let assignee_names = assignee_map
            .get(&task.title)
            .map(|names| names.join("; "))
            .unwrap_or_default();

        let due = task
            .due_date
            .map(|d| d.format("%Y-%m-%d").to_string())
            .unwrap_or_default();
        let created = task.created_at.format("%Y-%m-%dT%H:%M:%SZ").to_string();

        csv.push_str(&format!(
            "{},{},{},{},{},{},{}\n",
            csv_escape(&task.title),
            csv_escape(task.description.as_deref().unwrap_or("")),
            csv_escape(&task.priority),
            csv_escape(&task.column_name),
            csv_escape(&due),
            csv_escape(&assignee_names),
            csv_escape(&created),
        ));
    }

    // Get board name for the filename
    let board_name: Option<String> = sqlx::query_scalar("SELECT name FROM boards WHERE id = $1")
        .bind(board_id)
        .fetch_optional(db)
        .await
        .map_err(AppError::from)?;

    let filename = format!(
        "{}_export.csv",
        board_name
            .unwrap_or_else(|| "project".into())
            .replace(' ', "_")
            .to_lowercase()
    );

    Ok((
        [
            (header::CONTENT_TYPE, "text/csv; charset=utf-8".to_string()),
            (
                header::CONTENT_DISPOSITION,
                format!("attachment; filename=\"{}\"", filename),
            ),
        ],
        csv,
    )
        .into_response())
}

async fn export_json(db: &sqlx::PgPool, board_id: Uuid) -> Result<Response> {
    // Fetch board
    let board: BoardRow = sqlx::query_as(
        "SELECT id, name, description FROM boards WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(board_id)
    .fetch_optional(db)
    .await
    .map_err(AppError::from)?
    .ok_or_else(|| AppError::NotFound("Board not found".into()))?;

    // Fetch columns
    let columns: Vec<ColumnRow> = sqlx::query_as(
        "SELECT id, name, position, color FROM board_columns WHERE board_id = $1 ORDER BY position",
    )
    .bind(board_id)
    .fetch_all(db)
    .await
    .map_err(AppError::from)?;

    // Fetch tasks with column names
    let tasks: Vec<ExportTaskRow> = sqlx::query_as(
        r#"
        SELECT
            t.title,
            t.description,
            t.priority::text AS priority,
            bc.name AS column_name,
            t.due_date,
            t.created_at
        FROM tasks t
        JOIN board_columns bc ON bc.id = t.column_id
        WHERE t.board_id = $1 AND t.deleted_at IS NULL
        ORDER BY bc.position, t.position
        "#,
    )
    .bind(board_id)
    .fetch_all(db)
    .await
    .map_err(AppError::from)?;

    // Fetch assignees
    let assignees: Vec<TaskAssigneeRow> = sqlx::query_as(
        r#"
        SELECT
            t.title AS task_title,
            u.name AS assignee_name
        FROM task_assignees ta
        JOIN tasks t ON t.id = ta.task_id
        JOIN users u ON u.id = ta.user_id
        WHERE t.board_id = $1 AND t.deleted_at IS NULL
        ORDER BY t.title, u.name
        "#,
    )
    .bind(board_id)
    .fetch_all(db)
    .await
    .map_err(AppError::from)?;

    let mut assignee_map: std::collections::HashMap<String, Vec<String>> =
        std::collections::HashMap::new();
    for row in &assignees {
        assignee_map
            .entry(row.task_title.clone())
            .or_default()
            .push(row.assignee_name.clone());
    }

    let export = ExportBoardJson {
        board: ExportBoardMeta {
            id: board.id,
            name: board.name,
            description: board.description,
            exported_at: Utc::now(),
        },
        columns: columns
            .into_iter()
            .map(|c| ExportColumnJson {
                id: c.id,
                name: c.name,
                position: c.position,
                color: c.color,
            })
            .collect(),
        tasks: tasks
            .iter()
            .map(|t| {
                let task_assignees = assignee_map.get(&t.title).cloned().unwrap_or_default();
                ExportTaskJson {
                    title: t.title.clone(),
                    description: t.description.clone(),
                    priority: t.priority.clone(),
                    column_name: t.column_name.clone(),
                    due_date: t.due_date,
                    assignees: task_assignees,
                    created_at: t.created_at,
                }
            })
            .collect(),
    };

    Ok(Json(export).into_response())
}

// ============================================================================
// Router
// ============================================================================

pub fn export_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/projects/{board_id}/export", get(export_handler))
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
