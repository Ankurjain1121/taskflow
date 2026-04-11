//! Input validation helpers for route handlers.
//!
//! Centralizes string length validation for all user-facing input fields.
//! Validation limits:
//! - Task title / Project name / Workspace name / User name: 255 chars
//! - Column name / Label name: 100 chars
//! - Task description: 10,000 chars
//! - Project description / Workspace description: 5,000 chars
//! - Comment content: 10,000 chars
//! - User bio: 2,000 chars
//! - User job_title / department: 255 chars

use crate::errors::AppError;

/// Validate a required string field (must not be empty, must not exceed max_len).
pub fn validate_required_string(
    field_name: &str,
    value: &str,
    max_len: usize,
) -> Result<(), AppError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(AppError::BadRequest(format!("{field_name} is required")));
    }
    if trimmed.len() > max_len {
        return Err(AppError::BadRequest(format!(
            "{field_name} must be {max_len} characters or less"
        )));
    }
    Ok(())
}

/// Validate an optional string field (if present, must not exceed max_len).
pub fn validate_optional_string(
    field_name: &str,
    value: Option<&str>,
    max_len: usize,
) -> Result<(), AppError> {
    if let Some(v) = value {
        if v.len() > max_len {
            return Err(AppError::BadRequest(format!(
                "{field_name} must be {max_len} characters or less"
            )));
        }
    }
    Ok(())
}

/// Validate a hex color string (must be exactly #RRGGBB format).
///
/// Prevents CSS injection by enforcing strict hex-only pattern.
pub fn validate_hex_color(value: &str) -> Result<(), AppError> {
    let trimmed = value.trim();
    if trimmed.len() != 7 {
        return Err(AppError::BadRequest(
            "Color must be a valid hex color (e.g. #FF5733)".into(),
        ));
    }
    if !trimmed.starts_with('#') {
        return Err(AppError::BadRequest(
            "Color must be a valid hex color (e.g. #FF5733)".into(),
        ));
    }
    if !trimmed[1..].chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(AppError::BadRequest(
            "Color must be a valid hex color (e.g. #FF5733)".into(),
        ));
    }
    Ok(())
}

/// Maximum nesting depth for subtasks (parent depth 0 -> child depth 1 -> ... -> depth 5).
pub const MAX_SUBTASK_DEPTH: i16 = 5;

// ============================================================================
// String length limits (centralized constants)
// ============================================================================

/// Max length for short name fields (task title, project name, workspace name, user name).
pub const MAX_NAME_LEN: usize = 255;

/// Max length for column/status names and label names.
pub const MAX_SHORT_NAME_LEN: usize = 100;

/// Max length for task description and comment content.
pub const MAX_DESCRIPTION_LEN: usize = 10_000;

/// Max length for project and workspace descriptions.
pub const MAX_PROJECT_DESCRIPTION_LEN: usize = 5_000;

/// Max length for user bio.
pub const MAX_BIO_LEN: usize = 2_000;

#[cfg(test)]
mod tests {
    use super::*;

    // ========================================================================
    // 7A: String Length Validation Tests (RED -> GREEN)
    // ========================================================================

    #[test]
    fn test_validate_required_string_valid() {
        assert!(validate_required_string("Title", "A valid title", 255).is_ok());
    }

    #[test]
    fn test_validate_required_string_empty() {
        let result = validate_required_string("Title", "", 255);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(matches!(err, AppError::BadRequest(msg) if msg.contains("required")));
    }

    #[test]
    fn test_validate_required_string_whitespace_only() {
        let result = validate_required_string("Title", "   ", 255);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(matches!(err, AppError::BadRequest(msg) if msg.contains("required")));
    }

    #[test]
    fn test_validate_required_string_at_max_length() {
        let value = "a".repeat(255);
        assert!(validate_required_string("Title", &value, 255).is_ok());
    }

    #[test]
    fn test_validate_required_string_exceeds_max_length() {
        let value = "a".repeat(256);
        let result = validate_required_string("Title", &value, 255);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(matches!(err, AppError::BadRequest(msg) if msg.contains("255 characters or less")));
    }

    #[test]
    fn test_task_title_300_chars_rejected() {
        let long_title = "x".repeat(300);
        let result = validate_required_string("Title", &long_title, MAX_NAME_LEN);
        assert!(result.is_err());
    }

    #[test]
    fn test_task_description_15000_chars_rejected() {
        let long_desc = "y".repeat(15_000);
        let result = validate_optional_string("Description", Some(&long_desc), MAX_DESCRIPTION_LEN);
        assert!(result.is_err());
    }

    #[test]
    fn test_project_name_300_chars_rejected() {
        let long_name = "z".repeat(300);
        let result = validate_required_string("Project name", &long_name, MAX_NAME_LEN);
        assert!(result.is_err());
    }

    #[test]
    fn test_valid_length_strings_accepted() {
        assert!(validate_required_string("Title", "Short title", MAX_NAME_LEN).is_ok());
        assert!(
            validate_optional_string(
                "Description",
                Some("A brief description"),
                MAX_DESCRIPTION_LEN
            )
            .is_ok()
        );
        assert!(validate_required_string("Name", "My Project", MAX_NAME_LEN).is_ok());
    }

    #[test]
    fn test_validate_optional_string_none_accepted() {
        assert!(validate_optional_string("Description", None, MAX_DESCRIPTION_LEN).is_ok());
    }

    #[test]
    fn test_validate_optional_string_at_max_length() {
        let value = "d".repeat(10_000);
        assert!(validate_optional_string("Description", Some(&value), MAX_DESCRIPTION_LEN).is_ok());
    }

    #[test]
    fn test_validate_optional_string_exceeds_max_length() {
        let value = "d".repeat(10_001);
        let result = validate_optional_string("Description", Some(&value), MAX_DESCRIPTION_LEN);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(
            matches!(err, AppError::BadRequest(msg) if msg.contains("10000 characters or less"))
        );
    }

    #[test]
    fn test_column_name_max_100() {
        let valid = "a".repeat(100);
        assert!(validate_required_string("Column name", &valid, MAX_SHORT_NAME_LEN).is_ok());

        let too_long = "a".repeat(101);
        assert!(validate_required_string("Column name", &too_long, MAX_SHORT_NAME_LEN).is_err());
    }

    #[test]
    fn test_label_name_max_100() {
        let valid = "b".repeat(100);
        assert!(validate_required_string("Label name", &valid, MAX_SHORT_NAME_LEN).is_ok());

        let too_long = "b".repeat(101);
        assert!(validate_required_string("Label name", &too_long, MAX_SHORT_NAME_LEN).is_err());
    }

    #[test]
    fn test_comment_content_max_10000() {
        let valid = "c".repeat(10_000);
        assert!(validate_required_string("Comment", &valid, MAX_DESCRIPTION_LEN).is_ok());

        let too_long = "c".repeat(10_001);
        assert!(validate_required_string("Comment", &too_long, MAX_DESCRIPTION_LEN).is_err());
    }

    #[test]
    fn test_project_description_max_5000() {
        let valid = "p".repeat(5_000);
        assert!(
            validate_optional_string("Description", Some(&valid), MAX_PROJECT_DESCRIPTION_LEN)
                .is_ok()
        );

        let too_long = "p".repeat(5_001);
        assert!(
            validate_optional_string("Description", Some(&too_long), MAX_PROJECT_DESCRIPTION_LEN)
                .is_err()
        );
    }

    #[test]
    fn test_bio_max_2000() {
        let valid = "b".repeat(2_000);
        assert!(validate_optional_string("Bio", Some(&valid), MAX_BIO_LEN).is_ok());

        let too_long = "b".repeat(2_001);
        assert!(validate_optional_string("Bio", Some(&too_long), MAX_BIO_LEN).is_err());
    }

    // ========================================================================
    // 4A: Subtask Depth Constant Test
    // ========================================================================

    #[test]
    fn test_max_subtask_depth_is_5() {
        assert_eq!(MAX_SUBTASK_DEPTH, 5);
    }

    // ========================================================================
    // Phase 4.5d: Hex Color Validation Tests
    // ========================================================================

    #[test]
    fn test_validate_hex_color_valid() {
        assert!(validate_hex_color("#FF5733").is_ok());
        assert!(validate_hex_color("#000000").is_ok());
        assert!(validate_hex_color("#ffffff").is_ok());
        assert!(validate_hex_color("#3b82f6").is_ok());
        assert!(validate_hex_color("#aAbBcC").is_ok());
    }

    #[test]
    fn test_validate_hex_color_empty() {
        assert!(validate_hex_color("").is_err());
    }

    #[test]
    fn test_validate_hex_color_no_hash() {
        assert!(validate_hex_color("FF5733").is_err());
    }

    #[test]
    fn test_validate_hex_color_too_short() {
        assert!(validate_hex_color("#FFF").is_err());
    }

    #[test]
    fn test_validate_hex_color_too_long() {
        assert!(validate_hex_color("#FF57330").is_err());
    }

    #[test]
    fn test_validate_hex_color_invalid_chars() {
        assert!(validate_hex_color("#GGGGGG").is_err());
        assert!(validate_hex_color("#12345Z").is_err());
    }

    #[test]
    fn test_validate_hex_color_with_spaces() {
        // Trimmed before validation
        assert!(validate_hex_color(" #FF5733 ").is_ok());
    }

    #[test]
    fn test_validate_hex_color_css_injection_attempt() {
        assert!(validate_hex_color("red; background-image: url(evil)").is_err());
        assert!(validate_hex_color("#000000; --x: 1").is_err());
    }
}
