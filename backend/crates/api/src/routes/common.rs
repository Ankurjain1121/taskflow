use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::{AppError, Result};

#[derive(Debug, Serialize)]
pub struct MessageResponse {
    pub message: String,
}

/// Verify that a user is a member of a project.
/// Returns `Ok(())` if the user is a member, or `Err(AppError::Forbidden)` otherwise.
pub async fn verify_project_membership(
    pool: &PgPool,
    project_id: Uuid,
    user_id: Uuid,
) -> Result<()> {
    let is_member = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM project_members
            WHERE project_id = $1 AND user_id = $2
        ) as "exists!"
        "#,
        project_id,
        user_id
    )
    .fetch_one(pool)
    .await?;

    if !is_member {
        return Err(AppError::Forbidden("Not a board member".into()));
    }

    Ok(())
}
