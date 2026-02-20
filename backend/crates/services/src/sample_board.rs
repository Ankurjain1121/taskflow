//! Sample board generation service
//!
//! Creates a "Getting Started" board with default columns, tasks, and labels
//! to help new users understand the Kanban workflow.

use serde_json;
use sqlx::PgPool;
use uuid::Uuid;

/// Error type for sample board generation
#[derive(Debug, thiserror::Error)]
pub enum SampleBoardError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
}

/// Generate a sample "Getting Started" board with default columns, tasks, and labels.
///
/// Creates in a single transaction:
/// - Board named "Getting Started"
/// - 4 columns: Backlog, To Do, In Progress, Done
/// - 6 sample tasks distributed across columns
/// - 3 labels: Tutorial, Quick Win, Important
/// - Attaches "Tutorial" label to all tasks
/// - Adds creator as board member with "editor" role
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `workspace_id` - The workspace to create the board in
/// * `created_by_id` - The user creating the board
/// * `tenant_id` - The tenant ID
///
/// # Returns
/// The UUID of the created board
pub async fn generate_sample_board(
    pool: &PgPool,
    workspace_id: Uuid,
    created_by_id: Uuid,
    tenant_id: Uuid,
) -> Result<Uuid, SampleBoardError> {
    let mut tx = pool.begin().await?;

    // 1. Create the board
    let board_id = Uuid::new_v4();
    sqlx::query!(
        r#"
        INSERT INTO boards (id, name, description, workspace_id, tenant_id, created_by_id)
        VALUES ($1, 'Getting Started', 'Your first Kanban board to help you learn TaskFlow', $2, $3, $4)
        "#,
        board_id,
        workspace_id,
        tenant_id,
        created_by_id
    )
    .execute(&mut *tx)
    .await?;

    // 2. Create the 4 columns
    let backlog_id = Uuid::new_v4();
    let todo_id = Uuid::new_v4();
    let in_progress_id = Uuid::new_v4();
    let done_id = Uuid::new_v4();

    // Backlog column
    sqlx::query!(
        r#"
        INSERT INTO board_columns (id, name, board_id, position, color, status_mapping)
        VALUES ($1, 'Backlog', $2, 'a0', '#94a3b8', NULL)
        "#,
        backlog_id,
        board_id
    )
    .execute(&mut *tx)
    .await?;

    // To Do column
    sqlx::query!(
        r#"
        INSERT INTO board_columns (id, name, board_id, position, color, status_mapping)
        VALUES ($1, 'To Do', $2, 'a1', '#6366f1', NULL)
        "#,
        todo_id,
        board_id
    )
    .execute(&mut *tx)
    .await?;

    // In Progress column
    sqlx::query!(
        r#"
        INSERT INTO board_columns (id, name, board_id, position, color, status_mapping)
        VALUES ($1, 'In Progress', $2, 'a2', '#3b82f6', NULL)
        "#,
        in_progress_id,
        board_id
    )
    .execute(&mut *tx)
    .await?;

    // Done column (with status_mapping indicating done)
    let done_status = serde_json::json!({"done": true});
    sqlx::query!(
        r#"
        INSERT INTO board_columns (id, name, board_id, position, color, status_mapping)
        VALUES ($1, 'Done', $2, 'a3', '#22c55e', $3)
        "#,
        done_id,
        board_id,
        done_status
    )
    .execute(&mut *tx)
    .await?;

    // 3. Add creator as board member with editor role
    sqlx::query!(
        r#"
        INSERT INTO board_members (id, board_id, user_id, role)
        VALUES ($1, $2, $3, 'editor')
        "#,
        Uuid::new_v4(),
        board_id,
        created_by_id
    )
    .execute(&mut *tx)
    .await?;

    // 4. Create 6 sample tasks
    // Task struct for easier iteration
    struct SampleTask {
        id: Uuid,
        title: &'static str,
        column_id: Uuid,
        priority: &'static str,
        position: &'static str,
    }

    let tasks = vec![
        SampleTask {
            id: Uuid::new_v4(),
            title: "Explore the Kanban board",
            column_id: backlog_id,
            priority: "low",
            position: "a0",
        },
        SampleTask {
            id: Uuid::new_v4(),
            title: "Invite your team members",
            column_id: todo_id,
            priority: "medium",
            position: "a0",
        },
        SampleTask {
            id: Uuid::new_v4(),
            title: "Create your first real task",
            column_id: todo_id,
            priority: "medium",
            position: "a1",
        },
        SampleTask {
            id: Uuid::new_v4(),
            title: "Try dragging tasks between columns",
            column_id: in_progress_id,
            priority: "high",
            position: "a0",
        },
        SampleTask {
            id: Uuid::new_v4(),
            title: "Set task priorities and due dates",
            column_id: in_progress_id,
            priority: "medium",
            position: "a1",
        },
        SampleTask {
            id: Uuid::new_v4(),
            title: "Complete onboarding",
            column_id: done_id,
            priority: "low",
            position: "a0",
        },
    ];

    for task in &tasks {
        sqlx::query(
            r#"
            INSERT INTO tasks (id, title, board_id, column_id, priority, position, tenant_id, created_by_id)
            VALUES ($1, $2, $3, $4, $5::task_priority, $6, $7, $8)
            "#,
        )
        .bind(task.id)
        .bind(task.title)
        .bind(board_id)
        .bind(task.column_id)
        .bind(task.priority)
        .bind(task.position)
        .bind(tenant_id)
        .bind(created_by_id)
        .execute(&mut *tx)
        .await?;
    }

    // 5. Create 3 labels
    let tutorial_label_id = Uuid::new_v4();
    let quick_win_label_id = Uuid::new_v4();
    let important_label_id = Uuid::new_v4();

    // Tutorial label (purple)
    sqlx::query!(
        r#"
        INSERT INTO labels (id, name, color, board_id)
        VALUES ($1, 'Tutorial', '#8b5cf6', $2)
        "#,
        tutorial_label_id,
        board_id
    )
    .execute(&mut *tx)
    .await?;

    // Quick Win label (green)
    sqlx::query!(
        r#"
        INSERT INTO labels (id, name, color, board_id)
        VALUES ($1, 'Quick Win', '#22c55e', $2)
        "#,
        quick_win_label_id,
        board_id
    )
    .execute(&mut *tx)
    .await?;

    // Important label (red)
    sqlx::query!(
        r#"
        INSERT INTO labels (id, name, color, board_id)
        VALUES ($1, 'Important', '#ef4444', $2)
        "#,
        important_label_id,
        board_id
    )
    .execute(&mut *tx)
    .await?;

    // 6. Attach Tutorial label to all tasks
    for task in &tasks {
        sqlx::query!(
            r#"
            INSERT INTO task_labels (id, task_id, label_id)
            VALUES ($1, $2, $3)
            "#,
            Uuid::new_v4(),
            task.id,
            tutorial_label_id
        )
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    Ok(board_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sample_board_error_display() {
        // Verify the Display trait output for SampleBoardError
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
    fn test_done_status_mapping_json() {
        let done_status = serde_json::json!({"done": true});
        assert_eq!(done_status["done"], true);
    }

    #[test]
    fn test_sample_board_column_colors_are_valid_hex() {
        let colors = ["#94a3b8", "#6366f1", "#3b82f6", "#22c55e"];
        for color in colors {
            assert!(color.starts_with('#'), "Color '{}' missing # prefix", color);
            assert_eq!(
                color.len(),
                7,
                "Color '{}' should be 7 chars (#RRGGBB)",
                color
            );
            assert!(
                color[1..].chars().all(|c| c.is_ascii_hexdigit()),
                "Color '{}' contains non-hex chars",
                color
            );
        }
    }

    #[test]
    fn test_sample_board_label_colors_are_valid_hex() {
        let label_colors = ["#8b5cf6", "#22c55e", "#ef4444"];
        for color in label_colors {
            assert!(color.starts_with('#'), "Color '{}' missing # prefix", color);
            assert_eq!(
                color.len(),
                7,
                "Color '{}' should be 7 chars (#RRGGBB)",
                color
            );
            assert!(
                color[1..].chars().all(|c| c.is_ascii_hexdigit()),
                "Color '{}' contains non-hex chars",
                color
            );
        }
    }

    #[test]
    fn test_sample_board_positions_are_lexicographically_ordered() {
        // Positions for the 4 columns: a0, a1, a2, a3
        let positions = ["a0", "a1", "a2", "a3"];
        for i in 0..positions.len() - 1 {
            assert!(
                positions[i] < positions[i + 1],
                "Position '{}' should be < '{}'",
                positions[i],
                positions[i + 1]
            );
        }
    }
}
