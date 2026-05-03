//! Twenty client schema-drift resilience tests.
//!
//! Verifies that the Twenty API client handles payloads from newer Twenty
//! versions gracefully — unknown fields are ignored rather than causing a
//! parse failure or crash.
//!
//! # Structure
//!
//! * **Pure serde unit tests** (compile + run today) — demonstrate the expected
//!   deserialisation contract using inline mock structs that mirror how the real
//!   `TwentyPerson` / `TwentyCompany` types should be defined (no `deny_unknown_fields`).
//!
//! * **Integration stubs** (`#[ignore]`) — test the actual `TwentyClient`
//!   once W4 exports the type.

use serde::Deserialize;

// ─── Mock structs (mirrors of what W4 should export) ─────────────────────────
//
// These stand in for the real Twenty client types that live in W4
// (backend-sso / backend-sync-in). When W4 lands, replace these with:
//   use taskbolt_services::crm::client::{TwentyPerson, TwentyCompany, TwentyDeal};

#[derive(Debug, Deserialize, PartialEq)]
struct MockTwentyPerson {
    id: String,
    #[serde(rename = "name")]
    display_name: Option<String>,
    email: Option<String>,
    #[serde(rename = "createdAt")]
    created_at: Option<String>,
    #[serde(rename = "updatedAt")]
    updated_at: Option<String>,
    // Intentionally omits phone_number, linkedin_url etc. — should be ignored.
}

#[derive(Debug, Deserialize, PartialEq)]
struct MockTwentyCompany {
    id: String,
    name: Option<String>,
    #[serde(rename = "domainName")]
    domain_name: Option<String>,
    #[serde(rename = "updatedAt")]
    updated_at: Option<String>,
}

#[derive(Debug, Deserialize, PartialEq)]
struct MockTwentyDeal {
    id: String,
    name: Option<String>,
    stage: Option<String>,
    amount: Option<serde_json::Value>,
    #[serde(rename = "updatedAt")]
    updated_at: Option<String>,
}

// ─── T-DRIFT-1: Person with extra v2.3.0 fields ──────────────────────────────

#[test]
fn test_person_payload_with_extra_fields_deserializes_without_crash() {
    // Payload from a hypothetical Twenty v2.3.0 that added phone_number,
    // linkedin_url, and an array field.  Our client must ignore these.
    let payload = serde_json::json!({
        "id": "person-v23-001",
        "name": "Alice Smith",
        "email": "alice@example.com",
        "createdAt": "2026-05-03T08:00:00Z",
        "updatedAt": "2026-05-03T08:00:00Z",
        // v2.3.0 additions — must be silently ignored
        "phone_number": "+1-555-0100",
        "linkedin_url": "https://linkedin.com/in/alice",
        "custom_fields": [{ "key": "tier", "value": "enterprise" }],
        "deeply_nested": { "a": { "b": { "c": 42 } } }
    });

    let result: Result<MockTwentyPerson, _> = serde_json::from_value(payload);
    assert!(
        result.is_ok(),
        "extra unknown fields must not crash person deserialization: {:?}",
        result.err()
    );
    let person = result.unwrap();
    assert_eq!(person.id, "person-v23-001");
    assert_eq!(person.email.as_deref(), Some("alice@example.com"));
}

// ─── T-DRIFT-2: Company with extra fields ────────────────────────────────────

#[test]
fn test_company_payload_with_extra_fields_deserializes_without_crash() {
    let payload = serde_json::json!({
        "id": "company-v23-001",
        "name": "Acme Corp",
        "domainName": "acme.com",
        "updatedAt": "2026-05-03T08:00:00Z",
        // future fields
        "employee_count": 500,
        "funding_stage": "series-b",
        "tags": ["tech", "b2b"]
    });

    let result: Result<MockTwentyCompany, _> = serde_json::from_value(payload);
    assert!(
        result.is_ok(),
        "extra unknown fields must not crash company deserialization: {:?}",
        result.err()
    );
    let company = result.unwrap();
    assert_eq!(company.id, "company-v23-001");
    assert_eq!(company.domain_name.as_deref(), Some("acme.com"));
}

// ─── T-DRIFT-3: Deal with extra + renamed fields ──────────────────────────────

#[test]
fn test_deal_payload_with_extra_fields_deserializes_without_crash() {
    let payload = serde_json::json!({
        "id": "deal-v23-001",
        "name": "Acme Q2 Renewal",
        "stage": "proposal",
        "amount": { "amountMicros": 500000000, "currencyCode": "USD" },
        "updatedAt": "2026-05-03T08:00:00Z",
        // future fields
        "probability": 0.75,
        "forecast_category": "commit",
        "owner": { "id": "user-001", "name": "Bob" }
    });

    let result: Result<MockTwentyDeal, _> = serde_json::from_value(payload);
    assert!(
        result.is_ok(),
        "extra unknown fields must not crash deal deserialization: {:?}",
        result.err()
    );
    let deal = result.unwrap();
    assert_eq!(deal.id, "deal-v23-001");
    assert_eq!(deal.stage.as_deref(), Some("proposal"));
}

// ─── T-DRIFT-4: Null values on optional fields ───────────────────────────────

#[test]
fn test_person_payload_with_null_optional_fields_deserializes() {
    let payload = serde_json::json!({
        "id": "person-nulls-001",
        "name": null,
        "email": null,
        "createdAt": null,
        "updatedAt": null
    });

    let result: Result<MockTwentyPerson, _> = serde_json::from_value(payload);
    assert!(
        result.is_ok(),
        "null optional fields must not crash: {:?}",
        result.err()
    );
    let person = result.unwrap();
    assert_eq!(person.id, "person-nulls-001");
    assert!(person.email.is_none());
}

// ─── T-DRIFT-5: Completely empty object ──────────────────────────────────────

#[test]
fn test_person_payload_minimum_fields_deserializes() {
    // Only the required `id` field is present.
    let payload = serde_json::json!({ "id": "person-minimal-001" });

    let result: Result<MockTwentyPerson, _> = serde_json::from_value(payload);
    assert!(
        result.is_ok(),
        "payload with only required fields must deserialize: {:?}",
        result.err()
    );
}

// ─── T-DRIFT-6 (integration stub): Real TwentyClient processes drifted payload

#[ignore = "requires CRM Phase 9 merge (W4: TwentyClient export from taskbolt-services)"]
#[test]
fn test_twenty_client_version_tolerant_deserialize_real_type() {
    // TODO(W12): Replace MockTwentyPerson with the real type from W4:
    // use taskbolt_services::crm::client::TwentyPerson;
    //
    // let payload = serde_json::json!({
    //     "id": "person-real-001",
    //     "name": { "firstName": "Test", "lastName": "User" },
    //     "createdAt": "2026-05-03T08:00:00Z",
    //     "updatedAt": "2026-05-03T08:00:00Z",
    //     "extra_field_v3": "should be ignored",
    // });
    //
    // let result: Result<TwentyPerson, _> = serde_json::from_value(payload);
    // assert!(result.is_ok(), "real TwentyPerson must tolerate unknown fields");

    todo!("T-DRIFT-6: import real TwentyPerson from W4 taskbolt-services")
}
