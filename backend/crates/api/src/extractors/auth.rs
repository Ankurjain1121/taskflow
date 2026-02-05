//! Authentication extractors for Axum handlers
//!
//! Provides typed extractors for accessing authenticated user information
//! and enforcing role-based access control.

use axum::{
    async_trait,
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
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
///
/// # Example
/// ```ignore
/// async fn handler(user: AuthUserExtractor) -> impl IntoResponse {
///     format!("Hello, user {}", user.0.user_id)
/// }
/// ```
#[derive(Debug, Clone)]
pub struct AuthUserExtractor(pub AuthUser);

#[async_trait]
impl<S> FromRequestParts<S> for AuthUserExtractor
where
    S: Send + Sync,
{
    type Rejection = Response;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        parts
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
            })
    }
}

/// Extractor that requires Admin role
///
/// Extracts the `AuthUser` and verifies they have Admin role.
/// Returns 401 if not authenticated, 403 if not an admin.
///
/// # Example
/// ```ignore
/// async fn admin_only_handler(admin: AdminUser) -> impl IntoResponse {
///     format!("Welcome, admin {}", admin.0.user_id)
/// }
/// ```
#[derive(Debug, Clone)]
pub struct AdminUser(pub AuthUser);

#[async_trait]
impl<S> FromRequestParts<S> for AdminUser
where
    S: Send + Sync,
{
    type Rejection = Response;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let auth_user = parts
            .extensions
            .get::<AuthUser>()
            .cloned()
            .ok_or_else(|| {
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
    }
}

/// Extractor that requires Manager or Admin role
///
/// Extracts the `AuthUser` and verifies they have Manager or Admin role.
/// Returns 401 if not authenticated, 403 if insufficient role.
///
/// # Example
/// ```ignore
/// async fn manager_handler(user: ManagerOrAdmin) -> impl IntoResponse {
///     format!("Welcome, manager/admin {}", user.0.user_id)
/// }
/// ```
#[derive(Debug, Clone)]
pub struct ManagerOrAdmin(pub AuthUser);

#[async_trait]
impl<S> FromRequestParts<S> for ManagerOrAdmin
where
    S: Send + Sync,
{
    type Rejection = Response;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let auth_user = parts
            .extensions
            .get::<AuthUser>()
            .cloned()
            .ok_or_else(|| {
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
    }
}

/// Extractor for tenant context
///
/// Provides the tenant ID from the authenticated user.
/// Useful for scoping database queries to the current tenant.
///
/// # Example
/// ```ignore
/// async fn tenant_handler(tenant: TenantContext) -> impl IntoResponse {
///     format!("Tenant: {}", tenant.tenant_id)
/// }
/// ```
#[derive(Debug, Clone)]
pub struct TenantContext {
    pub tenant_id: Uuid,
    pub user_id: Uuid,
    pub role: UserRole,
}

#[async_trait]
impl<S> FromRequestParts<S> for TenantContext
where
    S: Send + Sync,
{
    type Rejection = Response;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let auth_user = parts
            .extensions
            .get::<AuthUser>()
            .cloned()
            .ok_or_else(|| {
                (
                    StatusCode::UNAUTHORIZED,
                    Json(ExtractorErrorResponse::unauthorized()),
                )
                    .into_response()
            })?;

        Ok(TenantContext {
            tenant_id: auth_user.tenant_id,
            user_id: auth_user.user_id,
            role: auth_user.role,
        })
    }
}

/// Optional authenticated user extractor
///
/// Returns `Some(AuthUser)` if authenticated, `None` otherwise.
/// Never fails - useful for endpoints that work with or without auth.
///
/// # Example
/// ```ignore
/// async fn public_handler(user: OptionalAuthUser) -> impl IntoResponse {
///     match user.0 {
///         Some(u) => format!("Hello, {}", u.user_id),
///         None => "Hello, anonymous".to_string(),
///     }
/// }
/// ```
#[derive(Debug, Clone)]
pub struct OptionalAuthUser(pub Option<AuthUser>);

#[async_trait]
impl<S> FromRequestParts<S> for OptionalAuthUser
where
    S: Send + Sync,
{
    type Rejection = std::convert::Infallible;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        Ok(OptionalAuthUser(parts.extensions.get::<AuthUser>().cloned()))
    }
}
