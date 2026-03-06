//! Automation evaluation and execution support queries.
//!
//! Functions used by the automation engine to find triggered rules and log results.

use serde_json;
use sqlx::PgPool;
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

/// Get all active rules for a specific trigger on a project.
/// Used by the automation engine to find rules that should fire.
pub async fn get_active_rules_for_trigger(
    pool: &PgPool,
    project_id: Uuid,
    trigger: AutomationTrigger,
) -> Result<Vec<AutomationRuleWithActions>, AutomationQueryError> {
    let rules = sqlx::query_as::<_, AutomationRule>(
        r#"
        SELECT
            id,
            name,
            project_id,
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
        WHERE project_id = $1
          AND trigger = $2
          AND is_active = true
        ORDER BY created_at ASC
        "#,
    )
    .bind(project_id)
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
