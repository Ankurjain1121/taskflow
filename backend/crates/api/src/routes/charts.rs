use axum::{
    extract::{Path, Query, State},
    middleware::from_fn_with_state,
    routing::get,
    Json, Router,
};
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;
use taskflow_db::queries::reports::ReportQueryError;

#[derive(Debug, Serialize)]
pub struct BurndownDataPoint {
    pub date: NaiveDate,
    pub total_tasks: i64,
    pub completed_tasks: i64,
    pub remaining: i64,
    pub ideal_line: f64,
}

#[derive(Deserialize)]
pub struct ChartQuery {
    pub days: Option<i32>,
}

/// GET /api/projects/{board_id}/charts/burndown?days=30
async fn get_burndown_chart_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(board_id): Path<Uuid>,
    Query(query): Query<ChartQuery>,
) -> Result<Json<Vec<BurndownDataPoint>>> {
    let days_back = query.days.unwrap_or(30).clamp(1, 365);

    // Verify membership
    let is_member = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM project_members
            WHERE project_id = $1 AND user_id = $2
        )
        "#,
    )
    .bind(board_id)
    .bind(tenant.user_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        let rqe: ReportQueryError = e.into();
        match rqe {
            ReportQueryError::Database(e) => AppError::SqlxError(e),
            ReportQueryError::NotBoardMember => AppError::Forbidden("Not a board member".into()),
        }
    })?;

    if !is_member {
        return Err(AppError::Forbidden("Not a board member".into()));
    }

    // Query daily created and completed counts over the period
    #[derive(sqlx::FromRow)]
    struct DailyPoint {
        date: NaiveDate,
        total_created: i64,
        total_completed: i64,
    }

    let points = sqlx::query_as::<_, DailyPoint>(
        r#"
        WITH daily_created AS (
            SELECT created_at::date AS day, COUNT(*) AS cnt
            FROM tasks
            WHERE project_id = $1 AND deleted_at IS NULL AND parent_task_id IS NULL
              AND created_at::date <= CURRENT_DATE
            GROUP BY 1
        ),
        daily_done AS (
            SELECT t.updated_at::date AS day, COUNT(*) AS cnt
            FROM tasks t
            LEFT JOIN project_statuses ps ON ps.id = t.status_id
            WHERE t.project_id = $1 AND t.deleted_at IS NULL AND ps.type = 'done'
              AND t.parent_task_id IS NULL
              AND t.updated_at::date <= CURRENT_DATE
            GROUP BY 1
        ),
        series AS (
            SELECT d::date AS day
            FROM generate_series(
                CURRENT_DATE - ($2 || ' days')::interval,
                CURRENT_DATE,
                '1 day'::interval
            ) d
        )
        SELECT
            s.day AS date,
            COALESCE(SUM(dc.cnt) OVER (ORDER BY s.day), 0) AS total_created,
            COALESCE(SUM(dd.cnt) OVER (ORDER BY s.day), 0) AS total_completed
        FROM series s
        LEFT JOIN daily_created dc ON dc.day = s.day
        LEFT JOIN daily_done dd ON dd.day = s.day
        ORDER BY s.day
        "#,
    )
    .bind(board_id)
    .bind(days_back)
    .fetch_all(&state.db)
    .await
    .map_err(AppError::SqlxError)?;

    let total_points = points.len();
    let first_total = points.first().map(|p| p.total_created).unwrap_or(0);

    let result: Vec<BurndownDataPoint> = points
        .into_iter()
        .enumerate()
        .map(|(i, p)| {
            let remaining = p.total_created - p.total_completed;
            // Ideal line: linear from first day's total to 0
            let ideal = if total_points > 1 {
                first_total as f64 * (1.0 - (i as f64 / (total_points - 1) as f64))
            } else {
                first_total as f64
            };
            BurndownDataPoint {
                date: p.date,
                total_tasks: p.total_created,
                completed_tasks: p.total_completed,
                remaining,
                ideal_line: (ideal * 100.0).round() / 100.0,
            }
        })
        .collect();

    Ok(Json(result))
}

pub fn charts_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route(
            "/projects/{board_id}/charts/burndown",
            get(get_burndown_chart_handler),
        )
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
