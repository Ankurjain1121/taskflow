use axum::{
    extract::{Path, State},
    middleware::from_fn_with_state,
    routing::get,
    Json, Router,
};
use serde_json::json;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::{StrictJson, TenantContext};
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;

use super::common::verify_task_membership;
use taskbolt_db::models::{TaskCrmCompany, TaskCrmContact, TaskCrmDeal};
use taskbolt_db::queries::task_crm_links::{
    create_company_link, create_contact_link, create_deal_link, delete_company_link,
    delete_contact_link, delete_deal_link, list_all_for_task, list_companies_for_task,
    list_contacts_for_task, list_deals_for_task, TaskCrmLinkError,
};

fn map_err(e: TaskCrmLinkError) -> AppError {
    match e {
        TaskCrmLinkError::TaskNotFound => AppError::NotFound("Task not found".into()),
        TaskCrmLinkError::AlreadyExists => AppError::Conflict("Link already exists".into()),
        TaskCrmLinkError::Database(e) => AppError::SqlxError(e),
    }
}

#[strict_dto_derive::strict_dto]
pub struct LinkCrmContactRequest {
    pub crm_contact_id: Uuid,
    pub twenty_workspace_id: String,
}

#[strict_dto_derive::strict_dto]
pub struct LinkCrmCompanyRequest {
    pub crm_company_id: Uuid,
    pub twenty_workspace_id: String,
}

#[strict_dto_derive::strict_dto]
pub struct LinkCrmDealRequest {
    pub crm_deal_id: Uuid,
    pub twenty_workspace_id: String,
}

#[derive(serde::Serialize)]
pub struct AllCrmLinksResponse {
    pub contacts: Vec<TaskCrmContact>,
    pub companies: Vec<TaskCrmCompany>,
    pub deals: Vec<TaskCrmDeal>,
}

// === CONTACTS ===

/// POST /api/tasks/{task_id}/linked-crm-contacts
async fn link_crm_contact_to_task(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
    StrictJson(body): StrictJson<LinkCrmContactRequest>,
) -> Result<Json<serde_json::Value>> {
    verify_task_membership(&state.db, task_id, tenant.user_id, &tenant.role).await?;

    create_contact_link(
        &state.db,
        tenant.tenant_id,
        task_id,
        body.twenty_workspace_id,
        body.crm_contact_id,
        tenant.user_id,
    )
    .await
    .map_err(map_err)?;

    Ok(Json(json!({ "success": true })))
}

/// DELETE /api/tasks/{task_id}/linked-crm-contacts/{crm_contact_id}/{twenty_workspace_id}
async fn unlink_crm_contact_from_task(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path((task_id, crm_contact_id, twenty_workspace_id)): Path<(Uuid, Uuid, String)>,
) -> Result<Json<serde_json::Value>> {
    verify_task_membership(&state.db, task_id, tenant.user_id, &tenant.role).await?;

    delete_contact_link(
        &state.db,
        tenant.tenant_id,
        task_id,
        &twenty_workspace_id,
        crm_contact_id,
    )
    .await
    .map_err(map_err)?;

    Ok(Json(json!({ "success": true })))
}

/// GET /api/tasks/{task_id}/linked-crm-contacts
async fn get_linked_crm_contacts_for_task(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
) -> Result<Json<Vec<TaskCrmContact>>> {
    verify_task_membership(&state.db, task_id, tenant.user_id, &tenant.role).await?;

    let rows = list_contacts_for_task(&state.db, tenant.tenant_id, task_id).await?;
    Ok(Json(rows))
}

// === COMPANIES ===

/// POST /api/tasks/{task_id}/linked-crm-companies
async fn link_crm_company_to_task(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
    StrictJson(body): StrictJson<LinkCrmCompanyRequest>,
) -> Result<Json<serde_json::Value>> {
    verify_task_membership(&state.db, task_id, tenant.user_id, &tenant.role).await?;

    create_company_link(
        &state.db,
        tenant.tenant_id,
        task_id,
        body.twenty_workspace_id,
        body.crm_company_id,
        tenant.user_id,
    )
    .await
    .map_err(map_err)?;

    Ok(Json(json!({ "success": true })))
}

/// DELETE /api/tasks/{task_id}/linked-crm-companies/{crm_company_id}/{twenty_workspace_id}
async fn unlink_crm_company_from_task(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path((task_id, crm_company_id, twenty_workspace_id)): Path<(Uuid, Uuid, String)>,
) -> Result<Json<serde_json::Value>> {
    verify_task_membership(&state.db, task_id, tenant.user_id, &tenant.role).await?;

    delete_company_link(
        &state.db,
        tenant.tenant_id,
        task_id,
        &twenty_workspace_id,
        crm_company_id,
    )
    .await
    .map_err(map_err)?;

    Ok(Json(json!({ "success": true })))
}

/// GET /api/tasks/{task_id}/linked-crm-companies
async fn get_linked_crm_companies_for_task(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
) -> Result<Json<Vec<TaskCrmCompany>>> {
    verify_task_membership(&state.db, task_id, tenant.user_id, &tenant.role).await?;

    let rows = list_companies_for_task(&state.db, tenant.tenant_id, task_id).await?;
    Ok(Json(rows))
}

// === DEALS ===

/// POST /api/tasks/{task_id}/linked-crm-deals
async fn link_crm_deal_to_task(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
    StrictJson(body): StrictJson<LinkCrmDealRequest>,
) -> Result<Json<serde_json::Value>> {
    verify_task_membership(&state.db, task_id, tenant.user_id, &tenant.role).await?;

    create_deal_link(
        &state.db,
        tenant.tenant_id,
        task_id,
        body.twenty_workspace_id,
        body.crm_deal_id,
        tenant.user_id,
    )
    .await
    .map_err(map_err)?;

    Ok(Json(json!({ "success": true })))
}

/// DELETE /api/tasks/{task_id}/linked-crm-deals/{crm_deal_id}/{twenty_workspace_id}
async fn unlink_crm_deal_from_task(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path((task_id, crm_deal_id, twenty_workspace_id)): Path<(Uuid, Uuid, String)>,
) -> Result<Json<serde_json::Value>> {
    verify_task_membership(&state.db, task_id, tenant.user_id, &tenant.role).await?;

    delete_deal_link(
        &state.db,
        tenant.tenant_id,
        task_id,
        &twenty_workspace_id,
        crm_deal_id,
    )
    .await
    .map_err(map_err)?;

    Ok(Json(json!({ "success": true })))
}

/// GET /api/tasks/{task_id}/linked-crm-deals
async fn get_linked_crm_deals_for_task(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
) -> Result<Json<Vec<TaskCrmDeal>>> {
    verify_task_membership(&state.db, task_id, tenant.user_id, &tenant.role).await?;

    let rows = list_deals_for_task(&state.db, tenant.tenant_id, task_id).await?;
    Ok(Json(rows))
}

// === BATCH ===

/// GET /api/tasks/{task_id}/linked-crm-all
async fn get_all_linked_crm_for_task(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
) -> Result<Json<AllCrmLinksResponse>> {
    verify_task_membership(&state.db, task_id, tenant.user_id, &tenant.role).await?;

    let (contacts, companies, deals) =
        list_all_for_task(&state.db, tenant.tenant_id, task_id).await?;

    Ok(Json(AllCrmLinksResponse {
        contacts,
        companies,
        deals,
    }))
}

pub fn task_crm_links_router(state: AppState) -> Router<AppState> {
    Router::new()
        // Contacts
        .route(
            "/tasks/{task_id}/linked-crm-contacts",
            get(get_linked_crm_contacts_for_task).post(link_crm_contact_to_task),
        )
        .route(
            "/tasks/{task_id}/linked-crm-contacts/{crm_contact_id}/{twenty_workspace_id}",
            axum::routing::delete(unlink_crm_contact_from_task),
        )
        // Companies
        .route(
            "/tasks/{task_id}/linked-crm-companies",
            get(get_linked_crm_companies_for_task).post(link_crm_company_to_task),
        )
        .route(
            "/tasks/{task_id}/linked-crm-companies/{crm_company_id}/{twenty_workspace_id}",
            axum::routing::delete(unlink_crm_company_from_task),
        )
        // Deals
        .route(
            "/tasks/{task_id}/linked-crm-deals",
            get(get_linked_crm_deals_for_task).post(link_crm_deal_to_task),
        )
        .route(
            "/tasks/{task_id}/linked-crm-deals/{crm_deal_id}/{twenty_workspace_id}",
            axum::routing::delete(unlink_crm_deal_from_task),
        )
        // Combined
        .route(
            "/tasks/{task_id}/linked-crm-all",
            get(get_all_linked_crm_for_task),
        )
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
