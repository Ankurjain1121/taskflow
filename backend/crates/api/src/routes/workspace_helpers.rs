//! Workspace helper functions
//!
//! Non-handler logic extracted from workspace.rs for reuse and file size control.

use uuid::Uuid;

use taskbolt_db::models::automation::AutomationTrigger;
use taskbolt_services::{spawn_automation_evaluation, TriggerContext};

/// Fire MemberJoined trigger for all boards in a workspace.
///
/// Spawns a background task that queries all non-deleted boards in the workspace
/// and fires a `MemberJoined` automation trigger for each one.
pub fn fire_member_joined_trigger(
    pool: sqlx::PgPool,
    redis: redis::aio::ConnectionManager,
    workspace_id: Uuid,
    member_user_id: Uuid,
    tenant_id: Uuid,
) {
    tokio::spawn(async move {
        let board_ids = sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM boards WHERE workspace_id = $1 AND deleted_at IS NULL",
        )
        .bind(workspace_id)
        .fetch_all(&pool)
        .await
        .unwrap_or_default();

        for board_id in board_ids {
            // Use a dummy task_id (Nil) since MemberJoined doesn't relate to a specific task
            spawn_automation_evaluation(
                pool.clone(),
                redis.clone(),
                AutomationTrigger::MemberJoined,
                TriggerContext {
                    task_id: Uuid::nil(),
                    board_id,
                    tenant_id,
                    user_id: member_user_id,
                    previous_status_id: None,
                    new_status_id: None,
                    priority: None,
                    member_user_id: Some(member_user_id),
                },
                0,
            );
        }
    });
}
