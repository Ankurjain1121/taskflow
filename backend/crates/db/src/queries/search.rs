use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TaskSearchResult {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub board_id: Uuid,
    pub board_name: String,
    pub workspace_id: Uuid,
    pub workspace_name: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct BoardSearchResult {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub workspace_id: Uuid,
    pub workspace_name: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CommentSearchResult {
    pub id: Uuid,
    pub content: String,
    pub task_id: Uuid,
    pub task_title: String,
    pub board_id: Uuid,
    pub board_name: String,
    pub workspace_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct SearchResults {
    pub tasks: Vec<TaskSearchResult>,
    pub boards: Vec<BoardSearchResult>,
    pub comments: Vec<CommentSearchResult>,
}

pub async fn search_all(
    pool: &PgPool,
    tenant_id: Uuid,
    user_id: Uuid,
    query: &str,
    limit: i64,
) -> Result<SearchResults, sqlx::Error> {
    let like_query = format!("%{}%", query);

    // Search tasks using full-text search with ILIKE fallback (board membership enforced)
    let tasks = sqlx::query_as::<_, TaskSearchResult>(
        r#"
        SELECT t.id, t.title, t.description, t.board_id,
               b.name as board_name, b.workspace_id,
               w.name as workspace_name
        FROM tasks t
        JOIN boards b ON b.id = t.board_id
        JOIN workspaces w ON w.id = b.workspace_id
        JOIN board_members bm ON bm.board_id = b.id AND bm.user_id = $5
        WHERE t.tenant_id = $1 AND t.deleted_at IS NULL AND b.deleted_at IS NULL
          AND (t.search_vector @@ plainto_tsquery('english', $2) OR t.title ILIKE $3)
        ORDER BY ts_rank(t.search_vector, plainto_tsquery('english', $2)) DESC
        LIMIT $4
        "#,
    )
    .bind(tenant_id)
    .bind(query)
    .bind(&like_query)
    .bind(limit)
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    // Search boards (board membership enforced)
    let boards = sqlx::query_as::<_, BoardSearchResult>(
        r#"
        SELECT b.id, b.name, b.description, b.workspace_id,
               w.name as workspace_name
        FROM boards b
        JOIN workspaces w ON w.id = b.workspace_id
        JOIN board_members bm ON bm.board_id = b.id AND bm.user_id = $4
        WHERE b.tenant_id = $1 AND b.deleted_at IS NULL
          AND (b.name ILIKE $2 OR b.description ILIKE $2)
        LIMIT $3
        "#,
    )
    .bind(tenant_id)
    .bind(&like_query)
    .bind(limit)
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    // Search comments (board membership enforced)
    let comments = sqlx::query_as::<_, CommentSearchResult>(
        r#"
        SELECT c.id, c.content, c.task_id,
               t.title as task_title, t.board_id,
               b.name as board_name, b.workspace_id
        FROM comments c
        JOIN tasks t ON t.id = c.task_id
        JOIN boards b ON b.id = t.board_id
        JOIN board_members bm ON bm.board_id = b.id AND bm.user_id = $4
        WHERE b.tenant_id = $1 AND c.deleted_at IS NULL AND t.deleted_at IS NULL
          AND c.content ILIKE $2
        LIMIT $3
        "#,
    )
    .bind(tenant_id)
    .bind(&like_query)
    .bind(limit)
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(SearchResults {
        tasks,
        boards,
        comments,
    })
}
