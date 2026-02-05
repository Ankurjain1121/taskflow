use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use taskflow_db::models::UserRole;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: Uuid,        // user_id
    pub tenant_id: Uuid,
    pub role: UserRole,
    pub exp: i64,
    pub iat: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RefreshClaims {
    pub sub: Uuid,        // user_id
    pub token_id: Uuid,   // refresh_token row id
    pub exp: i64,
    pub iat: i64,
}

pub struct TokenPair {
    pub access_token: String,
    pub refresh_token: String,
}

/// Issue an access + refresh token pair
pub fn issue_tokens(
    user_id: Uuid,
    tenant_id: Uuid,
    role: UserRole,
    refresh_token_id: Uuid,
    jwt_secret: &str,
    jwt_refresh_secret: &str,
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
    };

    let refresh_claims = RefreshClaims {
        sub: user_id,
        token_id: refresh_token_id,
        iat: now.timestamp(),
        exp: (now + Duration::seconds(refresh_expiry_secs)).timestamp(),
    };

    let access_token = encode(
        &Header::default(),
        &access_claims,
        &EncodingKey::from_secret(jwt_secret.as_bytes()),
    )?;

    let refresh_token = encode(
        &Header::default(),
        &refresh_claims,
        &EncodingKey::from_secret(jwt_refresh_secret.as_bytes()),
    )?;

    Ok(TokenPair {
        access_token,
        refresh_token,
    })
}

/// Verify and decode an access token
pub fn verify_access_token(
    token: &str,
    jwt_secret: &str,
) -> Result<Claims, jsonwebtoken::errors::Error> {
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(jwt_secret.as_bytes()),
        &Validation::default(),
    )?;
    Ok(token_data.claims)
}

/// Verify and decode a refresh token
pub fn verify_refresh_token(
    token: &str,
    jwt_refresh_secret: &str,
) -> Result<RefreshClaims, jsonwebtoken::errors::Error> {
    let token_data = decode::<RefreshClaims>(
        token,
        &DecodingKey::from_secret(jwt_refresh_secret.as_bytes()),
        &Validation::default(),
    )?;
    Ok(token_data.claims)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_issue_and_verify_tokens() {
        let user_id = Uuid::new_v4();
        let tenant_id = Uuid::new_v4();
        let token_id = Uuid::new_v4();

        let pair = issue_tokens(
            user_id,
            tenant_id,
            UserRole::Member,
            token_id,
            "test-secret",
            "test-refresh-secret",
            900,
            604800,
        )
        .unwrap();

        let claims = verify_access_token(&pair.access_token, "test-secret").unwrap();
        assert_eq!(claims.sub, user_id);
        assert_eq!(claims.tenant_id, tenant_id);
        assert_eq!(claims.role, UserRole::Member);

        let refresh = verify_refresh_token(&pair.refresh_token, "test-refresh-secret").unwrap();
        assert_eq!(refresh.sub, user_id);
        assert_eq!(refresh.token_id, token_id);
    }
}
