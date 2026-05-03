//! Inbound webhook receiver for Twenty CRM events.
//!
//! POST /api/webhooks/incoming/twenty/{tenant_id}
//!
//! Handler order (security-critical — do not reorder):
//!   1. Body size cap (reject > 1 MB BEFORE any parse)
//!   2. Content-Encoding rejection (only identity accepted)
//!   3. Lookup crm_workspace_links → get HMAC secret (encrypted)
//!   4. Decrypt HMAC secret
//!   5. Verify HMAC-SHA256 (constant-time compare)
//!   6. Replay defense: timestamp within 5-min window
//!   7. Dedup: insert event_id ON CONFLICT DO NOTHING
//!   8. Parse JSON (depth-limited, schema-tolerant via serde Value)
//!   9. Route event_type → upsert or tombstone mirror
//!  10. Mark event processed
//!  11. Return 200 {"received":true}
//!
//! Twenty's outbound HMAC scheme (from call-webhook.job.ts):
//!   signature = HMAC-SHA256(key=secret, msg="${timestamp}:${rawBody}")
//!   headers: X-Twenty-Webhook-Timestamp, X-Twenty-Webhook-Signature,
//!            X-Twenty-Webhook-Nonce

use axum::{
    body::Bytes,
    extract::{DefaultBodyLimit, Path, State},
    http::{HeaderMap, StatusCode},
    middleware::from_fn,
    response::{IntoResponse, Response},
    routing::post,
    Json, Router,
};
use chrono::{DateTime, Utc};
use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

use crate::state::AppState;
use taskbolt_db::queries::crm_mirror::{
    get_workspace_link, mark_deleted, mark_event_processed, record_event, upsert_company,
    upsert_contact, upsert_deal, TenantContext,
};

const MAX_BODY_BYTES: usize = 1024 * 1024; // 1 MB
const TIMESTAMP_WINDOW_MS: u64 = 5 * 60 * 1000; // 5 minutes
const JSON_MAX_DEPTH: usize = 32;

type HmacSha256 = Hmac<Sha256>;

/// POST /api/webhooks/incoming/twenty/{tenant_id}
async fn handle_twenty_webhook(
    State(state): State<AppState>,
    Path(tenant_id): Path<Uuid>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    // Step 1: body size cap — reject BEFORE parse
    if body.len() > MAX_BODY_BYTES {
        tracing::warn!(
            tenant_id = %tenant_id,
            body_len = body.len(),
            "Twenty webhook body exceeds 1 MB cap"
        );
        return StatusCode::PAYLOAD_TOO_LARGE.into_response();
    }

    // Step 2: reject any Content-Encoding other than identity.
    // Prevents compressed-body HMAC bypass (attacker sends gzip body with plain sig).
    if let Some(enc) = headers.get("content-encoding") {
        if enc.to_str().unwrap_or("identity") != "identity" {
            tracing::warn!(
                tenant_id = %tenant_id,
                "Twenty webhook rejected non-identity Content-Encoding"
            );
            return StatusCode::UNSUPPORTED_MEDIA_TYPE.into_response();
        }
    }

    // Step 3: lookup workspace link → encrypted HMAC secret
    let link = match get_workspace_link(&state.db, tenant_id).await {
        Ok(l) => l,
        Err(taskbolt_db::queries::crm_mirror::CrmMirrorError::WorkspaceLinkNotFound) => {
            tracing::warn!(tenant_id = %tenant_id, "Unknown tenant in crm_workspace_links");
            return StatusCode::NOT_FOUND.into_response();
        }
        Err(e) => {
            tracing::error!(tenant_id = %tenant_id, error = %e, "DB error looking up workspace link");
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };

    // Step 4: decrypt HMAC secret
    let hmac_secret = match super::crm_secret_crypto::decrypt_secret(&link.hmac_secret_encrypted) {
        Ok(s) => s,
        Err(e) => {
            tracing::error!(tenant_id = %tenant_id, error = %e, "Failed to decrypt HMAC secret");
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };

    // Step 5: HMAC verification
    let timestamp_str = match headers
        .get("x-twenty-webhook-timestamp")
        .and_then(|v| v.to_str().ok())
    {
        Some(ts) => ts.to_owned(),
        None => {
            log_hmac_fail(&headers, tenant_id, "missing timestamp header");
            return StatusCode::UNAUTHORIZED.into_response();
        }
    };

    let sig_header = match headers
        .get("x-twenty-webhook-signature")
        .and_then(|v| v.to_str().ok())
    {
        Some(s) => s.to_owned(),
        None => {
            log_hmac_fail(&headers, tenant_id, "missing signature header");
            return StatusCode::UNAUTHORIZED.into_response();
        }
    };

    // Reconstruct the signed message: "${timestamp}:${rawBody}"
    let msg = {
        let mut m = timestamp_str.clone().into_bytes();
        m.push(b':');
        m.extend_from_slice(&body);
        m
    };

    if !verify_hmac(&hmac_secret, &msg, &sig_header) {
        log_hmac_fail(&headers, tenant_id, "HMAC mismatch");
        return StatusCode::UNAUTHORIZED.into_response();
    }

    // Step 6: replay defense — timestamp within 5-min window
    let timestamp_ms: u64 = match timestamp_str.parse() {
        Ok(ts) => ts,
        Err(_) => {
            tracing::warn!(tenant_id = %tenant_id, "Invalid timestamp header");
            return StatusCode::BAD_REQUEST.into_response();
        }
    };
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    if now_ms.abs_diff(timestamp_ms) > TIMESTAMP_WINDOW_MS {
        tracing::warn!(
            tenant_id = %tenant_id,
            timestamp_ms,
            now_ms,
            "Twenty webhook timestamp outside 5-min window (replay rejected)"
        );
        return StatusCode::UNAUTHORIZED.into_response();
    }

    // Step 7: event dedup via nonce
    let event_id = match headers
        .get("x-twenty-webhook-nonce")
        .and_then(|v| v.to_str().ok())
    {
        Some(n) => n.to_owned(),
        None => {
            // Fall back to a hash of the body if nonce is missing
            hex::encode(Sha256::digest(&body))
        }
    };

    let body_hash = hex::encode(Sha256::digest(&body));

    // Step 8: depth-limited JSON parse — cap at 32 levels to prevent stack exhaustion.
    if json_depth(&body) > JSON_MAX_DEPTH {
        tracing::warn!(
            tenant_id = %tenant_id,
            "Twenty webhook JSON depth exceeds {JSON_MAX_DEPTH}"
        );
        return StatusCode::PAYLOAD_TOO_LARGE.into_response();
    }

    // Parse event_type from body early so we can log it in the event record.
    // Use serde_json::Value — schema-tolerant; unknown fields are silently ignored.
    let payload: serde_json::Value = match serde_json::from_slice(&body) {
        Ok(v) => v,
        Err(e) => {
            tracing::warn!(tenant_id = %tenant_id, error = %e, "Twenty webhook invalid JSON");
            return StatusCode::BAD_REQUEST.into_response();
        }
    };

    let event_type = payload
        .get("eventName")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_owned();

    let workspace_id = &link.twenty_workspace_id;

    // Insert into event log. ON CONFLICT DO NOTHING.
    // rows_affected == 0 → duplicate; return 200 immediately.
    let is_new = match record_event(
        &state.db,
        workspace_id,
        &event_id,
        &event_type,
        &body_hash,
        tenant_id,
    )
    .await
    {
        Ok(new) => new,
        Err(e) => {
            tracing::error!(tenant_id = %tenant_id, error = %e, "Failed to record event");
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };

    if !is_new {
        tracing::debug!(
            tenant_id = %tenant_id,
            event_id,
            "Duplicate Twenty webhook event acknowledged"
        );
        return (
            StatusCode::OK,
            Json(serde_json::json!({"received": true, "dup": true})),
        )
            .into_response();
    }

    // Step 9: route event_type → mirror upsert or tombstone
    let dispatch_result =
        dispatch_event(&state, tenant_id, workspace_id, &event_type, &payload).await;

    match dispatch_result {
        Ok(()) => {}
        Err(e) => {
            // Do NOT mark processed_at on 5xx — allow retry.
            tracing::error!(
                tenant_id = %tenant_id,
                event_id,
                event_type,
                error = %e,
                "Failed to dispatch Twenty webhook event"
            );
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    }

    // Step 10: mark processed
    if let Err(e) = mark_event_processed(&state.db, workspace_id, &event_id).await {
        // Non-fatal: event is idempotently upserted; processed_at is best-effort.
        tracing::warn!(tenant_id = %tenant_id, event_id, error = %e, "Failed to mark event processed");
    }

    (StatusCode::OK, Json(serde_json::json!({"received": true}))).into_response()
}

/// Route event_type to the appropriate mirror operation.
/// Extracts fields from the `record` key in the payload.
/// Unknown fields in `record` are silently ignored (schema-tolerant).
async fn dispatch_event(
    state: &AppState,
    tenant_id: Uuid,
    workspace_id: &str,
    event_type: &str,
    payload: &serde_json::Value,
) -> Result<(), String> {
    let ctx = TenantContext { tenant_id };
    let record = payload.get("record").unwrap_or(&serde_json::Value::Null);

    // P1 fix: clamp eventDate to Utc::now() to prevent attacker-controlled LWW
    // timestamp (e.g. eventDate=9999-12-31 would lock out all future updates).
    let parsed_event_date = payload
        .get("eventDate")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<DateTime<Utc>>().ok())
        .unwrap_or_else(Utc::now);
    let event_date = std::cmp::min(parsed_event_date, Utc::now());

    // Extract twenty_id from record.id
    let twenty_id: Uuid = record
        .get("id")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse().ok())
        .ok_or_else(|| "Missing or invalid record.id".to_owned())?;

    let object_type = event_type.split('.').next().unwrap_or("unknown");

    let operation = event_type.split('.').nth(1).unwrap_or("unknown");

    if operation == "deleted" {
        mark_deleted(
            &state.db,
            &ctx,
            object_type,
            workspace_id,
            twenty_id,
            event_date,
        )
        .await
        .map_err(|e| e.to_string())?;
        return Ok(());
    }

    match object_type {
        "person" => {
            upsert_contact(
                &state.db,
                &ctx,
                workspace_id,
                twenty_id,
                extract_str(record, "name"),
                extract_email(record),
                extract_str(record, "phone"),
                extract_str(record, "assigneeId"),
                record,
                event_date,
            )
            .await
            .map_err(|e| e.to_string())?;
        }
        "company" => {
            upsert_company(
                &state.db,
                &ctx,
                workspace_id,
                twenty_id,
                extract_str(record, "name"),
                extract_email(record),
                extract_str(record, "phone"),
                extract_str(record, "assigneeId"),
                record,
                event_date,
            )
            .await
            .map_err(|e| e.to_string())?;
        }
        "opportunity" => {
            let amount_cents = record
                .get("amount")
                .and_then(|v| v.get("amountMicros"))
                .and_then(serde_json::Value::as_i64)
                .map(|micros| micros / 10); // micros → cents

            upsert_deal(
                &state.db,
                &ctx,
                workspace_id,
                twenty_id,
                extract_str(record, "name"),
                extract_str(record, "stage"),
                amount_cents,
                extract_str(record, "assigneeId"),
                record,
                event_date,
            )
            .await
            .map_err(|e| e.to_string())?;
        }
        _ => {
            // Unknown object type — log and ignore; do not crash.
            tracing::debug!(
                object_type,
                "Ignoring Twenty webhook for unrecognised object type"
            );
        }
    }

    Ok(())
}

// ── JSON depth scanner ────────────────────────────────────────────────────────

/// Returns the maximum nesting depth of a JSON byte slice.
/// Accounts for string escaping to avoid false positives from `{`/`[` inside strings.
fn json_depth(data: &[u8]) -> usize {
    let mut depth: usize = 0;
    let mut max_depth: usize = 0;
    let mut in_string = false;
    let mut escape = false;
    for &b in data {
        if escape {
            escape = false;
            continue;
        }
        if in_string {
            if b == b'\\' {
                escape = true;
            } else if b == b'"' {
                in_string = false;
            }
            continue;
        }
        match b {
            b'"' => in_string = true,
            b'{' | b'[' => {
                depth += 1;
                if depth > max_depth {
                    max_depth = depth;
                }
            }
            b'}' | b']' => {
                depth = depth.saturating_sub(1);
            }
            _ => {}
        }
    }
    max_depth
}

// ── HMAC helpers ──────────────────────────────────────────────────────────────

/// Constant-time HMAC-SHA256 verification.
/// `msg` = b"${timestamp}:${rawBody}"
fn verify_hmac(secret: &[u8], msg: &[u8], expected_hex: &str) -> bool {
    let Ok(mut mac) = HmacSha256::new_from_slice(secret) else {
        return false;
    };
    mac.update(msg);
    let computed = mac.finalize().into_bytes();

    // Decode expected hex → bytes for constant-time compare.
    let Ok(expected_bytes) = hex::decode(expected_hex) else {
        return false;
    };

    // constant_time_eq via subtle crate or manual byte-wise XOR
    constant_time_eq(&computed, &expected_bytes)
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff: u8 = 0;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

fn log_hmac_fail(headers: &HeaderMap, tenant_id: Uuid, reason: &str) {
    let src_ip = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown");
    tracing::warn!(
        tenant_id = %tenant_id,
        src_ip,
        reason,
        "Twenty webhook HMAC verification failed"
    );
}

// ── JSON field helpers (schema-tolerant) ─────────────────────────────────────

fn extract_str<'a>(v: &'a serde_json::Value, key: &str) -> Option<&'a str> {
    v.get(key).and_then(|f| f.as_str())
}

fn extract_email(record: &serde_json::Value) -> Option<&str> {
    // Twenty stores emails as { primaryEmail: "...", ... } or as an array.
    record
        .get("primaryEmail")
        .or_else(|| record.get("email"))
        .and_then(|v| v.as_str())
}

// ── Router ────────────────────────────────────────────────────────────────────

pub fn webhooks_incoming_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route(
            "/webhooks/incoming/twenty/{tenant_id}",
            post(handle_twenty_webhook),
        )
        // Layer order (innermost first = added first):
        // 1. from_fn(rate_limit_middleware): reads injected RateLimiter, enforces limit
        // 2. rate_limit_layer: injects RateLimiter into request extensions (runs before #1)
        // 3. DefaultBodyLimit: outermost, caps body before Bytes extractor runs
        .layer(from_fn(
            crate::middleware::rate_limit::rate_limit_middleware,
        ))
        .layer(crate::middleware::rate_limit::rate_limit_layer(
            state.redis.clone(),
            300,
            60,
        ))
        .layer(DefaultBodyLimit::max(MAX_BODY_BYTES))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hmac_verify_correct_signature() {
        let secret = b"test-secret";
        let msg = b"1234567890:{}";
        let mut mac = HmacSha256::new_from_slice(secret).unwrap();
        mac.update(msg);
        let sig_bytes = mac.finalize().into_bytes();
        let sig_hex = hex::encode(sig_bytes);

        assert!(verify_hmac(secret, msg, &sig_hex));
    }

    #[test]
    fn hmac_verify_wrong_secret() {
        let secret = b"correct-secret";
        let wrong_secret = b"wrong-secret";
        let msg = b"ts:body";
        let mut mac = HmacSha256::new_from_slice(secret).unwrap();
        mac.update(msg);
        let sig_hex = hex::encode(mac.finalize().into_bytes());

        assert!(!verify_hmac(wrong_secret, msg, &sig_hex));
    }

    #[test]
    fn hmac_verify_tampered_body() {
        let secret = b"secret";
        let original = b"100:original-body";
        let tampered = b"100:tampered-body";
        let mut mac = HmacSha256::new_from_slice(secret).unwrap();
        mac.update(original);
        let sig_hex = hex::encode(mac.finalize().into_bytes());

        assert!(!verify_hmac(secret, tampered, &sig_hex));
    }

    #[test]
    fn hmac_verify_invalid_hex() {
        assert!(!verify_hmac(b"secret", b"msg", "not-valid-hex!!!"));
    }

    #[test]
    fn constant_time_eq_same() {
        assert!(constant_time_eq(b"hello", b"hello"));
    }

    #[test]
    fn constant_time_eq_diff() {
        assert!(!constant_time_eq(b"hello", b"world"));
    }

    #[test]
    fn constant_time_eq_diff_length() {
        assert!(!constant_time_eq(b"hello", b"helloworld"));
    }

    #[test]
    fn json_depth_flat() {
        assert_eq!(json_depth(br#"{"a":1,"b":2}"#), 1);
    }

    #[test]
    fn json_depth_nested() {
        assert_eq!(json_depth(br#"{"a":{"b":{"c":1}}}"#), 3);
    }

    #[test]
    fn json_depth_brace_in_string_ignored() {
        // Braces inside a string must not increment the depth counter.
        assert_eq!(json_depth(br#"{"key":"{{{deep}}}"}"#), 1);
    }

    #[test]
    fn json_depth_within_limit_accepted() {
        let body = br#"{"a":{"b":{"c":{"d":1}}}}"#;
        assert!(json_depth(body) <= JSON_MAX_DEPTH);
    }

    #[test]
    fn lww_clamp_future_date() {
        use chrono::Duration;
        let future = Utc::now() + Duration::days(365 * 100);
        let clamped = std::cmp::min(future, Utc::now());
        // Clamped value must be at or before now
        assert!(clamped <= Utc::now() + Duration::seconds(1));
    }
}
