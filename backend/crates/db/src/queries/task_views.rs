use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::TaskPriority;

use super::tasks::{verify_project_membership, TaskQueryError};

/// Flat list of tasks for list view (with enriched data)
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TaskListItem {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub priority: TaskPriority,
    pub due_date: Option<DateTime<Utc>>,
    pub column_id: Uuid,
    pub column_name: String,
    pub position: String,
    pub created_by_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Assignee info for list view
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ListTaskAssignee {
    pub user_id: Uuid,
    pub display_name: String,
    pub avatar_url: Option<String>,
}

/// Enhanced task list item with aggregated fields
#[derive(Debug, Serialize)]
pub struct EnhancedTaskListItem {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub priority: TaskPriority,
    pub due_date: Option<DateTime<Utc>>,
    pub column_id: Uuid,
    pub column_name: String,
    pub is_done: bool,
    pub position: String,
    pub task_number: Option<i32>,
    pub created_by_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub subtask_completed: i64,
    pub subtask_total: i64,
    pub assignees: Vec<ListTaskAssignee>,
    pub labels: Vec<String>,
    pub comment_count: i64,
    pub milestone_name: Option<String>,
}

/// Raw row from the enhanced query (before JSON parsing)
#[derive(Debug, sqlx::FromRow)]
struct EnhancedTaskRow {
    id: Uuid,
    title: String,
    description: Option<String>,
    priority: TaskPriority,
    due_date: Option<DateTime<Utc>>,
    column_id: Uuid,
    column_name: String,
    is_done: bool,
    position: String,
    task_number: Option<i32>,
    created_by_id: Uuid,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    subtask_completed: i64,
    subtask_total: i64,
    assignees_json: serde_json::Value,
    labels_json: serde_json::Value,
    comment_count: i64,
    milestone_name: Option<String>,
}

/// Paginated response for enhanced task list
#[derive(Debug, Serialize)]
pub struct PaginatedTaskList {
    pub tasks: Vec<EnhancedTaskListItem>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
}

/// Parameters for the enhanced list query
pub struct ListTasksParams {
    pub sort_by: String,
    pub sort_order: String,
    pub page: i64,
    pub page_size: i64,
    pub search: Option<String>,
    pub priorities: Vec<String>,
    pub assignee_ids: Vec<Uuid>,
    pub column_ids: Vec<Uuid>,
    pub label_ids: Vec<Uuid>,
    pub overdue: bool,
}

/// Enhanced list query with filtering, sorting, pagination
pub async fn list_tasks_enhanced(
    pool: &PgPool,
    project_id: Uuid,
    user_id: Uuid,
    params: ListTasksParams,
) -> Result<PaginatedTaskList, TaskQueryError> {
    if !verify_project_membership(pool, project_id, user_id).await? {
        return Err(TaskQueryError::NotProjectMember);
    }

    let offset = (params.page - 1) * params.page_size;

    // Build WHERE clauses dynamically
    let mut conditions = vec![
        "t.project_id = $1".to_string(),
        "t.deleted_at IS NULL".to_string(),
        "t.parent_task_id IS NULL".to_string(),
    ];
    // We track bind parameter index starting after $1 (project_id)
    let mut bind_idx = 2u32;

    // Search filter
    let search_idx = if params.search.is_some() {
        let idx = bind_idx;
        conditions.push(format!("t.title ILIKE '%' || ${idx} || '%'"));
        bind_idx += 1;
        Some(idx)
    } else {
        None
    };

    // Priority filter
    let priority_idx = if !params.priorities.is_empty() {
        let idx = bind_idx;
        conditions.push(format!("t.priority::text = ANY(${idx})"));
        bind_idx += 1;
        Some(idx)
    } else {
        None
    };

    // Assignee filter
    let assignee_idx = if !params.assignee_ids.is_empty() {
        let idx = bind_idx;
        conditions.push(format!(
            "EXISTS (SELECT 1 FROM task_assignees ta2 WHERE ta2.task_id = t.id AND ta2.user_id = ANY(${idx}))"
        ));
        bind_idx += 1;
        Some(idx)
    } else {
        None
    };

    // Column filter
    let column_idx = if !params.column_ids.is_empty() {
        let idx = bind_idx;
        conditions.push(format!("t.column_id = ANY(${idx})"));
        bind_idx += 1;
        Some(idx)
    } else {
        None
    };

    // Label filter
    let label_idx = if !params.label_ids.is_empty() {
        let idx = bind_idx;
        conditions.push(format!(
            "EXISTS (SELECT 1 FROM task_labels tl2 WHERE tl2.task_id = t.id AND tl2.label_id = ANY(${idx}))"
        ));
        bind_idx += 1;
        Some(idx)
    } else {
        None
    };

    // Overdue filter
    if params.overdue {
        conditions.push(
            "t.due_date < NOW() AND COALESCE(bc.status_mapping->>'done' = 'true', false) = false"
                .to_string(),
        );
    }

    let where_clause = conditions.join(" AND ");

    // Validate and build ORDER BY
    let sort_col = match params.sort_by.as_str() {
        "title" => "t.title",
        "priority" => "t.priority",
        "status" => "bc.name",
        "due_date" => "t.due_date",
        "created_at" => "t.created_at",
        "updated_at" => "t.updated_at",
        _ => "t.created_at",
    };
    let sort_dir = if params.sort_order == "asc" {
        "ASC"
    } else {
        "DESC"
    };
    let nulls = if sort_dir == "ASC" {
        "NULLS LAST"
    } else {
        "NULLS FIRST"
    };

    let limit_idx = bind_idx;
    bind_idx += 1;
    let offset_idx = bind_idx;

    let query_str = format!(
        r#"
        WITH filtered_tasks AS (
            SELECT t.id, t.title, t.description, t.priority, t.due_date,
                   t.column_id, bc.name as column_name,
                   COALESCE(bc.status_mapping->>'done' = 'true', false) as is_done,
                   t.position, t.task_number, t.created_by_id,
                   t.created_at, t.updated_at
            FROM tasks t
            JOIN project_columns bc ON bc.id = t.column_id
            WHERE {where_clause}
        ),
        task_page AS (
            SELECT * FROM filtered_tasks
            ORDER BY {sort_col} {sort_dir} {nulls}, filtered_tasks.id ASC
            LIMIT ${limit_idx} OFFSET ${offset_idx}
        ),
        subtask_counts AS (
            SELECT parent_task_id,
                   COUNT(*) as total,
                   COUNT(*) FILTER (WHERE
                       EXISTS (SELECT 1 FROM project_columns pc
                               WHERE pc.id = tasks.column_id
                               AND pc.status_mapping->>'done' = 'true')
                   ) as completed
            FROM tasks
            WHERE parent_task_id IN (SELECT id FROM task_page)
              AND deleted_at IS NULL
            GROUP BY parent_task_id
        ),
        assignee_agg AS (
            SELECT ta.task_id,
                   COALESCE(json_agg(json_build_object(
                       'user_id', u.id,
                       'display_name', u.name,
                       'avatar_url', u.avatar_url
                   )) FILTER (WHERE u.id IS NOT NULL), '[]'::json) as assignees
            FROM task_assignees ta
            JOIN users u ON u.id = ta.user_id
            WHERE ta.task_id IN (SELECT id FROM task_page)
            GROUP BY ta.task_id
        ),
        label_agg AS (
            SELECT tl.task_id,
                   COALESCE(json_agg(l.name) FILTER (WHERE l.id IS NOT NULL), '[]'::json) as labels
            FROM task_labels tl
            JOIN labels l ON l.id = tl.label_id
            WHERE tl.task_id IN (SELECT id FROM task_page)
            GROUP BY tl.task_id
        ),
        comment_counts AS (
            SELECT task_id, COUNT(*) as cnt
            FROM comments
            WHERE task_id IN (SELECT id FROM task_page)
            GROUP BY task_id
        )
        SELECT
            tp.id, tp.title, tp.description, tp.priority,
            tp.due_date, tp.column_id, tp.column_name,
            tp.is_done as "is_done!",
            tp.position, tp.task_number, tp.created_by_id,
            tp.created_at, tp.updated_at,
            COALESCE(sc.completed, 0) as "subtask_completed!",
            COALESCE(sc.total, 0) as "subtask_total!",
            COALESCE(aa.assignees, '[]'::json) as "assignees_json!",
            COALESCE(la.labels, '[]'::json) as "labels_json!",
            COALESCE(cc.cnt, 0) as "comment_count!",
            m.name as milestone_name
        FROM task_page tp
        LEFT JOIN subtask_counts sc ON sc.parent_task_id = tp.id
        LEFT JOIN assignee_agg aa ON aa.task_id = tp.id
        LEFT JOIN label_agg la ON la.task_id = tp.id
        LEFT JOIN comment_counts cc ON cc.task_id = tp.id
        LEFT JOIN milestones m ON m.id = (
            SELECT t2.milestone_id FROM tasks t2 WHERE t2.id = tp.id
        )
        ORDER BY {sort_col} {sort_dir} {nulls}, tp.id ASC
        "#,
        where_clause = where_clause,
        sort_col = sort_col.replace("t.", "tp.").replace("bc.", "tp."),
        sort_dir = sort_dir,
        nulls = nulls,
        limit_idx = limit_idx,
        offset_idx = offset_idx,
    );

    // Count query
    let count_query = format!(
        r#"
        SELECT COUNT(*) as "count!"
        FROM tasks t
        JOIN project_columns bc ON bc.id = t.column_id
        WHERE {where_clause}
        "#,
        where_clause = where_clause,
    );

    // Build and execute count query
    let mut count_q = sqlx::query_scalar::<_, i64>(&count_query).bind(project_id);
    if search_idx.is_some() {
        count_q = count_q.bind(params.search.as_deref().unwrap_or(""));
    }
    if priority_idx.is_some() {
        count_q = count_q.bind(&params.priorities);
    }
    if assignee_idx.is_some() {
        count_q = count_q.bind(&params.assignee_ids);
    }
    if column_idx.is_some() {
        count_q = count_q.bind(&params.column_ids);
    }
    if label_idx.is_some() {
        count_q = count_q.bind(&params.label_ids);
    }
    let total = count_q.fetch_one(pool).await?;

    // Build and execute main query
    let mut main_q = sqlx::query_as::<_, EnhancedTaskRow>(&query_str).bind(project_id);
    if search_idx.is_some() {
        main_q = main_q.bind(params.search.as_deref().unwrap_or(""));
    }
    if priority_idx.is_some() {
        main_q = main_q.bind(&params.priorities);
    }
    if assignee_idx.is_some() {
        main_q = main_q.bind(&params.assignee_ids);
    }
    if column_idx.is_some() {
        main_q = main_q.bind(&params.column_ids);
    }
    if label_idx.is_some() {
        main_q = main_q.bind(&params.label_ids);
    }
    main_q = main_q.bind(params.page_size).bind(offset);

    let rows = main_q.fetch_all(pool).await?;

    let tasks = rows
        .into_iter()
        .map(|row| {
            let assignees: Vec<ListTaskAssignee> =
                serde_json::from_value(row.assignees_json).unwrap_or_default();
            let labels: Vec<String> = serde_json::from_value(row.labels_json).unwrap_or_default();

            EnhancedTaskListItem {
                id: row.id,
                title: row.title,
                description: row.description,
                priority: row.priority,
                due_date: row.due_date,
                column_id: row.column_id,
                column_name: row.column_name,
                is_done: row.is_done,
                position: row.position,
                task_number: row.task_number,
                created_by_id: row.created_by_id,
                created_at: row.created_at,
                updated_at: row.updated_at,
                subtask_completed: row.subtask_completed,
                subtask_total: row.subtask_total,
                assignees,
                labels,
                comment_count: row.comment_count,
                milestone_name: row.milestone_name,
            }
        })
        .collect();

    Ok(PaginatedTaskList {
        tasks,
        total,
        page: params.page,
        page_size: params.page_size,
    })
}

/// List all tasks for a project as a flat list with column names
pub async fn list_tasks_flat(
    pool: &PgPool,
    project_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<TaskListItem>, TaskQueryError> {
    if !verify_project_membership(pool, project_id, user_id).await? {
        return Err(TaskQueryError::NotProjectMember);
    }

    let tasks = sqlx::query_as::<_, TaskListItem>(
        r#"
        SELECT t.id, t.title, t.description,
               t.priority,
               t.due_date, t.column_id,
               bc.name as column_name,
               t.position, t.created_by_id,
               t.created_at, t.updated_at
        FROM tasks t
        JOIN project_columns bc ON bc.id = t.column_id
        WHERE t.project_id = $1 AND t.deleted_at IS NULL AND t.parent_task_id IS NULL
        ORDER BY t.created_at DESC
        "#,
    )
    .bind(project_id)
    .fetch_all(pool)
    .await?;

    Ok(tasks)
}

/// Calendar task for date-based views
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CalendarTask {
    pub id: Uuid,
    pub title: String,
    pub priority: TaskPriority,
    pub due_date: DateTime<Utc>,
    pub start_date: Option<DateTime<Utc>>,
    pub column_id: Uuid,
    pub column_name: String,
    pub is_done: bool,
    pub milestone_id: Option<Uuid>,
}

/// List tasks for a project filtered by date range (for calendar view)
pub async fn list_tasks_for_calendar(
    pool: &PgPool,
    project_id: Uuid,
    user_id: Uuid,
    start: DateTime<Utc>,
    end: DateTime<Utc>,
) -> Result<Vec<CalendarTask>, TaskQueryError> {
    if !verify_project_membership(pool, project_id, user_id).await? {
        return Err(TaskQueryError::NotProjectMember);
    }

    let tasks = sqlx::query_as::<_, CalendarTask>(
        r#"
        SELECT
            t.id, t.title, t.priority,
            t.due_date as "due_date!",
            t.start_date,
            t.column_id,
            bc.name as column_name,
            COALESCE(bc.status_mapping->>'done' = 'true', false) as "is_done!",
            t.milestone_id
        FROM tasks t
        JOIN project_columns bc ON bc.id = t.column_id
        WHERE t.project_id = $1
            AND t.deleted_at IS NULL
            AND t.due_date IS NOT NULL
            AND t.due_date >= $2
            AND t.due_date <= $3
        ORDER BY t.due_date ASC
        "#,
    )
    .bind(project_id)
    .bind(start)
    .bind(end)
    .fetch_all(pool)
    .await?;

    Ok(tasks)
}

/// Gantt task for timeline views
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct GanttTask {
    pub id: Uuid,
    pub title: String,
    pub priority: TaskPriority,
    pub start_date: Option<DateTime<Utc>>,
    pub due_date: Option<DateTime<Utc>>,
    pub column_id: Uuid,
    pub column_name: String,
    pub is_done: bool,
    pub milestone_id: Option<Uuid>,
}

/// List tasks for a project that have dates (for Gantt chart)
pub async fn list_tasks_for_gantt(
    pool: &PgPool,
    project_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<GanttTask>, TaskQueryError> {
    if !verify_project_membership(pool, project_id, user_id).await? {
        return Err(TaskQueryError::NotProjectMember);
    }

    let tasks = sqlx::query_as::<_, GanttTask>(
        r#"
        SELECT
            t.id, t.title, t.priority,
            t.start_date,
            t.due_date,
            t.column_id,
            bc.name as column_name,
            COALESCE(bc.status_mapping->>'done' = 'true', false) as "is_done!",
            t.milestone_id
        FROM tasks t
        JOIN project_columns bc ON bc.id = t.column_id
        WHERE t.project_id = $1
            AND t.deleted_at IS NULL
            AND (t.start_date IS NOT NULL OR t.due_date IS NOT NULL)
        ORDER BY COALESCE(t.start_date, t.due_date) ASC
        "#,
    )
    .bind(project_id)
    .fetch_all(pool)
    .await?;

    Ok(tasks)
}
