//! Workspace Export REST endpoints
//!
//! Provides workspace-level export in CSV or JSON format.

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
use crate::extractors::AuthUserExtractor;
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;
use taskbolt_db::models::WorkspaceMemberRole;

// ============================================================================
// DTOs
// ============================================================================

#[derive(Deserialize)]
pub struct ExportQuery {
    pub format: String,
}

#[derive(Serialize)]
struct WorkspaceExportJson {
    workspace: WorkspaceExportMeta,
    members: Vec<ExportMember>,
    boards: Vec<ExportBoardWithTasks>,
}

#[derive(Serialize)]
struct WorkspaceExportMeta {
    id: Uuid,
    name: String,
    description: Option<String>,
    exported_at: DateTime<Utc>,
}

#[derive(Serialize)]
struct ExportMember {
    name: String,
    email: String,
    role: String,
}

#[derive(Serialize)]
struct ExportBoardWithTasks {
    id: Uuid,
    name: String,
    description: Option<String>,
    tasks: Vec<ExportTask>,
}

#[derive(Serialize)]
struct ExportTask {
    title: String,
    description: Option<String>,
    priority: String,
    column_name: String,
    due_date: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
}

// Internal query rows
#[derive(sqlx::FromRow)]
struct WsRow {
    id: Uuid,
    name: String,
    description: Option<String>,
}

#[derive(sqlx::FromRow)]
struct MemberRow {
    name: String,
    email: String,
    role: String,
}

#[derive(sqlx::FromRow)]
struct BoardRow {
    id: Uuid,
    name: String,
    description: Option<String>,
}

#[derive(sqlx::FromRow)]
struct TaskRow {
    project_id: Uuid,
    title: String,
    description: Option<String>,
    priority: String,
    column_name: String,
    due_date: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
}

// ============================================================================
// Helpers
// ============================================================================

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

/// GET /api/workspaces/:workspace_id/export?format=csv|json
async fn export_workspace(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(workspace_id): Path<Uuid>,
    Query(query): Query<ExportQuery>,
) -> Result<Response> {
    let is_member = taskbolt_db::queries::workspaces::is_workspace_member(
        &state.db,
        workspace_id,
        auth.0.user_id,
    )
    .await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    // Determine if this user can see member emails (Owner/Admin only)
    let user_role = taskbolt_db::queries::workspaces::get_workspace_member_role(
        &state.db,
        workspace_id,
        auth.0.user_id,
    )
    .await?;
    let can_see_emails = matches!(
        user_role,
        Some(WorkspaceMemberRole::Owner) | Some(WorkspaceMemberRole::Admin)
    );

    match query.format.as_str() {
        "csv" => export_csv(&state.db, workspace_id, can_see_emails).await,
        "json" => export_json(&state.db, workspace_id, can_see_emails).await,
        _ => Err(AppError::BadRequest(
            "Invalid format. Use 'csv' or 'json'.".into(),
        )),
    }
}

async fn export_json(
    db: &sqlx::PgPool,
    workspace_id: Uuid,
    can_see_emails: bool,
) -> Result<Response> {
    let ws: WsRow = sqlx::query_as(
        "SELECT id, name, description FROM workspaces WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(workspace_id)
    .fetch_optional(db)
    .await
    .map_err(AppError::from)?
    .ok_or_else(|| AppError::NotFound("Workspace not found".into()))?;

    let members: Vec<MemberRow> = sqlx::query_as(
        r#"
        SELECT u.name, u.email, wm.role::text as role
        FROM workspace_members wm
        JOIN users u ON u.id = wm.user_id
        WHERE wm.workspace_id = $1
        ORDER BY u.name
        "#,
    )
    .bind(workspace_id)
    .fetch_all(db)
    .await
    .map_err(AppError::from)?;

    let boards: Vec<BoardRow> = sqlx::query_as(
        "SELECT id, name, description FROM projects WHERE workspace_id = $1 AND deleted_at IS NULL ORDER BY name",
    )
    .bind(workspace_id)
    .fetch_all(db)
    .await
    .map_err(AppError::from)?;

    let board_ids: Vec<Uuid> = boards.iter().map(|b| b.id).collect();

    let tasks: Vec<TaskRow> = if board_ids.is_empty() {
        vec![]
    } else {
        sqlx::query_as(
            r#"
            SELECT
                t.project_id,
                t.title,
                t.description,
                t.priority::text as priority,
                COALESCE(ps.name, 'No Status') as column_name,
                t.due_date,
                t.created_at
            FROM tasks t
            LEFT JOIN project_statuses ps ON ps.id = t.status_id
            WHERE t.project_id = ANY($1) AND t.deleted_at IS NULL
              AND t.parent_task_id IS NULL
            ORDER BY t.project_id, t.position
            "#,
        )
        .bind(&board_ids)
        .fetch_all(db)
        .await
        .map_err(AppError::from)?
    };

    // Group tasks by board_id
    let mut task_map: std::collections::HashMap<Uuid, Vec<ExportTask>> =
        std::collections::HashMap::new();
    for t in tasks {
        task_map.entry(t.project_id).or_default().push(ExportTask {
            title: t.title,
            description: t.description,
            priority: t.priority,
            column_name: t.column_name,
            due_date: t.due_date,
            created_at: t.created_at,
        });
    }

    let export = WorkspaceExportJson {
        workspace: WorkspaceExportMeta {
            id: ws.id,
            name: ws.name,
            description: ws.description,
            exported_at: Utc::now(),
        },
        members: members
            .into_iter()
            .map(|m| ExportMember {
                name: m.name,
                email: if can_see_emails {
                    m.email
                } else {
                    "[redacted]".to_string()
                },
                role: m.role,
            })
            .collect(),
        boards: boards
            .into_iter()
            .map(|b| {
                let tasks = task_map.remove(&b.id).unwrap_or_default();
                ExportBoardWithTasks {
                    id: b.id,
                    name: b.name,
                    description: b.description,
                    tasks,
                }
            })
            .collect(),
    };

    Ok(Json(export).into_response())
}

async fn export_csv(
    db: &sqlx::PgPool,
    workspace_id: Uuid,
    _can_see_emails: bool,
) -> Result<Response> {
    let ws_name: Option<String> =
        sqlx::query_scalar("SELECT name FROM workspaces WHERE id = $1 AND deleted_at IS NULL")
            .bind(workspace_id)
            .fetch_optional(db)
            .await
            .map_err(AppError::from)?;

    let ws_name = ws_name.ok_or_else(|| AppError::NotFound("Workspace not found".into()))?;

    let board_ids: Vec<Uuid> = sqlx::query_scalar(
        "SELECT id FROM projects WHERE workspace_id = $1 AND deleted_at IS NULL",
    )
    .bind(workspace_id)
    .fetch_all(db)
    .await
    .map_err(AppError::from)?;

    // Build CSV with all tasks across boards
    let mut csv =
        String::from("board_name,title,description,priority,status,due_date,created_at\n");

    if !board_ids.is_empty() {
        let tasks: Vec<TaskWithBoard> = sqlx::query_as(
            r#"
            SELECT
                b.name as board_name,
                t.title,
                t.description,
                t.priority::text as priority,
                COALESCE(ps.name, 'No Status') as column_name,
                t.due_date,
                t.created_at
            FROM tasks t
            JOIN projects b ON b.id = t.project_id
            LEFT JOIN project_statuses ps ON ps.id = t.status_id
            WHERE t.project_id = ANY($1) AND t.deleted_at IS NULL
              AND t.parent_task_id IS NULL
            ORDER BY b.name, t.position
            "#,
        )
        .bind(&board_ids)
        .fetch_all(db)
        .await
        .map_err(AppError::from)?;

        for task in &tasks {
            let due = task
                .due_date
                .map(|d| d.format("%Y-%m-%d").to_string())
                .unwrap_or_default();
            let created = task.created_at.format("%Y-%m-%dT%H:%M:%SZ").to_string();

            csv.push_str(&format!(
                "{},{},{},{},{},{},{}\n",
                csv_escape(&task.board_name),
                csv_escape(&task.title),
                csv_escape(task.description.as_deref().unwrap_or("")),
                csv_escape(&task.priority),
                csv_escape(&task.column_name),
                csv_escape(&due),
                csv_escape(&created),
            ));
        }
    }

    let filename = format!("{}_export.csv", ws_name.replace(' ', "_").to_lowercase());

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

#[derive(sqlx::FromRow)]
struct TaskWithBoard {
    board_name: String,
    title: String,
    description: Option<String>,
    priority: String,
    column_name: String,
    due_date: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
}

// ============================================================================
// Router
// ============================================================================

pub fn workspace_export_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/export", get(export_workspace))
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
