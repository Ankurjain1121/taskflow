//! `/oauth/twenty/*` integration routes.
//!
//! Each Twenty CRM workspace registers TaskBolt as its OIDC provider. TaskBolt
//! exposes the standard OpenID Connect endpoints under `/oauth/twenty` so
//! Twenty's built-in `oidc.auth.strategy.ts` can handle the dance.
//!
//! Key isolation: ID tokens are signed with a DEDICATED RSA keypair
//! (`TwentyOidcKeys`), separate from TaskBolt's JWT signing key. Compromise of
//! one key cannot forge tokens accepted by the other.

pub mod crm_crypto;
pub mod oidc_keys;
pub mod twenty_oidc;

pub use oidc_keys::TwentyOidcKeys;
pub use twenty_oidc::twenty_oidc_router;
