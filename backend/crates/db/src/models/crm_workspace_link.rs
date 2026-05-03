use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct CrmWorkspaceLink {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub twenty_workspace_id: String,
    /// AES-256-GCM ciphertext (server-side wrapped). Optional — only required when
    /// TaskBolt server needs to call Twenty REST APIs (provisioning, sync).
    pub twenty_api_key_encrypted: Option<Vec<u8>>,
    pub twenty_oidc_client_id: String,
    /// AES-256-GCM ciphertext for the OIDC client_secret (validated at /token).
    pub twenty_oidc_client_secret_encrypted: Vec<u8>,
    pub valid_from: DateTime<Utc>,
    pub valid_to: Option<DateTime<Utc>>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub created_by_id: Uuid,
}

impl CrmWorkspaceLink {
    pub fn is_active(&self) -> bool {
        self.status == "active" && self.valid_to.is_none()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> CrmWorkspaceLink {
        let now = Utc::now();
        CrmWorkspaceLink {
            id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            twenty_workspace_id: "tw-ws-123".to_string(),
            twenty_api_key_encrypted: Some(vec![1, 2, 3]),
            twenty_oidc_client_id: "client-abc".to_string(),
            twenty_oidc_client_secret_encrypted: vec![9, 8, 7],
            valid_from: now,
            valid_to: None,
            status: "active".to_string(),
            created_at: now,
            created_by_id: Uuid::new_v4(),
        }
    }

    #[test]
    fn is_active_true_when_active_and_no_valid_to() {
        assert!(sample().is_active());
    }

    #[test]
    fn is_active_false_when_revoked() {
        let mut l = sample();
        l.status = "revoked".to_string();
        assert!(!l.is_active());
    }

    #[test]
    fn is_active_false_when_expired() {
        let mut l = sample();
        l.valid_to = Some(Utc::now());
        assert!(!l.is_active());
    }

    #[test]
    fn serde_roundtrip() {
        let l = sample();
        let json = serde_json::to_string(&l).expect("serialize");
        let back: CrmWorkspaceLink = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(back.twenty_workspace_id, l.twenty_workspace_id);
        assert_eq!(back.twenty_oidc_client_id, l.twenty_oidc_client_id);
    }
}
