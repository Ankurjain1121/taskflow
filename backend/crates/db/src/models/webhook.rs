use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct Webhook {
    pub id: Uuid,
    pub project_id: Uuid,
    pub url: String,
    #[serde(skip_serializing)]
    pub secret: Option<String>,
    pub events: Vec<String>,
    pub is_active: bool,
    pub tenant_id: Uuid,
    pub created_by_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct WebhookDelivery {
    pub id: Uuid,
    pub webhook_id: Uuid,
    pub event_type: String,
    pub payload: serde_json::Value,
    pub response_status: Option<i32>,
    pub response_body: Option<String>,
    pub delivered_at: DateTime<Utc>,
    pub success: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_webhook_secret_skip_serializing() {
        let now = Utc::now();
        let webhook = Webhook {
            id: Uuid::new_v4(),
            project_id: Uuid::new_v4(),
            url: "https://example.com/webhook".to_string(),
            secret: Some("super_secret_key".to_string()),
            events: vec!["task_created".to_string(), "task_updated".to_string()],
            is_active: true,
            tenant_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            created_at: now,
            updated_at: now,
        };
        let json = serde_json::to_string(&webhook).unwrap();
        assert!(
            !json.contains("secret"),
            "secret must be excluded from serialization"
        );
        assert!(
            !json.contains("super_secret_key"),
            "secret value must not leak"
        );
    }

    #[test]
    fn test_webhook_serde_fields() {
        let now = Utc::now();
        let webhook = Webhook {
            id: Uuid::new_v4(),
            project_id: Uuid::new_v4(),
            url: "https://hooks.slack.com/abc".to_string(),
            secret: None,
            events: vec!["task_created".to_string()],
            is_active: true,
            tenant_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            created_at: now,
            updated_at: now,
        };
        let parsed: serde_json::Value = serde_json::to_value(&webhook).unwrap();
        assert_eq!(parsed["url"], "https://hooks.slack.com/abc");
        assert_eq!(parsed["is_active"], true);
        assert!(parsed["events"].is_array());
        assert_eq!(parsed["events"].as_array().unwrap().len(), 1);
        assert!(parsed.get("secret").is_none());
    }

    #[test]
    fn test_webhook_delivery_serde_roundtrip() {
        let now = Utc::now();
        let delivery = WebhookDelivery {
            id: Uuid::new_v4(),
            webhook_id: Uuid::new_v4(),
            event_type: "task_created".to_string(),
            payload: serde_json::json!({"task_id": "abc"}),
            response_status: Some(200),
            response_body: Some("OK".to_string()),
            delivered_at: now,
            success: true,
        };
        let json = serde_json::to_string(&delivery).unwrap();
        let deserialized: WebhookDelivery = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.event_type, "task_created");
        assert_eq!(deserialized.response_status, Some(200));
        assert!(deserialized.success);
    }

    #[test]
    fn test_webhook_delivery_failed() {
        let now = Utc::now();
        let delivery = WebhookDelivery {
            id: Uuid::new_v4(),
            webhook_id: Uuid::new_v4(),
            event_type: "task_deleted".to_string(),
            payload: serde_json::json!({}),
            response_status: Some(500),
            response_body: Some("Internal Server Error".to_string()),
            delivered_at: now,
            success: false,
        };
        let json = serde_json::to_string(&delivery).unwrap();
        let deserialized: WebhookDelivery = serde_json::from_str(&json).unwrap();
        assert!(!deserialized.success);
        assert_eq!(deserialized.response_status, Some(500));
    }

    #[test]
    fn test_webhook_delivery_no_response() {
        let now = Utc::now();
        let delivery = WebhookDelivery {
            id: Uuid::new_v4(),
            webhook_id: Uuid::new_v4(),
            event_type: "task_moved".to_string(),
            payload: serde_json::json!({"from": "A", "to": "B"}),
            response_status: None,
            response_body: None,
            delivered_at: now,
            success: false,
        };
        let json = serde_json::to_string(&delivery).unwrap();
        let deserialized: WebhookDelivery = serde_json::from_str(&json).unwrap();
        assert!(deserialized.response_status.is_none());
        assert!(deserialized.response_body.is_none());
    }

    #[test]
    fn test_webhook_clone() {
        let now = Utc::now();
        let webhook = Webhook {
            id: Uuid::new_v4(),
            project_id: Uuid::new_v4(),
            url: "https://example.com".to_string(),
            secret: Some("s".to_string()),
            events: vec!["a".to_string(), "b".to_string()],
            is_active: false,
            tenant_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            created_at: now,
            updated_at: now,
        };
        let cloned = webhook.clone();
        assert_eq!(cloned.id, webhook.id);
        assert_eq!(cloned.events, webhook.events);
        assert!(!cloned.is_active);
    }
}
