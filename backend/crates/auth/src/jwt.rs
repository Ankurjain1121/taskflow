use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use taskflow_db::models::UserRole;

const JWT_ISSUER: &str = "taskflow";
const JWT_AUDIENCE: &str = "taskflow-api";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: Uuid,        // user_id
    pub tenant_id: Uuid,
    pub role: UserRole,
    pub exp: i64,
    pub iat: i64,
    pub iss: String,
    pub aud: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RefreshClaims {
    pub sub: Uuid,        // user_id
    pub token_id: Uuid,   // refresh_token row id
    pub exp: i64,
    pub iat: i64,
    pub iss: String,
    pub aud: String,
}

pub struct TokenPair {
    pub access_token: String,
    pub refresh_token: String,
}

/// Configuration for JWT signing/verification
pub struct JwtKeys {
    pub access_encoding: EncodingKey,
    pub access_decoding: DecodingKey,
    pub refresh_encoding: EncodingKey,
    pub refresh_decoding: DecodingKey,
    pub algorithm: Algorithm,
}

impl JwtKeys {
    /// Create JWT keys from config. Uses RS256 if RSA PEM keys are provided,
    /// otherwise falls back to HS256 with the shared secrets.
    pub fn from_config(
        jwt_secret: &str,
        jwt_refresh_secret: &str,
        rsa_private_key: Option<&str>,
        rsa_public_key: Option<&str>,
    ) -> Result<Self, jsonwebtoken::errors::Error> {
        match (rsa_private_key, rsa_public_key) {
            (Some(private_pem), Some(public_pem)) => {
                Ok(Self {
                    access_encoding: EncodingKey::from_rsa_pem(private_pem.as_bytes())?,
                    access_decoding: DecodingKey::from_rsa_pem(public_pem.as_bytes())?,
                    refresh_encoding: EncodingKey::from_rsa_pem(private_pem.as_bytes())?,
                    refresh_decoding: DecodingKey::from_rsa_pem(public_pem.as_bytes())?,
                    algorithm: Algorithm::RS256,
                })
            }
            _ => {
                Ok(Self {
                    access_encoding: EncodingKey::from_secret(jwt_secret.as_bytes()),
                    access_decoding: DecodingKey::from_secret(jwt_secret.as_bytes()),
                    refresh_encoding: EncodingKey::from_secret(jwt_refresh_secret.as_bytes()),
                    refresh_decoding: DecodingKey::from_secret(jwt_refresh_secret.as_bytes()),
                    algorithm: Algorithm::HS256,
                })
            }
        }
    }
}

/// Build a Validation that checks issuer, audience, and uses the given algorithm.
fn build_validation(algorithm: Algorithm) -> Validation {
    let mut validation = Validation::new(algorithm);
    validation.set_issuer(&[JWT_ISSUER]);
    validation.set_audience(&[JWT_AUDIENCE]);
    validation.set_required_spec_claims(&["exp", "iss", "aud"]);
    validation
}

/// Issue an access + refresh token pair
pub fn issue_tokens(
    user_id: Uuid,
    tenant_id: Uuid,
    role: UserRole,
    refresh_token_id: Uuid,
    keys: &JwtKeys,
    access_expiry_secs: i64,
    refresh_expiry_secs: i64,
) -> Result<TokenPair, jsonwebtoken::errors::Error> {
    let now = Utc::now();

    let access_claims = Claims {
        sub: user_id,
        tenant_id,
        role,
        iat: now.timestamp(),
        exp: (now + Duration::seconds(access_expiry_secs)).timestamp(),
        iss: JWT_ISSUER.to_string(),
        aud: JWT_AUDIENCE.to_string(),
    };

    let refresh_claims = RefreshClaims {
        sub: user_id,
        token_id: refresh_token_id,
        iat: now.timestamp(),
        exp: (now + Duration::seconds(refresh_expiry_secs)).timestamp(),
        iss: JWT_ISSUER.to_string(),
        aud: JWT_AUDIENCE.to_string(),
    };

    let header = Header::new(keys.algorithm);

    let access_token = encode(
        &header,
        &access_claims,
        &keys.access_encoding,
    )?;

    let refresh_token = encode(
        &header,
        &refresh_claims,
        &keys.refresh_encoding,
    )?;

    Ok(TokenPair {
        access_token,
        refresh_token,
    })
}

/// Verify and decode an access token
pub fn verify_access_token(
    token: &str,
    keys: &JwtKeys,
) -> Result<Claims, jsonwebtoken::errors::Error> {
    let validation = build_validation(keys.algorithm);
    let token_data = decode::<Claims>(
        token,
        &keys.access_decoding,
        &validation,
    )?;
    Ok(token_data.claims)
}

/// Verify and decode a refresh token
pub fn verify_refresh_token(
    token: &str,
    keys: &JwtKeys,
) -> Result<RefreshClaims, jsonwebtoken::errors::Error> {
    let validation = build_validation(keys.algorithm);
    let token_data = decode::<RefreshClaims>(
        token,
        &keys.refresh_decoding,
        &validation,
    )?;
    Ok(token_data.claims)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_issue_and_verify_tokens_hs256() {
        let keys = JwtKeys::from_config(
            "test-secret",
            "test-refresh-secret",
            None,
            None,
        )
        .unwrap();

        let user_id = Uuid::new_v4();
        let tenant_id = Uuid::new_v4();
        let token_id = Uuid::new_v4();

        let pair = issue_tokens(
            user_id,
            tenant_id,
            UserRole::Member,
            token_id,
            &keys,
            900,
            604800,
        )
        .unwrap();

        let claims = verify_access_token(&pair.access_token, &keys).unwrap();
        assert_eq!(claims.sub, user_id);
        assert_eq!(claims.tenant_id, tenant_id);
        assert_eq!(claims.role, UserRole::Member);
        assert_eq!(claims.iss, "taskflow");
        assert_eq!(claims.aud, "taskflow-api");

        let refresh = verify_refresh_token(&pair.refresh_token, &keys).unwrap();
        assert_eq!(refresh.sub, user_id);
        assert_eq!(refresh.token_id, token_id);
        assert_eq!(refresh.iss, "taskflow");
        assert_eq!(refresh.aud, "taskflow-api");
    }

    #[test]
    fn test_expired_access_token() {
        let keys = JwtKeys::from_config(
            "test-secret",
            "test-refresh-secret",
            None,
            None,
        )
        .unwrap();

        let pair = issue_tokens(
            Uuid::new_v4(),
            Uuid::new_v4(),
            UserRole::Member,
            Uuid::new_v4(),
            &keys,
            -120, // expired well past the default 60s leeway
            604800,
        )
        .unwrap();

        let result = verify_access_token(&pair.access_token, &keys);
        assert!(result.is_err(), "Expired access token should fail verification");
    }

    #[test]
    fn test_wrong_secret_fails() {
        let keys_issue = JwtKeys::from_config(
            "secret-one",
            "refresh-secret-one",
            None,
            None,
        )
        .unwrap();

        let keys_verify = JwtKeys::from_config(
            "secret-two",
            "refresh-secret-two",
            None,
            None,
        )
        .unwrap();

        let pair = issue_tokens(
            Uuid::new_v4(),
            Uuid::new_v4(),
            UserRole::Member,
            Uuid::new_v4(),
            &keys_issue,
            900,
            604800,
        )
        .unwrap();

        let access_result = verify_access_token(&pair.access_token, &keys_verify);
        assert!(access_result.is_err(), "Access token signed with different secret should fail");

        let refresh_result = verify_refresh_token(&pair.refresh_token, &keys_verify);
        assert!(refresh_result.is_err(), "Refresh token signed with different secret should fail");
    }

    #[test]
    fn test_refresh_token_verification() {
        let keys = JwtKeys::from_config(
            "test-secret",
            "test-refresh-secret",
            None,
            None,
        )
        .unwrap();

        let user_id = Uuid::new_v4();
        let token_id = Uuid::new_v4();

        let pair = issue_tokens(
            user_id,
            Uuid::new_v4(),
            UserRole::Admin,
            token_id,
            &keys,
            900,
            604800,
        )
        .unwrap();

        let refresh_claims = verify_refresh_token(&pair.refresh_token, &keys).unwrap();
        assert_eq!(refresh_claims.sub, user_id, "Refresh token sub should match user_id");
        assert_eq!(refresh_claims.token_id, token_id, "Refresh token token_id should match");
        assert_eq!(refresh_claims.iss, "taskflow");
        assert_eq!(refresh_claims.aud, "taskflow-api");
    }

    #[test]
    fn test_access_token_wrong_audience() {
        let keys = JwtKeys::from_config(
            "test-secret",
            "test-refresh-secret",
            None,
            None,
        )
        .unwrap();

        // Manually craft a token with wrong audience
        let now = Utc::now();
        let bad_claims = Claims {
            sub: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            role: UserRole::Member,
            iat: now.timestamp(),
            exp: (now + Duration::seconds(900)).timestamp(),
            iss: "taskflow".to_string(),
            aud: "wrong-audience".to_string(),
        };

        let header = Header::new(keys.algorithm);
        let token = encode(&header, &bad_claims, &keys.access_encoding).unwrap();

        let result = verify_access_token(&token, &keys);
        assert!(result.is_err(), "Token with wrong audience should fail verification");
    }

    #[test]
    fn test_claims_contain_correct_role() {
        let keys = JwtKeys::from_config(
            "test-secret",
            "test-refresh-secret",
            None,
            None,
        )
        .unwrap();

        for role in [UserRole::Admin, UserRole::Manager, UserRole::Member] {
            let pair = issue_tokens(
                Uuid::new_v4(),
                Uuid::new_v4(),
                role,
                Uuid::new_v4(),
                &keys,
                900,
                604800,
            )
            .unwrap();

            let claims = verify_access_token(&pair.access_token, &keys).unwrap();
            assert_eq!(claims.role, role, "Token claims should contain role {:?}", role);
        }
    }

    #[test]
    fn test_issue_tokens_returns_different_access_and_refresh() {
        let keys = JwtKeys::from_config(
            "test-secret",
            "test-refresh-secret",
            None,
            None,
        )
        .unwrap();

        let pair = issue_tokens(
            Uuid::new_v4(),
            Uuid::new_v4(),
            UserRole::Member,
            Uuid::new_v4(),
            &keys,
            900,
            604800,
        )
        .unwrap();

        assert_ne!(
            pair.access_token, pair.refresh_token,
            "Access and refresh tokens must be different"
        );
    }
}
