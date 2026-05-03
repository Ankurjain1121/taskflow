//! Twenty OIDC IdP endpoints.
//!
//! TaskBolt acts as the OpenID Connect IdP for Twenty. Twenty initiates the
//! authorization-code + PKCE flow against `/oauth/twenty/*` and consumes the
//! resulting RS256-signed ID token via its built-in `oidc.auth.strategy.ts`.
//!
//! Issuer: `https://taskflow.paraslace.in/oauth/twenty` (override with
//! `TWENTY_OIDC_ISSUER`).

use std::sync::Arc;

use axum::{
    extract::{Extension, Form, Query, State},
    http::StatusCode,
    response::{IntoResponse, Json, Redirect, Response},
    routing::{get, post},
    Router,
};
use aes_gcm::aead::rand_core::RngCore;
use aes_gcm::aead::OsRng;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use chrono::{Duration, Utc};
use jsonwebtoken::Header;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use taskbolt_db::queries::crm_workspace_links;

use crate::extractors::auth::AuthUserExtractor;
use crate::routes::integrations::crm_crypto;
use crate::routes::integrations::oidc_keys::TwentyOidcKeys;
use crate::state::AppState;

const CODE_TTL_SECS: u64 = 600; // 10 min
const STATE_NONCE_TTL_SECS: u64 = 300; // 5 min
const ID_TOKEN_TTL_SECS: i64 = 3_600; // 1 hr
const ACCESS_TOKEN_TTL_SECS: u64 = 3_600;
const DEFAULT_ISSUER: &str = "https://taskflow.paraslace.in/oauth/twenty";

fn issuer() -> String {
    std::env::var("TWENTY_OIDC_ISSUER").unwrap_or_else(|_| DEFAULT_ISSUER.to_string())
}

fn allowed_redirect_prefix() -> Option<String> {
    std::env::var("TWENTY_BASE_URL").ok().filter(|s| !s.is_empty())
}

/// Build the `/oauth/twenty/*` router. Caller must layer on
/// `Extension(Arc::new(TwentyOidcKeys::...))`.
pub fn twenty_oidc_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route(
            "/oauth/twenty/.well-known/openid-configuration",
            get(discovery_handler),
        )
        .route("/oauth/twenty/jwks", get(jwks_handler))
        .route("/oauth/twenty/authorize", get(authorize_handler))
        .route("/oauth/twenty/token", post(token_handler))
        .route("/oauth/twenty/userinfo", get(userinfo_handler))
        .with_state(state)
}

// ── Discovery ────────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct DiscoveryDoc {
    issuer: String,
    authorization_endpoint: String,
    token_endpoint: String,
    userinfo_endpoint: String,
    jwks_uri: String,
    response_types_supported: Vec<String>,
    subject_types_supported: Vec<String>,
    id_token_signing_alg_values_supported: Vec<String>,
    scopes_supported: Vec<String>,
    token_endpoint_auth_methods_supported: Vec<String>,
    code_challenge_methods_supported: Vec<String>,
    grant_types_supported: Vec<String>,
}

async fn discovery_handler() -> Json<DiscoveryDoc> {
    let iss = issuer();
    Json(DiscoveryDoc {
        authorization_endpoint: format!("{iss}/authorize"),
        token_endpoint: format!("{iss}/token"),
        userinfo_endpoint: format!("{iss}/userinfo"),
        jwks_uri: format!("{iss}/jwks"),
        issuer: iss,
        response_types_supported: vec!["code".to_string()],
        subject_types_supported: vec!["public".to_string()],
        id_token_signing_alg_values_supported: vec!["RS256".to_string()],
        scopes_supported: vec![
            "openid".to_string(),
            "profile".to_string(),
            "email".to_string(),
        ],
        token_endpoint_auth_methods_supported: vec![
            "client_secret_basic".to_string(),
            "client_secret_post".to_string(),
        ],
        code_challenge_methods_supported: vec!["S256".to_string()],
        grant_types_supported: vec!["authorization_code".to_string()],
    })
}

// ── JWKS ─────────────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct Jwks {
    keys: Vec<serde_json::Value>,
}

async fn jwks_handler(Extension(keys): Extension<Arc<TwentyOidcKeys>>) -> Json<Jwks> {
    Json(Jwks {
        keys: vec![keys.jwk()],
    })
}

// ── Authorize ────────────────────────────────────────────────────────────────

#[derive(Deserialize, Debug)]
pub struct AuthorizeQuery {
    pub response_type: String,
    pub client_id: String,
    pub redirect_uri: String,
    pub state: String,
    pub nonce: String,
    pub code_challenge: String,
    #[serde(default)]
    pub code_challenge_method: Option<String>,
    #[serde(default)]
    pub scope: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
struct StoredCode {
    user_id: Uuid,
    tenant_id: Uuid,
    link_id: Uuid,
    twenty_workspace_id: String,
    client_id: String,
    redirect_uri: String,
    nonce: String,
    code_challenge: String,
}

async fn authorize_handler(
    State(state): State<AppState>,
    AuthUserExtractor(auth_user): AuthUserExtractor,
    Query(params): Query<AuthorizeQuery>,
) -> Result<Response, (StatusCode, Json<ErrorBody>)> {
    if params.response_type != "code" {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "unsupported_response_type",
            "only response_type=code is supported",
        ));
    }
    if params
        .code_challenge_method
        .as_deref()
        .map_or(false, |m| !m.eq_ignore_ascii_case("S256"))
    {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "invalid_request",
            "code_challenge_method must be S256",
        ));
    }
    if params.code_challenge.is_empty() {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "invalid_request",
            "PKCE code_challenge is required",
        ));
    }

    if let Some(prefix) = allowed_redirect_prefix() {
        if !params.redirect_uri.starts_with(&prefix) {
            return Err(error(
                StatusCode::BAD_REQUEST,
                "invalid_request",
                "redirect_uri not allowed for this issuer",
            ));
        }
    }

    let scope = crm_workspace_links::TenantScope::new(auth_user.tenant_id, auth_user.user_id);
    let link = crm_workspace_links::get_active_for_tenant(&state.db, &scope)
        .await
        .map_err(|e| {
            tracing::error!(?e, "crm link lookup failed");
            error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "server_error",
                "lookup failed",
            )
        })?
        .ok_or_else(|| {
            error(
                StatusCode::FORBIDDEN,
                "access_denied",
                "no active CRM workspace link for this tenant",
            )
        })?;

    if link.twenty_oidc_client_id != params.client_id {
        return Err(error(
            StatusCode::FORBIDDEN,
            "unauthorized_client",
            "client_id does not match registered link",
        ));
    }

    // One-time state+nonce TTL guard (5 min) — protects against replay if Twenty
    // re-uses the same state value. SET NX EX is a single atomic command.
    let state_key = format!("twenty_oidc:state:{}", params.state);
    let mut redis = state.redis.clone();
    let setnx: Option<String> = redis::cmd("SET")
        .arg(&state_key)
        .arg(&params.nonce)
        .arg("NX")
        .arg("EX")
        .arg(STATE_NONCE_TTL_SECS)
        .query_async(&mut redis)
        .await
        .map_err(|e| {
            tracing::error!(?e, "redis SET NX EX failed");
            error(StatusCode::INTERNAL_SERVER_ERROR, "server_error", "redis")
        })?;
    if setnx.is_none() {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "invalid_request",
            "state value already used",
        ));
    }

    // Issue authorization code
    let code = random_url_token();
    let stored = StoredCode {
        user_id: auth_user.user_id,
        tenant_id: auth_user.tenant_id,
        link_id: link.id,
        twenty_workspace_id: link.twenty_workspace_id.clone(),
        client_id: link.twenty_oidc_client_id.clone(),
        redirect_uri: params.redirect_uri.clone(),
        nonce: params.nonce.clone(),
        code_challenge: params.code_challenge.clone(),
    };
    let code_key = format!("twenty_oidc:code:{code}");
    let payload = serde_json::to_string(&stored).map_err(|e| {
        tracing::error!(?e, "serialize stored code failed");
        error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "server_error",
            "serialize",
        )
    })?;
    let _: () = redis::cmd("SET")
        .arg(&code_key)
        .arg(payload)
        .arg("EX")
        .arg(CODE_TTL_SECS)
        .query_async(&mut redis)
        .await
        .map_err(|e| {
            tracing::error!(?e, "redis SETEX code failed");
            error(StatusCode::INTERNAL_SERVER_ERROR, "server_error", "redis")
        })?;

    let separator = if params.redirect_uri.contains('?') {
        '&'
    } else {
        '?'
    };
    let redirect = format!(
        "{}{separator}code={}&state={}",
        params.redirect_uri,
        urlencoding::encode_str(&code),
        urlencoding::encode_str(&params.state),
    );
    Ok(Redirect::to(&redirect).into_response())
}

// ── Token ────────────────────────────────────────────────────────────────────

#[derive(Deserialize, Debug)]
pub struct TokenRequest {
    pub grant_type: String,
    pub code: String,
    pub redirect_uri: String,
    pub client_id: String,
    pub client_secret: String,
    pub code_verifier: String,
}

#[derive(Serialize)]
struct TokenResponse {
    access_token: String,
    token_type: &'static str,
    expires_in: i64,
    id_token: String,
}

#[derive(Serialize, Deserialize)]
struct IdTokenClaims {
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

async fn token_handler(
    State(state): State<AppState>,
    Extension(keys): Extension<Arc<TwentyOidcKeys>>,
    Form(req): Form<TokenRequest>,
) -> Result<Json<TokenResponse>, (StatusCode, Json<ErrorBody>)> {
    if req.grant_type != "authorization_code" {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "unsupported_grant_type",
            "only authorization_code is supported",
        ));
    }

    let mut redis = state.redis.clone();
    let code_key = format!("twenty_oidc:code:{}", req.code);
    // Atomic one-time-read via GETDEL (Redis 6.2+).
    let stored_json: Option<String> = redis::cmd("GETDEL")
        .arg(&code_key)
        .query_async(&mut redis)
        .await
        .map_err(|e| {
            tracing::error!(?e, "redis GETDEL code failed");
            error(StatusCode::INTERNAL_SERVER_ERROR, "server_error", "redis")
        })?;
    let stored_json = stored_json.ok_or_else(|| {
        error(
            StatusCode::BAD_REQUEST,
            "invalid_grant",
            "code expired or unknown",
        )
    })?;
    let stored: StoredCode = serde_json::from_str(&stored_json).map_err(|e| {
        tracing::error!(?e, "deserialize stored code failed");
        error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "server_error",
            "decode",
        )
    })?;

    if stored.client_id != req.client_id {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "invalid_grant",
            "client_id mismatch",
        ));
    }
    if stored.redirect_uri != req.redirect_uri {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "invalid_grant",
            "redirect_uri mismatch",
        ));
    }

    // Verify PKCE: BASE64URL(SHA256(code_verifier)) == stored.code_challenge
    let computed = URL_SAFE_NO_PAD.encode(Sha256::digest(req.code_verifier.as_bytes()));
    if !constant_time_eq(computed.as_bytes(), stored.code_challenge.as_bytes()) {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "invalid_grant",
            "PKCE verification failed",
        ));
    }

    // Validate client_secret against the link record (decrypt + constant-time eq).
    let link = crm_workspace_links::get_by_twenty_workspace_id(&state.db, &stored.twenty_workspace_id)
        .await
        .map_err(|e| {
            tracing::error!(?e, "crm link relookup failed");
            error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "server_error",
                "lookup",
            )
        })?
        .ok_or_else(|| {
            error(
                StatusCode::BAD_REQUEST,
                "invalid_grant",
                "link no longer active",
            )
        })?;
    let stored_secret = crm_crypto::decrypt(&link.twenty_oidc_client_secret_encrypted)
        .map_err(|e| {
            tracing::error!(?e, "decrypt client secret failed");
            error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "server_error",
                "decrypt",
            )
        })?;
    if !constant_time_eq(stored_secret.as_slice(), req.client_secret.as_bytes()) {
        return Err(error(
            StatusCode::UNAUTHORIZED,
            "invalid_client",
            "client authentication failed",
        ));
    }

    // Look up the user (bypass RLS via direct lookup on this trusted code-bound id)
    let user = taskbolt_db::queries::auth::get_user_by_id(&state.db, stored.user_id)
        .await
        .map_err(|e| {
            tracing::error!(?e, "user lookup failed");
            error(StatusCode::INTERNAL_SERVER_ERROR, "server_error", "lookup")
        })?
        .ok_or_else(|| {
            error(
                StatusCode::BAD_REQUEST,
                "invalid_grant",
                "user no longer exists",
            )
        })?;

    let now = Utc::now();
    let claims = IdTokenClaims {
        iss: issuer(),
        aud: stored.client_id.clone(),
        sub: user.id,
        email: user.email.clone(),
        name: user.name.clone(),
        workspace_id: stored.twenty_workspace_id.clone(),
        tenant_id: stored.tenant_id,
        nonce: stored.nonce.clone(),
        iat: now.timestamp(),
        exp: (now + Duration::seconds(ID_TOKEN_TTL_SECS)).timestamp(),
    };
    let mut header = Header::new(jsonwebtoken::Algorithm::RS256);
    header.kid = Some(keys.kid.clone());
    let id_token = jsonwebtoken::encode(&header, &claims, &keys.encoding).map_err(|e| {
        tracing::error!(?e, "JWT encode failed");
        error(StatusCode::INTERNAL_SERVER_ERROR, "server_error", "sign")
    })?;

    // Opaque access token for /userinfo (separate from id_token).
    let access_token = random_url_token();
    let user_info = StoredAccessToken {
        user_id: user.id,
        email: user.email.clone(),
        name: user.name.clone(),
        workspace_id: stored.twenty_workspace_id.clone(),
        tenant_id: stored.tenant_id,
    };
    let user_info_json = serde_json::to_string(&user_info).map_err(|e| {
        tracing::error!(?e, "serialize access token info failed");
        error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "server_error",
            "serialize",
        )
    })?;
    let access_key = format!("twenty_oidc:access:{access_token}");
    let _: () = redis::cmd("SET")
        .arg(&access_key)
        .arg(user_info_json)
        .arg("EX")
        .arg(ACCESS_TOKEN_TTL_SECS)
        .query_async(&mut redis)
        .await
        .map_err(|e| {
            tracing::error!(?e, "redis SETEX access failed");
            error(StatusCode::INTERNAL_SERVER_ERROR, "server_error", "redis")
        })?;

    Ok(Json(TokenResponse {
        access_token,
        token_type: "Bearer",
        expires_in: ID_TOKEN_TTL_SECS,
        id_token,
    }))
}

// ── Userinfo ─────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
struct StoredAccessToken {
    user_id: Uuid,
    email: String,
    name: String,
    workspace_id: String,
    tenant_id: Uuid,
}

#[derive(Serialize)]
struct UserInfoResponse {
    sub: Uuid,
    email: String,
    name: String,
    workspace_id: String,
    tenant_id: Uuid,
}

async fn userinfo_handler(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
) -> Result<Json<UserInfoResponse>, (StatusCode, Json<ErrorBody>)> {
    let token = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| {
            error(
                StatusCode::UNAUTHORIZED,
                "invalid_token",
                "missing bearer token",
            )
        })?;

    let mut redis = state.redis.clone();
    let key = format!("twenty_oidc:access:{token}");
    let raw: Option<String> = redis::cmd("GET")
        .arg(&key)
        .query_async(&mut redis)
        .await
        .map_err(|e| {
            tracing::error!(?e, "redis GET access failed");
            error(StatusCode::INTERNAL_SERVER_ERROR, "server_error", "redis")
        })?;
    let raw = raw.ok_or_else(|| {
        error(
            StatusCode::UNAUTHORIZED,
            "invalid_token",
            "token expired or unknown",
        )
    })?;
    let info: StoredAccessToken = serde_json::from_str(&raw).map_err(|e| {
        tracing::error!(?e, "deserialize access token info failed");
        error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "server_error",
            "decode",
        )
    })?;

    Ok(Json(UserInfoResponse {
        sub: info.user_id,
        email: info.email,
        name: info.name,
        workspace_id: info.workspace_id,
        tenant_id: info.tenant_id,
    }))
}

// ── Helpers ──────────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct ErrorBody {
    pub error: String,
    pub error_description: String,
}

fn error(status: StatusCode, code: &str, desc: &str) -> (StatusCode, Json<ErrorBody>) {
    (
        status,
        Json(ErrorBody {
            error: code.to_string(),
            error_description: desc.to_string(),
        }),
    )
}

fn random_url_token() -> String {
    let mut bytes = [0u8; 32];
    OsRng.fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

/// Constant-time byte comparison.
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut acc: u8 = 0;
    for (x, y) in a.iter().zip(b.iter()) {
        acc |= x ^ y;
    }
    acc == 0
}

mod urlencoding {
    /// Minimal RFC 3986 percent-encoder for query-string values.
    pub fn encode_str(s: &str) -> String {
        let mut out = String::with_capacity(s.len());
        for b in s.as_bytes() {
            if matches!(b,
                b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' |
                b'-' | b'_' | b'.' | b'~'
            ) {
                out.push(*b as char);
            } else {
                out.push_str(&format!("%{b:02X}"));
            }
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn discovery_doc_has_required_endpoints() {
        let doc = serde_json::to_value(DiscoveryDoc {
            issuer: "https://x.test/oauth/twenty".to_string(),
            authorization_endpoint: "https://x.test/oauth/twenty/authorize".to_string(),
            token_endpoint: "https://x.test/oauth/twenty/token".to_string(),
            userinfo_endpoint: "https://x.test/oauth/twenty/userinfo".to_string(),
            jwks_uri: "https://x.test/oauth/twenty/jwks".to_string(),
            response_types_supported: vec!["code".to_string()],
            subject_types_supported: vec!["public".to_string()],
            id_token_signing_alg_values_supported: vec!["RS256".to_string()],
            scopes_supported: vec!["openid".to_string()],
            token_endpoint_auth_methods_supported: vec!["client_secret_post".to_string()],
            code_challenge_methods_supported: vec!["S256".to_string()],
            grant_types_supported: vec!["authorization_code".to_string()],
        })
        .expect("serialize");
        for k in [
            "issuer",
            "authorization_endpoint",
            "token_endpoint",
            "userinfo_endpoint",
            "jwks_uri",
            "code_challenge_methods_supported",
        ] {
            assert!(doc.get(k).is_some(), "discovery doc missing {k}");
        }
        assert_eq!(doc["id_token_signing_alg_values_supported"][0], "RS256");
    }

    #[test]
    fn random_url_token_unique_and_url_safe() {
        let a = random_url_token();
        let b = random_url_token();
        assert_ne!(a, b);
        assert!(a.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_'));
    }

    #[test]
    fn constant_time_eq_matches() {
        assert!(constant_time_eq(b"abc", b"abc"));
        assert!(!constant_time_eq(b"abc", b"abd"));
        assert!(!constant_time_eq(b"abc", b"abcd"));
    }

    #[test]
    fn pkce_round_trip() {
        let verifier = "verifier-abcdef-1234567890";
        let challenge =
            URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
        let computed =
            URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
        assert!(constant_time_eq(challenge.as_bytes(), computed.as_bytes()));
    }

    #[test]
    fn url_encode_quotes_specials() {
        assert_eq!(urlencoding::encode_str("a b/c"), "a%20b%2Fc");
        assert_eq!(urlencoding::encode_str("abc-_.~"), "abc-_.~");
    }
}
