use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

/// An archived (soft-deleted) item visible to the tenant
#[derive(Debug, Serialize, FromRow)]
pub struct ArchiveItem {
    pub entity_type: String,
    pub entity_id: Uuid,
    pub name: String,
    pub deleted_at: DateTime<Utc>,
    pub days_remaining: i64,
}

/// Paginated archive response
#[derive(Debug, Serialize)]
pub struct PaginatedArchive {
    pub items: Vec<ArchiveItem>,
    pub next_cursor: Option<String>,
}

/// List soft-deleted items for a tenant (tasks and projects)
pub async fn list_archive(
    pool: &PgPool,
    tenant_id: Uuid,
    entity_type_filter: Option<&str>,
    cursor: Option<DateTime<Utc>>,
    page_size: i64,
) -> Result<PaginatedArchive, sqlx::Error> {
    let retention_days: i64 = 30;
    let fetch_limit = page_size + 1;

    let mut items: Vec<ArchiveItem> = Vec::new();

    // Fetch archived tasks
    if entity_type_filter.is_none() || entity_type_filter == Some("task") {
        let tasks = sqlx::query_as::<_, ArchiveItem>(
            r#"
            SELECT
                'task'::text as entity_type,
                t.id as entity_id,
                t.title as name,
                t.deleted_at as deleted_at,
                GREATEST(0, $1 - EXTRACT(DAY FROM (now() - t.deleted_at))::bigint) as days_remaining
            FROM tasks t
            WHERE t.tenant_id = $2
              AND t.deleted_at IS NOT NULL
              AND ($3::timestamptz IS NULL OR t.deleted_at < $3)
            ORDER BY t.deleted_at DESC
            LIMIT $4
            "#,
        )
        .bind(retention_days)
        .bind(tenant_id)
        .bind(cursor)
        .bind(fetch_limit)
        .fetch_all(pool)
        .await?;
        items.extend(tasks);
    }

    // Fetch archived projects
    if entity_type_filter.is_none() || entity_type_filter == Some("project") {
        let projects = sqlx::query_as::<_, ArchiveItem>(
            r#"
            SELECT
                'board'::text as entity_type,
                b.id as entity_id,
                b.name as name,
                b.deleted_at as deleted_at,
                GREATEST(0, $1 - EXTRACT(DAY FROM (now() - b.deleted_at))::bigint) as days_remaining
            FROM projects b
            WHERE b.tenant_id = $2
              AND b.deleted_at IS NOT NULL
              AND ($3::timestamptz IS NULL OR b.deleted_at < $3)
            ORDER BY b.deleted_at DESC
            LIMIT $4
            "#,
        )
        .bind(retention_days)
        .bind(tenant_id)
        .bind(cursor)
        .bind(fetch_limit)
        .fetch_all(pool)
        .await?;
        items.extend(projects);
    }

    // Sort merged results by deleted_at DESC
    items.sort_by(|a, b| b.deleted_at.cmp(&a.deleted_at));

    let has_more = items.len() > page_size as usize;
    let items: Vec<_> = items.into_iter().take(page_size as usize).collect();

    let next_cursor = if has_more {
        items.last().map(|item| item.deleted_at.to_rfc3339())
    } else {
        None
    };

    Ok(PaginatedArchive { items, next_cursor })
}
