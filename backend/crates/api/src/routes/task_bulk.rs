//! Bulk task operations (update, delete)

use axum::{
    extract::{Path, State},
    Json,
};
use serde_json::json;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::{StrictJson, TenantContext};
use crate::services::cache;
use crate::services::ActivityLogService;
use crate::state::AppState;
use taskbolt_db::models::automation::AutomationTrigger;
use taskbolt_db::models::{TaskPriority, WsBoardEvent};
use taskbolt_db::queries::{
    bulk_delete_tasks, bulk_update_tasks, get_project_status_name, is_done_status, BulkUpdateInput,
    TaskQueryError,
};
use taskbolt_services::{spawn_automation_evaluation, BroadcastService, TriggerContext};

const MAX_BULK_TASK_IDS: usize = 200;

/// Request body for bulk update
#[strict_dto_derive::strict_dto]
pub struct BulkUpdateRequest {
    pub task_ids: Vec<Uuid>,
    pub status_id: Option<Uuid>,
    pub priority: Option<TaskPriority>,
    pub milestone_id: Option<Uuid>,
    pub clear_milestone: Option<bool>,
    pub task_list_id: Option<Uuid>,
    pub clear_task_list: Option<bool>,
}

/// Request body for bulk delete
#[strict_dto_derive::strict_dto]
pub struct BulkDeleteRequest {
    pub task_ids: Vec<Uuid>,
}

/// POST /boards/{board_id}/tasks/bulk-update
pub async fn bulk_update_handler(
    State(state): State<AppState>,
    ctx: TenantContext,
    Path(board_id): Path<Uuid>,
    StrictJson(req): StrictJson<BulkUpdateRequest>,
) -> Result<Json<serde_json::Value>> {
    if req.task_ids.len() > MAX_BULK_TASK_IDS {
        return Err(AppError::BadRequest(format!(
            "Bulk update is limited to {} tasks at a time",
            MAX_BULK_TASK_IDS
        )));
    }

    // Snapshot previous status for every affected task BEFORE the update.
    // Used to emit `status_changed` activity log entries for tasks whose
    // status actually changed. Only fetched when a bulk status change is requested.
    let previous_statuses: Vec<(Uuid, Option<Uuid>)> =
        if req.status_id.is_some() && !req.task_ids.is_empty() {
            sqlx::query_as::<_, (Uuid, Option<Uuid>)>(
                r"
            SELECT id, status_id
            FROM tasks
            WHERE id = ANY($1) AND project_id = $2 AND deleted_at IS NULL
            ",
            )
            .bind(&req.task_ids)
            .bind(board_id)
            .fetch_all(&state.db)
            .await
            .map_err(AppError::SqlxError)?
        } else {
            Vec::new()
        };

    let new_status_id = req.status_id;

    let input = BulkUpdateInput {
        task_ids: req.task_ids,
        status_id: req.status_id,
        priority: req.priority,
        milestone_id: req.milestone_id,
        clear_milestone: req.clear_milestone,
        task_list_id: req.task_list_id,
        clear_task_list: req.clear_task_list,
    };

    let updated = bulk_update_tasks(&state.db, board_id, ctx.user_id, input)
        .await
        .map_err(|e| match e {
            TaskQueryError::NotProjectMember => AppError::Forbidden("Not a project member".into()),
            TaskQueryError::Database(e) => AppError::SqlxError(e),
            _ => AppError::InternalError(format!("{}", e)),
        })?;

    // Fire-and-forget status_changed activity log entries for every task whose
    // status actually changed. Uses the pre-update snapshot so `from` names
    // remain accurate even after the UPDATE has landed.
    if let Some(to_status_id) = new_status_id {
        let changed: Vec<(Uuid, Option<Uuid>)> = previous_statuses
            .into_iter()
            .filter(|(_, prev)| *prev != Some(to_status_id))
            .collect();

        if !changed.is_empty() {
            // Invalidate board tasks cache so subscribers refetch updated statuses.
            cache::cache_del(&state.redis, &cache::project_tasks_key(&board_id)).await;

            // Emit a single TaskBulkMoved WS frame with the full list of changed
            // task ids — subscribers reconcile against the REST payload. Per-task
            // completion side-effects (assignee/admin/parent-watcher notifications)
            // are intentionally SKIPPED in the bulk path; users observe the change
            // via the WS frame. Automations still fire per task for correctness.
            let changed_ids: Vec<Uuid> = changed.iter().map(|(id, _)| *id).collect();
            let broadcast_service = BroadcastService::new(state.redis.clone());
            let bulk_event = WsBoardEvent::TaskBulkMoved {
                task_ids: changed_ids.clone(),
                status_id: to_status_id,
                origin_user_id: ctx.user_id,
            };
            if let Err(e) = broadcast_service
                .broadcast_board_event(board_id, &bulk_event)
                .await
            {
                tracing::error!(
                    board_id = %board_id,
                    "Failed to broadcast TaskBulkMoved event: {}", e
                );
            }

            // Fire automations per task. Always TaskMoved; additionally
            // TaskCompleted when the destination column is a done-status.
            let is_done_dest = is_done_status(&state.db, to_status_id)
                .await
                .unwrap_or(false);
            for (task_id, prev_id) in &changed {
                spawn_automation_evaluation(
                    state.db.clone(),
                    state.redis.clone(),
                    AutomationTrigger::TaskMoved,
                    TriggerContext {
                        task_id: *task_id,
                        board_id,
                        tenant_id: ctx.tenant_id,
                        user_id: ctx.user_id,
                        previous_status_id: *prev_id,
                        new_status_id: Some(to_status_id),
                        priority: None,
                        member_user_id: None,
                    },
                    0,
                );
                if is_done_dest {
                    spawn_automation_evaluation(
                        state.db.clone(),
                        state.redis.clone(),
                        AutomationTrigger::TaskCompleted,
                        TriggerContext {
                            task_id: *task_id,
                            board_id,
                            tenant_id: ctx.tenant_id,
                            user_id: ctx.user_id,
                            previous_status_id: *prev_id,
                            new_status_id: Some(to_status_id),
                            priority: None,
                            member_user_id: None,
                        },
                        0,
                    );
                }
            }

            let db = state.db.clone();
            let actor_id = ctx.user_id;
            let tenant_id = ctx.tenant_id;
            tokio::spawn(async move {
                // Resolve destination name once.
                let to_name = get_project_status_name(&db, to_status_id)
                    .await
                    .ok()
                    .flatten()
                    .unwrap_or_default();

                // Cache of previous-status-id -> name so we hit the DB once
                // per distinct source status instead of once per task.
                let mut name_cache: std::collections::HashMap<Uuid, String> =
                    std::collections::HashMap::new();

                for (task_id, prev_id) in changed {
                    let from_name = match prev_id {
                        Some(id) => {
                            if let Some(cached) = name_cache.get(&id) {
                                cached.clone()
                            } else {
                                let name = get_project_status_name(&db, id)
                                    .await
                                    .ok()
                                    .flatten()
                                    .unwrap_or_default();
                                name_cache.insert(id, name.clone());
                                name
                            }
                        }
                        None => String::new(),
                    };

                    if let Err(e) = ActivityLogService::record_status_changed(
                        &db,
                        task_id,
                        actor_id,
                        tenant_id,
                        from_name.as_str(),
                        to_name.as_str(),
                    )
                    .await
                    {
                        tracing::error!(
                            task_id = %task_id,
                            "Failed to record bulk status_changed activity: {}",
                            e
                        );
                    }
                }
            });
        }
    }

    Ok(Json(json!({ "updated": updated })))
}

/// POST /boards/{board_id}/tasks/bulk-delete
pub async fn bulk_delete_handler(
    State(state): State<AppState>,
    ctx: TenantContext,
    Path(board_id): Path<Uuid>,
    StrictJson(req): StrictJson<BulkDeleteRequest>,
) -> Result<Json<serde_json::Value>> {
    if req.task_ids.len() > MAX_BULK_TASK_IDS {
        return Err(AppError::BadRequest(format!(
            "Bulk delete is limited to {} tasks at a time",
            MAX_BULK_TASK_IDS
        )));
    }

    let deleted = bulk_delete_tasks(&state.db, board_id, ctx.user_id, &req.task_ids)
        .await
        .map_err(|e| match e {
            TaskQueryError::NotProjectMember => AppError::Forbidden("Not a project member".into()),
            TaskQueryError::Database(e) => AppError::SqlxError(e),
            _ => AppError::InternalError(format!("{}", e)),
        })?;

    Ok(Json(json!({ "deleted": deleted })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_max_bulk_task_ids() {
        assert_eq!(MAX_BULK_TASK_IDS, 200);
    }
}
