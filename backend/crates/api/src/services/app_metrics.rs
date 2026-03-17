//! Application-level Prometheus metrics
//!
//! Provides helper functions that record counters, histograms, and gauges using
//! the global `metrics` recorder. The recorder must be installed before calling
//! these (see `main.rs` PrometheusBuilder initialization).

use metrics::{counter, gauge, histogram};

/// Record an email queued for delivery.
pub fn record_email_queued(event_type: &str) {
    counter!("taskflow_emails_queued_total", "event_type" => event_type.to_string()).increment(1);
}

/// Record an email send attempt (success or failure).
pub fn record_email_sent(event_type: &str, status: &str) {
    counter!("taskflow_emails_sent_total", "event_type" => event_type.to_string(), "status" => status.to_string()).increment(1);
}

/// Record a report generation event.
pub fn record_report_generated(report_type: &str, format: &str) {
    counter!("taskflow_reports_generated_total", "type" => report_type.to_string(), "format" => format.to_string()).increment(1);
}

/// Record an HTTP request with method, path, status code, and duration.
pub fn record_http_request(method: &str, path: &str, status: u16, duration_secs: f64) {
    counter!("taskflow_http_requests_total", "method" => method.to_string(), "path" => path.to_string(), "status" => status.to_string()).increment(1);
    histogram!("taskflow_http_request_duration_seconds", "method" => method.to_string(), "path" => path.to_string()).record(duration_secs);
}

/// Set the current email queue depth gauge.
pub fn set_email_queue_depth(depth: f64) {
    gauge!("taskflow_email_queue_depth").set(depth);
}

/// Set the current active WebSocket connections gauge.
pub fn set_active_websocket_connections(count: f64) {
    gauge!("taskflow_active_websocket_connections").set(count);
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Verify metric recording functions don't panic even without a global recorder.
    /// The `metrics` crate uses a no-op recorder by default, so these should be safe.
    #[test]
    fn test_record_email_queued_does_not_panic() {
        record_email_queued("welcome");
        record_email_queued("password_reset");
    }

    #[test]
    fn test_record_email_sent_does_not_panic() {
        record_email_sent("welcome", "success");
        record_email_sent("invite", "failure");
    }

    #[test]
    fn test_record_report_generated_does_not_panic() {
        record_report_generated("sprint", "csv");
        record_report_generated("burndown", "pdf");
    }

    #[test]
    fn test_record_http_request_does_not_panic() {
        record_http_request("GET", "/api/health", 200, 0.015);
        record_http_request("POST", "/api/tasks", 201, 0.123);
        record_http_request("GET", "/api/projects", 500, 1.5);
    }

    #[test]
    fn test_set_email_queue_depth_does_not_panic() {
        set_email_queue_depth(0.0);
        set_email_queue_depth(42.0);
    }

    #[test]
    fn test_set_active_websocket_connections_does_not_panic() {
        set_active_websocket_connections(0.0);
        set_active_websocket_connections(10.0);
    }
}
