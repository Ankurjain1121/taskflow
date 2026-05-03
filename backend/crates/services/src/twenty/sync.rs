//! Phase 6c — timestamp-driven conflict resolution + push wrapper.
//!
//! Decision rule (Eng review tiebreaker):
//!   if local_updated_at  > twenty_updated_at → push to Twenty, then update mirror
//!   if local_updated_at <= twenty_updated_at → DROP, log per-field conflict
//!     (equal-second is a tie → Twenty wins, matches Eng review T1)
//!
//! `push_job` is the worker entry point: it reads the mirror, runs `decide_conflict`,
//! and either calls Twenty or skips with a conflict log row.

use std::cmp::Ordering;

use chrono::{DateTime, Utc};
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

use taskbolt_db::queries::crm_sync::{
    self, get_mirror_updated_at, log_conflict, touch_mirror_after_push, validate_payload_fields,
    ConflictLogEntry, CrmSyncError, CrmSyncJob,
};

use super::client::{TwentyClient, TwentyError, UpsertOutcome};

/// Result of a conflict check.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConflictDecision {
    /// Local edit is newer; safe to push.
    Push,
    /// Twenty's mirror is at least as new; drop the outbound write.
    /// `reason` distinguishes the strict-newer case from the equal-second tie.
    Skip { resolution: ConflictResolution },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConflictResolution {
    /// `twenty_updated_at > local_updated_at`
    TwentyWinsTimestamp,
    /// `twenty_updated_at == local_updated_at` (tiebreaker per Eng review)
    TwentyWinsTie,
}

impl ConflictResolution {
    pub fn as_str(self) -> &'static str {
        match self {
            ConflictResolution::TwentyWinsTimestamp => "twenty_wins_timestamp",
            ConflictResolution::TwentyWinsTie => "twenty_wins_tie",
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum OutboundError {
    #[error("DB error: {0}")]
    Db(#[from] CrmSyncError),
    #[error("Twenty error: {0}")]
    Twenty(#[from] TwentyError),
    #[error("Payload missing required field: {0}")]
    MissingPayloadField(&'static str),
    #[error("No twenty_id available for delete operation")]
    DeleteWithoutTwentyId,
}

impl OutboundError {
    /// Whether this error class warrants a retry (worker bumps retry_count)
    /// vs being permanently rejected (worker → DLQ immediately).
    pub fn is_retryable(&self) -> bool {
        match self {
            OutboundError::Db(_) => true, // transient PG hiccups
            OutboundError::Twenty(e) => e.is_retryable(),
            OutboundError::MissingPayloadField(_) | OutboundError::DeleteWithoutTwentyId => false,
        }
    }
}

#[derive(Debug, Clone)]
pub enum PushOutcome {
    /// Pushed to Twenty and mirror touched.
    Pushed,
    /// Dropped because conflict resolver said Twenty is newer.
    DroppedByConflict { resolution: ConflictResolution },
}

// ── decision logic ───────────────────────────────────────────────────────────

/// Pure decision function — testable without a DB. Captures the entire 6c rule.
/// `local_updated_at` comes from the outbound payload; `twenty_updated_at` from
/// the mirror cache (None when there is no prior mirror row).
pub fn decide_conflict(
    local_updated_at: DateTime<Utc>,
    twenty_updated_at: Option<DateTime<Utc>>,
) -> ConflictDecision {
    match twenty_updated_at {
        None => ConflictDecision::Push, // first ever sync, no mirror yet
        Some(twenty) => match local_updated_at.cmp(&twenty) {
            Ordering::Greater => ConflictDecision::Push,
            Ordering::Equal => ConflictDecision::Skip {
                resolution: ConflictResolution::TwentyWinsTie,
            },
            Ordering::Less => ConflictDecision::Skip {
                resolution: ConflictResolution::TwentyWinsTimestamp,
            },
        },
    }
}

// ── helpers: payload parsing ────────────────────────────────────────────────

fn payload_field_str<'a>(payload: &'a Value, key: &'static str) -> Option<&'a str> {
    payload.get(key).and_then(|v| v.as_str())
}

fn payload_local_updated_at(payload: &Value) -> Result<DateTime<Utc>, OutboundError> {
    let s = payload_field_str(payload, "local_updated_at")
        .ok_or(OutboundError::MissingPayloadField("local_updated_at"))?;
    s.parse::<DateTime<Utc>>()
        .map_err(|_| OutboundError::MissingPayloadField("local_updated_at"))
}

/// Map our entity_type to the Twenty REST collection name.
fn entity_to_twenty_object(entity_type: &str) -> &'static str {
    match entity_type {
        "company" => "companies",
        "deal" => "opportunities",
        _ => "people", // contact + fallback; DB CHECK constraint guards invalid values
    }
}

// ── outbound push ────────────────────────────────────────────────────────────

/// Process one claimed job: resolve conflict, either push or drop.
/// All retry/DLQ bookkeeping is the caller's responsibility — this function
/// returns the outcome and the worker decides what to record.
pub async fn push_job(
    pool: &PgPool,
    client: &TwentyClient,
    job: &CrmSyncJob,
) -> Result<PushOutcome, OutboundError> {
    // Defence in depth — re-validate the payload allowlist (the enqueue API
    // already checked, but the row could pre-date a tightened allowlist).
    validate_payload_fields(&job.payload)?;

    let object = entity_to_twenty_object(&job.entity_type);
    let twenty_id_opt = payload_field_str(&job.payload, "twenty_id");

    match job.operation.as_str() {
        "delete" => {
            let twenty_id = twenty_id_opt.ok_or(OutboundError::DeleteWithoutTwentyId)?;
            client.delete_object(object, twenty_id).await?;
            // No mirror touch on delete — the inbound webhook sets deleted_at.
            Ok(PushOutcome::Pushed)
        }
        _ => {
            // upsert path with conflict check
            let local_updated = payload_local_updated_at(&job.payload)?;

            let mirror_updated = match twenty_id_opt {
                Some(id) => {
                    let parsed = id.parse::<Uuid>().ok();
                    match parsed {
                        Some(uuid) => {
                            get_mirror_updated_at(
                                pool,
                                &job.entity_type,
                                &job.twenty_workspace_id,
                                uuid,
                            )
                            .await?
                        }
                        None => None, // unparseable id → no prior mirror
                    }
                }
                None => None,
            };

            match decide_conflict(local_updated, mirror_updated) {
                ConflictDecision::Push => {
                    // Build the body: just the allow-listed fields.
                    let body = build_upsert_body(&job.payload);

                    let outcome = client.upsert_object(object, twenty_id_opt, &body).await?;

                    // Touch mirror so the next conflict check sees the new state.
                    // The mirror's authoritative timestamp will arrive via inbound
                    // webhook; we set it pessimistically to local_updated to avoid
                    // a same-second loop.
                    if let Some(returned_id) = upsert_outcome_id(&outcome).or(twenty_id_opt) {
                        if let Ok(uuid) = returned_id.parse::<Uuid>() {
                            let _ = touch_mirror_after_push(
                                pool,
                                &job.entity_type,
                                &job.twenty_workspace_id,
                                uuid,
                                local_updated,
                            )
                            .await;
                        }
                    }
                    Ok(PushOutcome::Pushed)
                }
                ConflictDecision::Skip { resolution } => {
                    log_dropped_fields(pool, job, &resolution, local_updated, mirror_updated)
                        .await?;
                    Ok(PushOutcome::DroppedByConflict { resolution })
                }
            }
        }
    }
}

fn build_upsert_body(payload: &Value) -> Value {
    let mut out = serde_json::Map::new();
    if let Some(fields) = payload.get("fields").and_then(|v| v.as_object()) {
        for (k, v) in fields {
            if crm_sync::ALLOWED_OUTBOUND_FIELDS.contains(&k.as_str()) {
                out.insert(k.clone(), v.clone());
            }
        }
    }
    Value::Object(out)
}

fn upsert_outcome_id(outcome: &UpsertOutcome) -> Option<&str> {
    match outcome {
        UpsertOutcome::Created { id, .. } | UpsertOutcome::Updated { id, .. } => {
            if id.is_empty() {
                None
            } else {
                Some(id.as_str())
            }
        }
        UpsertOutcome::AlreadyExists => None,
    }
}

async fn log_dropped_fields(
    pool: &PgPool,
    job: &CrmSyncJob,
    resolution: &ConflictResolution,
    local_updated: DateTime<Utc>,
    mirror_updated: Option<DateTime<Utc>>,
) -> Result<(), CrmSyncError> {
    let Some(fields) = job.payload.get("fields").and_then(|v| v.as_object()) else {
        // No fields — log a single placeholder row so the conflict is still visible.
        log_conflict(
            pool,
            ConflictLogEntry {
                tenant_id: job.tenant_id,
                twenty_workspace_id: &job.twenty_workspace_id,
                entity_type: &job.entity_type,
                entity_id: job.entity_id,
                field_name: "<entire_payload>",
                taskbolt_value: Some(&job.payload),
                twenty_value: None,
                resolution: resolution.as_str(),
                taskbolt_updated_at: Some(local_updated),
                twenty_updated_at: mirror_updated,
                source_job_id: Some(job.id),
            },
        )
        .await?;
        return Ok(());
    };

    for (field_name, taskbolt_value) in fields {
        log_conflict(
            pool,
            ConflictLogEntry {
                tenant_id: job.tenant_id,
                twenty_workspace_id: &job.twenty_workspace_id,
                entity_type: &job.entity_type,
                entity_id: job.entity_id,
                field_name,
                taskbolt_value: Some(taskbolt_value),
                twenty_value: None, // The current Twenty value is on the mirror; an admin can fetch it.
                resolution: resolution.as_str(),
                taskbolt_updated_at: Some(local_updated),
                twenty_updated_at: mirror_updated,
                source_job_id: Some(job.id),
            },
        )
        .await?;
    }
    Ok(())
}

// ── tests (pure logic only) ─────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;
    use serde_json::json;

    fn ts(unix: i64) -> DateTime<Utc> {
        Utc.timestamp_opt(unix, 0).unwrap()
    }

    #[test]
    fn local_strictly_newer_pushes() {
        let dec = decide_conflict(ts(200), Some(ts(100)));
        assert_eq!(dec, ConflictDecision::Push);
    }

    #[test]
    fn twenty_strictly_newer_skips_with_timestamp_resolution() {
        let dec = decide_conflict(ts(100), Some(ts(200)));
        assert_eq!(
            dec,
            ConflictDecision::Skip {
                resolution: ConflictResolution::TwentyWinsTimestamp
            }
        );
    }

    #[test]
    fn equal_second_skips_with_tie_resolution() {
        let dec = decide_conflict(ts(150), Some(ts(150)));
        assert_eq!(
            dec,
            ConflictDecision::Skip {
                resolution: ConflictResolution::TwentyWinsTie
            }
        );
    }

    #[test]
    fn no_mirror_pushes_first_time() {
        let dec = decide_conflict(ts(150), None);
        assert_eq!(dec, ConflictDecision::Push);
    }

    #[test]
    fn build_body_filters_to_allowlist() {
        let payload = json!({"fields": {"email": "x@y.com", "name": "evil"}});
        let body = build_upsert_body(&payload);
        let obj = body.as_object().unwrap();
        assert!(obj.contains_key("email"));
        assert!(!obj.contains_key("name"));
    }

    #[test]
    fn entity_object_mapping() {
        assert_eq!(entity_to_twenty_object("contact"), "people");
        assert_eq!(entity_to_twenty_object("company"), "companies");
        assert_eq!(entity_to_twenty_object("deal"), "opportunities");
    }

    #[test]
    fn outbound_error_retry_classification() {
        let bad_field = OutboundError::MissingPayloadField("local_updated_at");
        assert!(!bad_field.is_retryable());
        let no_id = OutboundError::DeleteWithoutTwentyId;
        assert!(!no_id.is_retryable());

        let twenty_500 = OutboundError::Twenty(TwentyError::Api {
            status: 500,
            body: "boom".into(),
        });
        assert!(twenty_500.is_retryable());

        let twenty_400 = OutboundError::Twenty(TwentyError::Api {
            status: 400,
            body: "bad req".into(),
        });
        assert!(!twenty_400.is_retryable());
    }
}
