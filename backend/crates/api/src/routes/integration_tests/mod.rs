//! Integration tests for API route handlers.
//!
//! Tests are split into domain-specific modules:
//!   - auth_tests: Authentication middleware, sessions, user preferences
//!   - workspace_tests: Workspace CRUD, member role enforcement
//!   - board_tests: Board CRUD, templates, members, shares, reports, webhooks
//!   - column_tests: Column CRUD and error handling
//!   - task_tests: Task CRUD, movement, assignment, subtasks, comments, deps
//!   - dashboard_tests: Dashboard stats, search, favorites, notifications, health
//!   - invitation_tests: Invitation CRUD, validation, acceptance

mod common;

mod auth_tests;
mod board_tests;
mod column_tests;
mod dashboard_tests;
mod filter_presets_tests;
mod invitation_tests;
mod personal_board_tests;
mod prometheus_tests;
mod recent_items_tests;
mod task_issue_link_tests;
mod task_snooze_tests;
mod task_tests;
mod workspace_audit_tests;
mod workspace_export_tests;
mod workspace_tests;
