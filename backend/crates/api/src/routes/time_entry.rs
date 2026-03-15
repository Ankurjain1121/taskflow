use axum::{
    extract::{Path, Query, State},
    middleware::from_fn_with_state,
    routing::{delete, get, post, put},
    Json, Router,
};
use chrono::{DateTime, NaiveDate, Utc};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::auth_middleware;
use crate::state::AppState;
use taskflow_db::queries::get_task_board_id;
use taskflow_db::queries::time_entries::{
    create_manual_entry, delete_entry, get_board_time_report, get_running_timer,
    get_timesheet_report, list_task_time_entries, start_timer, stop_timer, update_entry,
    ManualEntryInput, StartTimerInput, TimeEntryQueryError, UpdateEntryInput,
};

/// Request body for starting a timer
#[derive(Deserialize)]
pub struct StartTimerRequest {
    pub description: Option<String>,
    pub is_billable: Option<bool>,
}

/// Request body for creating a manual time entry
#[derive(Deserialize)]
pub struct CreateManualEntryRequest {
    pub description: Option<String>,
    pub started_at: DateTime<Utc>,
    pub ended_at: DateTime<Utc>,
    pub duration_minutes: i32,
    pub is_billable: Option<bool>,
}

/// Request body for updating a time entry
#[derive(Deserialize)]
pub struct UpdateEntryRequest {
    pub description: Option<String>,
    pub started_at: Option<DateTime<Utc>>,
    pub ended_at: Option<DateTime<Utc>>,
    pub duration_minutes: Option<i32>,
    pub is_billable: Option<bool>,
}

/// Query params for timesheet report
#[derive(Deserialize)]
pub struct TimesheetReportQuery {
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub user_id: Option<Uuid>,
    pub billable_only: Option<bool>,
}

/// Helper to map TimeEntryQueryError to AppError
fn map_time_entry_error(e: TimeEntryQueryError) -> AppError {
    match e {
        TimeEntryQueryError::NotFound => AppError::NotFound("Time entry not found".into()),
        TimeEntryQueryError::NotBoardMember => AppError::Forbidden("Not a board member".into()),
        TimeEntryQueryError::AlreadyRunning => {
            AppError::Conflict("A timer is already running".into())
        }
        TimeEntryQueryError::NotOwner => {
            AppError::Forbidden("Not the owner of this time entry".into())
        }
        TimeEntryQueryError::Database(e) => AppError::SqlxError(e),
    }
}

/// GET /api/tasks/{task_id}/time-entries
async fn list_entries_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
) -> Result<Json<Vec<taskflow_db::models::TimeEntry>>> {
    let entries = list_task_time_entries(&state.db, task_id, tenant.user_id)
        .await
        .map_err(map_time_entry_error)?;

    Ok(Json(entries))
}

/// POST /api/tasks/{task_id}/time-entries/start
async fn start_timer_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
    Json(body): Json<StartTimerRequest>,
) -> Result<Json<taskflow_db::models::TimeEntry>> {
    let board_id = get_task_board_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    let input = StartTimerInput {
        task_id,
        user_id: tenant.user_id,
        description: body.description,
        board_id,
        tenant_id: tenant.tenant_id,
        is_billable: body.is_billable,
    };

    let entry = start_timer(&state.db, input)
        .await
        .map_err(map_time_entry_error)?;

    Ok(Json(entry))
}

/// POST /api/time-entries/{id}/stop
async fn stop_timer_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(id): Path<Uuid>,
) -> Result<Json<taskflow_db::models::TimeEntry>> {
    let entry = stop_timer(&state.db, id, tenant.user_id)
        .await
        .map_err(map_time_entry_error)?;

    Ok(Json(entry))
}

/// POST /api/tasks/{task_id}/time-entries
async fn create_manual_entry_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
    Json(body): Json<CreateManualEntryRequest>,
) -> Result<Json<taskflow_db::models::TimeEntry>> {
    let board_id = get_task_board_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    let input = ManualEntryInput {
        task_id,
        user_id: tenant.user_id,
        description: body.description,
        started_at: body.started_at,
        ended_at: body.ended_at,
        duration_minutes: body.duration_minutes,
        board_id,
        tenant_id: tenant.tenant_id,
        is_billable: body.is_billable,
    };

    let entry = create_manual_entry(&state.db, input)
        .await
        .map_err(map_time_entry_error)?;

    Ok(Json(entry))
}

/// PUT /api/time-entries/{id}
async fn update_entry_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateEntryRequest>,
) -> Result<Json<taskflow_db::models::TimeEntry>> {
    let input = UpdateEntryInput {
        description: body.description,
        started_at: body.started_at,
        ended_at: body.ended_at,
        duration_minutes: body.duration_minutes,
        is_billable: body.is_billable,
    };

    let entry = update_entry(&state.db, id, input, tenant.user_id)
        .await
        .map_err(map_time_entry_error)?;

    Ok(Json(entry))
}

/// DELETE /api/time-entries/{id}
async fn delete_entry_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    delete_entry(&state.db, id, tenant.user_id)
        .await
        .map_err(map_time_entry_error)?;

    Ok(Json(json!({ "success": true })))
}

/// GET /api/boards/{board_id}/time-report
async fn board_time_report_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(board_id): Path<Uuid>,
) -> Result<Json<Vec<taskflow_db::queries::time_entries::TaskTimeReport>>> {
    let report = get_board_time_report(&state.db, board_id, tenant.user_id)
        .await
        .map_err(map_time_entry_error)?;

    Ok(Json(report))
}

/// GET /api/projects/{project_id}/timesheet-report
async fn timesheet_report_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(project_id): Path<Uuid>,
    Query(params): Query<TimesheetReportQuery>,
) -> Result<Json<taskflow_db::queries::time_entries::TimesheetReport>> {
    let report = get_timesheet_report(
        &state.db,
        project_id,
        tenant.user_id,
        params.start_date,
        params.end_date,
        params.user_id,
        params.billable_only,
    )
    .await
    .map_err(map_time_entry_error)?;

    Ok(Json(report))
}

/// GET /api/time-entries/running
async fn get_running_timer_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
) -> Result<Json<Option<taskflow_db::queries::time_entries::TimeEntryWithTask>>> {
    let entry = get_running_timer(&state.db, tenant.user_id)
        .await
        .map_err(map_time_entry_error)?;

    Ok(Json(entry))
}

/// Create the time entry router
pub fn time_entry_router(state: AppState) -> Router<AppState> {
    Router::new()
        // Task-scoped time entry routes
        .route("/tasks/{task_id}/time-entries", get(list_entries_handler))
        .route(
            "/tasks/{task_id}/time-entries/start",
            post(start_timer_handler),
        )
        .route(
            "/tasks/{task_id}/time-entries",
            post(create_manual_entry_handler),
        )
        // Time entry-specific routes
        .route("/time-entries/{id}/stop", post(stop_timer_handler))
        .route("/time-entries/{id}", put(update_entry_handler))
        .route("/time-entries/{id}", delete(delete_entry_handler))
        // Board-scoped time report
        .route(
            "/projects/{board_id}/time-report",
            get(board_time_report_handler),
        )
        // Project-scoped timesheet report
        .route(
            "/projects/{project_id}/timesheet-report",
            get(timesheet_report_handler),
        )
        // User-scoped running timer
        .route("/time-entries/running", get(get_running_timer_handler))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
