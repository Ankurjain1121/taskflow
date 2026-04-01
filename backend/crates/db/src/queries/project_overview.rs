//! Project Overview database queries
//!
//! Aggregated project data: task counts, overdue count, milestone progress,
//! recent activity, team members.

use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

/// Aggregated project overview
#[derive(Debug, Serialize)]
pub struct ProjectOverview {
    pub task_counts: TaskCounts,
    pub overdue_count: i64,
    pub milestone_progress: Vec<MilestoneProgress>,
    pub recent_activity: Vec<RecentActivityItem>,
    pub team_members: Vec<TeamMemberInfo>,
}

/// Task counts by status type
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TaskCounts {
    pub total: i64,
    pub todo: i64,
    pub in_progress: i64,
    pub done: i64,
}

/// Milestone progress entry
#[derive(Debug, Serialize, Clone, sqlx::FromRow)]
pub struct MilestoneProgress {
    pub id: Uuid,
    pub name: String,
    pub due_date: Option<DateTime<Utc>>,
    pub total_tasks: i64,
    pub completed_tasks: i64,
}

/// Recent activity item
#[derive(Debug, Serialize, Clone, sqlx::FromRow)]
pub struct RecentActivityItem {
    pub id: Uuid,
    pub action: String,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub actor_name: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Team member info
#[derive(Debug, Serialize, Clone, sqlx::FromRow)]
pub struct TeamMemberInfo {
    pub user_id: Uuid,
    pub name: Option<String>,
    pub email: String,
    pub role: String,
    pub task_count: i64,
}

/// Get aggregated project overview
pub async fn get_project_overview(
    pool: &PgPool,
    project_id: Uuid,
) -> Result<ProjectOverview, sqlx::Error> {
    // 1. Task counts
    let task_counts = sqlx::query_as::<_, TaskCounts>(
        r"
        SELECT
            COUNT(*)::bigint AS total,
            COUNT(*) FILTER (WHERE ps.type = 'todo' OR ps.type IS NULL)::bigint AS todo,
            COUNT(*) FILTER (WHERE ps.type = 'in_progress')::bigint AS in_progress,
            COUNT(*) FILTER (WHERE ps.type = 'done')::bigint AS done
        FROM tasks t
        LEFT JOIN project_statuses ps ON ps.id = t.status_id
        WHERE t.project_id = $1
          AND t.deleted_at IS NULL
          AND t.parent_task_id IS NULL
        ",
    )
    .bind(project_id)
    .fetch_one(pool)
    .await?;

    // 2. Overdue count
    let overdue_count = sqlx::query_scalar::<_, i64>(
        r"
        SELECT COUNT(*)::bigint
        FROM tasks t
        LEFT JOIN project_statuses ps ON ps.id = t.status_id
        WHERE t.project_id = $1
          AND t.deleted_at IS NULL
          AND t.parent_task_id IS NULL
          AND t.due_date < NOW()
          AND (ps.type IS NULL OR ps.type != 'done')
        ",
    )
    .bind(project_id)
    .fetch_one(pool)
    .await?;

    // 3. Milestone progress
    let milestone_progress = sqlx::query_as::<_, MilestoneProgress>(
        r"
        SELECT
            m.id,
            m.name,
            m.due_date,
            COUNT(t.id)::bigint AS total_tasks,
            COUNT(t.id) FILTER (WHERE ps.type = 'done')::bigint AS completed_tasks
        FROM milestones m
        LEFT JOIN tasks t ON t.milestone_id = m.id AND t.deleted_at IS NULL
        LEFT JOIN project_statuses ps ON ps.id = t.status_id
        WHERE m.project_id = $1
        GROUP BY m.id, m.name, m.due_date
        ORDER BY m.due_date ASC NULLS LAST
        LIMIT 10
        ",
    )
    .bind(project_id)
    .fetch_all(pool)
    .await?;

    // 4. Recent activity (last 20 entries)
    let recent_activity = sqlx::query_as::<_, RecentActivityItem>(
        r"
        SELECT
            al.id,
            al.action::text,
            al.entity_type,
            al.entity_id,
            u.name AS actor_name,
            al.created_at
        FROM activity_log al
        LEFT JOIN users u ON u.id = al.user_id
        WHERE al.project_id = $1
        ORDER BY al.created_at DESC
        LIMIT 20
        ",
    )
    .bind(project_id)
    .fetch_all(pool)
    .await?;

    // 5. Team members with task counts
    let team_members = sqlx::query_as::<_, TeamMemberInfo>(
        r"
        SELECT
            pm.user_id,
            u.name,
            u.email,
            pm.role::text,
            COALESCE(tc.task_count, 0)::bigint AS task_count
        FROM project_members pm
        INNER JOIN users u ON u.id = pm.user_id
        LEFT JOIN LATERAL (
            SELECT COUNT(*)::bigint AS task_count
            FROM task_assignees ta
            INNER JOIN tasks t ON t.id = ta.task_id
                AND t.project_id = $1
                AND t.deleted_at IS NULL
            WHERE ta.user_id = pm.user_id
        ) tc ON true
        WHERE pm.project_id = $1
        ORDER BY tc.task_count DESC
        ",
    )
    .bind(project_id)
    .fetch_all(pool)
    .await?;

    Ok(ProjectOverview {
        task_counts,
        overdue_count,
        milestone_progress,
        recent_activity,
        team_members,
    })
}
