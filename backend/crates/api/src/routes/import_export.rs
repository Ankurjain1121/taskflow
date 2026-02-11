//! Import/Export REST endpoints
//!
//! Provides export (CSV, JSON) and import (JSON, CSV, Trello) for board tasks.

use axum::{
    extract::{Path, Query, State},
    http::header,
    middleware::from_fn_with_state,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::auth_middleware;
use crate::state::AppState;

// ============================================================================
// Query / Request / Response DTOs
// ============================================================================

#[derive(Deserialize)]
struct ExportQuery {
    format: String,
}

#[derive(Deserialize)]
struct ImportTaskItem {
    title: String,
    description: Option<String>,
    priority: Option<String>,
    column_name: Option<String>,
    due_date: Option<String>,
}

#[derive(Deserialize)]
struct ImportCsvBody {
    csv_text: String,
}

#[derive(Deserialize)]
struct TrelloCard {
    name: Option<String>,
    desc: Option<String>,
    due: Option<String>,
    #[serde(rename = "idList")]
    id_list: Option<String>,
    closed: Option<bool>,
}

#[derive(Deserialize)]
struct TrelloList {
    id: Option<String>,
    name: Option<String>,
    closed: Option<bool>,
}

#[derive(Deserialize)]
struct TrelloExport {
    #[allow(dead_code)]
    name: Option<String>,
    lists: Option<Vec<TrelloList>>,
    cards: Option<Vec<TrelloCard>>,
}

#[derive(Serialize)]
struct ImportResult {
    imported_count: i64,
}

#[derive(Serialize)]
struct TrelloImportResult {
    imported_count: i64,
    columns_created: i64,
    skipped: i64,
}

// Export response types
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

#[derive(sqlx::FromRow)]
struct ColumnIdRow {
    id: Uuid,
}

#[derive(sqlx::FromRow)]
struct NewColumnRow {
    id: Uuid,
}

#[derive(sqlx::FromRow)]
#[allow(dead_code)]
struct CreatedTaskRow {
    id: Uuid,
}

// ============================================================================
// Helpers
// ============================================================================

/// Verify the current user is a board member. Returns Err(AppError) if not.
async fn verify_board_membership(
    db: &sqlx::PgPool,
    board_id: Uuid,
    user_id: Uuid,
) -> Result<()> {
    let is_member: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM board_members WHERE board_id = $1 AND user_id = $2)",
    )
    .bind(board_id)
    .bind(user_id)
    .fetch_one(db)
    .await
    .map_err(AppError::from)?;

    if !is_member {
        return Err(AppError::Forbidden("Not a board member".into()));
    }
    Ok(())
}

/// Parse a priority string into one of the valid DB enum values.
/// Returns "medium" as default if unrecognized.
fn normalize_priority(input: &str) -> &'static str {
    match input.to_lowercase().trim() {
        "urgent" => "urgent",
        "high" => "high",
        "medium" => "medium",
        "low" => "low",
        _ => "medium",
    }
}

/// Simple CSV parser that handles quoted fields.
/// Returns a Vec of rows, each row being a Vec of field strings.
fn parse_csv(input: &str) -> Vec<Vec<String>> {
    let mut rows: Vec<Vec<String>> = Vec::new();

    for line in input.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let mut fields: Vec<String> = Vec::new();
        let mut current = String::new();
        let mut in_quotes = false;
        let mut chars = trimmed.chars().peekable();

        while let Some(ch) = chars.next() {
            if in_quotes {
                if ch == '"' {
                    // Check for escaped quote ""
                    if chars.peek() == Some(&'"') {
                        current.push('"');
                        chars.next();
                    } else {
                        in_quotes = false;
                    }
                } else {
                    current.push(ch);
                }
            } else {
                match ch {
                    '"' => {
                        in_quotes = true;
                    }
                    ',' => {
                        fields.push(current.trim().to_string());
                        current = String::new();
                    }
                    _ => {
                        current.push(ch);
                    }
                }
            }
        }
        fields.push(current.trim().to_string());
        rows.push(fields);
    }

    rows
}

/// Escape a field for CSV output (wrap in quotes if it contains comma, quote, or newline).
fn csv_escape(field: &str) -> String {
    if field.contains(',') || field.contains('"') || field.contains('\n') {
        format!("\"{}\"", field.replace('"', "\"\""))
    } else {
        field.to_string()
    }
}

/// Resolve a column_name to a column_id for a given board.
/// Falls back to the first column (by position) if the name is not found.
async fn resolve_column_id(
    db: &sqlx::PgPool,
    board_id: Uuid,
    column_name: Option<&str>,
) -> Result<Uuid> {
    if let Some(name) = column_name {
        if !name.is_empty() {
            let row: Option<ColumnIdRow> = sqlx::query_as(
                "SELECT id FROM board_columns WHERE board_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1",
            )
            .bind(board_id)
            .bind(name)
            .fetch_optional(db)
            .await
            .map_err(AppError::from)?;

            if let Some(r) = row {
                return Ok(r.id);
            }
        }
    }

    // Fallback: first column by position
    let fallback: ColumnIdRow = sqlx::query_as(
        "SELECT id FROM board_columns WHERE board_id = $1 ORDER BY position ASC LIMIT 1",
    )
    .bind(board_id)
    .fetch_optional(db)
    .await
    .map_err(AppError::from)?
    .ok_or_else(|| AppError::BadRequest("Board has no columns".into()))?;

    Ok(fallback.id)
}

/// Get the next fractional position key for a column (simple: fetch max and append "a").
async fn next_position_in_column(db: &sqlx::PgPool, column_id: Uuid) -> Result<String> {
    let max_pos: Option<String> = sqlx::query_scalar(
        "SELECT MAX(position) FROM tasks WHERE column_id = $1 AND deleted_at IS NULL",
    )
    .bind(column_id)
    .fetch_one(db)
    .await
    .map_err(AppError::from)?;

    match max_pos {
        Some(p) => Ok(format!("{}a", p)),
        None => Ok("a0".to_string()),
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
    verify_board_membership(&state.db, board_id, tenant.user_id).await?;

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
    let board_name: Option<String> = sqlx::query_scalar(
        "SELECT name FROM boards WHERE id = $1",
    )
    .bind(board_id)
    .fetch_optional(db)
    .await
    .map_err(AppError::from)?;

    let filename = format!(
        "{}_export.csv",
        board_name
            .unwrap_or_else(|| "board".into())
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
                let task_assignees = assignee_map
                    .get(&t.title)
                    .cloned()
                    .unwrap_or_default();
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

/// POST /boards/{board_id}/import
///
/// Import tasks from a JSON array.
async fn import_json_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(board_id): Path<Uuid>,
    Json(items): Json<Vec<ImportTaskItem>>,
) -> Result<Json<ImportResult>> {
    verify_board_membership(&state.db, board_id, tenant.user_id).await?;

    if items.is_empty() {
        return Ok(Json(ImportResult { imported_count: 0 }));
    }

    let mut imported: i64 = 0;

    for item in &items {
        if item.title.trim().is_empty() {
            continue;
        }

        let column_id =
            resolve_column_id(&state.db, board_id, item.column_name.as_deref()).await?;
        let position = next_position_in_column(&state.db, column_id).await?;
        let priority = normalize_priority(item.priority.as_deref().unwrap_or("medium"));

        let due_date: Option<DateTime<Utc>> = item.due_date.as_deref().and_then(|d| {
            d.parse::<DateTime<Utc>>()
                .ok()
                .or_else(|| {
                    chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d")
                        .ok()
                        .and_then(|nd| nd.and_hms_opt(0, 0, 0).map(|ndt| ndt.and_utc()))
                })
        });

        let _created: Option<CreatedTaskRow> = sqlx::query_as(
            r#"
            INSERT INTO tasks (id, title, description, priority, due_date, board_id, column_id, position, tenant_id, created_by_id, created_at, updated_at)
            VALUES (gen_random_uuid(), $1, $2, $3::task_priority, $4, $5, $6, $7, $8, $9, NOW(), NOW())
            RETURNING id
            "#,
        )
        .bind(&item.title)
        .bind(&item.description)
        .bind(priority)
        .bind(due_date)
        .bind(board_id)
        .bind(column_id)
        .bind(&position)
        .bind(tenant.tenant_id)
        .bind(tenant.user_id)
        .fetch_optional(&state.db)
        .await
        .map_err(AppError::from)?;

        imported += 1;
    }

    Ok(Json(ImportResult {
        imported_count: imported,
    }))
}

/// POST /boards/{board_id}/import/csv
///
/// Import tasks from CSV text.
async fn import_csv_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(board_id): Path<Uuid>,
    Json(body): Json<ImportCsvBody>,
) -> Result<Json<ImportResult>> {
    verify_board_membership(&state.db, board_id, tenant.user_id).await?;

    let rows = parse_csv(&body.csv_text);
    if rows.is_empty() {
        return Ok(Json(ImportResult { imported_count: 0 }));
    }

    // Determine if first row is a header
    let first_row_lower: Vec<String> = rows[0].iter().map(|f| f.to_lowercase()).collect();
    let has_header = first_row_lower.contains(&"title".to_string());

    let data_rows = if has_header { &rows[1..] } else { &rows[..] };

    // Expected columns: title, description, priority, column_name, due_date
    // Minimal: at least title (first column)
    let mut imported: i64 = 0;

    for row in data_rows {
        if row.is_empty() {
            continue;
        }

        let title = row.first().map(|s| s.as_str()).unwrap_or("").trim();
        if title.is_empty() {
            continue;
        }

        let description = row.get(1).map(|s| s.as_str()).filter(|s| !s.is_empty());
        let priority_str = row.get(2).map(|s| s.as_str()).unwrap_or("medium");
        let column_name = row.get(3).map(|s| s.as_str()).filter(|s| !s.is_empty());
        let due_date_str = row.get(4).map(|s| s.as_str()).filter(|s| !s.is_empty());

        let column_id = resolve_column_id(&state.db, board_id, column_name).await?;
        let position = next_position_in_column(&state.db, column_id).await?;
        let priority = normalize_priority(priority_str);

        let due_date: Option<DateTime<Utc>> = due_date_str.and_then(|d| {
            d.parse::<DateTime<Utc>>()
                .ok()
                .or_else(|| {
                    chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d")
                        .ok()
                        .and_then(|nd| nd.and_hms_opt(0, 0, 0).map(|ndt| ndt.and_utc()))
                })
        });

        let _created: Option<CreatedTaskRow> = sqlx::query_as(
            r#"
            INSERT INTO tasks (id, title, description, priority, due_date, board_id, column_id, position, tenant_id, created_by_id, created_at, updated_at)
            VALUES (gen_random_uuid(), $1, $2, $3::task_priority, $4, $5, $6, $7, $8, $9, NOW(), NOW())
            RETURNING id
            "#,
        )
        .bind(title)
        .bind(description)
        .bind(priority)
        .bind(due_date)
        .bind(board_id)
        .bind(column_id)
        .bind(&position)
        .bind(tenant.tenant_id)
        .bind(tenant.user_id)
        .fetch_optional(&state.db)
        .await
        .map_err(AppError::from)?;

        imported += 1;
    }

    Ok(Json(ImportResult {
        imported_count: imported,
    }))
}

/// POST /boards/{board_id}/import/trello
///
/// Import from a Trello board JSON export.
async fn import_trello_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(board_id): Path<Uuid>,
    Json(trello): Json<TrelloExport>,
) -> Result<Json<TrelloImportResult>> {
    verify_board_membership(&state.db, board_id, tenant.user_id).await?;

    // Build a map of Trello list_id -> list_name
    let trello_lists = trello.lists.unwrap_or_default();
    let mut list_id_to_name: std::collections::HashMap<String, String> =
        std::collections::HashMap::new();
    for list in &trello_lists {
        if list.closed.unwrap_or(false) {
            continue;
        }
        if let (Some(id), Some(name)) = (&list.id, &list.name) {
            list_id_to_name.insert(id.clone(), name.clone());
        }
    }

    // Fetch existing columns for this board
    let existing_columns: Vec<ColumnRow> = sqlx::query_as(
        "SELECT id, name, position, color FROM board_columns WHERE board_id = $1 ORDER BY position",
    )
    .bind(board_id)
    .fetch_all(&state.db)
    .await
    .map_err(AppError::from)?;

    let mut column_name_to_id: std::collections::HashMap<String, Uuid> =
        std::collections::HashMap::new();
    for col in &existing_columns {
        column_name_to_id.insert(col.name.to_lowercase(), col.id);
    }

    // Determine last position for creating new columns
    let mut last_position = existing_columns
        .last()
        .map(|c| c.position.clone())
        .unwrap_or_else(|| "a0".to_string());

    let mut columns_created: i64 = 0;

    // Ensure columns exist for each Trello list
    for list_name in list_id_to_name.values() {
        let key = list_name.to_lowercase();
        if !column_name_to_id.contains_key(&key) {
            // Create the column
            let new_pos = format!("{}a", last_position);
            let new_col: NewColumnRow = sqlx::query_as(
                r#"
                INSERT INTO board_columns (id, name, board_id, position, created_at)
                VALUES (gen_random_uuid(), $1, $2, $3, NOW())
                RETURNING id
                "#,
            )
            .bind(list_name)
            .bind(board_id)
            .bind(&new_pos)
            .fetch_one(&state.db)
            .await
            .map_err(AppError::from)?;

            column_name_to_id.insert(key, new_col.id);
            last_position = new_pos;
            columns_created += 1;
        }
    }

    // Import cards as tasks
    let cards = trello.cards.unwrap_or_default();
    let mut imported: i64 = 0;
    let mut skipped: i64 = 0;

    for card in &cards {
        if card.closed.unwrap_or(false) {
            skipped += 1;
            continue;
        }

        let title = card.name.as_deref().unwrap_or("").trim();
        if title.is_empty() {
            skipped += 1;
            continue;
        }

        // Resolve column from Trello list id
        let column_name = card
            .id_list
            .as_deref()
            .and_then(|lid| list_id_to_name.get(lid));

        let column_id = if let Some(name) = column_name {
            column_name_to_id
                .get(&name.to_lowercase())
                .copied()
                .unwrap_or_else(|| {
                    // Fallback to first column
                    existing_columns
                        .first()
                        .map(|c| c.id)
                        .unwrap_or(Uuid::nil())
                })
        } else {
            // Fallback to first column
            resolve_column_id_sync(&column_name_to_id, &existing_columns)
        };

        if column_id == Uuid::nil() {
            skipped += 1;
            continue;
        }

        let position = next_position_in_column(&state.db, column_id).await?;
        let description = card.desc.as_deref().filter(|d| !d.is_empty());

        let due_date: Option<DateTime<Utc>> = card.due.as_deref().and_then(|d| {
            d.parse::<DateTime<Utc>>()
                .ok()
                .or_else(|| {
                    chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d")
                        .ok()
                        .and_then(|nd| nd.and_hms_opt(0, 0, 0).map(|ndt| ndt.and_utc()))
                })
        });

        let _created: Option<CreatedTaskRow> = sqlx::query_as(
            r#"
            INSERT INTO tasks (id, title, description, priority, due_date, board_id, column_id, position, tenant_id, created_by_id, created_at, updated_at)
            VALUES (gen_random_uuid(), $1, $2, 'medium'::task_priority, $3, $4, $5, $6, $7, $8, NOW(), NOW())
            RETURNING id
            "#,
        )
        .bind(title)
        .bind(description)
        .bind(due_date)
        .bind(board_id)
        .bind(column_id)
        .bind(&position)
        .bind(tenant.tenant_id)
        .bind(tenant.user_id)
        .fetch_optional(&state.db)
        .await
        .map_err(AppError::from)?;

        imported += 1;
    }

    Ok(Json(TrelloImportResult {
        imported_count: imported,
        columns_created,
        skipped,
    }))
}

/// Synchronous fallback: pick the first column_id from the map or existing columns.
fn resolve_column_id_sync(
    name_map: &std::collections::HashMap<String, Uuid>,
    existing: &[ColumnRow],
) -> Uuid {
    if let Some(id) = name_map.values().next() {
        return *id;
    }
    existing
        .first()
        .map(|c| c.id)
        .unwrap_or(Uuid::nil())
}

// ============================================================================
// Router
// ============================================================================

pub fn import_export_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/boards/{board_id}/export", get(export_handler))
        .route("/boards/{board_id}/import", post(import_json_handler))
        .route("/boards/{board_id}/import/csv", post(import_csv_handler))
        .route(
            "/boards/{board_id}/import/trello",
            post(import_trello_handler),
        )
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
