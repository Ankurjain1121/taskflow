pub mod audit;
pub mod board_templates;
pub mod broadcast;
pub mod jobs;
pub mod minio;
pub mod notifications;
pub mod novu;
pub mod presence;
pub mod sample_board;
pub mod sample_data;
pub mod trash_bin;

pub use audit::{get_action_for_route, record_audit_event, AuditError, ROUTE_ACTION_MAP};
pub use board_templates::{get_template, BoardTemplate, TEMPLATES as BOARD_TEMPLATES};
pub use broadcast::{BroadcastError, BroadcastService};
pub use jobs::{
    cleanup_expired_trash, evaluate_trigger, resolve_column_by_name, resolve_label_by_name,
    scan_deadlines, send_weekly_digests, spawn_automation_evaluation, AutomationExecutorError,
    AutomationRunResult, DeadlineScanResult, TrashCleanupResult, TriggerContext,
    WeeklyDigestResult,
};
pub use minio::{MinioConfig, MinioError, MinioService};
pub use notifications::{
    generate_weekly_digest_html, is_slack_enabled, is_whatsapp_enabled, send_slack_notification,
    send_whatsapp_notification, EmailError, NotificationEvent, NotificationService,
    NotificationServiceError, PostalClient, SlackError, WhatsAppError,
};
pub use novu::{NovuClient, NovuError};
pub use presence::{PresenceError, PresenceService, TaskLockInfo};
pub use sample_board::{generate_sample_board, SampleBoardError};
pub use trash_bin::{
    get_trash_items, move_to_trash, permanently_delete, restore_from_trash, PaginatedTrashItems,
    TrashBinError, TrashEntityType, TrashItem, TRASH_RETENTION_DAYS,
};
