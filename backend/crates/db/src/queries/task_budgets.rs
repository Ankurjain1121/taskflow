//! Project-level budget rollup queries (Phase 2.6).
//!
//! Aggregates per-task budget fields plus logged time into a single summary
//! used by the project budget summary card on the frontend.

use serde::Serialize;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use super::membership::verify_project_membership;

/// Errors the budget-summary query can return.
#[derive(Debug, thiserror::Error)]
pub enum BudgetSummaryError {
    #[error("User is not a member of this project")]
    NotProjectMember,
    #[error(transparent)]
    Database(#[from] sqlx::Error),
}

/// Aggregate financial snapshot for a project.
///
/// All monetary sums are USD, expressed as `f64` to match the storage type
/// on `tasks` (see `20260411000003_task_budget_fields.sql`). NULL task-level
/// values are ignored by `SUM`, so a project with zero budgeted tasks returns
/// `None` for the relevant sums rather than `0`.
#[derive(Debug, Serialize, FromRow)]
pub struct ProjectBudgetSummary {
    /// Sum of `tasks.budgeted_hours`. `None` when no task has a value set.
    pub total_budgeted_hours: Option<f64>,
    /// Sum of completed (stopped) time entries on this project's tasks, in hours.
    /// Always populated (defaults to 0.0). Running timers are excluded.
    pub total_logged_hours: f64,
    /// Sum of `tasks.cost_budget`. `None` when no task has a value set.
    pub total_budgeted_cost: Option<f64>,
    /// Sum of `logged_hours_per_task * cost_per_hour` across tasks where
    /// `cost_per_hour IS NOT NULL`. `None` when no task has a cost rate.
    pub total_actual_cost: Option<f64>,
    /// Sum of `tasks.revenue_budget`. `None` when no task has a value set.
    pub total_revenue_budget: Option<f64>,
    /// Number of tasks in the project that have at least one budget field set.
    pub task_count_with_budget: i64,
}

/// Fetch a financial rollup for a project after verifying membership.
///
/// The query is a single `SELECT` that joins each non-deleted task against the
/// sum of its completed time entries (in minutes). All sums are NULL-tolerant.
pub async fn get_project_budget_summary(
    pool: &PgPool,
    project_id: Uuid,
    user_id: Uuid,
) -> Result<ProjectBudgetSummary, BudgetSummaryError> {
    let is_member = verify_project_membership(pool, project_id, user_id).await?;
    if !is_member {
        return Err(BudgetSummaryError::NotProjectMember);
    }

    let summary = sqlx::query_as::<_, ProjectBudgetSummary>(
        r"
        WITH task_time AS (
            SELECT
                t.id,
                t.budgeted_hours,
                t.cost_budget,
                t.cost_per_hour,
                t.revenue_budget,
                t.rate_per_hour,
                t.budgeted_hours_threshold,
                t.cost_budget_threshold,
                COALESCE((
                    SELECT SUM(te.duration_minutes)::double precision
                    FROM time_entries te
                    WHERE te.task_id = t.id
                      AND te.is_running = false
                      AND te.duration_minutes IS NOT NULL
                ), 0.0) / 60.0 AS logged_hours
            FROM tasks t
            WHERE t.project_id = $1
              AND t.deleted_at IS NULL
        )
        SELECT
            SUM(budgeted_hours)           AS total_budgeted_hours,
            COALESCE(SUM(logged_hours), 0.0) AS total_logged_hours,
            SUM(cost_budget)              AS total_budgeted_cost,
            SUM(
                CASE
                    WHEN cost_per_hour IS NOT NULL
                    THEN logged_hours * cost_per_hour
                    ELSE NULL
                END
            )                             AS total_actual_cost,
            SUM(revenue_budget)           AS total_revenue_budget,
            COUNT(*) FILTER (
                WHERE budgeted_hours IS NOT NULL
                   OR cost_budget IS NOT NULL
                   OR revenue_budget IS NOT NULL
                   OR rate_per_hour IS NOT NULL
                   OR cost_per_hour IS NOT NULL
                   OR budgeted_hours_threshold IS NOT NULL
                   OR cost_budget_threshold IS NOT NULL
            )::bigint                     AS task_count_with_budget
        FROM task_time
        ",
    )
    .bind(project_id)
    .fetch_one(pool)
    .await?;

    Ok(summary)
}
