use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct RecentItem {
    pub id: Uuid,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub entity_name: String,
    pub context: Option<String>,
    pub viewed_at: DateTime<Utc>,
}

/// List recent items for a user, resolving entity names via JOINs.
/// Returns tasks and boards the user recently viewed, ordered by most recent first.
pub async fn list_recent_items(
    pool: &PgPool,
    user_id: Uuid,
    tenant_id: Uuid,
    limit: i64,
) -> Result<Vec<RecentItem>, sqlx::Error> {
    let items = sqlx::query_as::<_, RecentItem>(
        r#"
        SELECT
            ri.id,
            ri.entity_type,
            ri.entity_id,
            COALESCE(
                t.title,
                b.name,
                'Unknown'
            ) AS entity_name,
            CASE
                WHEN ri.entity_type = 'board' THEN w_b.name
                WHEN ri.entity_type = 'task' THEN CONCAT(w_t.name, ' > ', tb.name)
                ELSE NULL
            END AS context,
            ri.viewed_at
        FROM recent_items ri
        LEFT JOIN tasks t ON ri.entity_type = 'task' AND t.id = ri.entity_id AND t.deleted_at IS NULL
        LEFT JOIN boards tb ON t.board_id = tb.id AND tb.deleted_at IS NULL
        LEFT JOIN workspaces w_t ON tb.workspace_id = w_t.id
        LEFT JOIN boards b ON ri.entity_type = 'board' AND b.id = ri.entity_id AND b.deleted_at IS NULL
        LEFT JOIN workspaces w_b ON b.workspace_id = w_b.id
        WHERE ri.user_id = $1
          AND ri.tenant_id = $2
        ORDER BY ri.viewed_at DESC
        LIMIT $3
        "#,
    )
    .bind(user_id)
    .bind(tenant_id)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(items)
}

/// Upsert a recent item: insert if new, update viewed_at if already exists.
pub async fn upsert_recent_item(
    pool: &PgPool,
    user_id: Uuid,
    tenant_id: Uuid,
    entity_type: &str,
    entity_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO recent_items (user_id, tenant_id, entity_type, entity_id, viewed_at)
        VALUES ($1, $2, $3, $4, now())
        ON CONFLICT (user_id, entity_type, entity_id)
        DO UPDATE SET viewed_at = now()
        "#,
    )
    .bind(user_id)
    .bind(tenant_id)
    .bind(entity_type)
    .bind(entity_id)
    .execute(pool)
    .await?;

    Ok(())
}
