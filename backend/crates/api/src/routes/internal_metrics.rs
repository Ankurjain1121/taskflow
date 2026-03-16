//! Prometheus metrics endpoint
//!
//! Exposes application metrics in Prometheus text exposition format at
//! `/internal/metrics`. Gated behind admin-only authentication.

use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;

use crate::state::AppState;

/// Handler for `GET /internal/metrics`
///
/// Returns Prometheus text exposition format. Requires admin authentication
/// (handled by the `AdminUser` extractor on the route).
pub async fn internal_metrics_handler(
    _admin: crate::extractors::AdminUser,
    State(state): State<AppState>,
) -> impl IntoResponse {
    match &state.prometheus_handle {
        Some(handle) => {
            let body = handle.render();
            (
                StatusCode::OK,
                [(
                    axum::http::header::CONTENT_TYPE,
                    "text/plain; version=0.0.4; charset=utf-8",
                )],
                body,
            )
                .into_response()
        }
        None => (StatusCode::SERVICE_UNAVAILABLE, "Metrics not available").into_response(),
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_prometheus_handle_render() {
        // Verify that PrometheusBuilder produces a handle that renders without panic
        let builder = metrics_exporter_prometheus::PrometheusBuilder::new();
        let handle = builder.install_recorder().expect("failed to install recorder");
        let output = handle.render();
        // Output should be valid text (may be empty if no metrics recorded)
        assert!(
            output.is_empty() || output.contains('#') || output.contains('\n'),
            "Prometheus output should be empty or valid text exposition format"
        );
    }
}
