//! Twenty CRM REST client.
//!
//! Authenticates with Twenty using the per-workspace API key
//! (`Authorization: Bearer <key>`). W4 ships a thin client; W5/W6 will fill in
//! the rest of the surface area (deals, contacts, sync).

pub mod client;

pub use client::{TwentyClient, TwentyError, ProvisionUserOutcome};
