#![allow(ambiguous_glob_reexports)]

pub mod activity_log;
pub mod archive;
pub mod attachments;
pub mod auth;
pub mod automation_templates;
pub mod automations;
pub mod board_shares;
pub mod boards;
pub mod bulk_operations;
pub mod columns;
pub mod comments;
pub mod custom_fields;
pub mod dashboard;
pub mod dependencies;
pub mod eisenhower;
pub mod favorites;
pub mod invitations;
pub mod metrics;
pub mod milestones;
pub mod my_tasks;
pub mod notification_preferences;
pub mod notifications;
pub mod positions;
pub mod project_templates;
pub mod recent_items;
pub mod recurring;
pub mod reports;
pub mod search;
pub mod subtasks;
pub mod task_assignments;
pub mod task_bulk;
pub mod task_groups;
pub mod task_reminders;
pub mod task_templates;
pub mod task_views;
pub mod task_watchers;
pub mod tasks;
pub mod team_overview;
pub mod teams;
pub mod themes;
pub mod time_entries;
pub mod user_preferences;
pub mod webhooks;
pub mod workspace_api_keys;
pub mod workspace_job_roles;
pub mod workspaces;

#[cfg(test)]
mod integration_tests;
#[cfg(test)]
mod integration_tests_advanced;
#[cfg(test)]
mod integration_tests_extra;

pub use activity_log::*;
pub use attachments::*;
pub use automation_templates::*;
pub use automations::*;
pub use board_shares::*;
pub use boards::*;
pub use columns::*;
pub use comments::*;
pub use custom_fields::*;
pub use dashboard::*;
pub use dependencies::*;
pub use eisenhower::*;
pub use my_tasks::*;
pub use notification_preferences::*;
pub use notifications::*;
pub use positions::*;
pub use project_templates::*;
pub use recurring::*;
pub use subtasks::*;
pub use task_assignments::*;
pub use task_bulk::*;
pub use task_groups::*;
pub use task_reminders::*;
pub use task_templates::*;
pub use task_views::*;
pub use task_watchers::*;
pub use tasks::*;
pub use team_overview::*;
pub use teams::*;
pub use time_entries::*;
pub use webhooks::*;
pub use workspaces::*;

pub use workspace_job_roles::*;

pub use archive::*;
pub use auth::*;
pub use favorites::*;
pub use invitations::*;
pub use milestones::*;
pub use recent_items::*;
pub use reports::*;
pub use search::*;
pub use themes::*;

// Re-export with module paths for clarity (avoid name collisions)
pub use user_preferences as user_prefs;
pub use workspace_api_keys as api_keys;
