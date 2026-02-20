//! Background jobs module
//!
//! Contains scheduled jobs for deadline scanning, weekly digests, trash cleanup, etc.

pub mod deadline_scanner;
pub mod trash_cleanup;
pub mod weekly_digest;

pub use deadline_scanner::{scan_deadlines, DeadlineScanResult, DeadlineScannerError};
pub use trash_cleanup::{cleanup_expired_trash, TrashCleanupError, TrashCleanupResult};
pub use weekly_digest::{send_weekly_digests, WeeklyDigestError, WeeklyDigestResult};
