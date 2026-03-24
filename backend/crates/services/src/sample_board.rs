//! Sample board generation service
//!
//! Creates a use-case-specific sample board with columns, tasks, subtasks,
//! labels, and due dates to help new users see TaskBolt in action.

use sqlx::PgPool;
use uuid::Uuid;

/// Error type for sample board generation
#[derive(Debug, thiserror::Error)]
pub enum SampleBoardError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Not implemented: {0}")]
    NotImplemented(String),
}

// ============================================================================
// Board generation
// ============================================================================

/// Generate a sample project based on the selected use case.
///
/// NOTE: This function needs to be updated for the new projects architecture
/// (project_statuses, task_lists, status_id). Currently returns an error.
/// Use the onboarding flow without sample data until this is migrated.
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
#[allow(unused_variables)]
pub async fn generate_sample_board(
    pool: &PgPool,
    workspace_id: Uuid,
    created_by_id: Uuid,
    tenant_id: Uuid,
    use_case: &str,
) -> Result<Uuid, SampleBoardError> {
    // TODO: Rewrite for new schema (project_statuses, task_lists, status_id).
    // board_columns and column_id were dropped in migration 20260316000001.
    Err(SampleBoardError::NotImplemented(
        "Sample board generation needs migration to new schema (project_statuses, task_lists, status_id)".to_string(),
    ))
}

#[cfg(test)]
mod tests {
    use super::super::sample_data::get_template;
    use super::*;

    #[test]
    fn test_sample_board_error_display() {
        let err = SampleBoardError::NotImplemented("test".to_string());
        let msg = format!("{}", err);
        assert!(msg.contains("Not implemented"), "got: {}", msg);
    }

    #[test]
    fn test_sample_board_error_debug() {
        let err = SampleBoardError::NotImplemented("test".to_string());
        let debug = format!("{:?}", err);
        assert!(debug.contains("NotImplemented"), "got: {}", debug);
    }

    #[test]
    fn test_get_template_software() {
        let t = get_template("software");
        assert_eq!(t.board_name, "Dev Board");
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
        assert_eq!(t.board_name, "Design Board");
        assert_eq!(t.columns.len(), 5);
        assert_eq!(t.tasks.len(), 8);
        assert_eq!(t.labels.len(), 3);
    }

    #[test]
    fn test_get_template_unknown_defaults_to_software() {
        let t = get_template("unknown");
        assert_eq!(t.board_name, "Dev Board");
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
