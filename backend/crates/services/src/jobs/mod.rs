//! Background jobs module
//!
//! Contains scheduled jobs for deadline scanning, weekly digests, trash cleanup,
//! email processing, and automation execution.

pub mod automation;
pub mod daily_digest;
pub mod deadline_scanner;
pub mod digest_service;
pub mod email_queue;
pub mod email_worker;
pub mod report_jobs;
pub mod trash_cleanup;
pub mod weekly_digest;
pub mod whatsapp_digest;

pub use automation::{
    evaluate_trigger, execute_scheduled_automations, resolve_column_by_name, resolve_label_by_name,
    spawn_automation_evaluation, AutomationExecutorError, AutomationRunResult,
    ScheduledAutomationResult, TriggerContext,
};
pub use daily_digest::send_daily_digests;
pub use deadline_scanner::{scan_deadlines, DeadlineScanResult, DeadlineScannerError};
pub use email_worker::run_email_worker;
pub use trash_cleanup::{cleanup_expired_trash, TrashCleanupError, TrashCleanupResult};
pub use weekly_digest::{send_weekly_digests, WeeklyDigestError, WeeklyDigestResult};
pub use whatsapp_digest::{
    send_admin_daily_org_report, send_daily_whatsapp_digests, send_enhanced_daily_digests,
    send_weekly_whatsapp_summaries, WhatsAppDigestError, WhatsAppDigestResult,
};
