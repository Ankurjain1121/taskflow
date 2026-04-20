//! Marker trait for request DTOs that opt in to strict deserialization.
//!
//! A type carrying `StrictDto` guarantees two things at compile time:
//! - it derives `serde::Deserialize`
//! - the generated deserializer uses `#[serde(deny_unknown_fields)]`
//!
//! `StrictJson<T>` (in the API crate) bounds `T: StrictDto`, so any handler
//! that accepts a DTO without this trait fails to compile. This closes the
//! "silent field drop" bug class at the type level instead of relying on
//! reviewer vigilance.
//!
//! Apply via the attribute macro in `strict-dto-derive`:
//! ```ignore
//! use strict_dto_derive::strict_dto;
//!
//! #[strict_dto]
//! #[derive(Debug)]
//! pub struct UpdateFooRequest {
//!     pub name: Option<String>,
//! }
//! ```

use serde::de::DeserializeOwned;

/// Sealed-style marker: types implementing this trait are guaranteed to have
/// `deny_unknown_fields` emitted by the derive macro. Manual impls are
/// permitted for testing but should not be used in production code.
pub trait StrictDto: DeserializeOwned {}
