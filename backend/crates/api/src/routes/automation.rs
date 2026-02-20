use axum::{
    extract::{Path, Query, State},
    middleware::from_fn_with_state,
    routing::{delete, get, post, put},
    Json, Router,
};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::auth_middleware;
use crate::state::AppState;
use taskflow_db::models::automation::{AutomationActionType, AutomationLog, AutomationTrigger};
use taskflow_db::queries::automations::{
    create_rule, delete_rule, get_rule, get_rule_logs, list_rules, update_rule,
    AutomationQueryError, AutomationRuleWithActions, CreateActionInput, CreateRuleInput,
    UpdateRuleInput,
};

/// Map AutomationQueryError to AppError
fn map_automation_error(e: AutomationQueryError) -> AppError {
    match e {
        AutomationQueryError::NotFound => AppError::NotFound("Automation rule not found".into()),
        AutomationQueryError::NotBoardMember => AppError::Forbidden("Not a board member".into()),
        AutomationQueryError::Database(e) => AppError::SqlxError(e),
    }
}

/// Request body for creating an automation rule
#[derive(Debug, Deserialize)]
pub struct CreateRuleRequest {
    pub name: String,
    pub trigger: AutomationTrigger,
    #[serde(default = "default_trigger_config")]
    pub trigger_config: serde_json::Value,
    pub actions: Vec<CreateActionRequest>,
}

fn default_trigger_config() -> serde_json::Value {
    serde_json::json!({})
}

/// Request body for creating a single action
#[derive(Debug, Deserialize)]
pub struct CreateActionRequest {
    pub action_type: AutomationActionType,
    #[serde(default = "default_action_config")]
    pub action_config: serde_json::Value,
}

fn default_action_config() -> serde_json::Value {
    serde_json::json!({})
}

/// Request body for updating an automation rule
#[derive(Debug, Deserialize)]
pub struct UpdateRuleRequest {
    pub name: Option<String>,
    pub trigger: Option<AutomationTrigger>,
    pub trigger_config: Option<serde_json::Value>,
    pub is_active: Option<bool>,
    pub actions: Option<Vec<CreateActionRequest>>,
}

/// Query params for logs endpoint
#[derive(Debug, Deserialize)]
pub struct LogsQuery {
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    50
}

/// GET /api/boards/{board_id}/automations
/// List all automation rules for a board
async fn list_rules_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(board_id): Path<Uuid>,
) -> Result<Json<Vec<AutomationRuleWithActions>>> {
    let rules = list_rules(&state.db, board_id, tenant.user_id)
        .await
        .map_err(map_automation_error)?;

    Ok(Json(rules))
}

/// POST /api/boards/{board_id}/automations
/// Create a new automation rule
async fn create_rule_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(board_id): Path<Uuid>,
    Json(body): Json<CreateRuleRequest>,
) -> Result<Json<AutomationRuleWithActions>> {
    let input = CreateRuleInput {
        name: body.name,
        trigger: body.trigger,
        trigger_config: body.trigger_config,
        actions: body
            .actions
            .into_iter()
            .map(|a| CreateActionInput {
                action_type: a.action_type,
                action_config: a.action_config,
            })
            .collect(),
    };

    let rule = create_rule(&state.db, board_id, input, tenant.user_id, tenant.tenant_id)
        .await
        .map_err(map_automation_error)?;

    Ok(Json(rule))
}

/// GET /api/automations/{id}
/// Get a single automation rule with actions
async fn get_rule_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(rule_id): Path<Uuid>,
) -> Result<Json<AutomationRuleWithActions>> {
    let rule = get_rule(&state.db, rule_id, tenant.user_id)
        .await
        .map_err(map_automation_error)?;

    Ok(Json(rule))
}

/// PUT /api/automations/{id}
/// Update an existing automation rule
async fn update_rule_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(rule_id): Path<Uuid>,
    Json(body): Json<UpdateRuleRequest>,
) -> Result<Json<AutomationRuleWithActions>> {
    let input = UpdateRuleInput {
        name: body.name,
        trigger: body.trigger,
        trigger_config: body.trigger_config,
        is_active: body.is_active,
        actions: body.actions.map(|actions| {
            actions
                .into_iter()
                .map(|a| CreateActionInput {
                    action_type: a.action_type,
                    action_config: a.action_config,
                })
                .collect()
        }),
    };

    let rule = update_rule(&state.db, rule_id, input, tenant.user_id)
        .await
        .map_err(map_automation_error)?;

    Ok(Json(rule))
}

/// DELETE /api/automations/{id}
/// Delete an automation rule
async fn delete_rule_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(rule_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    delete_rule(&state.db, rule_id, tenant.user_id)
        .await
        .map_err(map_automation_error)?;

    Ok(Json(json!({ "success": true })))
}

/// GET /api/automations/{id}/logs
/// Get automation execution logs for a rule
async fn get_rule_logs_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(rule_id): Path<Uuid>,
    Query(query): Query<LogsQuery>,
) -> Result<Json<Vec<AutomationLog>>> {
    let logs = get_rule_logs(&state.db, rule_id, tenant.user_id, query.limit)
        .await
        .map_err(map_automation_error)?;

    Ok(Json(logs))
}

/// Create the automation router
pub fn automation_router(state: AppState) -> Router<AppState> {
    Router::new()
        // Board-scoped automation routes
        .route("/boards/{board_id}/automations", get(list_rules_handler))
        .route("/boards/{board_id}/automations", post(create_rule_handler))
        // Automation-specific routes
        .route("/automations/{id}", get(get_rule_handler))
        .route("/automations/{id}", put(update_rule_handler))
        .route("/automations/{id}", delete(delete_rule_handler))
        // Automation logs
        .route("/automations/{id}/logs", get(get_rule_logs_handler))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
