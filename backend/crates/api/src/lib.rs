//! TaskBolt API library crate.
//!
//! Exposes all modules so that `tests/` integration tests can reference
//! public types without duplicating module declarations in `main.rs`.

#![allow(clippy::needless_raw_string_hashes)]

pub mod config;
pub mod errors;
pub mod extractors;
pub mod middleware;
pub mod routes;
pub mod services;
pub mod state;
pub mod ws;

// Job scheduler — pub(crate) is sufficient here; expose for tests if needed
pub mod jobs;

// Router builder
pub mod router;

/// Test helpers: available to `tests/` integration tests and in-crate `#[cfg(test)]` modules.
/// Not gated by `#[cfg(test)]` because external integration tests in `tests/` compile the lib
/// as a regular dependency (no cfg(test)), so the module must be unconditionally declared.
pub mod test_helpers;
