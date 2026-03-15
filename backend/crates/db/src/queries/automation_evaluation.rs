//! Automation evaluation and execution support queries.
//!
//! Functions used by the automation engine to find triggered rules and log results.

use chrono::{DateTime, Utc};
use serde_json;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use crate::models::automation::{
    AutomationAction, AutomationLog, AutomationRule, AutomationTrigger,
};

use super::automations::{AutomationQueryError, AutomationRuleWithActions};

/// Internal helper: fetch actions for a rule (duplicated here to avoid cross-module coupling).
async fn fetch_actions_for_rule(
    pool: &PgPool,
    rule_id: Uuid,
) -> Result<Vec<AutomationAction>, sqlx::Error> {
    let actions = sqlx::query_as::<_, AutomationAction>(
        r#"
        SELECT
            id,
            rule_id,
            action_type,
            action_config,
            position
        FROM automation_actions
        WHERE rule_id = $1
        ORDER BY position ASC
        "#,
    )
    .bind(rule_id)
    .fetch_all(pool)
    .await?;

    Ok(actions)
}

/// Get all active rules for a specific trigger on a board.
/// Used by the automation engine to find rules that should fire.
pub async fn get_active_rules_for_trigger(
    pool: &PgPool,
    board_id: Uuid,
    trigger: AutomationTrigger,
) -> Result<Vec<AutomationRuleWithActions>, AutomationQueryError> {
    let rules = sqlx::query_as::<_, AutomationRule>(
        r#"
        SELECT
            id,
            name,
            board_id,
            trigger,
            trigger_config,
            is_active,
            tenant_id,
            created_by_id,
            created_at,
            updated_at,
            conditions,
            execution_count,
            last_triggered_at
        FROM automation_rules
        WHERE board_id = $1
          AND trigger = $2
          AND is_active = true
        ORDER BY created_at ASC
        "#,
    )
    .bind(board_id)
    .bind(&trigger)
    .fetch_all(pool)
    .await?;

    let mut results = Vec::with_capacity(rules.len());
    for rule in rules {
        let actions = fetch_actions_for_rule(pool, rule.id).await?;
        results.push(AutomationRuleWithActions { rule, actions });
    }

    Ok(results)
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
        r#"
        INSERT INTO automation_logs (id, rule_id, task_id, triggered_at, status, details)
        VALUES ($1, $2, $3, NOW(), $4, $5)
        RETURNING
            id,
            rule_id,
            task_id,
            triggered_at,
            status,
            details
        "#,
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
        r#"
        UPDATE automation_rules
        SET execution_count = execution_count + 1,
            last_triggered_at = NOW()
        WHERE id = $1
        "#,
    )
    .bind(rule_id)
    .execute(pool)
    .await?;

    Ok(log)
}

/// A task eligible for a scheduled automation trigger (due date passed or approaching).
#[derive(FromRow, Debug, Clone)]
pub struct ScheduledTriggerTask {
    pub task_id: Uuid,
    pub board_id: Uuid,
    pub tenant_id: Uuid,
    pub assignee_id: Option<Uuid>,
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
        r#"
        SELECT DISTINCT
            t.id as task_id,
            t.board_id,
            b.tenant_id,
            t.assignee_id,
            t.due_date,
            'task_due_date_passed'::automation_trigger as trigger
        FROM tasks t
        JOIN boards b ON b.id = t.board_id
        WHERE t.due_date < NOW()
          AND t.due_date > NOW() - INTERVAL '1 day'
          AND t.deleted_at IS NULL
          AND t.archived_at IS NULL
          AND EXISTS (
              SELECT 1 FROM automation_rules ar
              WHERE ar.board_id = t.board_id
                AND ar.trigger = 'task_due_date_passed'
                AND ar.is_active = true
          )
        ORDER BY t.due_date ASC
        LIMIT 500
        "#,
    )
    .fetch_all(pool)
    .await?;

    // Find tasks whose due dates are approaching (within next 24h)
    let approaching = sqlx::query_as::<_, ScheduledTriggerTask>(
        r#"
        SELECT DISTINCT
            t.id as task_id,
            t.board_id,
            b.tenant_id,
            t.assignee_id,
            t.due_date,
            'due_date_approaching'::automation_trigger as trigger
        FROM tasks t
        JOIN boards b ON b.id = t.board_id
        WHERE t.due_date > NOW()
          AND t.due_date <= NOW() + INTERVAL '24 hours'
          AND t.deleted_at IS NULL
          AND t.archived_at IS NULL
          AND EXISTS (
              SELECT 1 FROM automation_rules ar
              WHERE ar.board_id = t.board_id
                AND ar.trigger = 'due_date_approaching'
                AND ar.is_active = true
          )
        ORDER BY t.due_date ASC
        LIMIT 500
        "#,
    )
    .fetch_all(pool)
    .await?;

    let mut results = overdue;
    results.extend(approaching);
    Ok(results)
}
