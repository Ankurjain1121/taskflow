//! Trigger matching logic for automation rules
//!
//! Determines whether a trigger's config conditions match the current execution context.

use uuid::Uuid;

use super::TriggerContext;

/// Check if the trigger_config conditions match the current context.
///
/// trigger_config is a JSON object with optional fields like:
/// - `source_column_id`: for TaskMoved, only fire if moved FROM this column
/// - `target_column_id`: for TaskMoved, only fire if moved TO this column
/// - `priority`: for TaskPriorityChanged, only fire for this priority
pub(crate) fn matches_trigger_config(config: &serde_json::Value, context: &TriggerContext) -> bool {
    let obj = match config.as_object() {
        Some(obj) => obj,
        None => return true, // Empty/null config means always match
    };

    // If empty object, match everything
    if obj.is_empty() {
        return true;
    }

    // Check source_column_id (TaskMoved)
    if let Some(source_col) = obj.get("source_column_id").and_then(|v| v.as_str()) {
        if let Ok(expected) = source_col.parse::<Uuid>() {
            if let Some(prev) = context.previous_status_id {
                if prev != expected {
                    return false;
                }
            }
        }
    }

    // Check target_column_id (TaskMoved)
    if let Some(target_col) = obj.get("target_column_id").and_then(|v| v.as_str()) {
        if let Ok(expected) = target_col.parse::<Uuid>() {
            if let Some(new) = context.new_status_id {
                if new != expected {
                    return false;
                }
            }
        }
    }

    // Check priority (TaskPriorityChanged)
    if let Some(expected_priority) = obj.get("priority").and_then(|v| v.as_str()) {
        if let Some(ref actual) = context.priority {
            if actual != expected_priority {
                return false;
            }
        }
    }

    true
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn make_context() -> TriggerContext {
        TriggerContext {
            task_id: Uuid::new_v4(),
            board_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            previous_status_id: None,
            new_status_id: None,
            priority: None,
            member_user_id: None,
        }
    }

    #[test]
    fn test_matches_trigger_config_null_config() {
        let config = json!(null);
        let ctx = make_context();
        assert!(matches_trigger_config(&config, &ctx));
    }

    #[test]
    fn test_matches_trigger_config_empty_object() {
        let config = json!({});
        let ctx = make_context();
        assert!(matches_trigger_config(&config, &ctx));
    }

    #[test]
    fn test_matches_trigger_config_source_column_match() {
        let col_id = Uuid::new_v4();
        let config = json!({"source_column_id": col_id.to_string()});
        let mut ctx = make_context();
        ctx.previous_status_id = Some(col_id);
        assert!(matches_trigger_config(&config, &ctx));
    }

    #[test]
    fn test_matches_trigger_config_source_column_mismatch() {
        let col_id = Uuid::new_v4();
        let other_col = Uuid::new_v4();
        let config = json!({"source_column_id": col_id.to_string()});
        let mut ctx = make_context();
        ctx.previous_status_id = Some(other_col);
        assert!(!matches_trigger_config(&config, &ctx));
    }

    #[test]
    fn test_matches_trigger_config_target_column_match() {
        let col_id = Uuid::new_v4();
        let config = json!({"target_column_id": col_id.to_string()});
        let mut ctx = make_context();
        ctx.new_status_id = Some(col_id);
        assert!(matches_trigger_config(&config, &ctx));
    }

    #[test]
    fn test_matches_trigger_config_target_column_mismatch() {
        let col_id = Uuid::new_v4();
        let other_col = Uuid::new_v4();
        let config = json!({"target_column_id": col_id.to_string()});
        let mut ctx = make_context();
        ctx.new_status_id = Some(other_col);
        assert!(!matches_trigger_config(&config, &ctx));
    }

    #[test]
    fn test_matches_trigger_config_priority_match() {
        let config = json!({"priority": "high"});
        let mut ctx = make_context();
        ctx.priority = Some("high".to_string());
        assert!(matches_trigger_config(&config, &ctx));
    }

    #[test]
    fn test_matches_trigger_config_priority_mismatch() {
        let config = json!({"priority": "high"});
        let mut ctx = make_context();
        ctx.priority = Some("low".to_string());
        assert!(!matches_trigger_config(&config, &ctx));
    }

    #[test]
    fn test_matches_trigger_config_combined_conditions() {
        let source = Uuid::new_v4();
        let target = Uuid::new_v4();
        let config = json!({
            "source_column_id": source.to_string(),
            "target_column_id": target.to_string()
        });
        let mut ctx = make_context();
        ctx.previous_status_id = Some(source);
        ctx.new_status_id = Some(target);
        assert!(matches_trigger_config(&config, &ctx));
    }

    #[test]
    fn test_matches_trigger_config_combined_one_fails() {
        let source = Uuid::new_v4();
        let target = Uuid::new_v4();
        let config = json!({
            "source_column_id": source.to_string(),
            "target_column_id": target.to_string()
        });
        let mut ctx = make_context();
        ctx.previous_status_id = Some(source);
        ctx.new_status_id = Some(Uuid::new_v4()); // wrong target
        assert!(!matches_trigger_config(&config, &ctx));
    }
}
