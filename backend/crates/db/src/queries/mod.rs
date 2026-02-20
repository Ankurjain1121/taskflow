#![allow(ambiguous_glob_reexports)]

pub mod activity_log;
pub mod archive;
pub mod attachments;
pub mod auth;
pub mod automations;
pub mod board_shares;
pub mod boards;
pub mod columns;
pub mod comments;
pub mod custom_fields;
pub mod dashboard;
pub mod dependencies;
pub mod eisenhower;
pub mod favorites;
pub mod invitations;
pub mod milestones;
pub mod my_tasks;
pub mod notification_preferences;
pub mod notifications;
pub mod project_templates;
pub mod recurring;
pub mod reports;
pub mod search;
pub mod subtasks;
pub mod task_groups;
pub mod tasks;
pub mod team_overview;
pub mod themes;
pub mod time_entries;
pub mod user_preferences;
pub mod webhooks;
pub mod workspace_api_keys;
pub mod workspaces;

#[cfg(test)]
mod integration_tests;
#[cfg(test)]
mod integration_tests_advanced;

pub use activity_log::*;
pub use attachments::*;
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
pub use project_templates::*;
pub use recurring::*;
pub use subtasks::*;
pub use task_groups::*;
pub use tasks::*;
pub use team_overview::*;
pub use time_entries::*;
pub use webhooks::*;
pub use workspaces::*;

pub use archive::*;
pub use auth::*;
pub use favorites::*;
pub use invitations::*;
pub use milestones::*;
pub use reports::*;
pub use search::*;
pub use themes::*;

// Re-export with module paths for clarity (avoid name collisions)
pub use user_preferences as user_prefs;
pub use workspace_api_keys as api_keys;
