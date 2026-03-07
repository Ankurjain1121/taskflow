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
            SELECT 1 FROM project_members
            WHERE project_id = $1 AND user_id = $2
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
                WHERE ps.type = 'done'
            ) as completed
        FROM tasks t
        LEFT JOIN project_statuses ps ON ps.id = t.status_id
        WHERE t.project_id = $1 AND t.deleted_at IS NULL
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
                LEFT JOIN project_statuses ps ON ps.id = t.status_id
                WHERE t.project_id = $1
                  AND t.deleted_at IS NULL
                  AND t.created_at::date <= ds.date
                  AND (ps.type IS DISTINCT FROM 'done')
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
        WHERE project_id = $1 AND deleted_at IS NULL
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
                WHERE ps.type = 'done'
            ) as completed_tasks
        FROM task_assignees ta
        JOIN users u ON u.id = ta.user_id
        JOIN tasks t ON t.id = ta.task_id
        LEFT JOIN project_statuses ps ON ps.id = t.status_id
        WHERE t.project_id = $1 AND t.deleted_at IS NULL
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
        LEFT JOIN project_statuses ps ON ps.id = t.status_id
        WHERE t.project_id = $1
            AND t.deleted_at IS NULL
            AND t.due_date < NOW()
            AND (ps.type IS DISTINCT FROM 'done')
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::TaskPriority;
    use crate::queries::{auth, boards, tasks, workspaces};

    const FAKE_HASH: &str = "$argon2id$v=19$m=19456,t=2,p=1$fake_salt$fake_hash_for_test";

    async fn test_pool() -> sqlx::PgPool {
        sqlx::PgPool::connect(
            "postgresql://taskflow:189015388bb0f90c999ea6b975d7e494@localhost:5433/taskflow",
        )
        .await
        .expect("Failed to connect to test database")
    }

    fn unique_email() -> String {
        format!("inttest-rp-{}@example.com", Uuid::new_v4())
    }

    async fn setup_user(pool: &sqlx::PgPool) -> (Uuid, Uuid) {
        let user = auth::create_user_with_tenant(pool, &unique_email(), "RP Test User", FAKE_HASH)
            .await
            .expect("create_user_with_tenant");
        (user.tenant_id, user.id)
    }

    async fn setup_user_and_workspace(pool: &sqlx::PgPool) -> (Uuid, Uuid, Uuid) {
        let (tenant_id, user_id) = setup_user(pool).await;
        let ws = workspaces::create_workspace(pool, "RP Test WS", None, tenant_id, user_id)
            .await
            .expect("create_workspace");
        (tenant_id, user_id, ws.id)
    }

    async fn setup_full(pool: &sqlx::PgPool) -> (Uuid, Uuid, Uuid, Uuid, Uuid) {
        let (tenant_id, user_id, ws_id) = setup_user_and_workspace(pool).await;
        let bwc = boards::create_board(pool, "RP Test Board", None, ws_id, tenant_id, user_id)
            .await
            .expect("create_board");
        let first_col_id = bwc.task_lists[0].id;
        (tenant_id, user_id, ws_id, bwc.project.id, first_col_id)
    }

    #[tokio::test]
    async fn test_get_board_report_empty_board() {
        let pool = test_pool().await;
        let (_tenant_id, user_id, _ws_id, board_id, _col_id) = setup_full(&pool).await;

        let report = get_board_report(&pool, board_id, user_id, 30)
            .await
            .expect("get_board_report");

        assert_eq!(report.completion_rate.total, 0);
        assert_eq!(report.completion_rate.completed, 0);
        assert_eq!(report.completion_rate.remaining, 0);
        // Burndown should have 31 data points (30 days back + today)
        assert_eq!(report.burndown.len(), 31);
        // With no tasks, all remaining counts should be 0
        for point in &report.burndown {
            assert_eq!(point.remaining, 0);
        }
        // Priority distribution is empty when no tasks exist
        assert!(report.priority_distribution.is_empty());
        // Assignee workload is empty when no tasks exist
        assert!(report.assignee_workload.is_empty());
        // Overdue analysis should have 4 buckets with 0 counts
        assert_eq!(report.overdue_analysis.len(), 4);
    }

    #[tokio::test]
    async fn test_get_board_report_with_tasks() {
        let pool = test_pool().await;
        let (tenant_id, user_id, _ws_id, board_id, col_id) = setup_full(&pool).await;

        // Create a couple of tasks
        let input1 = tasks::CreateTaskInput {
            title: "Report Task 1".to_string(),
            description: None,
            priority: TaskPriority::High,
            due_date: None,
            start_date: None,
            estimated_hours: None,
            status_id: None,
            task_list_id: Some(col_id),
            milestone_id: None,
            assignee_ids: None,
            label_ids: None,
            parent_task_id: None,
        };
        tasks::create_task(&pool, board_id, input1, tenant_id, user_id)
            .await
            .expect("create task 1");

        let input2 = tasks::CreateTaskInput {
            title: "Report Task 2".to_string(),
            description: None,
            priority: TaskPriority::Medium,
            due_date: None,
            start_date: None,
            estimated_hours: None,
            status_id: None,
            task_list_id: Some(col_id),
            milestone_id: None,
            assignee_ids: None,
            label_ids: None,
            parent_task_id: None,
        };
        tasks::create_task(&pool, board_id, input2, tenant_id, user_id)
            .await
            .expect("create task 2");

        let report = get_board_report(&pool, board_id, user_id, 7)
            .await
            .expect("get_board_report with tasks");

        assert_eq!(report.completion_rate.total, 2);
        // Both tasks are in "To Do" (first column), which is not done
        assert_eq!(report.completion_rate.completed, 0);
        assert_eq!(report.completion_rate.remaining, 2);

        // Burndown should have 8 data points (7 days back + today)
        assert_eq!(report.burndown.len(), 8);

        // Priority distribution should have at least 2 entries
        assert!(!report.priority_distribution.is_empty());
        let priorities: Vec<&str> = report
            .priority_distribution
            .iter()
            .map(|p| p.priority.as_str())
            .collect();
        assert!(priorities.contains(&"high"));
        assert!(priorities.contains(&"medium"));
    }

    #[tokio::test]
    async fn test_get_board_report_not_board_member() {
        let pool = test_pool().await;
        let (tenant_id, _user_id, _ws_id, board_id, _col_id) = setup_full(&pool).await;

        let other_user = auth::create_user(
            &pool,
            &unique_email(),
            "Non-member",
            FAKE_HASH,
            crate::models::UserRole::Member,
            tenant_id,
        )
        .await
        .expect("create other user");

        let result = get_board_report(&pool, board_id, other_user.id, 30).await;
        assert!(
            result.is_err(),
            "non-member should not be able to get board report"
        );
    }
}
