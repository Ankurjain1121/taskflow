use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::automation::{
    AutomationAction, AutomationActionType, AutomationLog, AutomationRule, AutomationTrigger,
};

/// Error type for automation query operations
#[derive(Debug, thiserror::Error)]
pub enum AutomationQueryError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Automation rule not found")]
    NotFound,
    #[error("User is not a member of this board")]
    NotBoardMember,
}

/// A rule with its associated actions
#[derive(Debug, Serialize)]
pub struct AutomationRuleWithActions {
    pub rule: AutomationRule,
    pub actions: Vec<AutomationAction>,
}

/// Input for creating a single action within a rule
#[derive(Debug, Deserialize)]
pub struct CreateActionInput {
    pub action_type: AutomationActionType,
    pub action_config: serde_json::Value,
}

/// Input for creating a new automation rule
#[derive(Debug, Deserialize)]
pub struct CreateRuleInput {
    pub name: String,
    pub trigger: AutomationTrigger,
    pub trigger_config: serde_json::Value,
    pub actions: Vec<CreateActionInput>,
}

/// Input for updating an existing automation rule
#[derive(Debug, Deserialize)]
pub struct UpdateRuleInput {
    pub name: Option<String>,
    pub trigger: Option<AutomationTrigger>,
    pub trigger_config: Option<serde_json::Value>,
    pub is_active: Option<bool>,
    pub actions: Option<Vec<CreateActionInput>>,
}

/// Internal helper: verify board membership
async fn verify_board_membership_internal(
    pool: &PgPool,
    board_id: Uuid,
    user_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM board_members
            WHERE board_id = $1 AND user_id = $2
        )
        "#,
    )
    .bind(board_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    Ok(result)
}

/// Internal helper: get the board_id for a rule
async fn get_rule_board_id_internal(
    pool: &PgPool,
    rule_id: Uuid,
) -> Result<Uuid, AutomationQueryError> {
    let board_id = sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT board_id FROM automation_rules WHERE id = $1
        "#,
    )
    .bind(rule_id)
    .fetch_optional(pool)
    .await?
    .ok_or(AutomationQueryError::NotFound)?;

    Ok(board_id)
}

/// Internal helper: fetch actions for a rule
async fn fetch_actions_for_rule(
    pool: &PgPool,
    rule_id: Uuid,
) -> Result<Vec<AutomationAction>, sqlx::Error> {
    let actions = sqlx::query_as::<_, AutomationAction>(
        r#"
        SELECT
            id,
            rule_id,
            action_type as "action_type: AutomationActionType",
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

/// List all automation rules for a board, with their actions.
/// Verifies board membership before returning.
pub async fn list_rules(
    pool: &PgPool,
    board_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<AutomationRuleWithActions>, AutomationQueryError> {
    if !verify_board_membership_internal(pool, board_id, user_id).await? {
        return Err(AutomationQueryError::NotBoardMember);
    }

    let rules = sqlx::query_as::<_, AutomationRule>(
        r#"
        SELECT
            id,
            name,
            board_id,
            trigger as "trigger: AutomationTrigger",
            trigger_config,
            is_active,
            tenant_id,
            created_by_id,
            created_at,
            updated_at
        FROM automation_rules
        WHERE board_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(board_id)
    .fetch_all(pool)
    .await?;

    let mut results = Vec::with_capacity(rules.len());
    for rule in rules {
        let actions = fetch_actions_for_rule(pool, rule.id).await?;
        results.push(AutomationRuleWithActions { rule, actions });
    }

    Ok(results)
}

/// Get a single automation rule with its actions.
/// Verifies board membership through the rule's board_id.
pub async fn get_rule(
    pool: &PgPool,
    rule_id: Uuid,
    user_id: Uuid,
) -> Result<AutomationRuleWithActions, AutomationQueryError> {
    let rule = sqlx::query_as::<_, AutomationRule>(
        r#"
        SELECT
            id,
            name,
            board_id,
            trigger as "trigger: AutomationTrigger",
            trigger_config,
            is_active,
            tenant_id,
            created_by_id,
            created_at,
            updated_at
        FROM automation_rules
        WHERE id = $1
        "#,
    )
    .bind(rule_id)
    .fetch_optional(pool)
    .await?
    .ok_or(AutomationQueryError::NotFound)?;

    if !verify_board_membership_internal(pool, rule.board_id, user_id).await? {
        return Err(AutomationQueryError::NotBoardMember);
    }

    let actions = fetch_actions_for_rule(pool, rule.id).await?;

    Ok(AutomationRuleWithActions { rule, actions })
}

/// Create a new automation rule with its actions in a transaction.
/// Verifies board membership before inserting.
pub async fn create_rule(
    pool: &PgPool,
    board_id: Uuid,
    input: CreateRuleInput,
    user_id: Uuid,
    tenant_id: Uuid,
) -> Result<AutomationRuleWithActions, AutomationQueryError> {
    if !verify_board_membership_internal(pool, board_id, user_id).await? {
        return Err(AutomationQueryError::NotBoardMember);
    }

    let mut tx = pool.begin().await?;

    let rule_id = Uuid::new_v4();
    let now = Utc::now();

    let rule = sqlx::query_as::<_, AutomationRule>(
        r#"
        INSERT INTO automation_rules (
            id, name, board_id, trigger, trigger_config,
            is_active, tenant_id, created_by_id, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8, $8)
        RETURNING
            id,
            name,
            board_id,
            trigger as "trigger: AutomationTrigger",
            trigger_config,
            is_active,
            tenant_id,
            created_by_id,
            created_at,
            updated_at
        "#,
    )
    .bind(rule_id)
    .bind(&input.name)
    .bind(board_id)
    .bind(&input.trigger)
    .bind(&input.trigger_config)
    .bind(tenant_id)
    .bind(user_id)
    .bind(now)
    .fetch_one(&mut *tx)
    .await?;

    let mut actions = Vec::with_capacity(input.actions.len());
    for (i, action_input) in input.actions.into_iter().enumerate() {
        let action = sqlx::query_as::<_, AutomationAction>(
            r#"
            INSERT INTO automation_actions (
                id, rule_id, action_type, action_config, position
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING
                id,
                rule_id,
                action_type as "action_type: AutomationActionType",
                action_config,
                position
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(rule_id)
        .bind(&action_input.action_type)
        .bind(&action_input.action_config)
        .bind(i as i32)
        .fetch_one(&mut *tx)
        .await?;

        actions.push(action);
    }

    tx.commit().await?;

    Ok(AutomationRuleWithActions { rule, actions })
}

/// Update an existing automation rule.
/// If actions are provided, replaces all existing actions.
/// Verifies board membership through the rule's board_id.
pub async fn update_rule(
    pool: &PgPool,
    rule_id: Uuid,
    input: UpdateRuleInput,
    user_id: Uuid,
) -> Result<AutomationRuleWithActions, AutomationQueryError> {
    let board_id = get_rule_board_id_internal(pool, rule_id).await?;

    if !verify_board_membership_internal(pool, board_id, user_id).await? {
        return Err(AutomationQueryError::NotBoardMember);
    }

    let mut tx = pool.begin().await?;

    let rule = sqlx::query_as::<_, AutomationRule>(
        r#"
        UPDATE automation_rules
        SET
            name = COALESCE($2, name),
            trigger = COALESCE($3, trigger),
            trigger_config = COALESCE($4, trigger_config),
            is_active = COALESCE($5, is_active),
            updated_at = NOW()
        WHERE id = $1
        RETURNING
            id,
            name,
            board_id,
            trigger as "trigger: AutomationTrigger",
            trigger_config,
            is_active,
            tenant_id,
            created_by_id,
            created_at,
            updated_at
        "#,
    )
    .bind(rule_id)
    .bind(&input.name)
    .bind(&input.trigger)
    .bind(&input.trigger_config)
    .bind(input.is_active)
    .fetch_one(&mut *tx)
    .await?;

    // If actions are provided, replace all existing actions
    let actions = if let Some(new_actions) = input.actions {
        // Delete existing actions
        sqlx::query(
            r#"
            DELETE FROM automation_actions WHERE rule_id = $1
            "#,
        )
        .bind(rule_id)
        .execute(&mut *tx)
        .await?;

        // Insert new actions
        let mut actions = Vec::with_capacity(new_actions.len());
        for (i, action_input) in new_actions.into_iter().enumerate() {
            let action = sqlx::query_as::<_, AutomationAction>(
                r#"
                INSERT INTO automation_actions (
                    id, rule_id, action_type, action_config, position
                )
                VALUES ($1, $2, $3, $4, $5)
                RETURNING
                    id,
                    rule_id,
                    action_type as "action_type: AutomationActionType",
                    action_config,
                    position
                "#,
            )
            .bind(Uuid::new_v4())
            .bind(rule_id)
            .bind(&action_input.action_type)
            .bind(&action_input.action_config)
            .bind(i as i32)
            .fetch_one(&mut *tx)
            .await?;

            actions.push(action);
        }
        actions
    } else {
        // Fetch existing actions
        sqlx::query_as::<_, AutomationAction>(
            r#"
            SELECT
                id,
                rule_id,
                action_type as "action_type: AutomationActionType",
                action_config,
                position
            FROM automation_actions
            WHERE rule_id = $1
            ORDER BY position ASC
            "#,
        )
        .bind(rule_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;

    Ok(AutomationRuleWithActions { rule, actions })
}

/// Delete an automation rule.
/// Cascade deletes actions and logs via FK constraints.
/// Verifies board membership through the rule's board_id.
pub async fn delete_rule(
    pool: &PgPool,
    rule_id: Uuid,
    user_id: Uuid,
) -> Result<(), AutomationQueryError> {
    let board_id = get_rule_board_id_internal(pool, rule_id).await?;

    if !verify_board_membership_internal(pool, board_id, user_id).await? {
        return Err(AutomationQueryError::NotBoardMember);
    }

    let rows_affected = sqlx::query(
        r#"
        DELETE FROM automation_rules WHERE id = $1
        "#,
    )
    .bind(rule_id)
    .execute(pool)
    .await?
    .rows_affected();

    if rows_affected == 0 {
        return Err(AutomationQueryError::NotFound);
    }

    Ok(())
}

/// Get automation logs for a rule, ordered by most recent first.
/// Verifies board membership through the rule's board_id.
pub async fn get_rule_logs(
    pool: &PgPool,
    rule_id: Uuid,
    user_id: Uuid,
    limit: i64,
) -> Result<Vec<AutomationLog>, AutomationQueryError> {
    let board_id = get_rule_board_id_internal(pool, rule_id).await?;

    if !verify_board_membership_internal(pool, board_id, user_id).await? {
        return Err(AutomationQueryError::NotBoardMember);
    }

    let logs = sqlx::query_as::<_, AutomationLog>(
        r#"
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
        "#,
    )
    .bind(rule_id)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(logs)
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
            trigger as "trigger: AutomationTrigger",
            trigger_config,
            is_active,
            tenant_id,
            created_by_id,
            created_at,
            updated_at
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

/// Log an automation execution result.
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

    Ok(log)
}
