//! Integration endpoints for external services (Twenty CRM, etc.).

pub mod twenty_sync_enqueue;

pub use twenty_sync_enqueue::twenty_sync_router;
