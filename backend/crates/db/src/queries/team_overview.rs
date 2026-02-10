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

/// Row returned from workload query
#[derive(Debug)]
struct WorkloadRow {
    user_id: Uuid,
    user_name: String,
    user_avatar: Option<String>,
    task_id: Option<Uuid>,
    due_date: Option<chrono::DateTime<chrono::Utc>>,
    status_mapping: Option<serde_json::Value>,
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
    // Get all workspace members with their assigned tasks
    let rows = sqlx::query_as!(
        WorkloadRow,
        r#"
        SELECT
            u.id as user_id,
            u.name as user_name,
            u.avatar_url as user_avatar,
            t.id as task_id,
            t.due_date,
            bc.status_mapping
        FROM workspace_members wm
        INNER JOIN users u ON u.id = wm.user_id
        LEFT JOIN task_assignees ta ON ta.user_id = u.id
        LEFT JOIN tasks t ON t.id = ta.task_id AND t.deleted_at IS NULL
        LEFT JOIN board_columns bc ON bc.id = t.column_id
        LEFT JOIN boards b ON b.id = t.board_id AND b.workspace_id = $1
        WHERE wm.workspace_id = $1
          AND u.tenant_id = $2
          AND u.deleted_at IS NULL
        ORDER BY u.name ASC
        "#,
        workspace_id,
        tenant_id
    )
    .fetch_all(pool)
    .await?;

    // Aggregate by user
    let mut user_workloads: HashMap<Uuid, MemberWorkload> = HashMap::new();
    let now = chrono::Utc::now();

    for row in rows {
        let entry = user_workloads.entry(row.user_id).or_insert_with(|| MemberWorkload {
            user_id: row.user_id,
            user_name: row.user_name.clone(),
            user_avatar: row.user_avatar.clone(),
            total_tasks: 0,
            active_tasks: 0,
            overdue_tasks: 0,
            tasks_by_status: HashMap::new(),
            is_overloaded: false,
        });

        // Only count if there's an actual task (not a NULL from LEFT JOIN)
        if row.task_id.is_some() {
            entry.total_tasks += 1;

            // Determine status from column's status_mapping
            let is_done = row
                .status_mapping
                .as_ref()
                .and_then(|sm: &serde_json::Value| sm.get("done"))
                .and_then(|v: &serde_json::Value| v.as_bool())
                .unwrap_or(false);

            let status = if is_done {
                "done"
            } else {
                "active"
            };

            // Increment status count
            *entry.tasks_by_status.entry(status.to_string()).or_insert(0) += 1;

            // Count active tasks (NOT done)
            if !is_done {
                entry.active_tasks += 1;

                // Check if overdue
                if let Some(due_date) = row.due_date {
                    if due_date < now {
                        entry.overdue_tasks += 1;
                    }
                }
            }
        }
    }

    // Set is_overloaded flag (>= 10 active tasks)
    for workload in user_workloads.values_mut() {
        workload.is_overloaded = workload.active_tasks >= 10;
    }

    Ok(user_workloads.into_values().collect())
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
    let rows = sqlx::query!(
        r#"
        SELECT
            u.id as user_id,
            u.name as user_name,
            u.avatar_url as user_avatar,
            COUNT(DISTINCT t.id) FILTER (
                WHERE t.deleted_at IS NULL
                AND (bc.status_mapping IS NULL OR NOT (bc.status_mapping->>'done')::boolean)
            ) as "active_tasks!"
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
        ORDER BY "active_tasks!" DESC
        "#,
        workspace_id,
        tenant_id,
        threshold
    )
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
