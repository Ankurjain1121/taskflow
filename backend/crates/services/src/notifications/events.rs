//! Notification event types and payloads
//!
//! Defines the types of notifications that can be sent and their
//! associated payload structures.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Types of notification events
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NotificationEvent {
    TaskAssigned,
    TaskDueSoon,
    TaskOverdue,
    TaskCommented,
    TaskCompleted,
    MentionInComment,
    TaskUpdatedWatcher,
    TaskReminder,
}

impl NotificationEvent {
    /// Get the event name as a string for Novu triggers
    pub fn name(&self) -> &'static str {
        match self {
            NotificationEvent::TaskAssigned => "task-assigned",
            NotificationEvent::TaskDueSoon => "task-due-soon",
            NotificationEvent::TaskOverdue => "task-overdue",
            NotificationEvent::TaskCommented => "task-commented",
            NotificationEvent::TaskCompleted => "task-completed",
            NotificationEvent::MentionInComment => "mention-in-comment",
            NotificationEvent::TaskUpdatedWatcher => "task-updated-watcher",
            NotificationEvent::TaskReminder => "task-reminder",
        }
    }

    /// Get a human-readable title for the event
    pub fn title(&self) -> &'static str {
        match self {
            NotificationEvent::TaskAssigned => "Task Assigned",
            NotificationEvent::TaskDueSoon => "Task Due Soon",
            NotificationEvent::TaskOverdue => "Task Overdue",
            NotificationEvent::TaskCommented => "New Comment",
            NotificationEvent::TaskCompleted => "Task Completed",
            NotificationEvent::MentionInComment => "You Were Mentioned",
            NotificationEvent::TaskUpdatedWatcher => "Task Updated",
            NotificationEvent::TaskReminder => "Task Reminder",
        }
    }

    /// Parse from string representation
    #[allow(clippy::should_implement_trait)]
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "task-assigned" | "task_assigned" => Some(NotificationEvent::TaskAssigned),
            "task-due-soon" | "task_due_soon" => Some(NotificationEvent::TaskDueSoon),
            "task-overdue" | "task_overdue" => Some(NotificationEvent::TaskOverdue),
            "task-commented" | "task_commented" => Some(NotificationEvent::TaskCommented),
            "task-completed" | "task_completed" => Some(NotificationEvent::TaskCompleted),
            "mention-in-comment" | "mention_in_comment" => {
                Some(NotificationEvent::MentionInComment)
            }
            "task-updated-watcher" | "task_updated_watcher" => {
                Some(NotificationEvent::TaskUpdatedWatcher)
            }
            "task-reminder" | "task_reminder" => Some(NotificationEvent::TaskReminder),
            _ => None,
        }
    }

    /// Get all event types
    pub fn all() -> &'static [NotificationEvent] {
        &[
            NotificationEvent::TaskAssigned,
            NotificationEvent::TaskDueSoon,
            NotificationEvent::TaskOverdue,
            NotificationEvent::TaskCommented,
            NotificationEvent::TaskCompleted,
            NotificationEvent::MentionInComment,
            NotificationEvent::TaskUpdatedWatcher,
            NotificationEvent::TaskReminder,
        ]
    }
}

impl std::fmt::Display for NotificationEvent {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.name())
    }
}

/// Payload for task assignment notifications
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskAssignedPayload {
    pub task_id: Uuid,
    pub task_title: String,
    pub board_id: Uuid,
    pub board_name: String,
    pub assigned_by_id: Uuid,
    pub assigned_by_name: String,
}

/// Payload for task due soon notifications
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskDueSoonPayload {
    pub task_id: Uuid,
    pub task_title: String,
    pub board_id: Uuid,
    pub board_name: String,
    pub due_date: String,
    pub hours_until_due: i64,
}

/// Payload for task overdue notifications
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskOverduePayload {
    pub task_id: Uuid,
    pub task_title: String,
    pub board_id: Uuid,
    pub board_name: String,
    pub due_date: String,
    pub days_overdue: i64,
}

/// Payload for task comment notifications
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskCommentedPayload {
    pub task_id: Uuid,
    pub task_title: String,
    pub board_id: Uuid,
    pub comment_id: Uuid,
    pub commenter_id: Uuid,
    pub commenter_name: String,
    pub comment_preview: String,
}

/// Payload for task completed notifications
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskCompletedPayload {
    pub task_id: Uuid,
    pub task_title: String,
    pub board_id: Uuid,
    pub board_name: String,
    pub completed_by_id: Uuid,
    pub completed_by_name: String,
}

/// Payload for mention notifications
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MentionInCommentPayload {
    pub task_id: Uuid,
    pub task_title: String,
    pub board_id: Uuid,
    pub comment_id: Uuid,
    pub mentioned_by_id: Uuid,
    pub mentioned_by_name: String,
    pub comment_preview: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_event_names() {
        assert_eq!(NotificationEvent::TaskAssigned.name(), "task-assigned");
        assert_eq!(NotificationEvent::TaskDueSoon.name(), "task-due-soon");
        assert_eq!(NotificationEvent::TaskOverdue.name(), "task-overdue");
        assert_eq!(NotificationEvent::TaskCommented.name(), "task-commented");
        assert_eq!(NotificationEvent::TaskCompleted.name(), "task-completed");
        assert_eq!(
            NotificationEvent::MentionInComment.name(),
            "mention-in-comment"
        );
        assert_eq!(
            NotificationEvent::TaskUpdatedWatcher.name(),
            "task-updated-watcher"
        );
        assert_eq!(NotificationEvent::TaskReminder.name(), "task-reminder");
    }

    #[test]
    fn test_from_str() {
        assert_eq!(
            NotificationEvent::from_str("task-assigned"),
            Some(NotificationEvent::TaskAssigned)
        );
        assert_eq!(
            NotificationEvent::from_str("task_assigned"),
            Some(NotificationEvent::TaskAssigned)
        );
        assert_eq!(NotificationEvent::from_str("invalid"), None);
    }

    #[test]
    fn test_all_events() {
        let all = NotificationEvent::all();
        assert_eq!(all.len(), 8);
    }

    #[test]
    fn test_event_titles() {
        assert_eq!(NotificationEvent::TaskAssigned.title(), "Task Assigned");
        assert_eq!(NotificationEvent::TaskDueSoon.title(), "Task Due Soon");
        assert_eq!(NotificationEvent::TaskOverdue.title(), "Task Overdue");
        assert_eq!(NotificationEvent::TaskCommented.title(), "New Comment");
        assert_eq!(NotificationEvent::TaskCompleted.title(), "Task Completed");
        assert_eq!(
            NotificationEvent::MentionInComment.title(),
            "You Were Mentioned"
        );
        assert_eq!(
            NotificationEvent::TaskUpdatedWatcher.title(),
            "Task Updated"
        );
        assert_eq!(NotificationEvent::TaskReminder.title(), "Task Reminder");
    }

    #[test]
    fn test_from_str_all_hyphenated() {
        assert_eq!(
            NotificationEvent::from_str("task-assigned"),
            Some(NotificationEvent::TaskAssigned)
        );
        assert_eq!(
            NotificationEvent::from_str("task-due-soon"),
            Some(NotificationEvent::TaskDueSoon)
        );
        assert_eq!(
            NotificationEvent::from_str("task-overdue"),
            Some(NotificationEvent::TaskOverdue)
        );
        assert_eq!(
            NotificationEvent::from_str("task-commented"),
            Some(NotificationEvent::TaskCommented)
        );
        assert_eq!(
            NotificationEvent::from_str("task-completed"),
            Some(NotificationEvent::TaskCompleted)
        );
        assert_eq!(
            NotificationEvent::from_str("mention-in-comment"),
            Some(NotificationEvent::MentionInComment)
        );
        assert_eq!(
            NotificationEvent::from_str("task-updated-watcher"),
            Some(NotificationEvent::TaskUpdatedWatcher)
        );
        assert_eq!(
            NotificationEvent::from_str("task-reminder"),
            Some(NotificationEvent::TaskReminder)
        );
    }

    #[test]
    fn test_from_str_all_underscored() {
        assert_eq!(
            NotificationEvent::from_str("task_assigned"),
            Some(NotificationEvent::TaskAssigned)
        );
        assert_eq!(
            NotificationEvent::from_str("task_due_soon"),
            Some(NotificationEvent::TaskDueSoon)
        );
        assert_eq!(
            NotificationEvent::from_str("task_overdue"),
            Some(NotificationEvent::TaskOverdue)
        );
        assert_eq!(
            NotificationEvent::from_str("task_commented"),
            Some(NotificationEvent::TaskCommented)
        );
        assert_eq!(
            NotificationEvent::from_str("task_completed"),
            Some(NotificationEvent::TaskCompleted)
        );
        assert_eq!(
            NotificationEvent::from_str("mention_in_comment"),
            Some(NotificationEvent::MentionInComment)
        );
        assert_eq!(
            NotificationEvent::from_str("task_updated_watcher"),
            Some(NotificationEvent::TaskUpdatedWatcher)
        );
        assert_eq!(
            NotificationEvent::from_str("task_reminder"),
            Some(NotificationEvent::TaskReminder)
        );
    }

    #[test]
    fn test_event_display() {
        for event in NotificationEvent::all() {
            assert_eq!(format!("{}", event), event.name());
        }
    }

    #[test]
    fn test_event_serde_roundtrip() {
        for event in NotificationEvent::all() {
            let serialized = serde_json::to_string(event).unwrap();
            let deserialized: NotificationEvent = serde_json::from_str(&serialized).unwrap();
            assert_eq!(*event, deserialized);
        }
    }
}
