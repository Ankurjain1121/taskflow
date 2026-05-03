//! Task ↔ CRM entity linking queries.
//!
//! Link a task to CRM entities (contacts, companies, deals). Each type has its
//! own table with composite PK (task_id, twenty_workspace_id, crm_*_id) to
//! prevent duplicates. RLS enforced at task level.

use crate::models::{TaskCrmCompany, TaskCrmContact, TaskCrmDeal};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, thiserror::Error)]
pub enum TaskCrmLinkError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Task not found")]
    TaskNotFound,
    #[error("Link already exists")]
    AlreadyExists,
}

// === CONTACTS ===

pub async fn create_contact_link(
    pool: &PgPool,
    task_id: Uuid,
    twenty_workspace_id: String,
    crm_contact_id: Uuid,
    created_by_id: Uuid,
) -> Result<(), TaskCrmLinkError> {
    // Verify task exists
    let task_exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM tasks WHERE id = $1)")
        .bind(task_id)
        .fetch_one(pool)
        .await?;

    if !task_exists {
        return Err(TaskCrmLinkError::TaskNotFound);
    }

    let result = sqlx::query(
        r"
        INSERT INTO task_crm_contacts (task_id, twenty_workspace_id, crm_contact_id, created_by_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (task_id, twenty_workspace_id, crm_contact_id) DO NOTHING
        ",
    )
    .bind(task_id)
    .bind(&twenty_workspace_id)
    .bind(crm_contact_id)
    .bind(created_by_id)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(TaskCrmLinkError::AlreadyExists);
    }
    Ok(())
}

pub async fn delete_contact_link(
    pool: &PgPool,
    task_id: Uuid,
    crm_contact_id: Uuid,
) -> Result<(), TaskCrmLinkError> {
    sqlx::query("DELETE FROM task_crm_contacts WHERE task_id = $1 AND crm_contact_id = $2")
        .bind(task_id)
        .bind(crm_contact_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn list_contacts_for_task(
    pool: &PgPool,
    task_id: Uuid,
) -> Result<Vec<TaskCrmContact>, sqlx::Error> {
    sqlx::query_as::<_, TaskCrmContact>(
        r"
        SELECT task_id, twenty_workspace_id, crm_contact_id, created_at, created_by_id
        FROM task_crm_contacts
        WHERE task_id = $1
        ORDER BY created_at DESC
        ",
    )
    .bind(task_id)
    .fetch_all(pool)
    .await
}

// === COMPANIES ===

pub async fn create_company_link(
    pool: &PgPool,
    task_id: Uuid,
    twenty_workspace_id: String,
    crm_company_id: Uuid,
    created_by_id: Uuid,
) -> Result<(), TaskCrmLinkError> {
    let task_exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM tasks WHERE id = $1)")
        .bind(task_id)
        .fetch_one(pool)
        .await?;

    if !task_exists {
        return Err(TaskCrmLinkError::TaskNotFound);
    }

    let result = sqlx::query(
        r"
        INSERT INTO task_crm_companies (task_id, twenty_workspace_id, crm_company_id, created_by_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (task_id, twenty_workspace_id, crm_company_id) DO NOTHING
        ",
    )
    .bind(task_id)
    .bind(&twenty_workspace_id)
    .bind(crm_company_id)
    .bind(created_by_id)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(TaskCrmLinkError::AlreadyExists);
    }
    Ok(())
}

pub async fn delete_company_link(
    pool: &PgPool,
    task_id: Uuid,
    crm_company_id: Uuid,
) -> Result<(), TaskCrmLinkError> {
    sqlx::query("DELETE FROM task_crm_companies WHERE task_id = $1 AND crm_company_id = $2")
        .bind(task_id)
        .bind(crm_company_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn list_companies_for_task(
    pool: &PgPool,
    task_id: Uuid,
) -> Result<Vec<TaskCrmCompany>, sqlx::Error> {
    sqlx::query_as::<_, TaskCrmCompany>(
        r"
        SELECT task_id, twenty_workspace_id, crm_company_id, created_at, created_by_id
        FROM task_crm_companies
        WHERE task_id = $1
        ORDER BY created_at DESC
        ",
    )
    .bind(task_id)
    .fetch_all(pool)
    .await
}

// === DEALS ===

pub async fn create_deal_link(
    pool: &PgPool,
    task_id: Uuid,
    twenty_workspace_id: String,
    crm_deal_id: Uuid,
    created_by_id: Uuid,
) -> Result<(), TaskCrmLinkError> {
    let task_exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM tasks WHERE id = $1)")
        .bind(task_id)
        .fetch_one(pool)
        .await?;

    if !task_exists {
        return Err(TaskCrmLinkError::TaskNotFound);
    }

    let result = sqlx::query(
        r"
        INSERT INTO task_crm_deals (task_id, twenty_workspace_id, crm_deal_id, created_by_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (task_id, twenty_workspace_id, crm_deal_id) DO NOTHING
        ",
    )
    .bind(task_id)
    .bind(&twenty_workspace_id)
    .bind(crm_deal_id)
    .bind(created_by_id)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(TaskCrmLinkError::AlreadyExists);
    }
    Ok(())
}

pub async fn delete_deal_link(
    pool: &PgPool,
    task_id: Uuid,
    crm_deal_id: Uuid,
) -> Result<(), TaskCrmLinkError> {
    sqlx::query("DELETE FROM task_crm_deals WHERE task_id = $1 AND crm_deal_id = $2")
        .bind(task_id)
        .bind(crm_deal_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn list_deals_for_task(
    pool: &PgPool,
    task_id: Uuid,
) -> Result<Vec<TaskCrmDeal>, sqlx::Error> {
    sqlx::query_as::<_, TaskCrmDeal>(
        r"
        SELECT task_id, twenty_workspace_id, crm_deal_id, created_at, created_by_id
        FROM task_crm_deals
        WHERE task_id = $1
        ORDER BY created_at DESC
        ",
    )
    .bind(task_id)
    .fetch_all(pool)
    .await
}

// === BATCH READ ===

pub async fn list_all_for_task(
    pool: &PgPool,
    task_id: Uuid,
) -> Result<(Vec<TaskCrmContact>, Vec<TaskCrmCompany>, Vec<TaskCrmDeal>), sqlx::Error> {
    let contacts = list_contacts_for_task(pool, task_id).await?;
    let companies = list_companies_for_task(pool, task_id).await?;
    let deals = list_deals_for_task(pool, task_id).await?;

    Ok((contacts, companies, deals))
}
