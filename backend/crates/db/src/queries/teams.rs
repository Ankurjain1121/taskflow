//! Team query functions

use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::Team;

/// Team with member count for list views
#[derive(sqlx::FromRow, Serialize, Clone, Debug)]
pub struct TeamWithMemberCount {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub color: String,
    pub workspace_id: Uuid,
    pub member_count: i64,
    pub created_at: DateTime<Utc>,
}

/// Team member with user details
#[derive(sqlx::FromRow, Serialize, Clone, Debug)]
pub struct TeamMemberWithUser {
    pub id: Uuid,
    pub team_id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub email: String,
    pub avatar_url: Option<String>,
    pub added_at: DateTime<Utc>,
}

/// List all teams in a workspace with member counts
pub async fn list_teams_by_workspace(
    pool: &PgPool,
    workspace_id: Uuid,
) -> Result<Vec<TeamWithMemberCount>, sqlx::Error> {
    sqlx::query_as::<_, TeamWithMemberCount>(
        r#"
        SELECT t.id, t.name, t.description, t.color, t.workspace_id,
               COUNT(tm.id)::bigint AS member_count,
               t.created_at
        FROM teams t
        LEFT JOIN team_members tm ON t.id = tm.team_id
        WHERE t.workspace_id = $1
        GROUP BY t.id
        ORDER BY t.name ASC
        "#,
    )
    .bind(workspace_id)
    .fetch_all(pool)
    .await
}

/// Get a team by ID
pub async fn get_team_by_id(pool: &PgPool, team_id: Uuid) -> Result<Option<Team>, sqlx::Error> {
    sqlx::query_as::<_, Team>(
        r#"
        SELECT id, name, description, color, workspace_id, created_by_id,
               created_at, updated_at
        FROM teams
        WHERE id = $1
        "#,
    )
    .bind(team_id)
    .fetch_optional(pool)
    .await
}

/// Create a new team
pub async fn create_team(
    pool: &PgPool,
    name: &str,
    description: Option<&str>,
    color: &str,
    workspace_id: Uuid,
    created_by_id: Uuid,
) -> Result<Team, sqlx::Error> {
    sqlx::query_as::<_, Team>(
        r#"
        INSERT INTO teams (name, description, color, workspace_id, created_by_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, description, color, workspace_id, created_by_id,
                  created_at, updated_at
        "#,
    )
    .bind(name)
    .bind(description)
    .bind(color)
    .bind(workspace_id)
    .bind(created_by_id)
    .fetch_one(pool)
    .await
}

/// Update a team
pub async fn update_team(
    pool: &PgPool,
    team_id: Uuid,
    name: &str,
    description: Option<&str>,
    color: &str,
) -> Result<Option<Team>, sqlx::Error> {
    sqlx::query_as::<_, Team>(
        r#"
        UPDATE teams
        SET name = $2, description = $3, color = $4, updated_at = now()
        WHERE id = $1
        RETURNING id, name, description, color, workspace_id, created_by_id,
                  created_at, updated_at
        "#,
    )
    .bind(team_id)
    .bind(name)
    .bind(description)
    .bind(color)
    .fetch_optional(pool)
    .await
}

/// Delete a team
pub async fn delete_team(pool: &PgPool, team_id: Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        r#"
        DELETE FROM teams WHERE id = $1
        "#,
    )
    .bind(team_id)
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}

/// List members of a team with user details
pub async fn list_team_members(
    pool: &PgPool,
    team_id: Uuid,
) -> Result<Vec<TeamMemberWithUser>, sqlx::Error> {
    sqlx::query_as::<_, TeamMemberWithUser>(
        r#"
        SELECT tm.id, tm.team_id, tm.user_id, u.name, u.email, u.avatar_url, tm.added_at
        FROM team_members tm
        INNER JOIN users u ON tm.user_id = u.id
        WHERE tm.team_id = $1
          AND u.deleted_at IS NULL
        ORDER BY tm.added_at ASC
        "#,
    )
    .bind(team_id)
    .fetch_all(pool)
    .await
}

/// Add a member to a team
pub async fn add_team_member(
    pool: &PgPool,
    team_id: Uuid,
    user_id: Uuid,
) -> Result<crate::models::TeamMember, sqlx::Error> {
    sqlx::query_as::<_, crate::models::TeamMember>(
        r#"
        INSERT INTO team_members (team_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (team_id, user_id) DO UPDATE SET added_at = team_members.added_at
        RETURNING id, team_id, user_id, added_at
        "#,
    )
    .bind(team_id)
    .bind(user_id)
    .fetch_one(pool)
    .await
}

/// Remove a member from a team
pub async fn remove_team_member(
    pool: &PgPool,
    team_id: Uuid,
    user_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        r#"
        DELETE FROM team_members WHERE team_id = $1 AND user_id = $2
        "#,
    )
    .bind(team_id)
    .bind(user_id)
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}
