//! Twenty CRM integration surface.
//!
//! - `client`: thin reqwest wrapper (mirrors `services::novu`). Owned by W4 (SSO);
//!   extended in W6 with the outbound `upsert_object` / `delete_object` calls
//!   used by the Phase 6b sync worker.
//! - `sync`: Phase 6c timestamp-driven conflict resolver + outbound push helpers.
//!
//! Inbound (W5) writes mirror tables; outbound (W6) reads those mirrors to decide
//! whether a local edit is fresh enough to push.

pub mod client;
pub mod sync;

pub use client::{ProvisionUserOutcome, TwentyClient, TwentyError, UpsertOutcome};
pub use sync::{
    decide_conflict, push_job, ConflictDecision, ConflictResolution, OutboundError, PushOutcome,
};
