//! Dashboard chart and visualization queries.
//!
//! Split from `dashboard.rs` to keep that file focused on stats/aggregation.
//! Contains: tasks by status, tasks by priority, completion trend,
//! focus tasks, project pulse, and user streak.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::TaskPriority;

/// Tasks grouped by status (column name)
#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct TasksByStatus {
    pub status: String,
    pub count: i64,
    pub color: Option<String>,
}

/// Get tasks grouped by status for dashboard chart
pub async fn get_tasks_by_status(
    pool: &PgPool,
    user_id: Uuid,
    workspace_id: Option<Uuid>,
) -> Result<Vec<TasksByStatus>, sqlx::Error> {
    let rows = sqlx::query_as::<_, TasksByStatus>(
        r#"
        SELECT
            bc.name as status,
            COUNT(DISTINCT t.id)::bigint as count,
            bc.color
        FROM tasks t
        INNER JOIN task_assignees ta ON ta.task_id = t.id
        INNER JOIN projects b ON b.id = t.project_id AND b.deleted_at IS NULL
        INNER JOIN project_statuses bc ON bc.id = t.status_id
        INNER JOIN project_members bm ON bm.project_id = t.project_id AND bm.user_id = $1
        WHERE ta.user_id = $1
          AND t.deleted_at IS NULL
          AND ($2::uuid IS NULL OR b.workspace_id = $2)
        GROUP BY bc.name, bc.color
        ORDER BY count DESC
        "#,
    )
    .bind(user_id)
    .bind(workspace_id)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

/// Tasks grouped by priority
#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct TasksByPriority {
    pub priority: TaskPriority,
    pub count: i64,
}

/// Get tasks grouped by priority for dashboard chart
pub async fn get_tasks_by_priority(
    pool: &PgPool,
    user_id: Uuid,
    workspace_id: Option<Uuid>,
) -> Result<Vec<TasksByPriority>, sqlx::Error> {
    let rows = sqlx::query_as::<_, TasksByPriority>(
        r#"
        SELECT
            t.priority,
            COUNT(DISTINCT t.id)::bigint as count
        FROM tasks t
        INNER JOIN task_assignees ta ON ta.task_id = t.id
        INNER JOIN projects b ON b.id = t.project_id AND b.deleted_at IS NULL
        INNER JOIN project_members bm ON bm.project_id = t.project_id AND bm.user_id = $1
        WHERE ta.user_id = $1
          AND t.deleted_at IS NULL
          AND ($2::uuid IS NULL OR b.workspace_id = $2)
        GROUP BY t.priority
        ORDER BY
            CASE t.priority
                WHEN 'urgent' THEN 1
                WHEN 'high' THEN 2
                WHEN 'medium' THEN 3
                WHEN 'low' THEN 4
            END
        "#,
    )
    .bind(user_id)
    .bind(workspace_id)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

/// Completion trend data point
#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct CompletionTrendPoint {
    pub date: String,
    pub completed: i64,
}

/// Get completion trend over the last N days
pub async fn get_completion_trend(
    pool: &PgPool,
    user_id: Uuid,
    days: i64,
    workspace_id: Option<Uuid>,
) -> Result<Vec<CompletionTrendPoint>, sqlx::Error> {
    let days = days.clamp(7, 90);
    let start_date = Utc::now() - chrono::Duration::days(days);

    let rows = sqlx::query_as::<_, CompletionTrendPoint>(
        r#"
        SELECT
            DATE(al.created_at)::text as date,
            COUNT(DISTINCT al.entity_id)::bigint as completed
        FROM activity_log al
        INNER JOIN tasks t ON t.id = al.entity_id AND t.deleted_at IS NULL
        INNER JOIN task_assignees ta ON ta.task_id = t.id AND ta.user_id = $1
        INNER JOIN projects b ON b.id = t.project_id AND b.deleted_at IS NULL
        INNER JOIN project_statuses bc ON bc.id = t.status_id
        WHERE al.action = 'moved'
          AND al.entity_type = 'task'
          AND al.created_at >= $2
          AND bc.type = 'done'
          AND ($3::uuid IS NULL OR b.workspace_id = $3)
        GROUP BY DATE(al.created_at)
        ORDER BY date ASC
        "#,
    )
    .bind(user_id)
    .bind(start_date)
    .bind(workspace_id)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

// ── Focus Tasks ──────────────────────────────────────────────────────

/// A single assignee shown on a focus task card
#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct FocusTaskAssignee {
    pub id: Uuid,
    pub name: String,
    pub avatar_url: Option<String>,
}

/// A high-priority task for the focus-tasks endpoint
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FocusTask {
    pub id: Uuid,
    pub title: String,
    pub priority: TaskPriority,
    pub due_date: Option<DateTime<Utc>>,
    pub project_id: Uuid,
    pub project_name: String,
    pub project_color: Option<String>,
    pub status_name: String,
    pub status_color: String,
    pub days_overdue: Option<i32>,
    pub assignees: Vec<FocusTaskAssignee>,
}

/// Internal row returned by the focus-tasks SQL query (before assignee aggregation)
#[derive(Debug, sqlx::FromRow)]
struct FocusTaskRow {
    pub id: Uuid,
    pub title: String,
    pub priority: TaskPriority,
    pub due_date: Option<DateTime<Utc>>,
    pub project_id: Uuid,
    pub project_name: String,
    pub project_color: Option<String>,
    pub status_name: String,
    pub status_color: String,
    pub days_overdue: Option<i32>,
}

/// Get the user's top 5 focus tasks, auto-sorted:
/// 1. Overdue (most overdue first)
/// 2. Due today (highest priority first)
/// 3. Highest priority without due date
pub async fn get_focus_tasks(
    pool: &PgPool,
    user_id: Uuid,
    workspace_id: Option<Uuid>,
) -> Result<Vec<FocusTask>, sqlx::Error> {
    let now = Utc::now();

    let rows = sqlx::query_as::<_, FocusTaskRow>(
        r#"
        SELECT
            t.id,
            t.title,
            t.priority,
            t.due_date,
            t.project_id,
            p.name AS project_name,
            p.background_color AS project_color,
            ps.name AS status_name,
            COALESCE(ps.color, '#6b7280') AS status_color,
            CASE
                WHEN t.due_date IS NOT NULL AND t.due_date < $2
                THEN EXTRACT(DAY FROM ($2 - t.due_date))::integer
                ELSE NULL
            END AS days_overdue
        FROM tasks t
        INNER JOIN task_assignees ta ON ta.task_id = t.id AND ta.user_id = $1
        INNER JOIN projects p ON p.id = t.project_id AND p.deleted_at IS NULL
        INNER JOIN project_statuses ps ON ps.id = t.status_id
        INNER JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = $1
        WHERE t.deleted_at IS NULL
          AND t.parent_task_id IS NULL
          AND ps.type != 'done'
          AND ($3::uuid IS NULL OR p.workspace_id = $3)
          AND (
              -- RBAC: user is assigned (already joined above) OR has can_view_all_tasks
              ta.user_id = $1
              OR NOT EXISTS (
                  SELECT 1 FROM project_members pm2
                  WHERE pm2.project_id = t.project_id AND pm2.user_id = $1 AND pm2.role_id IS NOT NULL
              )
              OR (
                  SELECT wr.capabilities->>'can_view_all_tasks' = 'true'
                  FROM workspace_roles wr
                  JOIN project_members pm3 ON pm3.role_id = wr.id
                  WHERE pm3.project_id = t.project_id AND pm3.user_id = $1
              )
          )
        ORDER BY
            -- Overdue first (most overdue at top)
            CASE WHEN t.due_date IS NOT NULL AND t.due_date < $2 THEN 0 ELSE 1 END,
            CASE WHEN t.due_date IS NOT NULL AND t.due_date < $2 THEN t.due_date END ASC,
            -- Due today next (highest priority first)
            CASE WHEN t.due_date IS NOT NULL AND t.due_date >= CURRENT_DATE AND t.due_date < CURRENT_DATE + INTERVAL '1 day' THEN 0 ELSE 1 END,
            CASE t.priority
                WHEN 'urgent' THEN 1
                WHEN 'high'   THEN 2
                WHEN 'medium' THEN 3
                WHEN 'low'    THEN 4
            END,
            -- Then highest priority without due date
            t.due_date ASC NULLS LAST
        LIMIT 5
        "#,
    )
    .bind(user_id)
    .bind(now)
    .bind(workspace_id)
    .fetch_all(pool)
    .await?;

    // Collect task IDs and fetch assignees in a single query
    let task_ids: Vec<Uuid> = rows.iter().map(|r| r.id).collect();
    if task_ids.is_empty() {
        return Ok(Vec::new());
    }

    let assignee_rows = sqlx::query_as::<_, FocusTaskAssigneeRow>(
        r#"
        SELECT ta.task_id, u.id, u.name, u.avatar_url
        FROM task_assignees ta
        INNER JOIN users u ON u.id = ta.user_id
        WHERE ta.task_id = ANY($1)
        ORDER BY ta.assigned_at ASC
        "#,
    )
    .bind(&task_ids)
    .fetch_all(pool)
    .await?;

    // Group assignees by task_id
    let mut assignees_map: std::collections::HashMap<Uuid, Vec<FocusTaskAssignee>> =
        std::collections::HashMap::new();
    for row in assignee_rows {
        assignees_map
            .entry(row.task_id)
            .or_default()
            .push(FocusTaskAssignee {
                id: row.id,
                name: row.name,
                avatar_url: row.avatar_url,
            });
    }

    let tasks = rows
        .into_iter()
        .map(|r| FocusTask {
            assignees: assignees_map.remove(&r.id).unwrap_or_default(),
            id: r.id,
            title: r.title,
            priority: r.priority,
            due_date: r.due_date,
            project_id: r.project_id,
            project_name: r.project_name,
            project_color: r.project_color,
            status_name: r.status_name,
            status_color: r.status_color,
            days_overdue: r.days_overdue,
        })
        .collect();

    Ok(tasks)
}

/// Internal row for fetching assignees with their task_id
#[derive(Debug, sqlx::FromRow)]
struct FocusTaskAssigneeRow {
    pub task_id: Uuid,
    pub id: Uuid,
    pub name: String,
    pub avatar_url: Option<String>,
}

// ── Project Pulse ────────────────────────────────────────────────────

/// Health status for a project
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ProjectHealth {
    Green,
    Amber,
    Red,
}

/// Per-project health stats for the project-pulse endpoint
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProjectPulse {
    pub project_id: Uuid,
    pub project_name: String,
    pub project_color: Option<String>,
    pub active_tasks: i64,
    pub overdue_tasks: i64,
    pub completed_this_week: i64,
    pub health: ProjectHealth,
    pub sparkline: Vec<i64>,
}

/// Internal row from the project-pulse aggregation query
#[derive(Debug, sqlx::FromRow)]
struct ProjectPulseRow {
    pub project_id: Uuid,
    pub project_name: String,
    pub project_color: Option<String>,
    pub active_tasks: i64,
    pub overdue_tasks: i64,
    pub completed_this_week: i64,
}

/// Internal row for daily sparkline data
#[derive(Debug, sqlx::FromRow)]
struct SparklineRow {
    pub project_id: Uuid,
    pub day_offset: i32,
    pub completed: i64,
}

pub fn compute_health(active: i64, overdue: i64) -> ProjectHealth {
    if overdue > 5 {
        return ProjectHealth::Red;
    }
    if active == 0 || overdue == 0 {
        return ProjectHealth::Green;
    }
    let ratio = overdue as f64 / active as f64;
    if ratio > 0.3 {
        ProjectHealth::Red
    } else if ratio >= 0.1 {
        ProjectHealth::Amber
    } else {
        ProjectHealth::Green
    }
}

/// Get project health stats for all projects the user has access to
pub async fn get_project_pulse(
    pool: &PgPool,
    user_id: Uuid,
    workspace_id: Option<Uuid>,
) -> Result<Vec<ProjectPulse>, sqlx::Error> {
    let now = Utc::now();
    let seven_days_ago = now - chrono::Duration::days(7);

    let rows = sqlx::query_as::<_, ProjectPulseRow>(
        r#"
        SELECT
            p.id AS project_id,
            p.name AS project_name,
            p.background_color AS project_color,
            COUNT(DISTINCT t.id) FILTER (WHERE ps.type != 'done')::bigint AS active_tasks,
            COUNT(DISTINCT t.id) FILTER (
                WHERE ps.type != 'done' AND t.due_date IS NOT NULL AND t.due_date < $2
            )::bigint AS overdue_tasks,
            (SELECT COUNT(DISTINCT al.entity_id)::bigint
             FROM activity_log al
             INNER JOIN tasks t2 ON t2.id = al.entity_id AND t2.deleted_at IS NULL AND t2.project_id = p.id
             INNER JOIN project_statuses ps2 ON ps2.id = t2.status_id
             WHERE al.action = 'moved' AND al.entity_type = 'task'
               AND al.created_at >= $3 AND ps2.type = 'done'
            ) AS completed_this_week
        FROM projects p
        INNER JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
        LEFT JOIN tasks t ON t.project_id = p.id AND t.deleted_at IS NULL AND t.parent_task_id IS NULL
        LEFT JOIN project_statuses ps ON ps.id = t.status_id
        WHERE p.deleted_at IS NULL
          AND ($4::uuid IS NULL OR p.workspace_id = $4)
        GROUP BY p.id, p.name, p.background_color
        ORDER BY p.name ASC
        "#,
    )
    .bind(user_id)
    .bind(now)
    .bind(seven_days_ago)
    .bind(workspace_id)
    .fetch_all(pool)
    .await?;

    if rows.is_empty() {
        return Ok(Vec::new());
    }

    let project_ids: Vec<Uuid> = rows.iter().map(|r| r.project_id).collect();
    let fourteen_days_ago = now - chrono::Duration::days(14);

    // Fetch sparkline data: completions per day for last 14 days, per project
    let sparkline_rows = sqlx::query_as::<_, SparklineRow>(
        r#"
        SELECT
            t.project_id,
            (CURRENT_DATE - DATE(al.created_at))::integer AS day_offset,
            COUNT(DISTINCT al.entity_id)::bigint AS completed
        FROM activity_log al
        INNER JOIN tasks t ON t.id = al.entity_id AND t.deleted_at IS NULL
        INNER JOIN project_statuses ps ON ps.id = t.status_id
        WHERE al.action = 'moved'
          AND al.entity_type = 'task'
          AND al.created_at >= $1
          AND ps.type = 'done'
          AND t.project_id = ANY($2)
        GROUP BY t.project_id, DATE(al.created_at)
        "#,
    )
    .bind(fourteen_days_ago)
    .bind(&project_ids)
    .fetch_all(pool)
    .await?;

    // Build sparkline map: project_id -> [14 days of completions, oldest first]
    let mut sparkline_map: std::collections::HashMap<Uuid, Vec<i64>> =
        std::collections::HashMap::new();
    for row in &sparkline_rows {
        let entry = sparkline_map
            .entry(row.project_id)
            .or_insert_with(|| vec![0i64; 14]);
        // day_offset=0 is today (index 13), day_offset=13 is 13 days ago (index 0)
        let idx = 13_i32.saturating_sub(row.day_offset);
        if (0..14).contains(&idx) {
            entry[idx as usize] = row.completed;
        }
    }

    let projects = rows
        .into_iter()
        .map(|r| {
            let health = compute_health(r.active_tasks, r.overdue_tasks);
            let sparkline = sparkline_map
                .remove(&r.project_id)
                .unwrap_or_else(|| vec![0i64; 14]);
            ProjectPulse {
                project_id: r.project_id,
                project_name: r.project_name,
                project_color: r.project_color,
                active_tasks: r.active_tasks,
                overdue_tasks: r.overdue_tasks,
                completed_this_week: r.completed_this_week,
                health,
                sparkline,
            }
        })
        .collect();

    Ok(projects)
}

// ── Streak ───────────────────────────────────────────────────────────

/// User's completion streak data
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserStreak {
    pub current_streak: i32,
    pub longest_streak: i32,
    pub completed_today: i32,
}

/// Internal row for distinct completion dates
#[derive(Debug, sqlx::FromRow)]
struct CompletionDateRow {
    pub completion_date: chrono::NaiveDate,
}

/// Get the user's current and longest completion streaks
pub async fn get_user_streak(pool: &PgPool, user_id: Uuid) -> Result<UserStreak, sqlx::Error> {
    let today = Utc::now().date_naive();

    // Fetch distinct dates where the user completed at least 1 task, ordered desc
    let date_rows = sqlx::query_as::<_, CompletionDateRow>(
        r#"
        SELECT DISTINCT DATE(al.created_at) AS completion_date
        FROM activity_log al
        INNER JOIN tasks t ON t.id = al.entity_id AND t.deleted_at IS NULL
        INNER JOIN project_statuses ps ON ps.id = t.status_id
        WHERE al.action = 'moved'
          AND al.entity_type = 'task'
          AND al.user_id = $1
          AND ps.type = 'done'
        ORDER BY completion_date DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    // Count completed_today
    let completed_today_row = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(DISTINCT al.entity_id)::bigint
        FROM activity_log al
        INNER JOIN tasks t ON t.id = al.entity_id AND t.deleted_at IS NULL
        INNER JOIN project_statuses ps ON ps.id = t.status_id
        WHERE al.action = 'moved'
          AND al.entity_type = 'task'
          AND al.user_id = $1
          AND ps.type = 'done'
          AND DATE(al.created_at) = CURRENT_DATE
        "#,
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    let dates: Vec<chrono::NaiveDate> = date_rows.into_iter().map(|r| r.completion_date).collect();

    // Compute current streak: consecutive days ending at today (or yesterday)
    let mut current_streak: i32 = 0;
    let mut expected = today;
    for &d in &dates {
        if d == expected {
            current_streak += 1;
            expected = d - chrono::Duration::days(1);
        } else if d == today - chrono::Duration::days(1) && current_streak == 0 {
            // Allow streak to start from yesterday if no completion today
            current_streak = 1;
            expected = d - chrono::Duration::days(1);
        } else {
            break;
        }
    }

    // Compute longest streak over all dates
    let mut longest_streak: i32 = 0;
    let mut streak: i32 = 0;
    let mut prev: Option<chrono::NaiveDate> = None;
    for &d in &dates {
        match prev {
            Some(p) if p - chrono::Duration::days(1) == d => {
                streak += 1;
            }
            _ => {
                streak = 1;
            }
        }
        if streak > longest_streak {
            longest_streak = streak;
        }
        prev = Some(d);
    }

    Ok(UserStreak {
        current_streak,
        longest_streak,
        completed_today: completed_today_row as i32,
    })
}
