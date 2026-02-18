use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::PgConnection;
use uuid::Uuid;
use crate::models::common::ActivityAction;

#[derive(sqlx::FromRow, Serialize)]
pub struct ActivityEntry {
    pub id: Uuid,
    pub action: ActivityAction,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub user_id: Option<Uuid>,
    pub user_name: Option<String>,
    pub metadata: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

pub async fn log_activity(
    conn: &mut PgConnection,
    action: ActivityAction,
    entity_type: &str,
    entity_id: Uuid,
    user_id: Uuid,
    metadata: Option<serde_json::Value>,
    tenant_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO activity_log (action, entity_type, entity_id, user_id, metadata, tenant_id) \
         VALUES ($1, $2, $3, $4, $5, $6)"
    )
    .bind(action)
    .bind(entity_type)
    .bind(entity_id)
    .bind(user_id)
    .bind(metadata)
    .bind(tenant_id)
    .execute(&mut *conn)
    .await?;
    Ok(())
}

pub async fn list_activity_by_workspace(
    conn: &mut PgConnection,
    workspace_id: Uuid,
    limit: i64,
    offset: i64,
) -> Result<Vec<ActivityEntry>, sqlx::Error> {
    // Join with users for user_name, filter by workspace's tenant
    sqlx::query_as::<_, ActivityEntry>(
        "SELECT a.id, a.action, a.entity_type, a.entity_id, a.user_id, u.name as user_name, a.metadata, a.created_at \
         FROM activity_log a \
         LEFT JOIN users u ON u.id = a.user_id \
         WHERE a.tenant_id = (SELECT tenant_id FROM workspaces WHERE id = $1) \
         ORDER BY a.created_at DESC \
         LIMIT $2 OFFSET $3"
    )
    .bind(workspace_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&mut *conn)
    .await
}
