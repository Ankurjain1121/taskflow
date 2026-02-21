//! Background jobs module
//!
//! Contains scheduled jobs for deadline scanning, weekly digests, trash cleanup,
//! and automation execution.

pub mod automation_executor;
pub mod deadline_scanner;
pub mod trash_cleanup;
pub mod weekly_digest;

pub use automation_executor::{
    evaluate_trigger, spawn_automation_evaluation, AutomationExecutorError, AutomationRunResult,
    TriggerContext,
};
pub use deadline_scanner::{scan_deadlines, DeadlineScanResult, DeadlineScannerError};
pub use trash_cleanup::{cleanup_expired_trash, TrashCleanupError, TrashCleanupResult};
pub use weekly_digest::{send_weekly_digests, WeeklyDigestError, WeeklyDigestResult};
