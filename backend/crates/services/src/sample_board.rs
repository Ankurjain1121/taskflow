//! Sample board generation service
//!
//! Creates a use-case-specific sample board with columns, tasks, subtasks,
//! labels, and due dates to help new users see TaskFlow in action.

use chrono::{Duration, Utc};
use sqlx::PgPool;
use uuid::Uuid;

/// Error type for sample board generation
#[derive(Debug, thiserror::Error)]
pub enum SampleBoardError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
}

// ============================================================================
// Template data structures
// ============================================================================

struct TemplateConfig {
    board_name: &'static str,
    board_description: &'static str,
    columns: &'static [ColumnDef],
    tasks: &'static [TaskDef],
    labels: &'static [LabelDef],
}

struct ColumnDef {
    name: &'static str,
    color: &'static str,
    is_done: bool,
}

struct TaskDef {
    title: &'static str,
    column_index: usize,
    priority: &'static str,
    due_day_offset: Option<i64>,
    subtasks: &'static [&'static str],
    label_index: usize,
}

struct LabelDef {
    name: &'static str,
    color: &'static str,
}

// ============================================================================
// Template definitions
// ============================================================================

static SOFTWARE_COLUMNS: &[ColumnDef] = &[
    ColumnDef {
        name: "Backlog",
        color: "#94a3b8",
        is_done: false,
    },
    ColumnDef {
        name: "To Do",
        color: "#6366f1",
        is_done: false,
    },
    ColumnDef {
        name: "In Progress",
        color: "#3b82f6",
        is_done: false,
    },
    ColumnDef {
        name: "Code Review",
        color: "#f59e0b",
        is_done: false,
    },
    ColumnDef {
        name: "Done",
        color: "#22c55e",
        is_done: true,
    },
];

static SOFTWARE_LABELS: &[LabelDef] = &[
    LabelDef {
        name: "Bug",
        color: "#ef4444",
    },
    LabelDef {
        name: "Feature",
        color: "#3b82f6",
    },
    LabelDef {
        name: "Tech Debt",
        color: "#f59e0b",
    },
];

static SOFTWARE_TASKS: &[TaskDef] = &[
    TaskDef {
        title: "Set up CI/CD pipeline",
        column_index: 0,
        priority: "high",
        due_day_offset: Some(2),
        subtasks: &[
            "Configure GitHub Actions workflow",
            "Add deployment scripts",
            "Set up staging environment",
        ],
        label_index: 0,
    },
    TaskDef {
        title: "Design user authentication",
        column_index: 0,
        priority: "high",
        due_day_offset: Some(5),
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Create API documentation",
        column_index: 1,
        priority: "medium",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Fix login page bug",
        column_index: 1,
        priority: "medium",
        due_day_offset: Some(3),
        subtasks: &["Reproduce the issue", "Write failing test"],
        label_index: 0,
    },
    TaskDef {
        title: "Add dark mode support",
        column_index: 2,
        priority: "medium",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Write unit tests for auth",
        column_index: 2,
        priority: "low",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Implement search feature",
        column_index: 3,
        priority: "low",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Review pull request #42",
        column_index: 4,
        priority: "low",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
];

static MARKETING_COLUMNS: &[ColumnDef] = &[
    ColumnDef {
        name: "Ideas",
        color: "#a78bfa",
        is_done: false,
    },
    ColumnDef {
        name: "Planning",
        color: "#6366f1",
        is_done: false,
    },
    ColumnDef {
        name: "In Progress",
        color: "#3b82f6",
        is_done: false,
    },
    ColumnDef {
        name: "Review",
        color: "#f59e0b",
        is_done: false,
    },
    ColumnDef {
        name: "Published",
        color: "#22c55e",
        is_done: true,
    },
];

static MARKETING_LABELS: &[LabelDef] = &[
    LabelDef {
        name: "Content",
        color: "#8b5cf6",
    },
    LabelDef {
        name: "Social",
        color: "#3b82f6",
    },
    LabelDef {
        name: "Email",
        color: "#f59e0b",
    },
];

static MARKETING_TASKS: &[TaskDef] = &[
    TaskDef {
        title: "Write blog post on product launch",
        column_index: 0,
        priority: "high",
        due_day_offset: Some(3),
        subtasks: &["Research keywords", "Write draft", "Create featured image"],
        label_index: 0,
    },
    TaskDef {
        title: "Design social media graphics",
        column_index: 0,
        priority: "high",
        due_day_offset: Some(5),
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Plan email newsletter",
        column_index: 1,
        priority: "medium",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Create landing page copy",
        column_index: 1,
        priority: "medium",
        due_day_offset: Some(4),
        subtasks: &["Write headline options", "Draft body copy"],
        label_index: 0,
    },
    TaskDef {
        title: "Set up analytics tracking",
        column_index: 2,
        priority: "medium",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Schedule social media posts",
        column_index: 2,
        priority: "low",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Review competitor analysis",
        column_index: 3,
        priority: "low",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Film product demo video",
        column_index: 4,
        priority: "low",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
];

static PERSONAL_COLUMNS: &[ColumnDef] = &[
    ColumnDef {
        name: "To Do",
        color: "#6366f1",
        is_done: false,
    },
    ColumnDef {
        name: "Doing",
        color: "#3b82f6",
        is_done: false,
    },
    ColumnDef {
        name: "Waiting",
        color: "#f59e0b",
        is_done: false,
    },
    ColumnDef {
        name: "Done",
        color: "#22c55e",
        is_done: true,
    },
];

static PERSONAL_LABELS: &[LabelDef] = &[
    LabelDef {
        name: "Health",
        color: "#22c55e",
    },
    LabelDef {
        name: "Learning",
        color: "#3b82f6",
    },
    LabelDef {
        name: "Home",
        color: "#f59e0b",
    },
];

static PERSONAL_TASKS: &[TaskDef] = &[
    TaskDef {
        title: "Plan weekend project",
        column_index: 0,
        priority: "high",
        due_day_offset: Some(2),
        subtasks: &["Gather materials", "Sketch out plan"],
        label_index: 0,
    },
    TaskDef {
        title: "Read Atomic Habits book",
        column_index: 0,
        priority: "high",
        due_day_offset: Some(7),
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Organize digital photos",
        column_index: 0,
        priority: "medium",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Learn basic cooking recipes",
        column_index: 1,
        priority: "medium",
        due_day_offset: Some(5),
        subtasks: &[
            "Find 3 simple recipes",
            "Buy ingredients",
            "Cook first meal",
        ],
        label_index: 0,
    },
    TaskDef {
        title: "Set up home office",
        column_index: 1,
        priority: "medium",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Create monthly budget",
        column_index: 2,
        priority: "low",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Exercise 3x this week",
        column_index: 2,
        priority: "low",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Call dentist for appointment",
        column_index: 3,
        priority: "low",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
];

static DESIGN_COLUMNS: &[ColumnDef] = &[
    ColumnDef {
        name: "Research",
        color: "#a78bfa",
        is_done: false,
    },
    ColumnDef {
        name: "Wireframes",
        color: "#6366f1",
        is_done: false,
    },
    ColumnDef {
        name: "Design",
        color: "#3b82f6",
        is_done: false,
    },
    ColumnDef {
        name: "Feedback",
        color: "#f59e0b",
        is_done: false,
    },
    ColumnDef {
        name: "Shipped",
        color: "#22c55e",
        is_done: true,
    },
];

static DESIGN_LABELS: &[LabelDef] = &[
    LabelDef {
        name: "UX Research",
        color: "#8b5cf6",
    },
    LabelDef {
        name: "UI Design",
        color: "#3b82f6",
    },
    LabelDef {
        name: "Prototype",
        color: "#f59e0b",
    },
];

static DESIGN_TASKS: &[TaskDef] = &[
    TaskDef {
        title: "Create user persona cards",
        column_index: 0,
        priority: "high",
        due_day_offset: Some(2),
        subtasks: &[
            "Conduct user interviews",
            "Synthesize findings",
            "Design persona templates",
        ],
        label_index: 0,
    },
    TaskDef {
        title: "Wireframe onboarding flow",
        column_index: 0,
        priority: "high",
        due_day_offset: Some(4),
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Design component library",
        column_index: 1,
        priority: "medium",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Prototype mobile navigation",
        column_index: 1,
        priority: "medium",
        due_day_offset: Some(6),
        subtasks: &["Map navigation structure", "Create clickable prototype"],
        label_index: 0,
    },
    TaskDef {
        title: "Conduct usability test",
        column_index: 2,
        priority: "medium",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Design dark mode palette",
        column_index: 2,
        priority: "low",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Create icon set",
        column_index: 3,
        priority: "low",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Review design system tokens",
        column_index: 4,
        priority: "low",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
];

fn get_template(use_case: &str) -> &'static TemplateConfig {
    match use_case {
        "marketing" => &MARKETING_TEMPLATE,
        "personal" => &PERSONAL_TEMPLATE,
        "design" => &DESIGN_TEMPLATE,
        _ => &SOFTWARE_TEMPLATE,
    }
}

static SOFTWARE_TEMPLATE: TemplateConfig = TemplateConfig {
    board_name: "Sprint Board",
    board_description: "Your software development sprint board",
    columns: SOFTWARE_COLUMNS,
    tasks: SOFTWARE_TASKS,
    labels: SOFTWARE_LABELS,
};

static MARKETING_TEMPLATE: TemplateConfig = TemplateConfig {
    board_name: "Campaign Tracker",
    board_description: "Track your marketing campaigns and content",
    columns: MARKETING_COLUMNS,
    tasks: MARKETING_TASKS,
    labels: MARKETING_LABELS,
};

static PERSONAL_TEMPLATE: TemplateConfig = TemplateConfig {
    board_name: "My Projects",
    board_description: "Organize your personal tasks and goals",
    columns: PERSONAL_COLUMNS,
    tasks: PERSONAL_TASKS,
    labels: PERSONAL_LABELS,
};

static DESIGN_TEMPLATE: TemplateConfig = TemplateConfig {
    board_name: "Design Sprint",
    board_description: "Your design sprint workflow",
    columns: DESIGN_COLUMNS,
    tasks: DESIGN_TASKS,
    labels: DESIGN_LABELS,
};

// ============================================================================
// Board generation
// ============================================================================

/// Generate a sample board based on the selected use case.
///
/// Creates in a single transaction:
/// - Board with `is_sample = true`
/// - Use-case-specific columns
/// - 8 tasks with varying priorities, labels, subtasks, and due dates
/// - 3 labels specific to the use case
/// - Creator as board member with "editor" role
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `workspace_id` - The workspace to create the board in
/// * `created_by_id` - The user creating the board
/// * `tenant_id` - The tenant ID
/// * `use_case` - One of "software", "marketing", "personal", "design"
///
/// # Returns
/// The UUID of the created board
pub async fn generate_sample_board(
    pool: &PgPool,
    workspace_id: Uuid,
    created_by_id: Uuid,
    tenant_id: Uuid,
    use_case: &str,
) -> Result<Uuid, SampleBoardError> {
    let template = get_template(use_case);
    let mut tx = pool.begin().await?;

    // 1. Create the board with is_sample = true
    let board_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO boards (id, name, description, workspace_id, tenant_id, created_by_id, is_sample)
        VALUES ($1, $2, $3, $4, $5, $6, true)
        "#,
    )
    .bind(board_id)
    .bind(template.board_name)
    .bind(template.board_description)
    .bind(workspace_id)
    .bind(tenant_id)
    .bind(created_by_id)
    .execute(&mut *tx)
    .await?;

    // 2. Create columns
    let mut column_ids = Vec::with_capacity(template.columns.len());
    for (i, col) in template.columns.iter().enumerate() {
        let col_id = Uuid::new_v4();
        let position = format!("a{}", i);
        let status_mapping: Option<serde_json::Value> = if col.is_done {
            Some(serde_json::json!({"done": true}))
        } else {
            None
        };
        sqlx::query(
            r#"
            INSERT INTO board_columns (id, name, board_id, position, color, status_mapping)
            VALUES ($1, $2, $3, $4, $5, $6)
            "#,
        )
        .bind(col_id)
        .bind(col.name)
        .bind(board_id)
        .bind(&position)
        .bind(col.color)
        .bind(&status_mapping)
        .execute(&mut *tx)
        .await?;
        column_ids.push(col_id);
    }

    // 3. Add creator as board member with editor role
    sqlx::query(
        r#"
        INSERT INTO board_members (id, board_id, user_id, role)
        VALUES ($1, $2, $3, 'editor')
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(board_id)
    .bind(created_by_id)
    .execute(&mut *tx)
    .await?;

    // 4. Create labels
    let mut label_ids = Vec::with_capacity(template.labels.len());
    for lbl in template.labels {
        let label_id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO labels (id, name, color, board_id, workspace_id)
            VALUES ($1, $2, $3, $4, $5)
            "#,
        )
        .bind(label_id)
        .bind(lbl.name)
        .bind(lbl.color)
        .bind(board_id)
        .bind(workspace_id)
        .execute(&mut *tx)
        .await?;
        label_ids.push(label_id);
    }

    // 5. Create tasks with subtasks, due dates, and labels
    let now = Utc::now();
    for (task_idx, task_def) in template.tasks.iter().enumerate() {
        let task_id = Uuid::new_v4();
        let position = format!("a{}", task_idx);
        let due_date = task_def
            .due_day_offset
            .map(|days| now + Duration::days(days));

        sqlx::query(
            r#"
            INSERT INTO tasks (id, title, board_id, column_id, priority, position, due_date, tenant_id, created_by_id)
            VALUES ($1, $2, $3, $4, $5::task_priority, $6, $7, $8, $9)
            "#,
        )
        .bind(task_id)
        .bind(task_def.title)
        .bind(board_id)
        .bind(column_ids[task_def.column_index])
        .bind(task_def.priority)
        .bind(&position)
        .bind(due_date)
        .bind(tenant_id)
        .bind(created_by_id)
        .execute(&mut *tx)
        .await?;

        // Attach first label to all tasks
        if !label_ids.is_empty() {
            let label_id = label_ids[task_def.label_index.min(label_ids.len() - 1)];
            sqlx::query(
                r#"
                INSERT INTO task_labels (id, task_id, label_id)
                VALUES ($1, $2, $3)
                "#,
            )
            .bind(Uuid::new_v4())
            .bind(task_id)
            .bind(label_id)
            .execute(&mut *tx)
            .await?;
        }

        // Create subtasks
        for (sub_idx, sub_title) in task_def.subtasks.iter().enumerate() {
            let sub_position = format!("a{}", sub_idx);
            sqlx::query(
                r#"
                INSERT INTO subtasks (id, task_id, title, is_completed, position, created_by_id)
                VALUES ($1, $2, $3, false, $4, $5)
                "#,
            )
            .bind(Uuid::new_v4())
            .bind(task_id)
            .bind(*sub_title)
            .bind(&sub_position)
            .bind(created_by_id)
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;

    Ok(board_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sample_board_error_display() {
        let err = SampleBoardError::Database(sqlx::Error::RowNotFound);
        let msg = format!("{}", err);
        assert!(msg.contains("Database error"), "got: {}", msg);
    }

    #[test]
    fn test_sample_board_error_debug() {
        let err = SampleBoardError::Database(sqlx::Error::RowNotFound);
        let debug = format!("{:?}", err);
        assert!(debug.contains("Database"), "got: {}", debug);
    }

    #[test]
    fn test_get_template_software() {
        let t = get_template("software");
        assert_eq!(t.board_name, "Sprint Board");
        assert_eq!(t.columns.len(), 5);
        assert_eq!(t.tasks.len(), 8);
        assert_eq!(t.labels.len(), 3);
    }

    #[test]
    fn test_get_template_marketing() {
        let t = get_template("marketing");
        assert_eq!(t.board_name, "Campaign Tracker");
        assert_eq!(t.columns.len(), 5);
        assert_eq!(t.tasks.len(), 8);
        assert_eq!(t.labels.len(), 3);
    }

    #[test]
    fn test_get_template_personal() {
        let t = get_template("personal");
        assert_eq!(t.board_name, "My Projects");
        assert_eq!(t.columns.len(), 4);
        assert_eq!(t.tasks.len(), 8);
        assert_eq!(t.labels.len(), 3);
    }

    #[test]
    fn test_get_template_design() {
        let t = get_template("design");
        assert_eq!(t.board_name, "Design Sprint");
        assert_eq!(t.columns.len(), 5);
        assert_eq!(t.tasks.len(), 8);
        assert_eq!(t.labels.len(), 3);
    }

    #[test]
    fn test_get_template_unknown_defaults_to_software() {
        let t = get_template("unknown");
        assert_eq!(t.board_name, "Sprint Board");
    }

    #[test]
    fn test_each_template_has_two_high_priority_tasks() {
        for use_case in &["software", "marketing", "personal", "design"] {
            let t = get_template(use_case);
            let high_count = t.tasks.iter().filter(|t| t.priority == "high").count();
            assert_eq!(
                high_count, 2,
                "{} should have 2 high priority tasks",
                use_case
            );
        }
    }

    #[test]
    fn test_each_template_has_three_medium_priority_tasks() {
        for use_case in &["software", "marketing", "personal", "design"] {
            let t = get_template(use_case);
            let med_count = t.tasks.iter().filter(|t| t.priority == "medium").count();
            assert_eq!(
                med_count, 3,
                "{} should have 3 medium priority tasks",
                use_case
            );
        }
    }

    #[test]
    fn test_each_template_has_three_low_priority_tasks() {
        for use_case in &["software", "marketing", "personal", "design"] {
            let t = get_template(use_case);
            let low_count = t.tasks.iter().filter(|t| t.priority == "low").count();
            assert_eq!(
                low_count, 3,
                "{} should have 3 low priority tasks",
                use_case
            );
        }
    }

    #[test]
    fn test_each_template_has_at_least_two_tasks_with_subtasks() {
        for use_case in &["software", "marketing", "personal", "design"] {
            let t = get_template(use_case);
            let with_subtasks = t.tasks.iter().filter(|t| !t.subtasks.is_empty()).count();
            assert!(
                with_subtasks >= 2,
                "{} should have at least 2 tasks with subtasks, got {}",
                use_case,
                with_subtasks
            );
        }
    }

    #[test]
    fn test_each_template_has_at_least_three_tasks_with_due_dates() {
        for use_case in &["software", "marketing", "personal", "design"] {
            let t = get_template(use_case);
            let with_due = t
                .tasks
                .iter()
                .filter(|t| t.due_day_offset.is_some())
                .count();
            assert!(
                with_due >= 3,
                "{} should have at least 3 tasks with due dates, got {}",
                use_case,
                with_due
            );
        }
    }

    #[test]
    fn test_column_colors_are_valid_hex() {
        for use_case in &["software", "marketing", "personal", "design"] {
            let t = get_template(use_case);
            for col in t.columns {
                assert!(
                    col.color.starts_with('#'),
                    "Color '{}' missing # prefix",
                    col.color
                );
                assert_eq!(
                    col.color.len(),
                    7,
                    "Color '{}' should be 7 chars",
                    col.color
                );
                assert!(
                    col.color[1..].chars().all(|c| c.is_ascii_hexdigit()),
                    "Color '{}' contains non-hex chars",
                    col.color
                );
            }
        }
    }

    #[test]
    fn test_label_colors_are_valid_hex() {
        for use_case in &["software", "marketing", "personal", "design"] {
            let t = get_template(use_case);
            for lbl in t.labels {
                assert!(
                    lbl.color.starts_with('#'),
                    "Color '{}' missing # prefix",
                    lbl.color
                );
                assert_eq!(
                    lbl.color.len(),
                    7,
                    "Color '{}' should be 7 chars",
                    lbl.color
                );
                assert!(
                    lbl.color[1..].chars().all(|c| c.is_ascii_hexdigit()),
                    "Color '{}' contains non-hex chars",
                    lbl.color
                );
            }
        }
    }

    #[test]
    fn test_task_column_indices_are_valid() {
        for use_case in &["software", "marketing", "personal", "design"] {
            let t = get_template(use_case);
            for task in t.tasks {
                assert!(
                    task.column_index < t.columns.len(),
                    "{}: task '{}' has column_index {} but only {} columns",
                    use_case,
                    task.title,
                    task.column_index,
                    t.columns.len()
                );
            }
        }
    }

    #[test]
    fn test_last_column_is_done() {
        for use_case in &["software", "marketing", "personal", "design"] {
            let t = get_template(use_case);
            let last = t.columns.last().expect("should have columns");
            assert!(last.is_done, "{}: last column should be done", use_case);
        }
    }

    #[test]
    fn test_sample_board_error_from_sqlx() {
        let sqlx_err = sqlx::Error::RowNotFound;
        let err: SampleBoardError = sqlx_err.into();
        assert!(matches!(err, SampleBoardError::Database(_)));
    }
}
