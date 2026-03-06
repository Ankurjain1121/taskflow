//! Integration tests for API route handlers.
//!
//! Tests are split into domain-specific modules:
//!   - auth_tests: Authentication middleware, sessions, user preferences
//!   - workspace_tests: Workspace CRUD, member role enforcement
//!   - project_tests: Project CRUD, templates, members, shares, reports, webhooks
//!   - column_tests: Column CRUD and error handling
//!   - task_tests: Task CRUD, movement, assignment, subtasks, comments, deps
//!   - dashproject_tests: Dashproject stats, search, favorites, notifications, health
//!   - invitation_tests: Invitation CRUD, validation, acceptance

mod common;

mod auth_tests;
mod board_tests;
mod column_tests;
mod dashboard_tests;
mod invitation_tests;
mod task_tests;
mod workspace_tests;
