use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct Tenant {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub plan: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tenant_serde_roundtrip() {
        let now = Utc::now();
        let tenant = Tenant {
            id: Uuid::new_v4(),
            name: "Acme Corp".to_string(),
            slug: "acme-corp".to_string(),
            plan: "pro".to_string(),
            created_at: now,
            updated_at: now,
        };
        let json = serde_json::to_string(&tenant).unwrap();
        let deserialized: Tenant = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.name, "Acme Corp");
        assert_eq!(deserialized.slug, "acme-corp");
        assert_eq!(deserialized.plan, "pro");
    }

    #[test]
    fn test_tenant_json_fields() {
        let now = Utc::now();
        let tenant = Tenant {
            id: Uuid::new_v4(),
            name: "Test".to_string(),
            slug: "test".to_string(),
            plan: "free".to_string(),
            created_at: now,
            updated_at: now,
        };
        let parsed: serde_json::Value = serde_json::to_value(&tenant).unwrap();
        assert!(parsed.get("id").is_some());
        assert!(parsed.get("name").is_some());
        assert!(parsed.get("slug").is_some());
        assert!(parsed.get("plan").is_some());
    }
}
