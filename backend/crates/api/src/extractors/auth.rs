//! Authentication extractors for Axum handlers
//!
//! Provides typed extractors for accessing authenticated user information
//! and enforcing role-based access control.

use axum::{
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use std::future::Future;
use uuid::Uuid;

use taskflow_db::models::UserRole;

use crate::middleware::auth::AuthUser;

/// Error response for extractor failures
#[derive(Serialize)]
struct ExtractorErrorResponse {
    error: String,
}

impl ExtractorErrorResponse {
    fn unauthorized() -> Self {
        Self {
            error: "Unauthorized".to_string(),
        }
    }

    fn forbidden(msg: &str) -> Self {
        Self {
            error: msg.to_string(),
        }
    }
}

// Re-export AuthUser for convenience
pub use crate::middleware::auth::AuthUser as ExtractedAuthUser;

/// Extractor for authenticated users
///
/// Extracts the `AuthUser` from request extensions.
/// Returns 401 if no authenticated user is present.
#[derive(Debug, Clone)]
pub struct AuthUserExtractor(pub AuthUser);

impl<S> FromRequestParts<S> for AuthUserExtractor
where
    S: Send + Sync,
{
    type Rejection = Response;

    fn from_request_parts(
        parts: &mut Parts,
        _state: &S,
    ) -> impl Future<Output = Result<Self, Self::Rejection>> + Send {
        let result = parts
            .extensions
            .get::<AuthUser>()
            .cloned()
            .map(AuthUserExtractor)
            .ok_or_else(|| {
                (
                    StatusCode::UNAUTHORIZED,
                    Json(ExtractorErrorResponse::unauthorized()),
                )
                    .into_response()
            });
        std::future::ready(result)
    }
}

/// Extractor that requires Admin role
///
/// Extracts the `AuthUser` and verifies they have Admin role.
/// Returns 401 if not authenticated, 403 if not an admin.
#[derive(Debug, Clone)]
pub struct AdminUser(pub AuthUser);

impl<S> FromRequestParts<S> for AdminUser
where
    S: Send + Sync,
{
    type Rejection = Response;

    fn from_request_parts(
        parts: &mut Parts,
        _state: &S,
    ) -> impl Future<Output = Result<Self, Self::Rejection>> + Send {
        let result = (|| {
            let auth_user = parts.extensions.get::<AuthUser>().cloned().ok_or_else(|| {
                (
                    StatusCode::UNAUTHORIZED,
                    Json(ExtractorErrorResponse::unauthorized()),
                )
                    .into_response()
            })?;

            if auth_user.role != UserRole::Admin {
                return Err((
                    StatusCode::FORBIDDEN,
                    Json(ExtractorErrorResponse::forbidden("Admin access required")),
                )
                    .into_response());
            }

            Ok(AdminUser(auth_user))
        })();
        std::future::ready(result)
    }
}

/// Extractor that requires Manager or Admin role
///
/// Extracts the `AuthUser` and verifies they have Manager or Admin role.
/// Returns 401 if not authenticated, 403 if insufficient role.
#[derive(Debug, Clone)]
pub struct ManagerOrAdmin(pub AuthUser);

impl<S> FromRequestParts<S> for ManagerOrAdmin
where
    S: Send + Sync,
{
    type Rejection = Response;

    fn from_request_parts(
        parts: &mut Parts,
        _state: &S,
    ) -> impl Future<Output = Result<Self, Self::Rejection>> + Send {
        let result = (|| {
            let auth_user = parts.extensions.get::<AuthUser>().cloned().ok_or_else(|| {
                (
                    StatusCode::UNAUTHORIZED,
                    Json(ExtractorErrorResponse::unauthorized()),
                )
                    .into_response()
            })?;

            match auth_user.role {
                UserRole::Admin | UserRole::Manager => Ok(ManagerOrAdmin(auth_user)),
                UserRole::Member => Err((
                    StatusCode::FORBIDDEN,
                    Json(ExtractorErrorResponse::forbidden(
                        "Manager or Admin access required",
                    )),
                )
                    .into_response()),
            }
        })();
        std::future::ready(result)
    }
}

/// Extractor for tenant context
///
/// Provides the tenant ID from the authenticated user.
/// Useful for scoping database queries to the current tenant.
#[derive(Debug, Clone)]
pub struct TenantContext {
    pub tenant_id: Uuid,
    pub user_id: Uuid,
    pub role: UserRole,
}

impl<S> FromRequestParts<S> for TenantContext
where
    S: Send + Sync,
{
    type Rejection = Response;

    fn from_request_parts(
        parts: &mut Parts,
        _state: &S,
    ) -> impl Future<Output = Result<Self, Self::Rejection>> + Send {
        let result = parts
            .extensions
            .get::<AuthUser>()
            .cloned()
            .map(|auth_user| TenantContext {
                tenant_id: auth_user.tenant_id,
                user_id: auth_user.user_id,
                role: auth_user.role,
            })
            .ok_or_else(|| {
                (
                    StatusCode::UNAUTHORIZED,
                    Json(ExtractorErrorResponse::unauthorized()),
                )
                    .into_response()
            });
        std::future::ready(result)
    }
}

/// Optional authenticated user extractor
///
/// Returns `Some(AuthUser)` if authenticated, `None` otherwise.
/// Never fails - useful for endpoints that work with or without auth.
#[derive(Debug, Clone)]
pub struct OptionalAuthUser(pub Option<AuthUser>);

impl<S> FromRequestParts<S> for OptionalAuthUser
where
    S: Send + Sync,
{
    type Rejection = std::convert::Infallible;

    fn from_request_parts(
        parts: &mut Parts,
        _state: &S,
    ) -> impl Future<Output = Result<Self, Self::Rejection>> + Send {
        std::future::ready(Ok(OptionalAuthUser(
            parts.extensions.get::<AuthUser>().cloned(),
        )))
    }
}
