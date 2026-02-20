//! Team overview database queries
//!
//! Provides queries for fetching team workload and member statistics.

use serde::Serialize;
use sqlx::PgPool;
use std::collections::HashMap;
use uuid::Uuid;

/// Member workload information for team overview
#[derive(Debug, Serialize, Clone)]
pub struct MemberWorkload {
    pub user_id: Uuid,
    pub user_name: String,
    pub user_avatar: Option<String>,
    pub total_tasks: i64,
    pub active_tasks: i64,
    pub overdue_tasks: i64,
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
            ) as done_tasks
        FROM workspace_members wm
        INNER JOIN users u ON u.id = wm.user_id
        LEFT JOIN task_assignees ta ON ta.user_id = u.id
        LEFT JOIN tasks t ON t.id = ta.task_id AND t.deleted_at IS NULL
        LEFT JOIN board_columns bc ON bc.id = t.column_id
        LEFT JOIN boards b ON b.id = t.board_id AND b.workspace_id = $1
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
        LEFT JOIN board_columns bc ON bc.id = t.column_id
        LEFT JOIN boards b ON b.id = t.board_id AND b.workspace_id = $1
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
            tasks_by_status: HashMap::new(),
            is_overloaded: false,
        };
        let json = serde_json::to_string(&workload).unwrap();
        assert!(json.contains("total_tasks"));
    }
}
