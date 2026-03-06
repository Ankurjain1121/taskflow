//! Task group query functions

use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{TaskGroup, TaskGroupWithStats};

/// List task groups for a project ordered by position
pub async fn list_task_groups_by_board(
    pool: &PgPool,
    project_id: Uuid,
) -> Result<Vec<TaskGroup>, sqlx::Error> {
    sqlx::query_as::<_, TaskGroup>(
        r#"
        SELECT id, project_id, name, color, position, collapsed,
               tenant_id, created_by_id, created_at, updated_at, deleted_at
        FROM task_groups
        WHERE project_id = $1 AND deleted_at IS NULL
        ORDER BY position ASC
        "#,
    )
    .bind(project_id)
    .fetch_all(pool)
    .await
}

/// List task groups with statistics (task count, completion, estimated hours)
pub async fn list_task_groups_with_stats(
    pool: &PgPool,
    project_id: Uuid,
) -> Result<Vec<TaskGroupWithStats>, sqlx::Error> {
    #[derive(sqlx::FromRow)]
    struct Row {
        id: Uuid,
        project_id: Uuid,
        name: String,
        color: String,
        position: String,
        collapsed: bool,
        tenant_id: Uuid,
        created_by_id: Uuid,
        created_at: chrono::DateTime<chrono::Utc>,
        updated_at: chrono::DateTime<chrono::Utc>,
        deleted_at: Option<chrono::DateTime<chrono::Utc>>,
        task_count: Option<i64>,
        completed_count: Option<i64>,
        estimated_hours: Option<f64>,
    }

    let rows: Vec<Row> = sqlx::query_as::<_, Row>(
        r#"
        SELECT
            tg.id, tg.project_id, tg.name, tg.color, tg.position, tg.collapsed,
            tg.tenant_id, tg.created_by_id, tg.created_at, tg.updated_at, tg.deleted_at,
            COUNT(t.id) as task_count,
            COUNT(CASE WHEN bc.status_mapping->>'done' = 'true' THEN 1 END) as completed_count,
            SUM(t.estimated_hours) as estimated_hours
        FROM task_groups tg
        LEFT JOIN tasks t ON t.group_id = tg.id AND t.deleted_at IS NULL
        LEFT JOIN project_columns bc ON t.column_id = bc.id
        WHERE tg.project_id = $1 AND tg.deleted_at IS NULL
        GROUP BY tg.id
        ORDER BY tg.position ASC
        "#,
    )
    .bind(project_id)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| TaskGroupWithStats {
            group: TaskGroup {
                id: row.id,
                project_id: row.project_id,
                name: row.name,
                color: row.color,
                position: row.position,
                collapsed: row.collapsed,
                tenant_id: row.tenant_id,
                created_by_id: row.created_by_id,
                created_at: row.created_at,
                updated_at: row.updated_at,
                deleted_at: row.deleted_at,
            },
            task_count: row.task_count.unwrap_or(0),
            completed_count: row.completed_count.unwrap_or(0),
            estimated_hours: row.estimated_hours,
        })
        .collect())
}

/// Get a task group by ID
pub async fn get_task_group_by_id(
    pool: &PgPool,
    id: Uuid,
) -> Result<Option<TaskGroup>, sqlx::Error> {
    sqlx::query_as::<_, TaskGroup>(
        r#"
        SELECT id, project_id, name, color, position, collapsed,
               tenant_id, created_by_id, created_at, updated_at, deleted_at
        FROM task_groups
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

/// Create a new task group
pub async fn create_task_group(
    pool: &PgPool,
    project_id: Uuid,
    name: &str,
    color: &str,
    position: &str,
    tenant_id: Uuid,
    created_by_id: Uuid,
) -> Result<TaskGroup, sqlx::Error> {
    sqlx::query_as::<_, TaskGroup>(
        r#"
        INSERT INTO task_groups (project_id, name, color, position, tenant_id, created_by_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, project_id, name, color, position, collapsed,
                  tenant_id, created_by_id, created_at, updated_at, deleted_at
        "#,
    )
    .bind(project_id)
    .bind(name)
    .bind(color)
    .bind(position)
    .bind(tenant_id)
    .bind(created_by_id)
    .fetch_one(pool)
    .await
}

/// Update task group name
pub async fn update_task_group_name(
    pool: &PgPool,
    id: Uuid,
    name: &str,
) -> Result<Option<TaskGroup>, sqlx::Error> {
    sqlx::query_as::<_, TaskGroup>(
        r#"
        UPDATE task_groups
        SET name = $2, updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id, project_id, name, color, position, collapsed,
                  tenant_id, created_by_id, created_at, updated_at, deleted_at
        "#,
    )
    .bind(id)
    .bind(name)
    .fetch_optional(pool)
    .await
}

/// Update task group color
pub async fn update_task_group_color(
    pool: &PgPool,
    id: Uuid,
    color: &str,
) -> Result<Option<TaskGroup>, sqlx::Error> {
    sqlx::query_as::<_, TaskGroup>(
        r#"
        UPDATE task_groups
        SET color = $2, updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id, project_id, name, color, position, collapsed,
                  tenant_id, created_by_id, created_at, updated_at, deleted_at
        "#,
    )
    .bind(id)
    .bind(color)
    .fetch_optional(pool)
    .await
}

/// Update task group position (for reordering)
pub async fn update_task_group_position(
    pool: &PgPool,
    id: Uuid,
    position: &str,
) -> Result<Option<TaskGroup>, sqlx::Error> {
    sqlx::query_as::<_, TaskGroup>(
        r#"
        UPDATE task_groups
        SET position = $2, updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id, project_id, name, color, position, collapsed,
                  tenant_id, created_by_id, created_at, updated_at, deleted_at
        "#,
    )
    .bind(id)
    .bind(position)
    .fetch_optional(pool)
    .await
}

/// Toggle task group collapsed state
pub async fn toggle_task_group_collapse(
    pool: &PgPool,
    id: Uuid,
    collapsed: bool,
) -> Result<Option<TaskGroup>, sqlx::Error> {
    sqlx::query_as::<_, TaskGroup>(
        r#"
        UPDATE task_groups
        SET collapsed = $2, updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id, project_id, name, color, position, collapsed,
                  tenant_id, created_by_id, created_at, updated_at, deleted_at
        "#,
    )
    .bind(id)
    .bind(collapsed)
    .fetch_optional(pool)
    .await
}

/// Soft delete a task group (moves tasks to "Ungrouped")
pub async fn soft_delete_task_group(
    pool: &PgPool,
    id: Uuid,
) -> Result<Option<TaskGroup>, sqlx::Error> {
    let mut tx = pool.begin().await?;

    // Move all tasks in this group to the "Ungrouped" group
    let project_id: Uuid = sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT project_id FROM task_groups WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    let ungrouped_id: Uuid = sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT id FROM task_groups
        WHERE project_id = $1 AND name = 'Ungrouped' AND deleted_at IS NULL
        "#,
    )
    .bind(project_id)
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query(
        r#"
        UPDATE tasks
        SET group_id = $2
        WHERE group_id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(id)
    .bind(ungrouped_id)
    .execute(&mut *tx)
    .await?;

    // Soft delete the group
    let group = sqlx::query_as::<_, TaskGroup>(
        r#"
        UPDATE task_groups
        SET deleted_at = NOW()
        WHERE id = $1
        RETURNING id, project_id, name, color, position, collapsed,
                  tenant_id, created_by_id, created_at, updated_at, deleted_at
        "#,
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(group)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::queries::{auth, projects, workspaces};

    const FAKE_HASH: &str = "$argon2id$v=19$m=19456,t=2,p=1$fake_salt$fake_hash_for_test";

    async fn test_pool() -> PgPool {
        PgPool::connect(
            "postgresql://taskflow:189015388bb0f90c999ea6b975d7e494@localhost:5433/taskflow",
        )
        .await
        .expect("Failed to connect to test database")
    }

    fn unique_email() -> String {
        format!("inttest-tg-{}@example.com", Uuid::new_v4())
    }

    async fn setup_user(pool: &PgPool) -> (Uuid, Uuid) {
        let user = auth::create_user_with_tenant(pool, &unique_email(), "TG Test User", FAKE_HASH)
            .await
            .expect("create_user_with_tenant");
        (user.tenant_id, user.id)
    }

    async fn setup_user_and_workspace(pool: &PgPool) -> (Uuid, Uuid, Uuid) {
        let (tenant_id, user_id) = setup_user(pool).await;
        let ws = workspaces::create_workspace(pool, "TG Test WS", None, tenant_id, user_id)
            .await
            .expect("create_workspace");
        (tenant_id, user_id, ws.id)
    }

    async fn setup_full(pool: &PgPool) -> (Uuid, Uuid, Uuid, Uuid, Uuid) {
        let (tenant_id, user_id, ws_id) = setup_user_and_workspace(pool).await;
        let bwc =
            projects::create_project(pool, "TG Test Project", None, ws_id, tenant_id, user_id)
                .await
                .expect("create_project");
        let first_col_id = bwc.columns[0].id;
        (tenant_id, user_id, ws_id, bwc.project.id, first_col_id)
    }

    #[tokio::test]
    async fn test_create_task_group() {
        let pool = test_pool().await;
        let (tenant_id, user_id, _ws_id, project_id, _col_id) = setup_full(&pool).await;

        let group = create_task_group(
            &pool, project_id, "Sprint 1", "#ff5722", "a1", tenant_id, user_id,
        )
        .await
        .expect("create_task_group");

        assert_eq!(group.project_id, project_id);
        assert_eq!(group.name, "Sprint 1");
        assert_eq!(group.color, "#ff5722");
        assert_eq!(group.position, "a1");
        assert!(!group.collapsed);
        assert_eq!(group.tenant_id, tenant_id);
        assert_eq!(group.created_by_id, user_id);
        assert!(group.deleted_at.is_none());
    }

    #[tokio::test]
    async fn test_list_task_groups_by_board() {
        let pool = test_pool().await;
        let (tenant_id, user_id, _ws_id, project_id, _col_id) = setup_full(&pool).await;

        create_task_group(
            &pool, project_id, "Group A", "#111111", "a1", tenant_id, user_id,
        )
        .await
        .expect("create group A");

        create_task_group(
            &pool, project_id, "Group B", "#222222", "a2", tenant_id, user_id,
        )
        .await
        .expect("create group B");

        let groups = list_task_groups_by_board(&pool, project_id)
            .await
            .expect("list_task_groups_by_board");

        // At minimum: Ungrouped (created by create_project) + our 2
        assert!(groups.len() >= 2);
        let names: Vec<&str> = groups.iter().map(|g| g.name.as_str()).collect();
        assert!(names.contains(&"Group A"));
        assert!(names.contains(&"Group B"));
    }

    #[tokio::test]
    async fn test_get_task_group_by_id() {
        let pool = test_pool().await;
        let (tenant_id, user_id, _ws_id, project_id, _col_id) = setup_full(&pool).await;

        let group = create_task_group(
            &pool, project_id, "Find Me", "#333333", "b1", tenant_id, user_id,
        )
        .await
        .expect("create group");

        let found = get_task_group_by_id(&pool, group.id)
            .await
            .expect("get_task_group_by_id")
            .expect("should find group");

        assert_eq!(found.id, group.id);
        assert_eq!(found.name, "Find Me");
    }

    #[tokio::test]
    async fn test_update_task_group_name() {
        let pool = test_pool().await;
        let (tenant_id, user_id, _ws_id, project_id, _col_id) = setup_full(&pool).await;

        let group = create_task_group(
            &pool, project_id, "Old Name", "#444444", "c1", tenant_id, user_id,
        )
        .await
        .expect("create group");

        let updated = update_task_group_name(&pool, group.id, "New Name")
            .await
            .expect("update_task_group_name")
            .expect("should return updated group");

        assert_eq!(updated.name, "New Name");
        assert_eq!(updated.id, group.id);
    }

    #[tokio::test]
    async fn test_update_task_group_color() {
        let pool = test_pool().await;
        let (tenant_id, user_id, _ws_id, project_id, _col_id) = setup_full(&pool).await;

        let group = create_task_group(
            &pool,
            project_id,
            "Color Test",
            "#000000",
            "d1",
            tenant_id,
            user_id,
        )
        .await
        .expect("create group");

        let updated = update_task_group_color(&pool, group.id, "#ff0000")
            .await
            .expect("update_task_group_color")
            .expect("should return updated group");

        assert_eq!(updated.color, "#ff0000");
    }

    #[tokio::test]
    async fn test_update_task_group_position() {
        let pool = test_pool().await;
        let (tenant_id, user_id, _ws_id, project_id, _col_id) = setup_full(&pool).await;

        let group = create_task_group(
            &pool,
            project_id,
            "Position Test",
            "#555555",
            "e1",
            tenant_id,
            user_id,
        )
        .await
        .expect("create group");

        let updated = update_task_group_position(&pool, group.id, "z9")
            .await
            .expect("update_task_group_position")
            .expect("should return updated group");

        assert_eq!(updated.position, "z9");
    }

    #[tokio::test]
    async fn test_toggle_task_group_collapse() {
        let pool = test_pool().await;
        let (tenant_id, user_id, _ws_id, project_id, _col_id) = setup_full(&pool).await;

        let group = create_task_group(
            &pool,
            project_id,
            "Collapse Test",
            "#666666",
            "f1",
            tenant_id,
            user_id,
        )
        .await
        .expect("create group");

        assert!(!group.collapsed);

        let toggled = toggle_task_group_collapse(&pool, group.id, true)
            .await
            .expect("toggle collapse")
            .expect("should return toggled group");

        assert!(toggled.collapsed);

        let toggled_back = toggle_task_group_collapse(&pool, group.id, false)
            .await
            .expect("toggle collapse back")
            .expect("should return toggled group");

        assert!(!toggled_back.collapsed);
    }

    #[tokio::test]
    async fn test_soft_delete_task_group() {
        let pool = test_pool().await;
        let (tenant_id, user_id, _ws_id, project_id, _col_id) = setup_full(&pool).await;

        let group = create_task_group(
            &pool,
            project_id,
            "Delete Me",
            "#777777",
            "g1",
            tenant_id,
            user_id,
        )
        .await
        .expect("create group");

        let deleted = soft_delete_task_group(&pool, group.id)
            .await
            .expect("soft_delete_task_group")
            .expect("should return deleted group");

        assert!(deleted.deleted_at.is_some());

        // Should not appear in list
        let groups = list_task_groups_by_board(&pool, project_id)
            .await
            .expect("list after delete");
        assert!(
            !groups.iter().any(|g| g.id == group.id),
            "soft-deleted group should not appear in list"
        );

        // Should not be found by get
        let found = get_task_group_by_id(&pool, group.id)
            .await
            .expect("get after delete");
        assert!(found.is_none(), "soft-deleted group should not be found");
    }

    #[tokio::test]
    async fn test_list_task_groups_with_stats() {
        let pool = test_pool().await;
        let (tenant_id, user_id, _ws_id, project_id, _col_id) = setup_full(&pool).await;

        create_task_group(
            &pool,
            project_id,
            "Stats Group",
            "#888888",
            "h1",
            tenant_id,
            user_id,
        )
        .await
        .expect("create group for stats");

        let stats = list_task_groups_with_stats(&pool, project_id)
            .await
            .expect("list_task_groups_with_stats");

        assert!(!stats.is_empty());
        let stats_group = stats.iter().find(|s| s.group.name == "Stats Group");
        assert!(stats_group.is_some(), "should find the stats group");
        let sg = stats_group.expect("stats group");
        assert_eq!(sg.task_count, 0);
        assert_eq!(sg.completed_count, 0);
    }
}
