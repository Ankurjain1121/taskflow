//! Team overview database queries
//!
//! Provides queries for fetching team workload and member statistics.

use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::PgPool;
use std::collections::HashMap;
use uuid::Uuid;

use crate::models::TaskPriority;

/// Member workload information for team overview
#[derive(Debug, Serialize, Clone)]
pub struct MemberWorkload {
    pub user_id: Uuid,
    pub user_name: String,
    pub user_avatar: Option<String>,
    pub total_tasks: i64,
    pub active_tasks: i64,
    pub overdue_tasks: i64,
    pub due_today: i64,
    pub due_this_week: i64,
    pub tasks_by_status: HashMap<String, i64>,
    pub is_overloaded: bool,
}

/// Simplified overloaded member info
#[derive(Debug, Serialize, Clone)]
pub struct OverloadedMember {
    pub user_id: Uuid,
    pub user_name: String,
    pub user_avatar: Option<String>,
    pub active_tasks: i64,
}

/// Aggregated row for overloaded members query
#[derive(sqlx::FromRow)]
struct OverloadedRow {
    user_id: Uuid,
    user_name: String,
    user_avatar: Option<String>,
    active_tasks: i64,
}

/// Aggregated workload row from SQL
#[derive(sqlx::FromRow)]
struct WorkloadAgg {
    user_id: Uuid,
    user_name: String,
    user_avatar: Option<String>,
    total_tasks: i64,
    active_tasks: i64,
    overdue_tasks: i64,
    done_tasks: i64,
    due_today: i64,
    due_this_week: i64,
}

/// Get workload for all members of a workspace
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `workspace_id` - The workspace's UUID
/// * `tenant_id` - The tenant's UUID for security
///
/// Returns workload stats for each workspace member
pub async fn get_workload(
    pool: &PgPool,
    workspace_id: Uuid,
    tenant_id: Uuid,
) -> Result<Vec<MemberWorkload>, sqlx::Error> {
    let rows = sqlx::query_as::<_, WorkloadAgg>(
        r#"
        SELECT
            u.id as user_id,
            u.name as user_name,
            u.avatar_url as user_avatar,
            COUNT(DISTINCT t.id) FILTER (WHERE t.id IS NOT NULL) as total_tasks,
            COUNT(DISTINCT t.id) FILTER (
                WHERE t.id IS NOT NULL
                AND (bc.status_mapping IS NULL OR (bc.status_mapping->>'done') IS DISTINCT FROM 'true')
            ) as active_tasks,
            COUNT(DISTINCT t.id) FILTER (
                WHERE t.id IS NOT NULL
                AND t.due_date < NOW()
                AND (bc.status_mapping IS NULL OR (bc.status_mapping->>'done') IS DISTINCT FROM 'true')
            ) as overdue_tasks,
            COUNT(DISTINCT t.id) FILTER (
                WHERE t.id IS NOT NULL
                AND bc.status_mapping->>'done' = 'true'
            ) as done_tasks,
            COUNT(DISTINCT t.id) FILTER (
                WHERE t.id IS NOT NULL AND t.due_date IS NOT NULL
                AND t.due_date::date = CURRENT_DATE
                AND (bc.status_mapping IS NULL OR (bc.status_mapping->>'done') IS DISTINCT FROM 'true')
            ) as due_today,
            COUNT(DISTINCT t.id) FILTER (
                WHERE t.id IS NOT NULL AND t.due_date IS NOT NULL
                AND t.due_date::date > CURRENT_DATE
                AND t.due_date::date <= (CURRENT_DATE + INTERVAL '7 days')::date
                AND (bc.status_mapping IS NULL OR (bc.status_mapping->>'done') IS DISTINCT FROM 'true')
            ) as due_this_week
        FROM workspace_members wm
        INNER JOIN users u ON u.id = wm.user_id
        LEFT JOIN task_assignees ta ON ta.user_id = u.id
        LEFT JOIN tasks t ON t.id = ta.task_id AND t.deleted_at IS NULL
        LEFT JOIN project_columns bc ON bc.id = t.column_id
        LEFT JOIN projects b ON b.id = t.project_id AND b.workspace_id = $1
        WHERE wm.workspace_id = $1
          AND u.tenant_id = $2
          AND u.deleted_at IS NULL
        GROUP BY u.id, u.name, u.avatar_url
        ORDER BY u.name ASC
        "#,
    )
    .bind(workspace_id)
    .bind(tenant_id)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| {
            let mut tasks_by_status = HashMap::new();
            tasks_by_status.insert("active".to_string(), r.active_tasks);
            tasks_by_status.insert("done".to_string(), r.done_tasks);
            MemberWorkload {
                user_id: r.user_id,
                user_name: r.user_name,
                user_avatar: r.user_avatar,
                total_tasks: r.total_tasks,
                active_tasks: r.active_tasks,
                overdue_tasks: r.overdue_tasks,
                due_today: r.due_today,
                due_this_week: r.due_this_week,
                tasks_by_status,
                is_overloaded: r.active_tasks >= 10,
            }
        })
        .collect())
}

/// Get members who are overloaded (have >= threshold active tasks)
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `workspace_id` - The workspace's UUID
/// * `tenant_id` - The tenant's UUID for security
/// * `threshold` - Minimum active tasks to be considered overloaded (default 10)
pub async fn get_overloaded_members(
    pool: &PgPool,
    workspace_id: Uuid,
    tenant_id: Uuid,
    threshold: i64,
) -> Result<Vec<OverloadedMember>, sqlx::Error> {
    let rows = sqlx::query_as::<_, OverloadedRow>(
        r#"
        SELECT
            u.id as user_id,
            u.name as user_name,
            u.avatar_url as user_avatar,
            COUNT(DISTINCT t.id) FILTER (
                WHERE t.deleted_at IS NULL
                AND (bc.status_mapping IS NULL OR NOT (bc.status_mapping->>'done')::boolean)
            ) as active_tasks
        FROM workspace_members wm
        INNER JOIN users u ON u.id = wm.user_id
        LEFT JOIN task_assignees ta ON ta.user_id = u.id
        LEFT JOIN tasks t ON t.id = ta.task_id AND t.deleted_at IS NULL
        LEFT JOIN project_columns bc ON bc.id = t.column_id
        LEFT JOIN projects b ON b.id = t.project_id AND b.workspace_id = $1
        WHERE wm.workspace_id = $1
          AND u.tenant_id = $2
          AND u.deleted_at IS NULL
        GROUP BY u.id, u.name, u.avatar_url
        HAVING COUNT(DISTINCT t.id) FILTER (
            WHERE t.deleted_at IS NULL
            AND (bc.status_mapping IS NULL OR NOT (bc.status_mapping->>'done')::boolean)
        ) >= $3
        ORDER BY active_tasks DESC
        "#,
    )
    .bind(workspace_id)
    .bind(tenant_id)
    .bind(threshold)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| OverloadedMember {
            user_id: row.user_id,
            user_name: row.user_name,
            user_avatar: row.user_avatar,
            active_tasks: row.active_tasks,
        })
        .collect())
}

/// A member's active task for workload balancing view
#[derive(Debug, Serialize, Clone)]
pub struct MemberTask {
    pub task_id: Uuid,
    pub title: String,
    pub project_name: String,
    pub column_name: String,
    pub priority: TaskPriority,
    pub due_date: Option<DateTime<Utc>>,
    pub due_status: String,
}

/// Raw row from the member tasks query (before computing due_status)
#[derive(sqlx::FromRow)]
struct MemberTaskRow {
    task_id: Uuid,
    title: String,
    project_name: String,
    column_name: String,
    priority: TaskPriority,
    due_date: Option<DateTime<Utc>>,
}

/// Compute a due-status label from an optional due date
fn compute_due_status(due_date: Option<DateTime<Utc>>) -> String {
    let Some(due) = due_date else {
        return "no_due_date".to_string();
    };
    let now = Utc::now();
    let today = now.date_naive();
    let due_day = due.date_naive();

    if due_day < today {
        "overdue".to_string()
    } else if due_day == today {
        "due_today".to_string()
    } else if due_day <= today + chrono::Duration::days(7) {
        "due_this_week".to_string()
    } else {
        "upcoming".to_string()
    }
}

/// Get active tasks assigned to a specific member within a workspace
pub async fn get_member_active_tasks(
    pool: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<MemberTask>, sqlx::Error> {
    let rows = sqlx::query_as::<_, MemberTaskRow>(
        r#"
        SELECT
            t.id as task_id,
            t.title,
            b.name as project_name,
            bc.name as column_name,
            t.priority,
            t.due_date
        FROM tasks t
        INNER JOIN task_assignees ta ON ta.task_id = t.id
        INNER JOIN projects b ON b.id = t.project_id
        INNER JOIN project_columns bc ON bc.id = t.column_id
        WHERE ta.user_id = $1
          AND b.workspace_id = $2
          AND t.deleted_at IS NULL
          AND b.deleted_at IS NULL
          AND (bc.status_mapping IS NULL OR (bc.status_mapping->>'done') IS DISTINCT FROM 'true')
        ORDER BY
            CASE t.priority
                WHEN 'urgent' THEN 1
                WHEN 'high' THEN 2
                WHEN 'medium' THEN 3
                WHEN 'low' THEN 4
            END,
            t.due_date ASC NULLS LAST
        "#,
    )
    .bind(user_id)
    .bind(workspace_id)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| MemberTask {
            due_status: compute_due_status(r.due_date),
            task_id: r.task_id,
            title: r.title,
            project_name: r.project_name,
            column_name: r.column_name,
            priority: r.priority,
            due_date: r.due_date,
        })
        .collect())
}

/// Reassign tasks from one user to another, scoped to a workspace.
/// Only tasks belonging to projects in the given workspace will be reassigned.
pub async fn reassign_tasks(
    pool: &PgPool,
    workspace_id: Uuid,
    task_ids: &[Uuid],
    from_user_id: Uuid,
    to_user_id: Uuid,
) -> Result<usize, sqlx::Error> {
    if task_ids.is_empty() {
        return Ok(0);
    }

    let mut tx = pool.begin().await?;
    let mut count = 0usize;

    for task_id in task_ids {
        // Remove old assignee -- only if task belongs to this workspace
        let removed = sqlx::query(
            r#"
            DELETE FROM task_assignees ta
            USING tasks t
            INNER JOIN projects b ON b.id = t.project_id
            WHERE ta.task_id = $1
              AND ta.user_id = $2
              AND t.id = ta.task_id
              AND b.workspace_id = $3
              AND t.deleted_at IS NULL
            "#,
        )
        .bind(task_id)
        .bind(from_user_id)
        .bind(workspace_id)
        .execute(&mut *tx)
        .await?;

        if removed.rows_affected() > 0 {
            // Add new assignee (ignore conflict if already assigned)
            sqlx::query(
                r#"
                INSERT INTO task_assignees (task_id, user_id)
                VALUES ($1, $2)
                ON CONFLICT (task_id, user_id) DO NOTHING
                "#,
            )
            .bind(task_id)
            .bind(to_user_id)
            .execute(&mut *tx)
            .await?;

            count += 1;
        }
    }

    tx.commit().await?;

    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_member_workload_serializes() {
        let workload = MemberWorkload {
            user_id: Uuid::new_v4(),
            user_name: "Test User".to_string(),
            user_avatar: None,
            total_tasks: 5,
            active_tasks: 3,
            overdue_tasks: 1,
            due_today: 2,
            due_this_week: 1,
            tasks_by_status: HashMap::new(),
            is_overloaded: false,
        };
        let json = serde_json::to_string(&workload).unwrap();
        assert!(json.contains("total_tasks"));
        assert!(json.contains("due_today"));
        assert!(json.contains("due_this_week"));
    }

    #[test]
    fn test_compute_due_status() {
        assert_eq!(compute_due_status(None), "no_due_date");

        let yesterday = Utc::now() - chrono::Duration::days(1);
        assert_eq!(compute_due_status(Some(yesterday)), "overdue");

        let today = Utc::now();
        assert_eq!(compute_due_status(Some(today)), "due_today");

        let in_3_days = Utc::now() + chrono::Duration::days(3);
        assert_eq!(compute_due_status(Some(in_3_days)), "due_this_week");

        let in_30_days = Utc::now() + chrono::Duration::days(30);
        assert_eq!(compute_due_status(Some(in_30_days)), "upcoming");
    }
}
