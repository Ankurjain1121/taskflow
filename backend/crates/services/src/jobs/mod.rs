//! Background jobs module
//!
//! Contains scheduled jobs for deadline scanning, weekly digests, trash cleanup,
//! and automation execution.

pub mod automation_executor;
pub mod deadline_scanner;
pub mod trash_cleanup;
pub mod weekly_digest;

pub use automation_executor::{
    evaluate_trigger, execute_scheduled_automations, resolve_column_by_name,
    resolve_label_by_name, spawn_automation_evaluation, AutomationExecutorError,
    AutomationRunResult, ScheduledAutomationResult, TriggerContext,
};
pub use deadline_scanner::{scan_deadlines, DeadlineScanResult, DeadlineScannerError};
pub use trash_cleanup::{cleanup_expired_trash, TrashCleanupError, TrashCleanupResult};
pub use weekly_digest::{send_weekly_digests, WeeklyDigestError, WeeklyDigestResult};
