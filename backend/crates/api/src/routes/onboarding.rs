//! Onboarding REST endpoints
//!
//! Provides endpoints for the user onboarding flow including:
//! - Invitation context lookup
//! - Workspace creation
//! - Member invitation
//! - Sample board generation
//! - Onboarding completion

use axum::{
    extract::{Query, State},
    middleware::from_fn_with_state,
    routing::{get, post},
    Json, Router,
};
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use taskflow_db::models::UserRole;
use taskflow_db::queries::{auth, invitations, workspaces};
use taskflow_services::sample_board::generate_sample_board;

use crate::errors::{AppError, Result};
use crate::extractors::AuthUserExtractor;
use crate::middleware::auth_middleware;
use crate::state::AppState;

// ============================================================================
// Request/Response DTOs
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct InvitationContextQuery {
    pub token: Uuid,
}

#[derive(Debug, Serialize)]
pub struct InvitationContextResponse {
    pub workspace_id: Uuid,
    pub workspace_name: String,
    pub board_ids: Vec<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateWorkspaceRequest {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CreateWorkspaceResponse {
    pub workspace_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct InviteMembersRequest {
    pub workspace_id: Uuid,
    pub emails: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct InviteMembersResponse {
    /// Number of invitations sent to new users (not yet registered)
    pub pending: i32,
    /// Number of existing users added directly to workspace
    pub invited: i32,
}

#[derive(Debug, Deserialize)]
pub struct GenerateSampleBoardRequest {
    pub workspace_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct GenerateSampleBoardResponse {
    pub board_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct SuccessResponse {
    pub success: bool,
}

// ============================================================================
// Route Handlers
// ============================================================================

/// GET /api/onboarding/invitation-context?token=uuid
///
/// Returns context about an invitation for the onboarding flow.
/// Public endpoint (no auth required) - used before user accepts invitation.
async fn get_invitation_context(
    State(state): State<AppState>,
    Query(query): Query<InvitationContextQuery>,
) -> Result<Json<InvitationContextResponse>> {
    // Get the invitation
    let invitation = invitations::get_invitation_by_token(&state.db, query.token)
        .await?
        .ok_or_else(|| AppError::NotFound("Invitation not found".into()))?;

    // Check if expired or already accepted
    if invitation.expires_at < Utc::now() {
        return Err(AppError::BadRequest("Invitation has expired".into()));
    }
    if invitation.accepted_at.is_some() {
        return Err(AppError::BadRequest(
            "Invitation has already been accepted".into(),
        ));
    }

    // Get workspace details
    let workspace = sqlx::query!(
        r#"
        SELECT id, name FROM workspaces
        WHERE id = $1 AND deleted_at IS NULL
        "#,
        invitation.workspace_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Workspace not found".into()))?;

    // Get board IDs in this workspace (boards the user would have access to)
    let board_ids: Vec<Uuid> = sqlx::query_scalar!(
        r#"
        SELECT id FROM boards
        WHERE workspace_id = $1 AND deleted_at IS NULL
        ORDER BY created_at ASC
        "#,
        invitation.workspace_id
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(InvitationContextResponse {
        workspace_id: workspace.id,
        workspace_name: workspace.name,
        board_ids,
    }))
}

/// POST /api/onboarding/create-workspace
///
/// Creates a new workspace and adds the authenticated user as a member.
async fn create_workspace(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Json(payload): Json<CreateWorkspaceRequest>,
) -> Result<Json<CreateWorkspaceResponse>> {
    // Validate input
    if payload.name.trim().is_empty() {
        return Err(AppError::BadRequest("Workspace name is required".into()));
    }

    if payload.name.len() > 255 {
        return Err(AppError::BadRequest(
            "Workspace name is too long (max 255 characters)".into(),
        ));
    }

    // Create the workspace (this also adds the user as a member)
    let workspace = workspaces::create_workspace(
        &state.db,
        payload.name.trim(),
        payload.description.as_deref(),
        auth.0.tenant_id,
        auth.0.user_id,
    )
    .await?;

    Ok(Json(CreateWorkspaceResponse {
        workspace_id: workspace.id,
    }))
}

/// POST /api/onboarding/invite-members
///
/// Invites members to a workspace. Max 10 emails per request.
/// - Existing users are added directly to the workspace
/// - New users receive an invitation email
async fn invite_members(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Json(payload): Json<InviteMembersRequest>,
) -> Result<Json<InviteMembersResponse>> {
    // Validate max 10 emails
    if payload.emails.len() > 10 {
        return Err(AppError::BadRequest(
            "Maximum 10 emails allowed per request".into(),
        ));
    }

    if payload.emails.is_empty() {
        return Err(AppError::BadRequest(
            "At least one email is required".into(),
        ));
    }

    // Verify user is a workspace member
    let is_member =
        workspaces::is_workspace_member(&state.db, payload.workspace_id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    let mut invited_count = 0;
    let mut pending_count = 0;

    for email in &payload.emails {
        let email = email.trim().to_lowercase();

        // Validate email format
        if !email.contains('@') || email.len() < 5 {
            continue; // Skip invalid emails
        }

        // Check if user already exists
        if let Some(existing_user) = auth::get_user_by_email(&state.db, &email).await? {
            // Check if already a workspace member
            let already_member =
                workspaces::is_workspace_member(&state.db, payload.workspace_id, existing_user.id)
                    .await?;

            if !already_member {
                // Add existing user directly to workspace
                let _ = workspaces::add_workspace_member(
                    &state.db,
                    payload.workspace_id,
                    existing_user.id,
                )
                .await;
                invited_count += 1;
            }
        } else {
            // Create invitation for new user
            let expires_at = Utc::now() + Duration::days(7);

            // Check for existing pending invitation
            let existing = sqlx::query_scalar!(
                r#"
                SELECT id FROM invitations
                WHERE email = $1
                  AND workspace_id = $2
                  AND accepted_at IS NULL
                  AND expires_at > NOW()
                "#,
                email,
                payload.workspace_id
            )
            .fetch_optional(&state.db)
            .await?;

            if existing.is_none() {
                let _ = invitations::create_invitation(
                    &state.db,
                    &email,
                    payload.workspace_id,
                    UserRole::Member, // Default role for invited members
                    auth.0.user_id,
                    expires_at,
                )
                .await;
                pending_count += 1;
            }
        }
    }

    Ok(Json(InviteMembersResponse {
        pending: pending_count,
        invited: invited_count,
    }))
}

/// POST /api/onboarding/generate-sample-board
///
/// Generates a sample "Getting Started" board in the specified workspace.
async fn generate_sample_board_handler(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Json(payload): Json<GenerateSampleBoardRequest>,
) -> Result<Json<GenerateSampleBoardResponse>> {
    // Verify user is a workspace member
    let is_member =
        workspaces::is_workspace_member(&state.db, payload.workspace_id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    // Generate the sample board
    let board_id = generate_sample_board(
        &state.db,
        payload.workspace_id,
        auth.0.user_id,
        auth.0.tenant_id,
    )
    .await
    .map_err(|e| AppError::InternalError(format!("Failed to generate sample board: {}", e)))?;

    Ok(Json(GenerateSampleBoardResponse { board_id }))
}

/// POST /api/onboarding/complete
///
/// Marks the user's onboarding as complete.
async fn complete_onboarding(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
) -> Result<Json<SuccessResponse>> {
    // Update user's onboarding_completed flag
    let result = sqlx::query!(
        r#"
        UPDATE users
        SET onboarding_completed = true, updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        "#,
        auth.0.user_id
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("User not found".into()));
    }

    Ok(Json(SuccessResponse { success: true }))
}

// ============================================================================
// Router
// ============================================================================

/// Build the onboarding router
///
/// Public routes (no auth):
/// - GET /invitation-context?token=uuid
///
/// Protected routes (require auth):
/// - POST /create-workspace
/// - POST /invite-members
/// - POST /generate-sample-board
/// - POST /complete
pub fn onboarding_router(state: AppState) -> Router<AppState> {
    // Protected routes
    let protected = Router::new()
        .route("/create-workspace", post(create_workspace))
        .route("/invite-members", post(invite_members))
        .route(
            "/generate-sample-board",
            post(generate_sample_board_handler),
        )
        .route("/complete", post(complete_onboarding))
        .layer(from_fn_with_state(state.clone(), auth_middleware));

    // Public routes
    let public = Router::new().route("/invitation-context", get(get_invitation_context));

    // Combine both
    Router::new().merge(protected).merge(public)
}
