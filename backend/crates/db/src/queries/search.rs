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
pub struct SearchResultCounts {
    pub tasks: i64,
    pub boards: i64,
    pub comments: i64,
}

#[derive(Debug, Serialize)]
pub struct SearchResults {
    pub tasks: Vec<TaskSearchResult>,
    pub boards: Vec<BoardSearchResult>,
    pub comments: Vec<CommentSearchResult>,
    pub counts: SearchResultCounts,
}

#[derive(Default)]
pub struct SearchFilters {
    pub assignee: Option<String>,
    pub label: Option<String>,
    pub status: Option<String>,
    pub board_id: Option<Uuid>,
}

pub async fn search_all(
    pool: &PgPool,
    tenant_id: Uuid,
    user_id: Uuid,
    query: &str,
    limit: i64,
    filters: &SearchFilters,
) -> Result<SearchResults, sqlx::Error> {
    let like_query = format!("%{}%", query);

    // Search tasks using full-text search with ILIKE fallback (board membership enforced)
    // Optional filters use the ($N::text IS NULL OR ...) pattern for conditional filtering
    let tasks = sqlx::query_as::<_, TaskSearchResult>(
        r#"
        SELECT t.id, t.title, t.description, t.project_id as board_id,
               b.name as board_name, b.workspace_id,
               w.name as workspace_name
        FROM tasks t
        JOIN projects b ON b.id = t.project_id
        JOIN workspaces w ON w.id = b.workspace_id
        JOIN project_members bm ON bm.project_id = b.id AND bm.user_id = $5
        WHERE t.tenant_id = $1 AND t.deleted_at IS NULL AND t.parent_task_id IS NULL AND b.deleted_at IS NULL
          AND (t.search_vector @@ plainto_tsquery('english', $2) OR t.title ILIKE $3)
          AND ($6::uuid IS NULL OR t.project_id = $6)
          AND ($7::text IS NULL OR EXISTS (
              SELECT 1 FROM task_assignees ta
              JOIN users u ON u.id = ta.user_id
              WHERE ta.task_id = t.id AND u.name ILIKE '%' || $7 || '%'
          ))
          AND ($8::text IS NULL OR EXISTS (
              SELECT 1 FROM task_labels tl
              JOIN labels l ON l.id = tl.label_id
              WHERE tl.task_id = t.id AND l.name ILIKE '%' || $8 || '%'
          ))
          AND ($9::text IS NULL OR EXISTS (
              SELECT 1 FROM project_statuses ps2
              WHERE ps2.id = t.status_id AND ps2.name ILIKE '%' || $9 || '%'
          ))
        ORDER BY ts_rank(t.search_vector, plainto_tsquery('english', $2)) DESC,
                 t.updated_at DESC
        LIMIT $4
        "#,
    )
    .bind(tenant_id)
    .bind(query)
    .bind(&like_query)
    .bind(limit)
    .bind(user_id)
    .bind(filters.board_id)
    .bind(&filters.assignee)
    .bind(&filters.label)
    .bind(&filters.status)
    .fetch_all(pool)
    .await?;

    // Search boards (board membership enforced)
    // board_id filter applies here too (match only that board)
    let boards = sqlx::query_as::<_, BoardSearchResult>(
        r#"
        SELECT b.id, b.name, b.description, b.workspace_id,
               w.name as workspace_name
        FROM projects b
        JOIN workspaces w ON w.id = b.workspace_id
        JOIN project_members bm ON bm.project_id = b.id AND bm.user_id = $4
        WHERE b.tenant_id = $1 AND b.deleted_at IS NULL
          AND (b.search_vector @@ plainto_tsquery('english', $6) OR b.name ILIKE $2 OR b.description ILIKE $2)
          AND ($5::uuid IS NULL OR b.id = $5)
        LIMIT $3
        "#,
    )
    .bind(tenant_id)
    .bind(&like_query)
    .bind(limit)
    .bind(user_id)
    .bind(filters.board_id)
    .bind(query)
    .fetch_all(pool)
    .await?;

    // Search comments (board membership enforced)
    // board_id filter applies to the parent task's board
    let comments = sqlx::query_as::<_, CommentSearchResult>(
        r#"
        SELECT c.id, c.content, c.task_id,
               t.title as task_title, t.project_id as board_id,
               b.name as board_name, b.workspace_id
        FROM comments c
        JOIN tasks t ON t.id = c.task_id
        JOIN projects b ON b.id = t.project_id
        JOIN project_members bm ON bm.project_id = b.id AND bm.user_id = $4
        WHERE b.tenant_id = $1 AND c.deleted_at IS NULL AND t.deleted_at IS NULL
          AND (c.search_vector @@ plainto_tsquery('english', $6) OR c.content ILIKE $2)
          AND ($5::uuid IS NULL OR t.project_id = $5)
        LIMIT $3
        "#,
    )
    .bind(tenant_id)
    .bind(&like_query)
    .bind(limit)
    .bind(user_id)
    .bind(filters.board_id)
    .bind(query)
    .fetch_all(pool)
    .await?;

    let counts = SearchResultCounts {
        tasks: tasks.len() as i64,
        boards: boards.len() as i64,
        comments: comments.len() as i64,
    };

    Ok(SearchResults {
        tasks,
        boards,
        comments,
        counts,
    })
}
