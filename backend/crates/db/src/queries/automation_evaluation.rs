//! Automation evaluation and execution support queries.
//!
//! Functions used by the automation engine to find triggered rules and log results.
//! Also contains shared helpers (RuleActionRow, fold_rules_with_actions) used by
//! both this module and `automations.rs`.

use chrono::{DateTime, Utc};
use serde_json;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use crate::models::automation::{
    AutomationAction, AutomationActionType, AutomationLog, AutomationRule, AutomationTrigger,
};

use super::automations::{AutomationQueryError, AutomationRuleWithActions};

/// Flat row from a JOIN of automation_rules + automation_actions.
/// Used internally to fold into `AutomationRuleWithActions`.
#[derive(Debug, sqlx::FromRow)]
pub(crate) struct RuleActionRow {
    pub rule_id: Uuid,
    pub rule_name: String,
    pub project_id: Uuid,
    pub trigger: AutomationTrigger,
    pub trigger_config: serde_json::Value,
    pub is_active: bool,
    pub tenant_id: Uuid,
    pub created_by_id: Uuid,
    pub rule_created_at: DateTime<Utc>,
    pub rule_updated_at: DateTime<Utc>,
    pub conditions: Option<serde_json::Value>,
    pub execution_count: i32,
    pub last_triggered_at: Option<DateTime<Utc>>,
    pub action_id: Option<Uuid>,
    pub action_type: Option<AutomationActionType>,
    pub action_config: Option<serde_json::Value>,
    pub action_position: Option<i32>,
}

/// Fold flat JOIN rows into grouped `AutomationRuleWithActions`.
///
/// Assumes rows are ordered by rule (all rows for the same rule are contiguous)
/// which is guaranteed when the SQL sorts by `ar.created_at` before `aa.position`.
pub(crate) fn fold_rules_with_actions(rows: Vec<RuleActionRow>) -> Vec<AutomationRuleWithActions> {
    let mut results: Vec<AutomationRuleWithActions> = Vec::new();

    for row in rows {
        // Check if we already have this rule (it will be the last one due to ordering)
        let needs_new = results
            .last()
            .is_none_or(|last| last.rule.id != row.rule_id);

        if needs_new {
            results.push(AutomationRuleWithActions {
                rule: AutomationRule {
                    id: row.rule_id,
                    name: row.rule_name,
                    project_id: row.project_id,
                    trigger: row.trigger,
                    trigger_config: row.trigger_config,
                    is_active: row.is_active,
                    tenant_id: row.tenant_id,
                    created_by_id: row.created_by_id,
                    created_at: row.rule_created_at,
                    updated_at: row.rule_updated_at,
                    conditions: row.conditions,
                    execution_count: row.execution_count,
                    last_triggered_at: row.last_triggered_at,
                },
                actions: Vec::new(),
            });
        }

        // If this row has an action, append it
        if let Some(action_id) = row.action_id {
            let current = results.last_mut().expect("just pushed or matched");
            current.actions.push(AutomationAction {
                id: action_id,
                rule_id: current.rule.id,
                action_type: row
                    .action_type
                    .expect("action_type present when action_id present"),
                action_config: row
                    .action_config
                    .expect("action_config present when action_id present"),
                position: row
                    .action_position
                    .expect("action_position present when action_id present"),
            });
        }
    }

    results
}

/// Get all active rules for a specific trigger on a project.
/// Uses a single JOIN query instead of N+1 fetches.
/// Used by the automation engine to find rules that should fire.
pub async fn get_active_rules_for_trigger(
    pool: &PgPool,
    board_id: Uuid,
    trigger: AutomationTrigger,
) -> Result<Vec<AutomationRuleWithActions>, AutomationQueryError> {
    let rows = sqlx::query_as::<_, RuleActionRow>(
        r"
        SELECT
            ar.id as rule_id, ar.name as rule_name, ar.project_id, ar.trigger,
            ar.trigger_config, ar.is_active, ar.tenant_id, ar.created_by_id,
            ar.created_at as rule_created_at, ar.updated_at as rule_updated_at,
            ar.conditions, ar.execution_count, ar.last_triggered_at,
            aa.id as action_id, aa.action_type, aa.action_config, aa.position as action_position
        FROM automation_rules ar
        LEFT JOIN automation_actions aa ON aa.rule_id = ar.id
        WHERE ar.project_id = $1
          AND ar.trigger = $2
          AND ar.is_active = true
        ORDER BY ar.created_at ASC, aa.position ASC
        ",
    )
    .bind(board_id)
    .bind(&trigger)
    .fetch_all(pool)
    .await?;

    Ok(fold_rules_with_actions(rows))
}

/// Log an automation execution result and update rule execution stats.
pub async fn log_automation(
    pool: &PgPool,
    rule_id: Uuid,
    task_id: Option<Uuid>,
    status: &str,
    details: Option<serde_json::Value>,
) -> Result<AutomationLog, AutomationQueryError> {
    let log = sqlx::query_as::<_, AutomationLog>(
        r"
        INSERT INTO automation_logs (id, rule_id, task_id, triggered_at, status, details)
        VALUES ($1, $2, $3, NOW(), $4, $5)
        RETURNING
            id,
            rule_id,
            task_id,
            triggered_at,
            status,
            details
        ",
    )
    .bind(Uuid::new_v4())
    .bind(rule_id)
    .bind(task_id)
    .bind(status)
    .bind(&details)
    .fetch_one(pool)
    .await?;

    // Update execution stats on the rule
    sqlx::query(
        r"
        UPDATE automation_rules
        SET execution_count = execution_count + 1,
            last_triggered_at = NOW()
        WHERE id = $1
        ",
    )
    .bind(rule_id)
    .execute(pool)
    .await?;

    Ok(log)
}

/// Get automation logs for a rule, ordered by most recent first.
/// Verifies board membership through the rule's board_id.
pub async fn get_rule_logs(
    pool: &PgPool,
    rule_id: Uuid,
    user_id: Uuid,
    limit: i64,
) -> Result<Vec<AutomationLog>, AutomationQueryError> {
    let board_id = sqlx::query_scalar::<_, Uuid>(
        r"
        SELECT project_id FROM automation_rules WHERE id = $1
        ",
    )
    .bind(rule_id)
    .fetch_optional(pool)
    .await?
    .ok_or(AutomationQueryError::NotFound)?;

    if !super::membership::verify_project_membership(pool, board_id, user_id).await? {
        return Err(AutomationQueryError::NotBoardMember);
    }

    let logs = sqlx::query_as::<_, AutomationLog>(
        r"
        SELECT
            id,
            rule_id,
            task_id,
            triggered_at,
            status,
            details
        FROM automation_logs
        WHERE rule_id = $1
        ORDER BY triggered_at DESC
        LIMIT $2
        ",
    )
    .bind(rule_id)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(logs)
}

/// A task eligible for a scheduled automation trigger (due date passed or approaching).
#[derive(FromRow, Debug, Clone)]
pub struct ScheduledTriggerTask {
    pub task_id: Uuid,
    pub project_id: Uuid,
    pub tenant_id: Uuid,
    pub due_date: DateTime<Utc>,
    pub trigger: AutomationTrigger,
}

/// Find tasks eligible for time-based automation triggers.
///
/// Returns tasks where:
/// - `TaskDueDatePassed`: due_date < NOW() and task is not archived/deleted
/// - `DueDateApproaching`: due_date is within the next 24 hours
///
/// Only returns tasks on boards that have active automation rules for these triggers.
pub async fn get_scheduled_trigger_tasks(
    pool: &PgPool,
) -> Result<Vec<ScheduledTriggerTask>, sqlx::Error> {
    // Find tasks whose due dates have passed (overdue)
    let overdue = sqlx::query_as::<_, ScheduledTriggerTask>(
        r"
        SELECT DISTINCT
            t.id as task_id,
            t.project_id,
            p.tenant_id,
            t.due_date,
            'task_due_date_passed'::automation_trigger as trigger
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        WHERE t.due_date < NOW()
          AND t.due_date > NOW() - INTERVAL '1 day'
          AND t.deleted_at IS NULL
          AND t.parent_task_id IS NULL
          AND EXISTS (
              SELECT 1 FROM automation_rules ar
              WHERE ar.project_id = t.project_id
                AND ar.trigger = 'task_due_date_passed'
                AND ar.is_active = true
          )
        ORDER BY t.due_date ASC
        LIMIT 500
        ",
    )
    .fetch_all(pool)
    .await?;

    // Find tasks whose due dates are approaching (within next 24h)
    let approaching = sqlx::query_as::<_, ScheduledTriggerTask>(
        r"
        SELECT DISTINCT
            t.id as task_id,
            t.project_id,
            p.tenant_id,
            t.due_date,
            'due_date_approaching'::automation_trigger as trigger
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        WHERE t.due_date > NOW()
          AND t.due_date <= NOW() + INTERVAL '24 hours'
          AND t.deleted_at IS NULL
          AND t.parent_task_id IS NULL
          AND EXISTS (
              SELECT 1 FROM automation_rules ar
              WHERE ar.project_id = t.project_id
                AND ar.trigger = 'due_date_approaching'
                AND ar.is_active = true
          )
        ORDER BY t.due_date ASC
        LIMIT 500
        ",
    )
    .fetch_all(pool)
    .await?;

    let mut results = overdue;
    results.extend(approaching);
    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::automation::{AutomationActionType, AutomationTrigger};
    use crate::queries::automations::{CreateActionInput, CreateRuleInput};
    use crate::queries::{auth, projects, workspaces};
    use crate::test_helpers::test_pool;

    const FAKE_HASH: &str = "$argon2id$v=19$m=19456,t=2,p=1$fake_salt$fake_hash_for_test";

    fn unique_email() -> String {
        format!("inttest-autoeval-{}@example.com", Uuid::new_v4())
    }

    async fn setup_user(pool: &PgPool) -> (Uuid, Uuid) {
        let user = auth::create_user_with_tenant(
            pool,
            &unique_email(),
            "AutoEval User",
            FAKE_HASH,
            None,
            false,
        )
        .await
        .expect("create_user_with_tenant");
        (user.tenant_id, user.id)
    }

    async fn setup_full(pool: &PgPool) -> (Uuid, Uuid, Uuid, Uuid, Uuid) {
        let (tenant_id, user_id) = setup_user(pool).await;
        let ws = workspaces::create_workspace(pool, "AutoEval WS", None, tenant_id, user_id)
            .await
            .expect("create_workspace");
        let bwc = projects::create_project(pool, "AutoEval Board", None, ws.id, tenant_id, user_id)
            .await
            .expect("create_board");
        let first_col_id = bwc.task_lists[0].id;
        (tenant_id, user_id, ws.id, bwc.project.id, first_col_id)
    }

    #[ignore = "integration test - run with: cargo test -- --ignored"]
    #[tokio::test]
    async fn test_log_automation_and_get_logs() {
        let pool = test_pool().await;
        let (tenant_id, user_id, _ws_id, board_id, _col_id) = setup_full(&pool).await;

        let input = CreateRuleInput {
            name: format!("LogRule-{}", Uuid::new_v4()),
            trigger: AutomationTrigger::TaskMoved,
            trigger_config: serde_json::json!({}),
            actions: vec![CreateActionInput {
                action_type: AutomationActionType::MoveTask,
                action_config: serde_json::json!({}),
            }],
        };

        let created =
            crate::queries::automations::create_rule(&pool, board_id, input, user_id, tenant_id)
                .await
                .expect("create_rule");

        // Log an execution
        let log_entry = log_automation(
            &pool,
            created.rule.id,
            None,
            "success",
            Some(serde_json::json!({"detail": "test log"})),
        )
        .await
        .expect("log_automation should succeed");

        assert_eq!(log_entry.rule_id, created.rule.id);
        assert_eq!(log_entry.status, "success");

        // Fetch logs
        let logs = get_rule_logs(&pool, created.rule.id, user_id, 10)
            .await
            .expect("get_rule_logs should succeed");

        assert!(!logs.is_empty(), "should have at least 1 log entry");
        assert_eq!(logs[0].rule_id, created.rule.id);

        // Verify execution count was incremented
        let updated_rule = crate::queries::automations::get_rule(&pool, created.rule.id, user_id)
            .await
            .expect("get_rule");
        assert_eq!(
            updated_rule.rule.execution_count, 1,
            "execution_count should be 1"
        );
    }
}
