use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

/// A favorite item with entity details resolved via JOIN
#[derive(Debug, Serialize)]
pub struct FavoriteItem {
    pub id: Uuid,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub name: String,
    pub board_id: Option<Uuid>,
    pub workspace_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

/// Internal row for favorite task query
#[derive(Debug, FromRow)]
struct FavoriteTaskRow {
    id: Uuid,
    entity_type: String,
    entity_id: Uuid,
    name: String,
    board_id: Option<Uuid>,
    workspace_id: Option<Uuid>,
    created_at: DateTime<Utc>,
}

/// Internal row for favorite board query
#[derive(Debug, FromRow)]
struct FavoriteBoardRow {
    id: Uuid,
    entity_type: String,
    entity_id: Uuid,
    name: String,
    workspace_id: Option<Uuid>,
    created_at: DateTime<Utc>,
}

/// List all favorites for a user, with entity names resolved
pub async fn list_favorites(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Vec<FavoriteItem>, sqlx::Error> {
    // Fetch favorite tasks
    let task_rows = sqlx::query_as::<_, FavoriteTaskRow>(
        r#"
        SELECT
            f.id,
            f.entity_type,
            f.entity_id,
            t.title as name,
            t.board_id,
            b.workspace_id,
            f.created_at
        FROM favorites f
        INNER JOIN tasks t ON t.id = f.entity_id AND t.deleted_at IS NULL
        LEFT JOIN boards b ON b.id = t.board_id AND b.deleted_at IS NULL
        WHERE f.user_id = $1 AND f.entity_type = 'task'
        ORDER BY f.created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    // Fetch favorite boards
    let board_rows = sqlx::query_as::<_, FavoriteBoardRow>(
        r#"
        SELECT
            f.id,
            f.entity_type,
            f.entity_id,
            b.name,
            b.workspace_id,
            f.created_at
        FROM favorites f
        INNER JOIN boards b ON b.id = f.entity_id AND b.deleted_at IS NULL
        WHERE f.user_id = $1 AND f.entity_type = 'board'
        ORDER BY f.created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    // Merge and sort by created_at desc
    let mut items: Vec<FavoriteItem> = Vec::with_capacity(task_rows.len() + board_rows.len());

    for row in task_rows {
        items.push(FavoriteItem {
            id: row.id,
            entity_type: row.entity_type,
            entity_id: row.entity_id,
            name: row.name,
            board_id: row.board_id,
            workspace_id: row.workspace_id,
            created_at: row.created_at,
        });
    }

    for row in board_rows {
        items.push(FavoriteItem {
            id: row.id,
            entity_type: row.entity_type,
            entity_id: row.entity_id,
            name: row.name,
            board_id: None,
            workspace_id: row.workspace_id,
            created_at: row.created_at,
        });
    }

    items.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Ok(items)
}

/// Add a favorite
pub async fn add_favorite(
    pool: &PgPool,
    user_id: Uuid,
    entity_type: &str,
    entity_id: Uuid,
) -> Result<Uuid, sqlx::Error> {
    let row: (Uuid,) = sqlx::query_as(
        r#"
        INSERT INTO favorites (user_id, entity_type, entity_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, entity_type, entity_id) DO UPDATE SET created_at = favorites.created_at
        RETURNING id
        "#,
    )
    .bind(user_id)
    .bind(entity_type)
    .bind(entity_id)
    .fetch_one(pool)
    .await?;

    Ok(row.0)
}

/// Remove a favorite
pub async fn remove_favorite(
    pool: &PgPool,
    user_id: Uuid,
    entity_type: &str,
    entity_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        r#"
        DELETE FROM favorites
        WHERE user_id = $1 AND entity_type = $2 AND entity_id = $3
        "#,
    )
    .bind(user_id)
    .bind(entity_type)
    .bind(entity_id)
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}

/// Check if an entity is favorited by a user
pub async fn is_favorited(
    pool: &PgPool,
    user_id: Uuid,
    entity_type: &str,
    entity_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let row: (bool,) = sqlx::query_as(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM favorites
            WHERE user_id = $1 AND entity_type = $2 AND entity_id = $3
        )
        "#,
    )
    .bind(user_id)
    .bind(entity_type)
    .bind(entity_id)
    .fetch_one(pool)
    .await?;

    Ok(row.0)
}
