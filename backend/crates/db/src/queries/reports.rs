use chrono::NaiveDate;
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

/// Error type for report query operations
#[derive(Debug, thiserror::Error)]
pub enum ReportQueryError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("User is not a member of this board")]
    NotBoardMember,
}

/// Completion rate stats
#[derive(Debug, Serialize)]
pub struct CompletionRate {
    pub total: i64,
    pub completed: i64,
    pub remaining: i64,
}

/// Burndown data point
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct BurndownPoint {
    pub date: NaiveDate,
    pub remaining: i64,
}

/// Priority distribution count
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PriorityCount {
    pub priority: String,
    pub count: i64,
}

/// Assignee workload
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AssigneeWorkload {
    pub user_id: Uuid,
    pub name: String,
    pub avatar_url: Option<String>,
    pub total_tasks: i64,
    pub completed_tasks: i64,
}

/// Overdue bucket
#[derive(Debug, Serialize)]
pub struct OverdueBucket {
    pub bucket: String,
    pub count: i64,
}

/// Full board report
#[derive(Debug, Serialize)]
pub struct BoardReport {
    pub completion_rate: CompletionRate,
    pub burndown: Vec<BurndownPoint>,
    pub priority_distribution: Vec<PriorityCount>,
    pub assignee_workload: Vec<AssigneeWorkload>,
    pub overdue_analysis: Vec<OverdueBucket>,
}

/// Verify user is a member of the board
async fn verify_board_membership(
    pool: &PgPool,
    board_id: Uuid,
    user_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM board_members
            WHERE board_id = $1 AND user_id = $2
        )
        "#,
    )
    .bind(board_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    Ok(result)
}

/// Get full board report
pub async fn get_board_report(
    pool: &PgPool,
    board_id: Uuid,
    user_id: Uuid,
    days_back: i32,
) -> Result<BoardReport, ReportQueryError> {
    if !verify_board_membership(pool, board_id, user_id).await? {
        return Err(ReportQueryError::NotBoardMember);
    }

    let completion_rate = get_completion_rate(pool, board_id).await?;
    let burndown = get_burndown(pool, board_id, days_back).await?;
    let priority_distribution = get_priority_distribution(pool, board_id).await?;
    let assignee_workload = get_assignee_workload(pool, board_id).await?;
    let overdue_analysis = get_overdue_analysis(pool, board_id).await?;

    Ok(BoardReport {
        completion_rate,
        burndown,
        priority_distribution,
        assignee_workload,
        overdue_analysis,
    })
}

/// Count tasks in done vs not-done columns
async fn get_completion_rate(pool: &PgPool, board_id: Uuid) -> Result<CompletionRate, sqlx::Error> {
    #[derive(sqlx::FromRow)]
    struct Counts {
        total: i64,
        completed: i64,
    }

    let counts = sqlx::query_as::<_, Counts>(
        r#"
        SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (
                WHERE bc.status_mapping->>'done' = 'true'
            ) as completed
        FROM tasks t
        JOIN board_columns bc ON bc.id = t.column_id
        WHERE t.board_id = $1 AND t.deleted_at IS NULL
        "#,
    )
    .bind(board_id)
    .fetch_one(pool)
    .await?;

    Ok(CompletionRate {
        total: counts.total,
        completed: counts.completed,
        remaining: counts.total - counts.completed,
    })
}

/// Get burndown data over a period
async fn get_burndown(
    pool: &PgPool,
    board_id: Uuid,
    days_back: i32,
) -> Result<Vec<BurndownPoint>, sqlx::Error> {
    // For each day in the range, count tasks that were created before that day
    // and not yet completed (moved to done column) before that day.
    // Simplified approach: count all non-deleted tasks created on or before each date,
    // minus tasks in done columns that were last updated before that date.
    // Even simpler: just count remaining (non-done) tasks as of each day using activity_log.
    //
    // Simplest approach: generate date series, for each date count tasks
    // where created_at <= date AND (not done OR completed after date).
    // Since we don't track completion time separately, we'll use a simpler metric:
    // tasks created up to each date as "total scope", and current completion rate applied.
    //
    // Most practical approach: count tasks created per day (cumulative) as the top line.
    let points = sqlx::query_as::<_, BurndownPoint>(
        r#"
        WITH date_series AS (
            SELECT generate_series(
                CURRENT_DATE - ($2 || ' days')::interval,
                CURRENT_DATE,
                '1 day'::interval
            )::date AS date
        )
        SELECT
            ds.date,
            (
                SELECT COUNT(*)
                FROM tasks t
                JOIN board_columns bc ON bc.id = t.column_id
                WHERE t.board_id = $1
                  AND t.deleted_at IS NULL
                  AND t.created_at::date <= ds.date
                  AND (bc.status_mapping->>'done' IS DISTINCT FROM 'true')
            ) AS remaining
        FROM date_series ds
        ORDER BY ds.date
        "#,
    )
    .bind(board_id)
    .bind(days_back)
    .fetch_all(pool)
    .await?;

    Ok(points)
}

/// Get task count by priority
async fn get_priority_distribution(
    pool: &PgPool,
    board_id: Uuid,
) -> Result<Vec<PriorityCount>, sqlx::Error> {
    let counts = sqlx::query_as::<_, PriorityCount>(
        r#"
        SELECT
            priority::text as priority,
            COUNT(*) as count
        FROM tasks
        WHERE board_id = $1 AND deleted_at IS NULL
        GROUP BY priority
        ORDER BY
            CASE priority::text
                WHEN 'urgent' THEN 0
                WHEN 'high' THEN 1
                WHEN 'medium' THEN 2
                WHEN 'low' THEN 3
            END
        "#,
    )
    .bind(board_id)
    .fetch_all(pool)
    .await?;

    Ok(counts)
}

/// Get workload per assignee
async fn get_assignee_workload(
    pool: &PgPool,
    board_id: Uuid,
) -> Result<Vec<AssigneeWorkload>, sqlx::Error> {
    let workload = sqlx::query_as::<_, AssigneeWorkload>(
        r#"
        SELECT
            u.id as user_id,
            u.name,
            u.avatar_url,
            COUNT(t.id) as total_tasks,
            COUNT(t.id) FILTER (
                WHERE bc.status_mapping->>'done' = 'true'
            ) as completed_tasks
        FROM task_assignees ta
        JOIN users u ON u.id = ta.user_id
        JOIN tasks t ON t.id = ta.task_id
        JOIN board_columns bc ON bc.id = t.column_id
        WHERE t.board_id = $1 AND t.deleted_at IS NULL
        GROUP BY u.id, u.name, u.avatar_url
        ORDER BY total_tasks DESC
        "#,
    )
    .bind(board_id)
    .fetch_all(pool)
    .await?;

    Ok(workload)
}

/// Get overdue task analysis bucketed by how overdue
async fn get_overdue_analysis(
    pool: &PgPool,
    board_id: Uuid,
) -> Result<Vec<OverdueBucket>, sqlx::Error> {
    #[derive(sqlx::FromRow)]
    struct OverdueRow {
        days_overdue: i32,
    }

    let rows = sqlx::query_as::<_, OverdueRow>(
        r#"
        SELECT
            EXTRACT(DAY FROM NOW() - t.due_date)::int as days_overdue
        FROM tasks t
        JOIN board_columns bc ON bc.id = t.column_id
        WHERE t.board_id = $1
            AND t.deleted_at IS NULL
            AND t.due_date < NOW()
            AND bc.status_mapping->>'done' IS DISTINCT FROM 'true'
        "#,
    )
    .bind(board_id)
    .fetch_all(pool)
    .await?;

    // Bucket the overdue tasks
    let mut buckets = vec![
        ("1-3 days".to_string(), 0i64),
        ("4-7 days".to_string(), 0),
        ("1-2 weeks".to_string(), 0),
        ("2+ weeks".to_string(), 0),
    ];

    for row in rows {
        let d = row.days_overdue;
        if d <= 3 {
            buckets[0].1 += 1;
        } else if d <= 7 {
            buckets[1].1 += 1;
        } else if d <= 14 {
            buckets[2].1 += 1;
        } else {
            buckets[3].1 += 1;
        }
    }

    Ok(buckets
        .into_iter()
        .map(|(bucket, count)| OverdueBucket { bucket, count })
        .collect())
}
