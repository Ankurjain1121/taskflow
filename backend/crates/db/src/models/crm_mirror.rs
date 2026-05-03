use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Maps a TaskBolt tenant to a Twenty workspace + encrypted HMAC shared secret.
#[derive(Debug, Clone, FromRow)]
pub struct CrmWorkspaceLink {
    pub tenant_id: Uuid,
    pub twenty_workspace_id: String,
    pub hmac_secret_encrypted: Vec<u8>,
}

/// Mirror of a Twenty `person` record (contact).
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CrmContactMirror {
    pub tenant_id: Uuid,
    pub twenty_workspace_id: String,
    pub twenty_id: Uuid,
    pub name: Option<String>,
    pub primary_email: Option<String>,
    pub primary_phone: Option<String>,
    pub owner_twenty_id: Option<String>,
    pub raw_json: serde_json::Value,
    pub parsed_projection: Option<serde_json::Value>,
    pub source_schema_version: i32,
    pub twenty_updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

/// Mirror of a Twenty `company` record.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CrmCompanyMirror {
    pub tenant_id: Uuid,
    pub twenty_workspace_id: String,
    pub twenty_id: Uuid,
    pub name: Option<String>,
    pub primary_email: Option<String>,
    pub primary_phone: Option<String>,
    pub owner_twenty_id: Option<String>,
    pub raw_json: serde_json::Value,
    pub parsed_projection: Option<serde_json::Value>,
    pub source_schema_version: i32,
    pub twenty_updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

/// Mirror of a Twenty `opportunity` record (deal).
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CrmDealMirror {
    pub tenant_id: Uuid,
    pub twenty_workspace_id: String,
    pub twenty_id: Uuid,
    pub name: Option<String>,
    pub stage: Option<String>,
    pub amount_cents: Option<i64>,
    pub owner_twenty_id: Option<String>,
    pub raw_json: serde_json::Value,
    pub parsed_projection: Option<serde_json::Value>,
    pub source_schema_version: i32,
    pub twenty_updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

/// Per-event idempotency log.  Duplicate detection: insert ON CONFLICT DO NOTHING,
/// then check rows_affected == 0 → duplicate.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CrmWebhookEventLog {
    pub workspace_id: String,
    pub event_id: String,
    pub received_at: DateTime<Utc>,
    pub processed_at: Option<DateTime<Utc>>,
    pub status: String,
    pub event_type: String,
    pub payload_hash: String,
    pub tenant_id: Uuid,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn crm_contact_serde_roundtrip() {
        let now = Utc::now();
        let contact = CrmContactMirror {
            tenant_id: Uuid::new_v4(),
            twenty_workspace_id: "ws-1".into(),
            twenty_id: Uuid::new_v4(),
            name: Some("Alice".into()),
            primary_email: Some("alice@example.com".into()),
            primary_phone: None,
            owner_twenty_id: None,
            raw_json: serde_json::json!({"id": "abc"}),
            parsed_projection: None,
            source_schema_version: 1,
            twenty_updated_at: now,
            deleted_at: None,
        };
        let json = serde_json::to_string(&contact).unwrap();
        let back: CrmContactMirror = serde_json::from_str(&json).unwrap();
        assert_eq!(back.name, Some("Alice".into()));
    }

    #[test]
    fn crm_deal_has_stage_and_amount() {
        let now = Utc::now();
        let deal = CrmDealMirror {
            tenant_id: Uuid::new_v4(),
            twenty_workspace_id: "ws-1".into(),
            twenty_id: Uuid::new_v4(),
            name: Some("Big Deal".into()),
            stage: Some("QUALIFIED".into()),
            amount_cents: Some(10_000_000),
            owner_twenty_id: None,
            raw_json: serde_json::json!({}),
            parsed_projection: None,
            source_schema_version: 1,
            twenty_updated_at: now,
            deleted_at: None,
        };
        assert_eq!(deal.stage, Some("QUALIFIED".into()));
        assert_eq!(deal.amount_cents, Some(10_000_000));
    }
}
