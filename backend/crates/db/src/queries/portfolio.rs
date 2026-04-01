//! Portfolio dashboard queries
//!
//! Provides cross-project portfolio view with aggregated task stats,
//! health indicators, and milestone information for a workspace.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

/// A project with aggregated portfolio metrics
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct PortfolioProject {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub prefix: Option<String>,
    pub background_color: Option<String>,
    pub created_at: DateTime<Utc>,
    pub total_tasks: i64,
    pub completed_tasks: i64,
    pub overdue_tasks: i64,
    pub active_tasks: i64,
    pub member_count: i64,
    pub progress_pct: f64,
    pub health: String,
    pub next_milestone_name: Option<String>,
    pub next_milestone_due: Option<DateTime<Utc>>,
}

/// A milestone with cross-project context for portfolio timeline
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct PortfolioMilestone {
    pub id: Uuid,
    pub name: String,
    pub due_date: Option<DateTime<Utc>>,
    pub project_id: Uuid,
    pub project_name: String,
    pub project_color: Option<String>,
    pub total_tasks: i64,
    pub completed_tasks: i64,
}

/// Combined portfolio response
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PortfolioResponse {
    pub projects: Vec<PortfolioProject>,
    pub milestones: Vec<PortfolioMilestone>,
}

/// Fetch all projects in a workspace with aggregated portfolio metrics.
pub async fn get_portfolio_projects(
    pool: &PgPool,
    workspace_id: Uuid,
    tenant_id: Uuid,
) -> Result<Vec<PortfolioProject>, sqlx::Error> {
    let projects = sqlx::query_as::<_, PortfolioProject>(
        r"
        SELECT
            p.id,
            p.name,
            p.description,
            p.prefix,
            p.background_color,
            p.created_at,
            COALESCE(task_stats.total, 0) as total_tasks,
            COALESCE(task_stats.completed, 0) as completed_tasks,
            COALESCE(task_stats.overdue, 0) as overdue_tasks,
            COALESCE(task_stats.active, 0) as active_tasks,
            COALESCE(member_stats.count, 0) as member_count,
            CASE WHEN COALESCE(task_stats.total, 0) = 0 THEN 0.0
                 ELSE ROUND(COALESCE(task_stats.completed, 0)::numeric / task_stats.total * 100, 1)::float8
            END as progress_pct,
            CASE
                WHEN COALESCE(task_stats.total, 0) = 0 THEN 'on_track'
                WHEN COALESCE(task_stats.overdue, 0)::numeric / GREATEST(task_stats.total, 1) > 0.20 THEN 'behind'
                WHEN COALESCE(task_stats.overdue, 0)::numeric / GREATEST(task_stats.total, 1) > 0.05 THEN 'at_risk'
                WHEN next_ms.due_date IS NOT NULL AND next_ms.due_date < NOW() THEN 'at_risk'
                ELSE 'on_track'
            END as health,
            next_ms.name as next_milestone_name,
            next_ms.due_date as next_milestone_due
        FROM projects p
        LEFT JOIN LATERAL (
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE ps.type = 'done') as completed,
                COUNT(*) FILTER (WHERE t.due_date < NOW() AND (ps.type IS NULL OR ps.type != 'done')) as overdue,
                COUNT(*) FILTER (WHERE ps.type IS NULL OR ps.type != 'done') as active
            FROM tasks t
            LEFT JOIN project_statuses ps ON ps.id = t.status_id
            WHERE t.project_id = p.id AND t.deleted_at IS NULL AND t.parent_task_id IS NULL
        ) task_stats ON true
        LEFT JOIN LATERAL (
            SELECT COUNT(*) as count
            FROM project_members pm
            WHERE pm.project_id = p.id
        ) member_stats ON true
        LEFT JOIN LATERAL (
            SELECT m.name, m.due_date
            FROM milestones m
            WHERE m.project_id = p.id AND (m.due_date IS NULL OR m.due_date >= NOW() - INTERVAL '7 days')
            ORDER BY m.due_date ASC NULLS LAST
            LIMIT 1
        ) next_ms ON true
        WHERE p.workspace_id = $1 AND p.tenant_id = $2 AND p.deleted_at IS NULL
        ORDER BY p.name ASC
        ",
    )
    .bind(workspace_id)
    .bind(tenant_id)
    .fetch_all(pool)
    .await?;

    Ok(projects)
}

/// Fetch all upcoming milestones across projects in a workspace.
pub async fn get_portfolio_milestones(
    pool: &PgPool,
    workspace_id: Uuid,
    tenant_id: Uuid,
) -> Result<Vec<PortfolioMilestone>, sqlx::Error> {
    let milestones = sqlx::query_as::<_, PortfolioMilestone>(
        r"
        SELECT
            m.id,
            m.name,
            m.due_date,
            m.project_id,
            p.name as project_name,
            p.background_color as project_color,
            COALESCE(COUNT(t.id), 0) as total_tasks,
            COALESCE(SUM(
                CASE WHEN ps.type = 'done' THEN 1 ELSE 0 END
            ), 0) as completed_tasks
        FROM milestones m
        INNER JOIN projects p ON p.id = m.project_id
        LEFT JOIN tasks t ON t.milestone_id = m.id AND t.deleted_at IS NULL AND t.parent_task_id IS NULL
        LEFT JOIN project_statuses ps ON ps.id = t.status_id
        WHERE p.workspace_id = $1
          AND p.tenant_id = $2
          AND p.deleted_at IS NULL
          AND (m.due_date IS NULL OR m.due_date >= NOW() - INTERVAL '30 days')
        GROUP BY m.id, m.name, m.due_date, m.project_id, p.name, p.background_color
        ORDER BY m.due_date ASC NULLS LAST, m.name ASC
        ",
    )
    .bind(workspace_id)
    .bind(tenant_id)
    .fetch_all(pool)
    .await?;

    Ok(milestones)
}
