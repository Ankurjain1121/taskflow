//! Project query functions (formerly boards)
//!
//! Split into read and write modules for maintainability.

mod projects_read;
mod projects_write;

// Re-export all public items to preserve the same public API
pub use projects_read::*;
pub use projects_write::*;
