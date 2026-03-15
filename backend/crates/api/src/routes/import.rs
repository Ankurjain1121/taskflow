//! Import REST endpoints
//!
//! Provides import (JSON, CSV, Trello) for board tasks.

use axum::{
    extract::{Path, State},
    middleware::from_fn_with_state,
    routing::post,
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::auth_middleware;
use crate::state::AppState;

use super::common::verify_project_membership;

// ============================================================================
// DTOs
// ============================================================================

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

// Internal row types for sqlx
#[derive(sqlx::FromRow)]
struct ColumnRow {
    id: Uuid,
    name: String,
    position: String,
    #[allow(dead_code)]
    color: Option<String>,
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

/// Get the next position key for a column.
async fn next_position_in_column(db: &sqlx::PgPool, column_id: Uuid) -> Result<String> {
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM tasks WHERE column_id = $1 AND deleted_at IS NULL",
    )
    .bind(column_id)
    .fetch_one(db)
    .await
    .map_err(AppError::from)?;

    Ok(format!("{:06}", count))
}

/// Synchronous fallback: pick the first column_id from the map or existing columns.
fn resolve_column_id_sync(
    name_map: &std::collections::HashMap<String, Uuid>,
    existing: &[ColumnRow],
) -> Uuid {
    if let Some(id) = name_map.values().next() {
        return *id;
    }
    existing.first().map(|c| c.id).unwrap_or(Uuid::nil())
}

// ============================================================================
// Route Handlers
// ============================================================================

/// POST /boards/{board_id}/import
///
/// Import tasks from a JSON array.
async fn import_json_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(board_id): Path<Uuid>,
    Json(items): Json<Vec<ImportTaskItem>>,
) -> Result<Json<ImportResult>> {
    verify_project_membership(&state.db, board_id, tenant.user_id).await?;

    if items.is_empty() {
        return Ok(Json(ImportResult { imported_count: 0 }));
    }

    let mut imported: i64 = 0;

    for item in &items {
        if item.title.trim().is_empty() {
            continue;
        }

        let column_id = resolve_column_id(&state.db, board_id, item.column_name.as_deref()).await?;
        let position = next_position_in_column(&state.db, column_id).await?;
        let priority = normalize_priority(item.priority.as_deref().unwrap_or("medium"));

        let due_date: Option<DateTime<Utc>> = item.due_date.as_deref().and_then(|d| {
            d.parse::<DateTime<Utc>>().ok().or_else(|| {
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
    verify_project_membership(&state.db, board_id, tenant.user_id).await?;

    let rows = parse_csv(&body.csv_text);
    if rows.is_empty() {
        return Ok(Json(ImportResult { imported_count: 0 }));
    }

    // Determine if first row is a header
    let first_row_lower: Vec<String> = rows[0].iter().map(|f| f.to_lowercase()).collect();
    let has_header = first_row_lower.contains(&"title".to_string());

    let data_rows = if has_header { &rows[1..] } else { &rows[..] };

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
            d.parse::<DateTime<Utc>>().ok().or_else(|| {
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
    verify_project_membership(&state.db, board_id, tenant.user_id).await?;

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
        if let std::collections::hash_map::Entry::Vacant(e) = column_name_to_id.entry(key) {
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

            e.insert(new_col.id);
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
            d.parse::<DateTime<Utc>>().ok().or_else(|| {
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

// ============================================================================
// Router
// ============================================================================

pub fn import_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/projects/{board_id}/import", post(import_json_handler))
        .route("/projects/{board_id}/import/csv", post(import_csv_handler))
        .route(
            "/projects/{board_id}/import/trello",
            post(import_trello_handler),
        )
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
