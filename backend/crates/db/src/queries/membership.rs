use sqlx::PgPool;
use uuid::Uuid;

/// Verify that a user is a member of a project.
/// Returns `true` if the user is a member, `false` otherwise.
///
/// This is the canonical membership check — all other modules should call this
/// instead of duplicating the query.
pub async fn verify_project_membership(
    pool: &PgPool,
    project_id: Uuid,
    user_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar::<_, bool>(
        r"
        SELECT EXISTS(
            SELECT 1 FROM project_members
            WHERE project_id = $1 AND user_id = $2
        )
        ",
    )
    .bind(project_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;
    Ok(result)
}
