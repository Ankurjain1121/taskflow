// CRM link integration tests live in:
//   backend/crates/api/src/routes/integration_tests/task_crm_link_tests.rs
//
// They require a live database and are gated by #[ignore]. Run with:
//   cargo test -p taskbolt-api -- --ignored task_crm_link
//
// This file is intentionally empty — it existed in a prior commit as a stub
// that referenced helpers not yet created. Tests were moved to the canonical
// integration_tests/ directory that has proper test_app() setup.
