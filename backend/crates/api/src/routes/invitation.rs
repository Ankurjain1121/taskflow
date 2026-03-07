//! Invitation REST endpoints
//!
//! Provides invitation creation, validation, acceptance, and listing endpoints.

use axum::{
    extract::{Path, Query, State},
    routing::{delete, get, post},
    Json, Router,
};
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use taskflow_auth::jwt::issue_tokens;
use taskflow_auth::password::hash_password;
use taskflow_db::models::automation::AutomationTrigger;
use taskflow_db::models::{Invitation, UserRole};
use taskflow_db::queries::{auth, invitations, workspaces};
use taskflow_services::{spawn_automation_evaluation, TriggerContext};

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
    pub message: Option<String>,
    pub board_ids: Option<Vec<Uuid>>,
    pub job_title: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BulkCreateInvitationRequest {
    pub emails: Vec<String>,
    pub workspace_id: Uuid,
    pub role: UserRole,
    pub message: Option<String>,
    pub board_ids: Option<Vec<Uuid>>,
    pub job_title: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct BulkInvitationError {
    pub email: String,
    pub reason: String,
}

#[derive(Debug, Serialize)]
pub struct BulkCreateInvitationResponse {
    pub created: Vec<InvitationResponse>,
    pub errors: Vec<BulkInvitationError>,
}

#[derive(Debug, Deserialize)]
pub struct AcceptInvitationRequest {
    pub token: Uuid,
    pub name: String,
    pub password: String,
    pub job_title: Option<String>,
    pub department: Option<String>,
    pub bio: Option<String>,
    pub timezone: Option<String>,
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
    pub message: Option<String>,
    pub board_ids: Option<serde_json::Value>,
    pub job_title: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct InvitationWithStatusResponse {
    pub id: Uuid,
    pub email: String,
    pub workspace_id: Uuid,
    pub role: UserRole,
    pub expires_at: chrono::DateTime<chrono::Utc>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub status: String,
    pub message: Option<String>,
    pub board_ids: Option<serde_json::Value>,
    pub job_title: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct InvitationValidateResponse {
    pub valid: bool,
    pub email: Option<String>,
    pub workspace_id: Option<Uuid>,
    pub role: Option<UserRole>,
    pub expired: bool,
    pub already_accepted: bool,
    pub job_title: Option<String>,
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
    pub job_title: Option<String>,
    pub department: Option<String>,
    pub bio: Option<String>,
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
            message: inv.message,
            board_ids: inv.board_ids,
            job_title: inv.job_title,
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
        return Err(AppError::Conflict(
            "User with this email already exists".into(),
        ));
    }

    // Set expiry to 7 days from now
    let expires_at = Utc::now() + Duration::days(7);

    // Convert board_ids to JSON value if present
    let board_ids_json = payload
        .board_ids
        .as_ref()
        .map(|ids| serde_json::to_value(ids).unwrap_or(serde_json::Value::Null));

    // Create the invitation
    let invitation = invitations::create_invitation_with_details(
        &state.db,
        &payload.email,
        payload.workspace_id,
        payload.role,
        auth.0.user_id,
        expires_at,
        payload.message.as_deref(),
        board_ids_json.as_ref(),
        payload.job_title.as_deref(),
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
                job_title: inv.job_title,
            }))
        }
        None => Ok(Json(InvitationValidateResponse {
            valid: false,
            email: None,
            workspace_id: None,
            role: None,
            expired: false,
            already_accepted: false,
            job_title: None,
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
        return Err(AppError::BadRequest(
            "Password must be at least 8 characters".into(),
        ));
    }

    // Get the invitation
    let invitation = invitations::get_invitation_by_token(&state.db, payload.token)
        .await?
        .ok_or_else(|| AppError::NotFound("Invitation not found".into()))?;

    // Check if already accepted
    if invitation.accepted_at.is_some() {
        return Err(AppError::BadRequest(
            "Invitation has already been accepted".into(),
        ));
    }

    // Check if expired
    if invitation.expires_at < Utc::now() {
        return Err(AppError::BadRequest("Invitation has expired".into()));
    }

    // Check if user already exists
    if auth::get_user_by_email(&state.db, &invitation.email)
        .await?
        .is_some()
    {
        return Err(AppError::Conflict(
            "User with this email already exists".into(),
        ));
    }

    // Get the tenant ID from the workspace
    let tenant_id = invitations::get_workspace_tenant_id(&state.db, invitation.workspace_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Workspace not found".into()))?;

    // Hash the password
    let password_hash = hash_password(&payload.password)
        .map_err(|_| AppError::InternalError("Failed to hash password".into()))?;

    // Wrap user creation, workspace membership, and invitation acceptance in a transaction
    let mut tx = state.db.begin().await?;

    // Determine job_title: user's input takes priority, fallback to inviter's suggestion
    let final_job_title = payload
        .job_title
        .as_deref()
        .or(invitation.job_title.as_deref());

    // Create the user within the transaction
    let user = sqlx::query_as::<_, taskflow_db::models::User>(
        r#"
        INSERT INTO users (id, email, name, password_hash, job_title, department, bio, role, tenant_id, onboarding_completed, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, NOW(), NOW())
        RETURNING id, email, name, password_hash, avatar_url, phone_number, job_title, department, bio, role,
                  tenant_id, onboarding_completed, last_login_at, deleted_at, created_at, updated_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(&invitation.email)
    .bind(&payload.name)
    .bind(&password_hash)
    .bind(final_job_title)
    .bind(payload.department.as_deref())
    .bind(payload.bio.as_deref())
    .bind(invitation.role)
    .bind(tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Add user to the workspace within the transaction
    sqlx::query(
        r#"
        INSERT INTO workspace_members (id, workspace_id, user_id, joined_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (workspace_id, user_id) DO NOTHING
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(invitation.workspace_id)
    .bind(user.id)
    .execute(&mut *tx)
    .await?;

    // Mark invitation as accepted within the transaction
    sqlx::query(
        "UPDATE invitations SET accepted_at = NOW() WHERE token = $1 AND accepted_at IS NULL",
    )
    .bind(payload.token)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    // Fire MemberJoined automation trigger for all boards in the workspace
    {
        let pool = state.db.clone();
        let redis = state.redis.clone();
        let ws_id = invitation.workspace_id;
        let new_user_id = user.id;
        let tid = tenant_id;
        tokio::spawn(async move {
            let board_ids = sqlx::query_scalar::<_, Uuid>(
                "SELECT id FROM boards WHERE workspace_id = $1 AND deleted_at IS NULL",
            )
            .bind(ws_id)
            .fetch_all(&pool)
            .await
            .unwrap_or_default();

            for board_id in board_ids {
                spawn_automation_evaluation(
                    pool.clone(),
                    redis.clone(),
                    AutomationTrigger::MemberJoined,
                    TriggerContext {
                        task_id: Uuid::nil(),
                        board_id,
                        tenant_id: tid,
                        user_id: new_user_id,
                        previous_status_id: None,
                        new_status_id: None,
                        priority: None,
                        member_user_id: Some(new_user_id),
                    },
                );
            }
        });
    }

    // Save timezone to user_preferences if provided
    if let Some(ref tz) = payload.timezone {
        let _ = sqlx::query(
            r#"INSERT INTO user_preferences (id, user_id, timezone, date_format, default_board_view,
                sidebar_density, locale, digest_frequency, created_at, updated_at)
            VALUES ($1, $2, $3, 'MMM D, YYYY', 'kanban', 'comfortable', 'en', 'daily', NOW(), NOW())
            ON CONFLICT (user_id) DO UPDATE SET timezone = $3, updated_at = NOW()"#,
        )
        .bind(Uuid::new_v4())
        .bind(user.id)
        .bind(tz.as_str())
        .execute(&state.db)
        .await;
    }

    // Issue tokens and create refresh token record atomically (no "pending" hash)
    let refresh_expiry = Utc::now() + Duration::seconds(state.config.jwt_refresh_expiry_secs);
    let token_id = Uuid::new_v4();

    let tokens = issue_tokens(
        user.id,
        user.tenant_id,
        user.role,
        token_id,
        &state.jwt_keys,
        state.config.jwt_access_expiry_secs,
        state.config.jwt_refresh_expiry_secs,
    )?;

    let token_hash = {
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(tokens.refresh_token.as_bytes());
        format!("{:x}", hasher.finalize())
    };
    auth::create_refresh_token(
        &state.db,
        token_id,
        user.id,
        &token_hash,
        refresh_expiry,
        None,
        None,
    )
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
            job_title: user.job_title,
            department: user.department,
            bio: user.bio,
            onboarding_completed: user.onboarding_completed,
        },
    }))
}

/// GET /api/invitations?workspace_id=<uuid>
///
/// List pending invitations for a workspace.
/// Requires authentication and workspace membership.
pub async fn list_handler(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Query(query): Query<ListInvitationsQuery>,
) -> Result<Json<Vec<InvitationResponse>>> {
    // Verify the user is a member of the requested workspace
    let is_member =
        workspaces::is_workspace_member(&state.db, query.workspace_id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    let invitations = invitations::list_pending_invitations(&state.db, query.workspace_id).await?;

    Ok(Json(invitations.into_iter().map(Into::into).collect()))
}

/// POST /api/invitations/bulk
///
/// Create multiple invitations at once.
/// Skips emails that already have a user account or pending invitation, tracking per-email errors.
/// Requires authentication.
pub async fn bulk_create_handler(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Json(payload): Json<BulkCreateInvitationRequest>,
) -> Result<Json<BulkCreateInvitationResponse>> {
    if payload.emails.is_empty() {
        return Err(AppError::BadRequest(
            "At least one email is required".into(),
        ));
    }

    if payload.emails.len() > 50 {
        return Err(AppError::BadRequest(
            "Cannot invite more than 50 emails at once".into(),
        ));
    }

    let expires_at = Utc::now() + Duration::days(7);
    let mut created = Vec::new();
    let mut errors = Vec::new();

    // Convert board_ids to a JSON value if present
    let board_ids_json = payload
        .board_ids
        .as_ref()
        .map(|ids| serde_json::to_value(ids).unwrap_or(serde_json::Value::Null));

    for raw_email in &payload.emails {
        let email = raw_email.trim().to_lowercase();

        // Validate email format
        if email.is_empty() || !email.contains('@') {
            errors.push(BulkInvitationError {
                email: email.clone(),
                reason: "Invalid email address".into(),
            });
            continue;
        }

        // Check if user already exists
        match auth::get_user_by_email(&state.db, &email).await {
            Ok(Some(_)) => {
                errors.push(BulkInvitationError {
                    email: email.clone(),
                    reason: "User with this email already exists".into(),
                });
                continue;
            }
            Ok(None) => {}
            Err(e) => {
                errors.push(BulkInvitationError {
                    email: email.clone(),
                    reason: format!("Database error: {}", e),
                });
                continue;
            }
        }

        // Check if a pending invitation already exists
        match invitations::get_pending_invitation_by_email(&state.db, &email, payload.workspace_id)
            .await
        {
            Ok(Some(_)) => {
                errors.push(BulkInvitationError {
                    email: email.clone(),
                    reason: "A pending invitation already exists for this email".into(),
                });
                continue;
            }
            Ok(None) => {}
            Err(e) => {
                errors.push(BulkInvitationError {
                    email: email.clone(),
                    reason: format!("Database error: {}", e),
                });
                continue;
            }
        }

        // Create the invitation with message, board_ids, and job_title
        match invitations::create_invitation_with_details(
            &state.db,
            &email,
            payload.workspace_id,
            payload.role,
            auth.0.user_id,
            expires_at,
            payload.message.as_deref(),
            board_ids_json.as_ref(),
            payload.job_title.as_deref(),
        )
        .await
        {
            Ok(invitation) => {
                created.push(invitation.into());
            }
            Err(e) => {
                errors.push(BulkInvitationError {
                    email: email.clone(),
                    reason: format!("Failed to create invitation: {}", e),
                });
            }
        }
    }

    Ok(Json(BulkCreateInvitationResponse { created, errors }))
}

/// GET /api/invitations/all?workspace_id=<uuid>
///
/// List ALL invitations (pending, accepted, expired) for a workspace with status.
/// Requires authentication.
pub async fn list_all_handler(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Query(query): Query<ListInvitationsQuery>,
) -> Result<Json<Vec<InvitationWithStatusResponse>>> {
    // Verify workspace membership
    let is_member =
        workspaces::is_workspace_member(&state.db, query.workspace_id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    let all_invitations = invitations::list_all_invitations(&state.db, query.workspace_id).await?;
    let now = Utc::now();

    let responses: Vec<InvitationWithStatusResponse> = all_invitations
        .into_iter()
        .map(|inv| {
            let status = if inv.accepted_at.is_some() {
                "accepted".to_string()
            } else if inv.expires_at < now {
                "expired".to_string()
            } else {
                "pending".to_string()
            };

            InvitationWithStatusResponse {
                id: inv.id,
                email: inv.email,
                workspace_id: inv.workspace_id,
                role: inv.role,
                expires_at: inv.expires_at,
                created_at: inv.created_at,
                status,
                message: inv.message,
                board_ids: inv.board_ids,
                job_title: inv.job_title,
            }
        })
        .collect();

    Ok(Json(responses))
}

/// DELETE /api/invitations/{id}
///
/// Delete a pending invitation.
/// Requires authentication.
pub async fn delete_handler(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    // Fetch invitation to verify workspace membership
    let invitation = invitations::get_invitation_by_id(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Invitation not found".into()))?;
    let is_member =
        workspaces::is_workspace_member(&state.db, invitation.workspace_id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    let deleted = invitations::delete_invitation(&state.db, id).await?;

    if !deleted {
        return Err(AppError::NotFound(
            "Invitation not found or already accepted".into(),
        ));
    }

    Ok(Json(serde_json::json!({ "success": true })))
}

/// POST /api/invitations/{id}/resend
///
/// Resend an invitation by generating a new token and extending the expiry.
/// Requires authentication.
pub async fn resend_handler(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(id): Path<Uuid>,
) -> Result<Json<InvitationResponse>> {
    // Fetch invitation to verify workspace membership
    let inv = invitations::get_invitation_by_id(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Invitation not found".into()))?;
    let is_member =
        workspaces::is_workspace_member(&state.db, inv.workspace_id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    let new_expires_at = Utc::now() + Duration::days(7);

    let invitation = invitations::resend_invitation(&state.db, id, new_expires_at)
        .await?
        .ok_or_else(|| AppError::NotFound("Invitation not found".into()))?;

    Ok(Json(invitation.into()))
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
/// - POST /bulk
/// - GET /all (with workspace_id query param)
/// - DELETE /{id}
/// - POST /{id}/resend
pub fn invitation_router() -> Router<AppState> {
    Router::new()
        .route("/", post(create_handler))
        .route("/", get(list_handler))
        .route("/bulk", post(bulk_create_handler))
        .route("/all", get(list_all_handler))
        .route("/validate/{token}", get(validate_handler))
        .route("/accept", post(accept_handler))
        .route("/{id}", delete(delete_handler))
        .route("/{id}/resend", post(resend_handler))
}
