use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::automation::{
    AutomationAction, AutomationActionType, AutomationRule, AutomationTrigger,
};

// Re-export evaluation helpers so consumers don't need import changes
pub use super::automation_evaluation::*;

use super::automation_evaluation::{fold_rules_with_actions, RuleActionRow};

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

use super::membership::verify_project_membership;

/// Internal helper: get the board_id for a rule
async fn get_rule_board_id_internal(
    pool: &PgPool,
    rule_id: Uuid,
) -> Result<Uuid, AutomationQueryError> {
    let board_id = sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT project_id FROM automation_rules WHERE id = $1
        "#,
    )
    .bind(rule_id)
    .fetch_optional(pool)
    .await?
    .ok_or(AutomationQueryError::NotFound)?;

    Ok(board_id)
}

/// List all automation rules for a board, with their actions.
/// Verifies board membership before returning.
/// Uses a single JOIN query instead of N+1 fetches.
pub async fn list_rules(
    pool: &PgPool,
    board_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<AutomationRuleWithActions>, AutomationQueryError> {
    if !verify_project_membership(pool, board_id, user_id).await? {
        return Err(AutomationQueryError::NotBoardMember);
    }

    let rows = sqlx::query_as::<_, RuleActionRow>(
        r#"
        SELECT
            ar.id as rule_id, ar.name as rule_name, ar.project_id, ar.trigger,
            ar.trigger_config, ar.is_active, ar.tenant_id, ar.created_by_id,
            ar.created_at as rule_created_at, ar.updated_at as rule_updated_at,
            ar.conditions, ar.execution_count, ar.last_triggered_at,
            aa.id as action_id, aa.action_type, aa.action_config, aa.position as action_position
        FROM automation_rules ar
        LEFT JOIN automation_actions aa ON aa.rule_id = ar.id
        WHERE ar.project_id = $1
        ORDER BY ar.created_at DESC, aa.position ASC
        "#,
    )
    .bind(board_id)
    .fetch_all(pool)
    .await?;

    Ok(fold_rules_with_actions(rows))
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
        WHERE id = $1
        "#,
    )
    .bind(rule_id)
    .fetch_optional(pool)
    .await?
    .ok_or(AutomationQueryError::NotFound)?;

    if !verify_project_membership(pool, rule.project_id, user_id).await? {
        return Err(AutomationQueryError::NotBoardMember);
    }

    let actions = sqlx::query_as::<_, AutomationAction>(
        r#"
        SELECT id, rule_id, action_type, action_config, position
        FROM automation_actions
        WHERE rule_id = $1
        ORDER BY position ASC
        "#,
    )
    .bind(rule.id)
    .fetch_all(pool)
    .await?;

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
    if !verify_project_membership(pool, board_id, user_id).await? {
        return Err(AutomationQueryError::NotBoardMember);
    }

    let mut tx = pool.begin().await?;

    let rule_id = Uuid::new_v4();
    let now = Utc::now();

    let rule = sqlx::query_as::<_, AutomationRule>(
        r#"
        INSERT INTO automation_rules (
            id, name, project_id, trigger, trigger_config,
            is_active, tenant_id, created_by_id, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8, $8)
        RETURNING
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
                action_type,
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

    if !verify_project_membership(pool, board_id, user_id).await? {
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
                    action_type,
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
                action_type,
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

    if !verify_project_membership(pool, board_id, user_id).await? {
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::queries::{auth, projects, workspaces};
    use crate::test_helpers::test_pool;

    const FAKE_HASH: &str = "$argon2id$v=19$m=19456,t=2,p=1$fake_salt$fake_hash_for_test";

    fn unique_email() -> String {
        format!("inttest-auto-{}@example.com", Uuid::new_v4())
    }

    async fn setup_user(pool: &PgPool) -> (Uuid, Uuid) {
        let user =
            auth::create_user_with_tenant(pool, &unique_email(), "Automation User", FAKE_HASH)
                .await
                .expect("create_user_with_tenant");
        (user.tenant_id, user.id)
    }

    async fn setup_user_and_workspace(pool: &PgPool) -> (Uuid, Uuid, Uuid) {
        let (tenant_id, user_id) = setup_user(pool).await;
        let ws = workspaces::create_workspace(pool, "Automation WS", None, tenant_id, user_id)
            .await
            .expect("create_workspace");
        (tenant_id, user_id, ws.id)
    }

    async fn setup_full(pool: &PgPool) -> (Uuid, Uuid, Uuid, Uuid, Uuid) {
        let (tenant_id, user_id, ws_id) = setup_user_and_workspace(pool).await;
        let bwc = projects::create_board(pool, "Automation Board", None, ws_id, tenant_id, user_id)
            .await
            .expect("create_board");
        let first_col_id = bwc.task_lists[0].id;
        (tenant_id, user_id, ws_id, bwc.project.id, first_col_id)
    }
    #[ignore = "integration test - run with: cargo test -- --ignored"]
    #[tokio::test]
    async fn test_create_rule() {
        let pool = test_pool().await;
        let (tenant_id, user_id, _ws_id, board_id, _col_id) = setup_full(&pool).await;

        let input = CreateRuleInput {
            name: format!("Rule-{}", Uuid::new_v4()),
            trigger: AutomationTrigger::TaskMoved,
            trigger_config: serde_json::json!({"from_column": "To Do", "to_column": "Done"}),
            actions: vec![CreateActionInput {
                action_type: AutomationActionType::SendNotification,
                action_config: serde_json::json!({"message": "Task completed!"}),
            }],
        };
        let rule_name = input.name.clone();

        let result = create_rule(&pool, board_id, input, user_id, tenant_id)
            .await
            .expect("create_rule should succeed");

        assert_eq!(result.rule.name, rule_name);
        assert_eq!(result.rule.project_id, board_id);
        assert_eq!(result.rule.trigger, AutomationTrigger::TaskMoved);
        assert!(result.rule.is_active);
        assert_eq!(result.rule.tenant_id, tenant_id);
        assert_eq!(result.rule.created_by_id, user_id);
        assert_eq!(result.actions.len(), 1);
        assert_eq!(
            result.actions[0].action_type,
            AutomationActionType::SendNotification
        );
        assert_eq!(result.actions[0].position, 0);
    }
    #[ignore = "integration test - run with: cargo test -- --ignored"]
    #[tokio::test]
    async fn test_list_rules() {
        let pool = test_pool().await;
        let (tenant_id, user_id, _ws_id, board_id, _col_id) = setup_full(&pool).await;

        let input1 = CreateRuleInput {
            name: format!("ListRule1-{}", Uuid::new_v4()),
            trigger: AutomationTrigger::TaskCreated,
            trigger_config: serde_json::json!({}),
            actions: vec![CreateActionInput {
                action_type: AutomationActionType::AssignTask,
                action_config: serde_json::json!({"user_id": Uuid::new_v4()}),
            }],
        };
        let name1 = input1.name.clone();

        let input2 = CreateRuleInput {
            name: format!("ListRule2-{}", Uuid::new_v4()),
            trigger: AutomationTrigger::TaskCompleted,
            trigger_config: serde_json::json!({}),
            actions: vec![CreateActionInput {
                action_type: AutomationActionType::MoveTask,
                action_config: serde_json::json!({"column": "Archive"}),
            }],
        };
        let name2 = input2.name.clone();

        create_rule(&pool, board_id, input1, user_id, tenant_id)
            .await
            .expect("create rule 1");
        create_rule(&pool, board_id, input2, user_id, tenant_id)
            .await
            .expect("create rule 2");

        let rules = list_rules(&pool, board_id, user_id)
            .await
            .expect("list_rules should succeed");

        let names: Vec<&str> = rules.iter().map(|r| r.rule.name.as_str()).collect();
        assert!(names.contains(&name1.as_str()), "should contain rule 1");
        assert!(names.contains(&name2.as_str()), "should contain rule 2");

        // Each rule should have its actions loaded
        for rwa in &rules {
            assert!(
                !rwa.actions.is_empty(),
                "rule '{}' should have actions",
                rwa.rule.name
            );
        }
    }
    #[ignore = "integration test - run with: cargo test -- --ignored"]
    #[tokio::test]
    async fn test_create_rule_with_multiple_actions() {
        let pool = test_pool().await;
        let (tenant_id, user_id, _ws_id, board_id, _col_id) = setup_full(&pool).await;

        let input = CreateRuleInput {
            name: format!("MultiAction-{}", Uuid::new_v4()),
            trigger: AutomationTrigger::TaskAssigned,
            trigger_config: serde_json::json!({}),
            actions: vec![
                CreateActionInput {
                    action_type: AutomationActionType::SetPriority,
                    action_config: serde_json::json!({"priority": "high"}),
                },
                CreateActionInput {
                    action_type: AutomationActionType::AddComment,
                    action_config: serde_json::json!({"text": "Auto-commented"}),
                },
                CreateActionInput {
                    action_type: AutomationActionType::SendNotification,
                    action_config: serde_json::json!({"message": "Assigned"}),
                },
            ],
        };

        let result = create_rule(&pool, board_id, input, user_id, tenant_id)
            .await
            .expect("create_rule with multiple actions");

        assert_eq!(result.actions.len(), 3);
        assert_eq!(result.actions[0].position, 0);
        assert_eq!(result.actions[1].position, 1);
        assert_eq!(result.actions[2].position, 2);
    }
    #[ignore = "integration test - run with: cargo test -- --ignored"]
    #[tokio::test]
    async fn test_toggle_active() {
        let pool = test_pool().await;
        let (tenant_id, user_id, _ws_id, board_id, _col_id) = setup_full(&pool).await;

        let input = CreateRuleInput {
            name: format!("ToggleRule-{}", Uuid::new_v4()),
            trigger: AutomationTrigger::TaskMoved,
            trigger_config: serde_json::json!({}),
            actions: vec![CreateActionInput {
                action_type: AutomationActionType::MoveTask,
                action_config: serde_json::json!({}),
            }],
        };

        let created = create_rule(&pool, board_id, input, user_id, tenant_id)
            .await
            .expect("create_rule");
        assert!(created.rule.is_active, "should start active");

        // Deactivate
        let update_input = UpdateRuleInput {
            name: None,
            trigger: None,
            trigger_config: None,
            is_active: Some(false),
            actions: None,
        };

        let updated = update_rule(&pool, created.rule.id, update_input, user_id)
            .await
            .expect("update_rule to deactivate");
        assert!(!updated.rule.is_active, "should be inactive after toggle");

        // Reactivate
        let reactivate = UpdateRuleInput {
            name: None,
            trigger: None,
            trigger_config: None,
            is_active: Some(true),
            actions: None,
        };

        let reactivated = update_rule(&pool, created.rule.id, reactivate, user_id)
            .await
            .expect("update_rule to reactivate");
        assert!(reactivated.rule.is_active, "should be active again");
    }
    #[ignore = "integration test - run with: cargo test -- --ignored"]
    #[tokio::test]
    async fn test_delete_rule() {
        let pool = test_pool().await;
        let (tenant_id, user_id, _ws_id, board_id, _col_id) = setup_full(&pool).await;

        let input = CreateRuleInput {
            name: format!("DelRule-{}", Uuid::new_v4()),
            trigger: AutomationTrigger::TaskCreated,
            trigger_config: serde_json::json!({}),
            actions: vec![CreateActionInput {
                action_type: AutomationActionType::SendNotification,
                action_config: serde_json::json!({}),
            }],
        };

        let created = create_rule(&pool, board_id, input, user_id, tenant_id)
            .await
            .expect("create_rule");

        delete_rule(&pool, created.rule.id, user_id)
            .await
            .expect("delete_rule should succeed");

        let result = get_rule(&pool, created.rule.id, user_id).await;
        assert!(result.is_err(), "rule should be deleted");
    }
    // --- Unit tests for fold_rules_with_actions ---

    fn make_row(
        rule_id: Uuid,
        rule_name: &str,
        action_id: Option<Uuid>,
        action_type: Option<AutomationActionType>,
        action_position: Option<i32>,
    ) -> RuleActionRow {
        RuleActionRow {
            rule_id,
            rule_name: rule_name.to_string(),
            project_id: Uuid::new_v4(),
            trigger: AutomationTrigger::TaskCreated,
            trigger_config: serde_json::json!({}),
            is_active: true,
            tenant_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            rule_created_at: Utc::now(),
            rule_updated_at: Utc::now(),
            conditions: None,
            execution_count: 0,
            last_triggered_at: None,
            action_id,
            action_type,
            action_config: action_id.map(|_| serde_json::json!({})),
            action_position,
        }
    }

    #[test]
    fn test_fold_rule_with_zero_actions() {
        let rule_id = Uuid::new_v4();
        let rows = vec![make_row(rule_id, "Empty rule", None, None, None)];

        let result = fold_rules_with_actions(rows);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].rule.id, rule_id);
        assert_eq!(result[0].rule.name, "Empty rule");
        assert!(result[0].actions.is_empty());
    }

    #[test]
    fn test_fold_rule_with_one_action() {
        let rule_id = Uuid::new_v4();
        let action_id = Uuid::new_v4();
        let rows = vec![make_row(
            rule_id,
            "One action",
            Some(action_id),
            Some(AutomationActionType::MoveTask),
            Some(0),
        )];

        let result = fold_rules_with_actions(rows);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].actions.len(), 1);
        assert_eq!(result[0].actions[0].id, action_id);
        assert_eq!(
            result[0].actions[0].action_type,
            AutomationActionType::MoveTask
        );
        assert_eq!(result[0].actions[0].position, 0);
    }

    #[test]
    fn test_fold_multiple_rules_multiple_actions() {
        let rule1 = Uuid::new_v4();
        let rule2 = Uuid::new_v4();
        let a1 = Uuid::new_v4();
        let a2 = Uuid::new_v4();
        let a3 = Uuid::new_v4();
        let a4 = Uuid::new_v4();

        // Rows come sorted: rule1 rows first, then rule2 rows
        let rows = vec![
            make_row(
                rule1,
                "Rule A",
                Some(a1),
                Some(AutomationActionType::MoveTask),
                Some(0),
            ),
            make_row(
                rule1,
                "Rule A",
                Some(a2),
                Some(AutomationActionType::AssignTask),
                Some(1),
            ),
            make_row(
                rule2,
                "Rule B",
                Some(a3),
                Some(AutomationActionType::SendNotification),
                Some(0),
            ),
            make_row(
                rule2,
                "Rule B",
                Some(a4),
                Some(AutomationActionType::AddComment),
                Some(1),
            ),
        ];

        let result = fold_rules_with_actions(rows);
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].rule.name, "Rule A");
        assert_eq!(result[0].actions.len(), 2);
        assert_eq!(result[0].actions[0].id, a1);
        assert_eq!(result[0].actions[1].id, a2);
        assert_eq!(result[1].rule.name, "Rule B");
        assert_eq!(result[1].actions.len(), 2);
        assert_eq!(result[1].actions[0].id, a3);
        assert_eq!(result[1].actions[1].id, a4);
    }

    #[test]
    fn test_fold_single_rule_multiple_rows() {
        let rule_id = Uuid::new_v4();
        let a1 = Uuid::new_v4();
        let a2 = Uuid::new_v4();
        let a3 = Uuid::new_v4();

        let rows = vec![
            make_row(
                rule_id,
                "Multi",
                Some(a1),
                Some(AutomationActionType::SetPriority),
                Some(0),
            ),
            make_row(
                rule_id,
                "Multi",
                Some(a2),
                Some(AutomationActionType::AddLabel),
                Some(1),
            ),
            make_row(
                rule_id,
                "Multi",
                Some(a3),
                Some(AutomationActionType::SendNotification),
                Some(2),
            ),
        ];

        let result = fold_rules_with_actions(rows);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].rule.id, rule_id);
        assert_eq!(result[0].actions.len(), 3);
        assert_eq!(result[0].actions[0].position, 0);
        assert_eq!(result[0].actions[1].position, 1);
        assert_eq!(result[0].actions[2].position, 2);
    }
}
