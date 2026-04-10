use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use ts_rs::TS;
use uuid::Uuid;

// ============================================
// Enums
// ============================================

#[derive(sqlx::Type, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, TS)]
#[sqlx(type_name = "issue_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum IssueStatus {
    Open,
    InProgress,
    OnHold,
    Closed,
    Reopened,
}

#[derive(sqlx::Type, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, TS)]
#[sqlx(type_name = "issue_severity", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum IssueSeverity {
    None,
    Minor,
    Major,
    Critical,
    ShowStopper,
}

#[derive(sqlx::Type, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, TS)]
#[sqlx(type_name = "issue_classification", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum IssueClassification {
    Bug,
    FeatureRequest,
    Improvement,
    Task,
    Other,
}

#[derive(sqlx::Type, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, TS)]
#[sqlx(type_name = "issue_reproducibility", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum IssueReproducibility {
    Always,
    Sometimes,
    Rarely,
    Unable,
    NotApplicable,
}

#[derive(sqlx::Type, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, TS)]
#[sqlx(type_name = "issue_resolution_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum IssueResolutionType {
    Fixed,
    WontFix,
    Duplicate,
    Deferred,
    NotABug,
    CannotReproduce,
}

// ============================================
// Issue model
// ============================================

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct Issue {
    pub id: Uuid,
    pub project_id: Uuid,
    pub tenant_id: Uuid,
    pub issue_number: i32,

    pub title: String,
    pub description: Option<String>,

    pub reporter_id: Uuid,
    pub assignee_id: Option<Uuid>,

    pub status: IssueStatus,
    pub severity: IssueSeverity,
    pub classification: IssueClassification,
    pub reproducibility: Option<IssueReproducibility>,

    pub module: Option<String>,
    pub affected_milestone_id: Option<Uuid>,
    pub release_milestone_id: Option<Uuid>,

    pub due_date: Option<DateTime<Utc>>,

    pub resolution_type: Option<IssueResolutionType>,
    pub resolution_notes: Option<String>,
    pub resolved_by_id: Option<Uuid>,
    pub closed_at: Option<DateTime<Utc>>,

    pub flag: String,

    pub deleted_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_issue() -> Issue {
        let now = Utc::now();
        Issue {
            id: Uuid::new_v4(),
            project_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            issue_number: 1,
            title: "Login page CSS broken on mobile".to_string(),
            description: Some("Layout breaks below 640px".to_string()),
            reporter_id: Uuid::new_v4(),
            assignee_id: None,
            status: IssueStatus::Open,
            severity: IssueSeverity::Major,
            classification: IssueClassification::Bug,
            reproducibility: Some(IssueReproducibility::Always),
            module: Some("auth".to_string()),
            affected_milestone_id: None,
            release_milestone_id: None,
            due_date: Some(now),
            resolution_type: None,
            resolution_notes: None,
            resolved_by_id: None,
            closed_at: None,
            flag: "internal".to_string(),
            deleted_at: None,
            created_at: now,
            updated_at: now,
        }
    }

    #[test]
    fn test_issue_serde_roundtrip() {
        let issue = make_issue();
        let json = serde_json::to_string(&issue).unwrap();
        let deserialized: Issue = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, issue.id);
        assert_eq!(deserialized.title, issue.title);
        assert_eq!(deserialized.severity, IssueSeverity::Major);
        assert_eq!(deserialized.status, IssueStatus::Open);
    }

    #[test]
    fn test_issue_status_serde_snake_case() {
        assert_eq!(
            serde_json::to_string(&IssueStatus::InProgress).unwrap(),
            "\"in_progress\""
        );
        assert_eq!(
            serde_json::to_string(&IssueStatus::OnHold).unwrap(),
            "\"on_hold\""
        );
    }

    #[test]
    fn test_issue_severity_ordering_via_serde() {
        for v in [
            IssueSeverity::None,
            IssueSeverity::Minor,
            IssueSeverity::Major,
            IssueSeverity::Critical,
            IssueSeverity::ShowStopper,
        ] {
            let json = serde_json::to_string(&v).unwrap();
            let back: IssueSeverity = serde_json::from_str(&json).unwrap();
            assert_eq!(v, back);
        }
    }

    #[test]
    fn test_issue_classification_serde() {
        assert_eq!(
            serde_json::to_string(&IssueClassification::FeatureRequest).unwrap(),
            "\"feature_request\""
        );
    }

    #[test]
    fn test_issue_invalid_status_rejected() {
        let result: std::result::Result<IssueStatus, _> = serde_json::from_str("\"pending\"");
        assert!(result.is_err());
    }

    #[test]
    fn test_issue_resolution_type_serde() {
        assert_eq!(
            serde_json::to_string(&IssueResolutionType::WontFix).unwrap(),
            "\"wont_fix\""
        );
        assert_eq!(
            serde_json::to_string(&IssueResolutionType::NotABug).unwrap(),
            "\"not_a_bug\""
        );
    }
}
