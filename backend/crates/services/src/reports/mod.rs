//! PDF report generation and WhatsApp delivery
//!
//! Generates branded PDF reports (morning agenda + evening achievement)
//! using HTML templates rendered via headless Chrome, then delivers
//! them as WhatsApp document attachments via WAHA.

pub mod pdf;
pub mod templates;

pub use pdf::{generate_pdf_from_html, PdfError};
