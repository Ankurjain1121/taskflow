//! Eisenhower Matrix database queries
//!
//! Provides queries for fetching tasks grouped by the Eisenhower Matrix quadrants:
//! - Do First: Urgent + Important
//! - Schedule: Not Urgent + Important
//! - Delegate: Urgent + Not Important
//! - Eliminate: Not Urgent + Not Important

use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::TaskPriority;

/// Eisenhower Matrix quadrant
#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EisenhowerQuadrant {
    DoFirst,   // Urgent + Important
    Schedule,  // Not Urgent + Important
    Delegate,  // Urgent + Not Important
    Eliminate, // Not Urgent + Not Important
}

/// Assignee info returned with Eisenhower tasks
#[derive(Debug, Serialize, Clone)]
pub struct EisenhowerAssignee {
    pub id: Uuid,
    pub display_name: String,
    pub avatar_url: Option<String>,
}

/// Internal row type for assignee query
#[derive(sqlx::FromRow)]
struct AssigneeRow {
    task_id: Uuid,
    user_id: Uuid,
    display_name: String,
    avatar_url: Option<String>,
}

/// Task item for Eisenhower Matrix with computed quadrant
#[derive(Debug, Serialize, Clone)]
pub struct EisenhowerTaskItem {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub priority: TaskPriority,
    pub due_date: Option<DateTime<Utc>>,
    pub board_id: Uuid,
    pub board_name: String,
    pub column_id: Uuid,
    pub column_name: String,
    pub position: String,
    pub is_done: bool,
    pub eisenhower_urgency: Option<bool>,
    pub eisenhower_importance: Option<bool>,
    pub quadrant: EisenhowerQuadrant,
    pub assignees: Vec<EisenhowerAssignee>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Response containing tasks grouped by quadrant
#[derive(Debug, Serialize)]
pub struct EisenhowerMatrixResponse {
    pub do_first: Vec<EisenhowerTaskItem>,
    pub schedule: Vec<EisenhowerTaskItem>,
    pub delegate: Vec<EisenhowerTaskItem>,
    pub eliminate: Vec<EisenhowerTaskItem>,
}

/// Internal row type for Eisenhower query
#[derive(sqlx::FromRow)]
struct EisenhowerTaskRow {
    id: Uuid,
    title: String,
    description: Option<String>,
    priority: TaskPriority,
    due_date: Option<DateTime<Utc>>,
    board_id: Uuid,
    board_name: String,
    column_id: Uuid,
    column_name: String,
    position: String,
    status_mapping: Option<serde_json::Value>,
    eisenhower_urgency: Option<bool>,
    eisenhower_importance: Option<bool>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

/// Compute urgency based on due date
/// Auto: due_date <= now + 2 days
fn compute_urgency(due_date: Option<DateTime<Utc>>) -> bool {
    if let Some(due_date) = due_date {
        let threshold = Utc::now() + Duration::days(2);
        due_date <= threshold
    } else {
        false
    }
}

/// Compute importance based on priority
/// Auto: priority = Urgent | High
fn compute_importance(priority: &TaskPriority) -> bool {
    matches!(priority, TaskPriority::Urgent | TaskPriority::High)
}

/// Determine quadrant based on urgency and importance
fn determine_quadrant(urgent: bool, important: bool) -> EisenhowerQuadrant {
    match (urgent, important) {
        (true, true) => EisenhowerQuadrant::DoFirst,
        (false, true) => EisenhowerQuadrant::Schedule,
        (true, false) => EisenhowerQuadrant::Delegate,
        (false, false) => EisenhowerQuadrant::Eliminate,
    }
}

/// Check if task is "done" based on column status mapping
fn is_task_done(status_mapping: &Option<serde_json::Value>) -> bool {
    status_mapping
        .as_ref()
        .and_then(|m| m.get("done"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
}

/// Filter parameters for the Eisenhower Matrix query
#[derive(Debug, Default)]
pub struct EisenhowerFilters {
    pub workspace_id: Option<Uuid>,
    pub board_id: Option<Uuid>,
    pub daily: bool,
}

/// Fetch all tasks assigned to user, grouped by Eisenhower Matrix quadrants
pub async fn get_eisenhower_matrix(
    pool: &PgPool,
    user_id: Uuid,
    filters: &EisenhowerFilters,
) -> Result<EisenhowerMatrixResponse, sqlx::Error> {
    // Build dynamic WHERE clauses
    let mut extra_where = String::new();
    if filters.workspace_id.is_some() {
        extra_where.push_str(" AND b.workspace_id = $2");
    }
    if filters.board_id.is_some() {
        let idx = if filters.workspace_id.is_some() { 3 } else { 2 };
        extra_where.push_str(&format!(" AND t.board_id = ${idx}"));
    }
    if filters.daily {
        extra_where.push_str(" AND t.due_date IS NOT NULL AND t.due_date::date <= CURRENT_DATE");
    }

    let query = format!(
        r#"
        SELECT
            t.id,
            t.title,
            t.description,
            t.priority,
            t.due_date,
            t.board_id,
            b.name as board_name,
            t.column_id,
            c.name as column_name,
            t.position,
            c.status_mapping,
            t.eisenhower_urgency,
            t.eisenhower_importance,
            t.created_at,
            t.updated_at
        FROM tasks t
        INNER JOIN task_assignees ta ON t.id = ta.task_id
        INNER JOIN boards b ON t.board_id = b.id AND b.deleted_at IS NULL
        INNER JOIN board_columns c ON t.column_id = c.id
        INNER JOIN board_members bm ON bm.board_id = t.board_id AND bm.user_id = $1
        WHERE ta.user_id = $1
          AND t.deleted_at IS NULL
          AND NOT COALESCE((c.status_mapping->>'done')::boolean, false)
          {extra_where}
        ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC
        "#,
    );

    let mut q = sqlx::query_as::<_, EisenhowerTaskRow>(&query).bind(user_id);
    if let Some(ws_id) = filters.workspace_id {
        q = q.bind(ws_id);
    }
    if let Some(b_id) = filters.board_id {
        q = q.bind(b_id);
    }

    let rows: Vec<EisenhowerTaskRow> = q.fetch_all(pool).await?;

    // Collect task IDs to fetch assignees in one batch query
    let task_ids: Vec<Uuid> = rows.iter().map(|r| r.id).collect();

    // Fetch all assignees for the task IDs
    let mut assignee_map: std::collections::HashMap<Uuid, Vec<EisenhowerAssignee>> =
        std::collections::HashMap::new();

    if !task_ids.is_empty() {
        let assignee_rows = sqlx::query_as::<_, AssigneeRow>(
            r#"
            SELECT ta.task_id, ta.user_id, u.name as display_name, u.avatar_url
            FROM task_assignees ta
            INNER JOIN users u ON ta.user_id = u.id
            WHERE ta.task_id = ANY($1)
            ORDER BY ta.assigned_at ASC
            "#,
        )
        .bind(&task_ids)
        .fetch_all(pool)
        .await?;

        for arow in assignee_rows {
            assignee_map
                .entry(arow.task_id)
                .or_default()
                .push(EisenhowerAssignee {
                    id: arow.user_id,
                    display_name: arow.display_name,
                    avatar_url: arow.avatar_url,
                });
        }
    }

    // Group tasks by quadrant
    let mut do_first = Vec::new();
    let mut schedule = Vec::new();
    let mut delegate = Vec::new();
    let mut eliminate = Vec::new();

    for row in rows {
        let is_done = is_task_done(&row.status_mapping);

        // Get urgency: use manual override if set, otherwise auto-compute
        let urgent = row
            .eisenhower_urgency
            .unwrap_or_else(|| compute_urgency(row.due_date));

        // Get importance: use manual override if set, otherwise auto-compute
        let important = row
            .eisenhower_importance
            .unwrap_or_else(|| compute_importance(&row.priority));

        let quadrant = determine_quadrant(urgent, important);

        let assignees = assignee_map.remove(&row.id).unwrap_or_default();

        let task = EisenhowerTaskItem {
            id: row.id,
            title: row.title,
            description: row.description,
            priority: row.priority,
            due_date: row.due_date,
            board_id: row.board_id,
            board_name: row.board_name,
            column_id: row.column_id,
            column_name: row.column_name,
            position: row.position,
            is_done,
            eisenhower_urgency: row.eisenhower_urgency,
            eisenhower_importance: row.eisenhower_importance,
            quadrant,
            assignees,
            created_at: row.created_at,
            updated_at: row.updated_at,
        };

        match quadrant {
            EisenhowerQuadrant::DoFirst => do_first.push(task),
            EisenhowerQuadrant::Schedule => schedule.push(task),
            EisenhowerQuadrant::Delegate => delegate.push(task),
            EisenhowerQuadrant::Eliminate => eliminate.push(task),
        }
    }

    Ok(EisenhowerMatrixResponse {
        do_first,
        schedule,
        delegate,
        eliminate,
    })
}

/// Update task's Eisenhower manual overrides
pub async fn update_eisenhower_overrides(
    pool: &PgPool,
    task_id: Uuid,
    urgency: Option<bool>,
    importance: Option<bool>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE tasks
        SET
            eisenhower_urgency = $1,
            eisenhower_importance = $2,
            updated_at = now()
        WHERE id = $3
        "#,
    )
    .bind(urgency)
    .bind(importance)
    .bind(task_id)
    .execute(pool)
    .await?;

    Ok(())
}

/// Reset all manual overrides for a user's tasks (auto-sort)
pub async fn reset_eisenhower_overrides(pool: &PgPool, user_id: Uuid) -> Result<u64, sqlx::Error> {
    let result = sqlx::query(
        r#"
        UPDATE tasks
        SET
            eisenhower_urgency = NULL,
            eisenhower_importance = NULL,
            updated_at = now()
        WHERE id IN (
            SELECT t.id
            FROM tasks t
            INNER JOIN task_assignees ta ON t.id = ta.task_id
            INNER JOIN boards b ON t.board_id = b.id AND b.deleted_at IS NULL
            INNER JOIN board_members bm ON bm.board_id = t.board_id AND bm.user_id = $1
            WHERE ta.user_id = $1
              AND t.deleted_at IS NULL
        )
        "#,
    )
    .bind(user_id)
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
}
