//! Invitation REST endpoints
//!
//! Provides invitation creation, validation, acceptance, and listing endpoints.

use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Json, Router,
};
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use taskflow_auth::jwt::issue_tokens;
use taskflow_auth::password::hash_password;
use taskflow_db::models::{Invitation, UserRole};
use taskflow_db::queries::{auth, invitations};

use crate::errors::{AppError, Result};
use crate::extractors::AuthUserExtractor;
use crate::state::AppState;

// ============================================================================
// Request/Response DTOs
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct CreateInvitationRequest {
    pub email: String,
    pub workspace_id: Uuid,
    pub role: UserRole,
}

#[derive(Debug, Deserialize)]
pub struct AcceptInvitationRequest {
    pub token: Uuid,
    pub name: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct ListInvitationsQuery {
    pub workspace_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct InvitationResponse {
    pub id: Uuid,
    pub email: String,
    pub workspace_id: Uuid,
    pub role: UserRole,
    pub token: Uuid,
    pub expires_at: chrono::DateTime<chrono::Utc>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct InvitationValidateResponse {
    pub valid: bool,
    pub email: Option<String>,
    pub workspace_id: Option<Uuid>,
    pub role: Option<UserRole>,
    pub expired: bool,
    pub already_accepted: bool,
}

#[derive(Debug, Serialize)]
pub struct AcceptInvitationResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub user: UserResponse,
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    pub role: UserRole,
    pub tenant_id: Uuid,
    pub avatar_url: Option<String>,
    pub onboarding_completed: bool,
}

impl From<Invitation> for InvitationResponse {
    fn from(inv: Invitation) -> Self {
        Self {
            id: inv.id,
            email: inv.email,
            workspace_id: inv.workspace_id,
            role: inv.role,
            token: inv.token,
            expires_at: inv.expires_at,
            created_at: inv.created_at,
        }
    }
}

// ============================================================================
// Route Handlers
// ============================================================================

/// POST /api/invitations
///
/// Create a new invitation with 7-day expiry.
/// Requires authentication.
pub async fn create_handler(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Json(payload): Json<CreateInvitationRequest>,
) -> Result<Json<InvitationResponse>> {
    // Validate email
    if payload.email.is_empty() || !payload.email.contains('@') {
        return Err(AppError::BadRequest("Invalid email address".into()));
    }

    // Check if user already exists with this email
    if let Some(_existing) = auth::get_user_by_email(&state.db, &payload.email).await? {
        return Err(AppError::Conflict("User with this email already exists".into()));
    }

    // Set expiry to 7 days from now
    let expires_at = Utc::now() + Duration::days(7);

    // Create the invitation
    let invitation = invitations::create_invitation(
        &state.db,
        &payload.email,
        payload.workspace_id,
        payload.role,
        auth.0.user_id,
        expires_at,
    )
    .await?;

    Ok(Json(invitation.into()))
}

/// GET /api/invitations/validate/:token
///
/// Validate an invitation token (public endpoint).
/// Returns details about the invitation's validity.
pub async fn validate_handler(
    State(state): State<AppState>,
    Path(token): Path<Uuid>,
) -> Result<Json<InvitationValidateResponse>> {
    let invitation = invitations::get_invitation_by_token(&state.db, token).await?;

    match invitation {
        Some(inv) => {
            let now = Utc::now();
            let expired = inv.expires_at < now;
            let already_accepted = inv.accepted_at.is_some();
            let valid = !expired && !already_accepted;

            Ok(Json(InvitationValidateResponse {
                valid,
                email: Some(inv.email),
                workspace_id: Some(inv.workspace_id),
                role: Some(inv.role),
                expired,
                already_accepted,
            }))
        }
        None => Ok(Json(InvitationValidateResponse {
            valid: false,
            email: None,
            workspace_id: None,
            role: None,
            expired: false,
            already_accepted: false,
        })),
    }
}

/// POST /api/invitations/accept
///
/// Accept an invitation (public endpoint).
/// Creates the user account and returns authentication tokens.
pub async fn accept_handler(
    State(state): State<AppState>,
    Json(payload): Json<AcceptInvitationRequest>,
) -> Result<Json<AcceptInvitationResponse>> {
    // Validate input
    if payload.name.is_empty() {
        return Err(AppError::BadRequest("Name is required".into()));
    }
    if payload.password.len() < 8 {
        return Err(AppError::BadRequest("Password must be at least 8 characters".into()));
    }

    // Get the invitation
    let invitation = invitations::get_invitation_by_token(&state.db, payload.token)
        .await?
        .ok_or_else(|| AppError::NotFound("Invitation not found".into()))?;

    // Check if already accepted
    if invitation.accepted_at.is_some() {
        return Err(AppError::BadRequest("Invitation has already been accepted".into()));
    }

    // Check if expired
    if invitation.expires_at < Utc::now() {
        return Err(AppError::BadRequest("Invitation has expired".into()));
    }

    // Check if user already exists
    if auth::get_user_by_email(&state.db, &invitation.email).await?.is_some() {
        return Err(AppError::Conflict("User with this email already exists".into()));
    }

    // Get the tenant ID from the workspace
    let tenant_id = invitations::get_workspace_tenant_id(&state.db, invitation.workspace_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Workspace not found".into()))?;

    // Hash the password
    let password_hash = hash_password(&payload.password)
        .map_err(|_| AppError::InternalError("Failed to hash password".into()))?;

    // Create the user
    let user = auth::create_user(
        &state.db,
        &invitation.email,
        &payload.name,
        &password_hash,
        invitation.role.clone(),
        tenant_id,
    )
    .await?;

    // Add user to the workspace
    invitations::add_workspace_member(&state.db, invitation.workspace_id, user.id).await?;

    // Mark invitation as accepted
    invitations::accept_invitation(&state.db, payload.token).await?;

    // Create refresh token
    let refresh_expiry = Utc::now() + Duration::seconds(state.config.jwt_refresh_expiry_secs);
    let token_id = auth::create_refresh_token(
        &state.db,
        user.id,
        "pending",
        refresh_expiry,
    )
    .await?;

    // Issue tokens
    let tokens = issue_tokens(
        user.id,
        user.tenant_id,
        user.role.clone(),
        token_id,
        &state.config.jwt_secret,
        &state.config.jwt_refresh_secret,
        state.config.jwt_access_expiry_secs,
        state.config.jwt_refresh_expiry_secs,
    )?;

    // Update token hash
    let token_hash = {
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(tokens.refresh_token.as_bytes());
        format!("{:x}", hasher.finalize())
    };
    sqlx::query("UPDATE refresh_tokens SET token_hash = $1 WHERE id = $2")
        .bind(&token_hash)
        .bind(token_id)
        .execute(&state.db)
        .await?;

    Ok(Json(AcceptInvitationResponse {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        user: UserResponse {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            tenant_id: user.tenant_id,
            avatar_url: user.avatar_url,
            onboarding_completed: user.onboarding_completed,
        },
    }))
}

/// GET /api/invitations?workspace_id=<uuid>
///
/// List pending invitations for a workspace.
/// Requires authentication.
pub async fn list_handler(
    State(state): State<AppState>,
    _auth: AuthUserExtractor,
    Query(query): Query<ListInvitationsQuery>,
) -> Result<Json<Vec<InvitationResponse>>> {
    let invitations = invitations::list_pending_invitations(&state.db, query.workspace_id).await?;

    Ok(Json(invitations.into_iter().map(Into::into).collect()))
}

// ============================================================================
// Router
// ============================================================================

/// Build the invitation router
///
/// Public routes:
/// - GET /validate/:token
/// - POST /accept
///
/// Protected routes (require auth middleware):
/// - POST /
/// - GET / (with workspace_id query param)
pub fn invitation_router() -> Router<AppState> {
    Router::new()
        .route("/", post(create_handler))
        .route("/", get(list_handler))
        .route("/validate/{token}", get(validate_handler))
        .route("/accept", post(accept_handler))
}
