//! Tenant-scoped database operations
//!
//! Provides helpers for executing database queries within a tenant context,
//! using PostgreSQL's row-level security (RLS) with session variables.

use sqlx::PgPool;
use std::future::Future;
use uuid::Uuid;

use crate::errors::{AppError, Result};

/// Execute a closure within a tenant-scoped transaction
///
/// This function:
/// 1. Begins a transaction
/// 2. Sets `app.tenant_id` session variable for RLS policies
/// 3. Executes the provided closure
/// 4. Commits on success, rolls back on error
///
/// # Arguments
/// * `pool` - PostgreSQL connection pool
/// * `tenant_id` - The tenant UUID to scope the transaction to
/// * `f` - Async closure that receives the transaction and returns a Result
///
/// # Example
/// ```ignore
/// let result = with_tenant(&pool, tenant_id, |tx| async move {
///     sqlx::query("SELECT * FROM tasks")
///         .fetch_all(&mut *tx)
///         .await
/// }).await?;
/// ```
pub async fn with_tenant<F, Fut, T>(pool: &PgPool, tenant_id: Uuid, f: F) -> Result<T>
where
    F: FnOnce(sqlx::Transaction<'static, sqlx::Postgres>) -> Fut,
    Fut: Future<Output = std::result::Result<T, sqlx::Error>>,
{
    // Begin transaction
    let mut tx = pool.begin().await.map_err(|e| {
        tracing::error!("Failed to begin transaction: {:?}", e);
        AppError::InternalError("Failed to begin transaction".to_string())
    })?;

    // Set tenant context for RLS (parameterized to prevent SQL injection)
    sqlx::query("SELECT set_config('app.tenant_id', $1::text, true)")
        .bind(tenant_id.to_string())
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("Failed to set tenant context: {:?}", e);
            AppError::InternalError("Failed to set tenant context".to_string())
        })?;

    // Execute the closure
    let result = f(tx).await.map_err(|e| {
        tracing::error!("Transaction operation failed: {:?}", e);
        AppError::SqlxError(e)
    })?;

    Ok(result)
}

/// Execute a closure within a tenant-scoped transaction, with explicit commit
///
/// Similar to `with_tenant`, but the closure receives a mutable reference
/// to the transaction, allowing for more complex operations.
///
/// # Arguments
/// * `pool` - PostgreSQL connection pool
/// * `tenant_id` - The tenant UUID to scope the transaction to
/// * `f` - Async closure that receives a mutable transaction reference
///
/// # Example
/// ```ignore
/// let result = with_tenant_tx(&pool, tenant_id, |tx| async move {
///     let task = sqlx::query_as::<_, Task>("SELECT * FROM tasks WHERE id = $1")
///         .bind(task_id)
///         .fetch_one(&mut **tx)
///         .await?;
///     Ok(task)
/// }).await?;
/// ```
pub async fn with_tenant_tx<'a, F, Fut, T>(pool: &PgPool, tenant_id: Uuid, f: F) -> Result<T>
where
    F: for<'c> FnOnce(&'c mut sqlx::Transaction<'static, sqlx::Postgres>) -> Fut,
    Fut: Future<Output = std::result::Result<T, sqlx::Error>>,
{
    // Begin transaction
    let mut tx = pool.begin().await.map_err(|e| {
        tracing::error!("Failed to begin transaction: {:?}", e);
        AppError::InternalError("Failed to begin transaction".to_string())
    })?;

    // Set tenant context for RLS (parameterized to prevent SQL injection)
    sqlx::query("SELECT set_config('app.tenant_id', $1::text, true)")
        .bind(tenant_id.to_string())
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("Failed to set tenant context: {:?}", e);
            AppError::InternalError("Failed to set tenant context".to_string())
        })?;

    // Execute the closure
    let result = f(&mut tx).await.map_err(|e| {
        tracing::error!("Transaction operation failed: {:?}", e);
        AppError::SqlxError(e)
    })?;

    // Commit transaction
    tx.commit().await.map_err(|e| {
        tracing::error!("Failed to commit transaction: {:?}", e);
        AppError::InternalError("Failed to commit transaction".to_string())
    })?;

    Ok(result)
}

/// Set tenant context on an existing connection/transaction
///
/// Useful when you need to manage the transaction lifecycle manually.
///
/// # Arguments
/// * `executor` - A sqlx Executor (connection, pool, or transaction)
/// * `tenant_id` - The tenant UUID to set
pub async fn set_tenant_context<'e, E>(executor: E, tenant_id: Uuid) -> Result<()>
where
    E: sqlx::Executor<'e, Database = sqlx::Postgres>,
{
    sqlx::query("SELECT set_config('app.tenant_id', $1::text, true)")
        .bind(tenant_id.to_string())
        .execute(executor)
        .await
        .map_err(|e| {
            tracing::error!("Failed to set tenant context: {:?}", e);
            AppError::InternalError("Failed to set tenant context".to_string())
        })?;

    Ok(())
}

#[cfg(test)]
mod tests {
    // Integration tests would require a real database connection
    // Unit tests here are limited to compile-time checks
}
