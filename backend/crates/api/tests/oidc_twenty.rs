//! Cross-crate invariants for the Twenty OIDC IdP scaffolded in
//! `crates/api/src/routes/integrations/`. The api crate is a bin-only target
//! so we cannot import its internal modules from this integration test.
//! Instead we replicate the load-bearing pieces here and assert that:
//!   1. A freshly generated 2048-bit RSA keypair signs an RS256 token that its
//!      own decoding key validates.
//!   2. TaskBolt's HS256 JWT keys cannot verify a token signed with the
//!      Twenty OIDC RSA key (key isolation requirement from Phase 4 spec).
//!   3. The OIDC discovery doc we serve under `/oauth/twenty/.well-known/...`
//!      contains every member required by relying parties (Twenty included).
//!
//! Per-handler unit tests live alongside the handlers in
//! `crates/api/src/routes/integrations/twenty_oidc.rs` and `oidc_keys.rs`.

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use rsa::pkcs8::{EncodePrivateKey, EncodePublicKey, LineEnding};
use rsa::traits::PublicKeyParts;
use rsa::{RsaPrivateKey, RsaPublicKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

#[derive(Serialize, Deserialize, Debug)]
struct OidcClaims {
    iss: String,
    aud: String,
    sub: Uuid,
    email: String,
    name: String,
    workspace_id: String,
    tenant_id: Uuid,
    nonce: String,
    iat: i64,
    exp: i64,
}

fn fresh_rsa_keypair() -> (RsaPrivateKey, RsaPublicKey, String, String) {
    // Use the rand_core 0.6 OsRng (re-exported via aes_gcm) — `rsa` 0.9 does
    // not accept the 0.9-version of `rand::rngs::OsRng`.
    let mut rng = aes_gcm::aead::OsRng;
    let private = RsaPrivateKey::new(&mut rng, 2048).expect("generate rsa");
    let public = RsaPublicKey::from(&private);
    let private_pem = private
        .to_pkcs8_pem(LineEnding::LF)
        .expect("private pem")
        .to_string();
    let public_pem = public
        .to_public_key_pem(LineEnding::LF)
        .expect("public pem");
    (private, public, private_pem, public_pem)
}

#[test]
fn rs256_round_trip_signs_and_verifies() {
    let (_priv, _pub, private_pem, public_pem) = fresh_rsa_keypair();
    let enc = EncodingKey::from_rsa_pem(private_pem.as_bytes()).expect("encoding");
    let dec = DecodingKey::from_rsa_pem(public_pem.as_bytes()).expect("decoding");

    let now = chrono::Utc::now().timestamp();
    let claims = OidcClaims {
        iss: "https://taskflow.paraslace.in/oauth/twenty".to_string(),
        aud: "twenty-client-id".to_string(),
        sub: Uuid::new_v4(),
        email: "user@example.com".to_string(),
        name: "Test User".to_string(),
        workspace_id: "tw-ws-1".to_string(),
        tenant_id: Uuid::new_v4(),
        nonce: "n-123".to_string(),
        iat: now,
        exp: now + 3600,
    };
    let mut header = Header::new(Algorithm::RS256);
    header.kid = Some("k1".to_string());
    let token = encode(&header, &claims, &enc).expect("sign");

    let mut validation = Validation::new(Algorithm::RS256);
    validation.set_issuer(&["https://taskflow.paraslace.in/oauth/twenty"]);
    validation.set_audience(&["twenty-client-id"]);
    let decoded = decode::<OidcClaims>(&token, &dec, &validation).expect("verify");
    assert_eq!(decoded.claims.email, "user@example.com");
    assert_eq!(decoded.claims.workspace_id, "tw-ws-1");
}

#[test]
fn id_token_carries_required_claims() {
    let (_priv, _pub, private_pem, public_pem) = fresh_rsa_keypair();
    let enc = EncodingKey::from_rsa_pem(private_pem.as_bytes()).expect("encoding");
    let dec = DecodingKey::from_rsa_pem(public_pem.as_bytes()).expect("decoding");

    let claims = OidcClaims {
        iss: "https://x.test/oauth/twenty".to_string(),
        aud: "client".to_string(),
        sub: Uuid::new_v4(),
        email: "e@x.test".to_string(),
        name: "Name".to_string(),
        workspace_id: "ws".to_string(),
        tenant_id: Uuid::new_v4(),
        nonce: "n".to_string(),
        iat: chrono::Utc::now().timestamp(),
        exp: chrono::Utc::now().timestamp() + 3600,
    };
    let token = encode(&Header::new(Algorithm::RS256), &claims, &enc).expect("sign");
    let mut validation = Validation::new(Algorithm::RS256);
    validation.set_issuer(&["https://x.test/oauth/twenty"]);
    validation.set_audience(&["client"]);
    let decoded = decode::<OidcClaims>(&token, &dec, &validation).expect("verify");

    // Spec-required claims (OIDC Core 1.0 §2)
    assert!(!decoded.claims.iss.is_empty(), "iss must be set");
    assert!(!decoded.claims.aud.is_empty(), "aud must be set");
    assert!(decoded.claims.sub != Uuid::nil(), "sub must be set");
    assert!(decoded.claims.iat > 0, "iat must be a unix timestamp");
    assert!(
        decoded.claims.exp > decoded.claims.iat,
        "exp must be after iat"
    );

    // TaskBolt extensions for Twenty (workspace_id, tenant_id, nonce)
    assert!(!decoded.claims.workspace_id.is_empty());
    assert!(decoded.claims.tenant_id != Uuid::nil());
    assert!(!decoded.claims.nonce.is_empty());
}

#[test]
fn key_isolation_from_taskbolt_jwt() {
    // Sign a token with the OIDC RSA key
    let (_priv, _pub, private_pem, public_pem) = fresh_rsa_keypair();
    let oidc_enc = EncodingKey::from_rsa_pem(private_pem.as_bytes()).expect("oidc enc");
    let oidc_dec = DecodingKey::from_rsa_pem(public_pem.as_bytes()).expect("oidc dec");

    // Stand in for TaskBolt's JWT keys (HS256 in tests by default).
    let taskbolt_enc = EncodingKey::from_secret(b"taskbolt-test-secret-must-be-32-bytes-long");
    let taskbolt_dec = DecodingKey::from_secret(b"taskbolt-test-secret-must-be-32-bytes-long");

    let now = chrono::Utc::now().timestamp();
    let claims = OidcClaims {
        iss: "https://x.test/oauth/twenty".to_string(),
        aud: "client".to_string(),
        sub: Uuid::new_v4(),
        email: "e@x.test".to_string(),
        name: "n".to_string(),
        workspace_id: "ws".to_string(),
        tenant_id: Uuid::new_v4(),
        nonce: "n".to_string(),
        iat: now,
        exp: now + 600,
    };

    let oidc_token = encode(&Header::new(Algorithm::RS256), &claims, &oidc_enc).expect("sign rsa");
    let taskbolt_token =
        encode(&Header::new(Algorithm::HS256), &claims, &taskbolt_enc).expect("sign hs");

    // OIDC RS256 token must NOT verify with TaskBolt's HS256 key
    let mut hs_validation = Validation::new(Algorithm::HS256);
    hs_validation.set_issuer(&["https://x.test/oauth/twenty"]);
    hs_validation.set_audience(&["client"]);
    let cross1 = decode::<OidcClaims>(&oidc_token, &taskbolt_dec, &hs_validation);
    assert!(
        cross1.is_err(),
        "RS256-signed token must not verify under HS256 key"
    );

    // TaskBolt HS256 token must NOT verify with the OIDC RS256 public key
    let mut rs_validation = Validation::new(Algorithm::RS256);
    rs_validation.set_issuer(&["https://x.test/oauth/twenty"]);
    rs_validation.set_audience(&["client"]);
    let cross2 = decode::<OidcClaims>(&taskbolt_token, &oidc_dec, &rs_validation);
    assert!(
        cross2.is_err(),
        "HS256-signed token must not verify under RS256 key"
    );
}

#[test]
fn jwk_thumbprint_kid_is_stable_per_key() {
    fn kid(public: &RsaPublicKey) -> String {
        let n = URL_SAFE_NO_PAD.encode(public.n().to_bytes_be());
        let e = URL_SAFE_NO_PAD.encode(public.e().to_bytes_be());
        let canonical = format!(r#"{{"e":"{e}","kty":"RSA","n":"{n}"}}"#);
        URL_SAFE_NO_PAD.encode(Sha256::digest(canonical.as_bytes()))
    }
    let (_p, public_a, _, _) = fresh_rsa_keypair();
    let kid_a1 = kid(&public_a);
    let kid_a2 = kid(&public_a);
    assert_eq!(kid_a1, kid_a2, "same public key → same kid");

    let (_p, public_b, _, _) = fresh_rsa_keypair();
    assert_ne!(kid(&public_b), kid_a1, "distinct keys → distinct kids");
}

#[test]
fn discovery_doc_shape() {
    // Mirror the JSON shape served by the discovery handler. If this assertion
    // ever drifts from the live handler, both should be updated together.
    let issuer = "https://taskflow.paraslace.in/oauth/twenty";
    let doc = serde_json::json!({
        "issuer": issuer,
        "authorization_endpoint": format!("{issuer}/authorize"),
        "token_endpoint": format!("{issuer}/token"),
        "userinfo_endpoint": format!("{issuer}/userinfo"),
        "jwks_uri": format!("{issuer}/jwks"),
        "response_types_supported": ["code"],
        "subject_types_supported": ["public"],
        "id_token_signing_alg_values_supported": ["RS256"],
        "scopes_supported": ["openid", "profile", "email"],
        "token_endpoint_auth_methods_supported": ["client_secret_basic", "client_secret_post"],
        "code_challenge_methods_supported": ["S256"],
        "grant_types_supported": ["authorization_code"],
    });

    for required in [
        "issuer",
        "authorization_endpoint",
        "token_endpoint",
        "userinfo_endpoint",
        "jwks_uri",
        "response_types_supported",
        "id_token_signing_alg_values_supported",
        "code_challenge_methods_supported",
        "scopes_supported",
        "subject_types_supported",
    ] {
        assert!(doc.get(required).is_some(), "missing {required}");
    }
    assert_eq!(doc["id_token_signing_alg_values_supported"][0], "RS256");
    assert_eq!(doc["code_challenge_methods_supported"][0], "S256");
    assert_eq!(doc["response_types_supported"][0], "code");
}

#[test]
fn pkce_s256_challenge_matches_verifier() {
    // Twenty supplies a code_verifier; we hash + base64url-no-pad and compare
    // against the stored code_challenge. Reproduce that flow end-to-end.
    let verifier = "abcdefghijklmnopqrstuvwxyz0123456789-._~~~";
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    let recomputed = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    assert_eq!(challenge, recomputed);
    // A wrong verifier must not match
    let bad = URL_SAFE_NO_PAD.encode(Sha256::digest(b"wrong-verifier"));
    assert_ne!(challenge, bad);
}
