use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// A reusable automation template (system-provided or user-created).
/// Templates define a trigger + action pair that can be enabled/disabled
/// per workspace and applied to specific projects.
#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct AutomationTemplate {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub category: String,
    pub trigger_type: String,
    pub trigger_config: serde_json::Value,
    pub action_type: String,
    pub action_config: serde_json::Value,
    pub enabled: bool,
    pub is_system: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request body for toggling a template on/off
#[derive(Debug, Deserialize)]
pub struct ToggleTemplateRequest {
    pub enabled: bool,
}

/// Request body for applying a template to a project
#[derive(Debug, Deserialize)]
pub struct ApplyTemplateRequest {
    pub project_id: Uuid,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_automation_template_serde_roundtrip() {
        let now = Utc::now();
        let template = AutomationTemplate {
            id: Uuid::new_v4(),
            workspace_id: Uuid::new_v4(),
            name: "Auto-assign on create".to_string(),
            description: Some("Assigns tasks to creator".to_string()),
            category: "task_management".to_string(),
            trigger_type: "task_created".to_string(),
            trigger_config: serde_json::json!({}),
            action_type: "assign_task".to_string(),
            action_config: serde_json::json!({"assign_to": "creator"}),
            enabled: true,
            is_system: true,
            created_at: now,
            updated_at: now,
        };

        let json = serde_json::to_string(&template).expect("serialize");
        let deserialized: AutomationTemplate = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(deserialized.id, template.id);
        assert_eq!(deserialized.name, "Auto-assign on create");
        assert!(deserialized.enabled);
        assert!(deserialized.is_system);
    }

    #[test]
    fn test_toggle_template_request_deserialize() {
        let json = r#"{"enabled": false}"#;
        let req: ToggleTemplateRequest = serde_json::from_str(json).expect("deserialize");
        assert!(!req.enabled);
    }

    #[test]
    fn test_apply_template_request_deserialize() {
        let project_id = Uuid::new_v4();
        let json = format!(r#"{{"project_id": "{}"}}"#, project_id);
        let req: ApplyTemplateRequest = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(req.project_id, project_id);
    }
}
