//! Sample project generation service
//!
//! Creates a use-case-specific sample project with columns, tasks, subtasks,
//! labels, and due dates to help new users see TaskFlow in action.

use chrono::{Duration, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use super::sample_data::get_template;

/// Error type for sample project generation
#[derive(Debug, thiserror::Error)]
pub enum SampleProjectError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
}

// ============================================================================
// Project generation
// ============================================================================

/// Generate a sample project based on the selected use case.
///
/// Creates in a single transaction:
/// - Project with `is_sample = true`
/// - Use-case-specific columns
/// - 8 tasks with varying priorities, labels, subtasks, and due dates
/// - 3 labels specific to the use case
/// - Creator as project member with "editor" role
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `workspace_id` - The workspace to create the project in
/// * `created_by_id` - The user creating the project
/// * `tenant_id` - The tenant ID
/// * `use_case` - One of "software", "marketing", "personal", "design"
///
/// # Returns
/// The UUID of the created project
pub async fn generate_sample_project(
    pool: &PgPool,
    workspace_id: Uuid,
    created_by_id: Uuid,
    tenant_id: Uuid,
    use_case: &str,
) -> Result<Uuid, SampleProjectError> {
    let template = get_template(use_case);
    let mut tx = pool.begin().await?;

    // 1. Create the project with is_sample = true
    let project_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO projects (id, name, description, workspace_id, tenant_id, created_by_id, is_sample)
        VALUES ($1, $2, $3, $4, $5, $6, true)
        "#,
    )
    .bind(project_id)
    .bind(template.project_name)
    .bind(template.project_description)
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
            INSERT INTO project_columns (id, name, project_id, position, color, status_mapping)
            VALUES ($1, $2, $3, $4, $5, $6)
            "#,
        )
        .bind(col_id)
        .bind(col.name)
        .bind(project_id)
        .bind(&position)
        .bind(col.color)
        .bind(&status_mapping)
        .execute(&mut *tx)
        .await?;
        column_ids.push(col_id);
    }

    // 3. Add creator as project member with editor role
    sqlx::query(
        r#"
        INSERT INTO project_members (id, project_id, user_id, role)
        VALUES ($1, $2, $3, 'editor')
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(project_id)
    .bind(created_by_id)
    .execute(&mut *tx)
    .await?;

    // 4. Create labels
    let mut label_ids = Vec::with_capacity(template.labels.len());
    for lbl in template.labels {
        let label_id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO labels (id, name, color, project_id, workspace_id)
            VALUES ($1, $2, $3, $4, $5)
            "#,
        )
        .bind(label_id)
        .bind(lbl.name)
        .bind(lbl.color)
        .bind(project_id)
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
            INSERT INTO tasks (id, title, project_id, column_id, priority, position, due_date, tenant_id, created_by_id)
            VALUES ($1, $2, $3, $4, $5::task_priority, $6, $7, $8, $9)
            "#,
        )
        .bind(task_id)
        .bind(task_def.title)
        .bind(project_id)
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

    Ok(project_id)
}

#[cfg(test)]
mod tests {
    use super::super::sample_data::get_template;
    use super::*;

    #[test]
    fn test_sample_project_error_display() {
        let err = SampleProjectError::Database(sqlx::Error::RowNotFound);
        let msg = format!("{}", err);
        assert!(msg.contains("Database error"), "got: {}", msg);
    }

    #[test]
    fn test_sample_project_error_debug() {
        let err = SampleProjectError::Database(sqlx::Error::RowNotFound);
        let debug = format!("{:?}", err);
        assert!(debug.contains("Database"), "got: {}", debug);
    }

    #[test]
    fn test_get_template_software() {
        let t = get_template("software");
        assert_eq!(t.project_name, "Sprint Project");
        assert_eq!(t.columns.len(), 5);
        assert_eq!(t.tasks.len(), 8);
        assert_eq!(t.labels.len(), 3);
    }

    #[test]
    fn test_get_template_marketing() {
        let t = get_template("marketing");
        assert_eq!(t.project_name, "Campaign Tracker");
        assert_eq!(t.columns.len(), 5);
        assert_eq!(t.tasks.len(), 8);
        assert_eq!(t.labels.len(), 3);
    }

    #[test]
    fn test_get_template_personal() {
        let t = get_template("personal");
        assert_eq!(t.project_name, "My Projects");
        assert_eq!(t.columns.len(), 4);
        assert_eq!(t.tasks.len(), 8);
        assert_eq!(t.labels.len(), 3);
    }

    #[test]
    fn test_get_template_design() {
        let t = get_template("design");
        assert_eq!(t.project_name, "Design Sprint");
        assert_eq!(t.columns.len(), 5);
        assert_eq!(t.tasks.len(), 8);
        assert_eq!(t.labels.len(), 3);
    }

    #[test]
    fn test_get_template_unknown_defaults_to_software() {
        let t = get_template("unknown");
        assert_eq!(t.project_name, "Sprint Project");
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
    fn test_sample_project_error_from_sqlx() {
        let sqlx_err = sqlx::Error::RowNotFound;
        let err: SampleProjectError = sqlx_err.into();
        assert!(matches!(err, SampleProjectError::Database(_)));
    }
}
