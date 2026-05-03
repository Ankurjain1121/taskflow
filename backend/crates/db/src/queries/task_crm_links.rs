//! Task ↔ CRM entity linking queries.
//!
//! Link a task to CRM entities (contacts, companies, deals). Each type has its
//! own table with composite PK (task_id, twenty_workspace_id, crm_*_id) to
//! prevent duplicates.
//!
//! **RLS discipline**: every write/read path begins a transaction and calls
//! `set_tenant_context` so that PostgreSQL row-level security policies see
//! `app.tenant_id`.  Without this the table owner bypasses RLS silently.

use crate::models::{TaskCrmCompany, TaskCrmContact, TaskCrmDeal};
use crate::tenant::set_tenant_context;
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
    tenant_id: Uuid,
    task_id: Uuid,
    twenty_workspace_id: String,
    crm_contact_id: Uuid,
    created_by_id: Uuid,
) -> Result<(), TaskCrmLinkError> {
    let mut tx = pool.begin().await?;
    set_tenant_context(&mut tx, tenant_id).await?;

    // Verify task exists (RLS-filtered by tenant via transaction)
    let task_exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM tasks WHERE id = $1)")
        .bind(task_id)
        .fetch_one(&mut *tx)
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
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    if result.rows_affected() == 0 {
        return Err(TaskCrmLinkError::AlreadyExists);
    }
    Ok(())
}

pub async fn delete_contact_link(
    pool: &PgPool,
    tenant_id: Uuid,
    task_id: Uuid,
    twenty_workspace_id: &str,
    crm_contact_id: Uuid,
) -> Result<(), TaskCrmLinkError> {
    let mut tx = pool.begin().await?;
    set_tenant_context(&mut tx, tenant_id).await?;

    sqlx::query(
        "DELETE FROM task_crm_contacts \
         WHERE task_id = $1 AND twenty_workspace_id = $2 AND crm_contact_id = $3",
    )
    .bind(task_id)
    .bind(twenty_workspace_id)
    .bind(crm_contact_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

pub async fn list_contacts_for_task(
    pool: &PgPool,
    tenant_id: Uuid,
    task_id: Uuid,
) -> Result<Vec<TaskCrmContact>, sqlx::Error> {
    let mut tx = pool.begin().await?;
    set_tenant_context(&mut tx, tenant_id).await?;

    let rows = sqlx::query_as::<_, TaskCrmContact>(
        r"
        SELECT task_id, twenty_workspace_id, crm_contact_id, created_at, created_by_id
        FROM task_crm_contacts
        WHERE task_id = $1
        ORDER BY created_at DESC
        ",
    )
    .bind(task_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(rows)
}

// === COMPANIES ===

pub async fn create_company_link(
    pool: &PgPool,
    tenant_id: Uuid,
    task_id: Uuid,
    twenty_workspace_id: String,
    crm_company_id: Uuid,
    created_by_id: Uuid,
) -> Result<(), TaskCrmLinkError> {
    let mut tx = pool.begin().await?;
    set_tenant_context(&mut tx, tenant_id).await?;

    let task_exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM tasks WHERE id = $1)")
        .bind(task_id)
        .fetch_one(&mut *tx)
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
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    if result.rows_affected() == 0 {
        return Err(TaskCrmLinkError::AlreadyExists);
    }
    Ok(())
}

pub async fn delete_company_link(
    pool: &PgPool,
    tenant_id: Uuid,
    task_id: Uuid,
    twenty_workspace_id: &str,
    crm_company_id: Uuid,
) -> Result<(), TaskCrmLinkError> {
    let mut tx = pool.begin().await?;
    set_tenant_context(&mut tx, tenant_id).await?;

    sqlx::query(
        "DELETE FROM task_crm_companies \
         WHERE task_id = $1 AND twenty_workspace_id = $2 AND crm_company_id = $3",
    )
    .bind(task_id)
    .bind(twenty_workspace_id)
    .bind(crm_company_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

pub async fn list_companies_for_task(
    pool: &PgPool,
    tenant_id: Uuid,
    task_id: Uuid,
) -> Result<Vec<TaskCrmCompany>, sqlx::Error> {
    let mut tx = pool.begin().await?;
    set_tenant_context(&mut tx, tenant_id).await?;

    let rows = sqlx::query_as::<_, TaskCrmCompany>(
        r"
        SELECT task_id, twenty_workspace_id, crm_company_id, created_at, created_by_id
        FROM task_crm_companies
        WHERE task_id = $1
        ORDER BY created_at DESC
        ",
    )
    .bind(task_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(rows)
}

// === DEALS ===

pub async fn create_deal_link(
    pool: &PgPool,
    tenant_id: Uuid,
    task_id: Uuid,
    twenty_workspace_id: String,
    crm_deal_id: Uuid,
    created_by_id: Uuid,
) -> Result<(), TaskCrmLinkError> {
    let mut tx = pool.begin().await?;
    set_tenant_context(&mut tx, tenant_id).await?;

    let task_exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM tasks WHERE id = $1)")
        .bind(task_id)
        .fetch_one(&mut *tx)
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
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    if result.rows_affected() == 0 {
        return Err(TaskCrmLinkError::AlreadyExists);
    }
    Ok(())
}

pub async fn delete_deal_link(
    pool: &PgPool,
    tenant_id: Uuid,
    task_id: Uuid,
    twenty_workspace_id: &str,
    crm_deal_id: Uuid,
) -> Result<(), TaskCrmLinkError> {
    let mut tx = pool.begin().await?;
    set_tenant_context(&mut tx, tenant_id).await?;

    sqlx::query(
        "DELETE FROM task_crm_deals \
         WHERE task_id = $1 AND twenty_workspace_id = $2 AND crm_deal_id = $3",
    )
    .bind(task_id)
    .bind(twenty_workspace_id)
    .bind(crm_deal_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

pub async fn list_deals_for_task(
    pool: &PgPool,
    tenant_id: Uuid,
    task_id: Uuid,
) -> Result<Vec<TaskCrmDeal>, sqlx::Error> {
    let mut tx = pool.begin().await?;
    set_tenant_context(&mut tx, tenant_id).await?;

    let rows = sqlx::query_as::<_, TaskCrmDeal>(
        r"
        SELECT task_id, twenty_workspace_id, crm_deal_id, created_at, created_by_id
        FROM task_crm_deals
        WHERE task_id = $1
        ORDER BY created_at DESC
        ",
    )
    .bind(task_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(rows)
}

// === BATCH READ ===
//
// Fix N+1: all three tables are fetched in parallel via tokio::try_join! instead
// of sequentially (was 3 RTTs, now 1 wall-clock RTT with overlapping I/O).

pub async fn list_all_for_task(
    pool: &PgPool,
    tenant_id: Uuid,
    task_id: Uuid,
) -> Result<(Vec<TaskCrmContact>, Vec<TaskCrmCompany>, Vec<TaskCrmDeal>), sqlx::Error> {
    let (contacts, companies, deals) = tokio::try_join!(
        list_contacts_for_task(pool, tenant_id, task_id),
        list_companies_for_task(pool, tenant_id, task_id),
        list_deals_for_task(pool, tenant_id, task_id),
    )?;

    Ok((contacts, companies, deals))
}
