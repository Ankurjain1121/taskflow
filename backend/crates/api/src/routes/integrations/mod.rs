//! `/oauth/twenty/*` and `/api/integrations/*` routes.
//!
//! Each Twenty CRM workspace registers TaskBolt as its OIDC provider. TaskBolt
//! exposes the standard OpenID Connect endpoints under `/oauth/twenty` so
//! Twenty's built-in `oidc.auth.strategy.ts` can handle the dance.
//!
//! Key isolation: ID tokens are signed with a DEDICATED RSA keypair
//! (`TwentyOidcKeys`), separate from TaskBolt's JWT signing key. Compromise of
//! one key cannot forge tokens accepted by the other.
//!
//! Outbound enqueue endpoints (Phase 6b) live under `twenty_sync_enqueue` and
//! push CRM mutations through the worker queue. Phase 8 adds a version-tolerant
//! Twenty health check exposed via `twenty_health::integrations_router` for the
//! Renovate auto-bump pipeline.

pub mod crm_crypto;
pub mod oidc_keys;
pub mod twenty_health;
pub mod twenty_oidc;
pub mod twenty_sync_enqueue;

pub use oidc_keys::TwentyOidcKeys;
pub use twenty_health::integrations_router;
pub use twenty_oidc::twenty_oidc_router;
pub use twenty_sync_enqueue::twenty_sync_router;
