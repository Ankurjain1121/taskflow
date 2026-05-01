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
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::sync::LazyLock;
use uuid::Uuid;

use taskbolt_db::models::{UserRole, WorkspaceMemberRole};
use taskbolt_db::queries::{auth, invitations, workspaces};
use taskbolt_services::sample_board::generate_sample_board;

use crate::errors::{AppError, Result};
use crate::extractors::{AuthUserExtractor, StrictJson};
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;

use super::validation::{
    validate_optional_string, validate_required_string, MAX_NAME_LEN, MAX_PROJECT_DESCRIPTION_LEN,
};

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

#[strict_dto_derive::strict_dto]
#[derive(Debug)]
pub struct CreateWorkspaceRequest {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CreateWorkspaceResponse {
    pub workspace_id: Uuid,
}

#[strict_dto_derive::strict_dto]
#[derive(Debug)]
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

#[strict_dto_derive::strict_dto]
#[derive(Debug)]
pub struct GenerateSampleBoardRequest {
    pub workspace_id: Uuid,
    pub use_case: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct GenerateSampleBoardResponse {
    pub board_id: Uuid,
    pub workspace_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct SuccessResponse {
    pub success: bool,
}

// ============================================================================
// Validation Helpers
// ============================================================================

/// Regex for RFC-compliant email validation
static EMAIL_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$",
    )
    .unwrap()
});

/// Validates email format according to RFC 5322 (simplified)
fn is_valid_email(email: &str) -> bool {
    EMAIL_REGEX.is_match(email) && email.len() <= 254
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
    let board_ids: Vec<Uuid> = sqlx::query_scalar(
        r#"
        SELECT id FROM projects
        WHERE workspace_id = $1 AND deleted_at IS NULL
        ORDER BY created_at ASC
        "#,
    )
    .bind(invitation.workspace_id)
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
    StrictJson(payload): StrictJson<CreateWorkspaceRequest>,
) -> Result<Json<CreateWorkspaceResponse>> {
    // Validate input
    validate_required_string("Workspace name", &payload.name, MAX_NAME_LEN)?;
    validate_optional_string(
        "Description",
        payload.description.as_deref(),
        MAX_PROJECT_DESCRIPTION_LEN,
    )?;

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
    StrictJson(payload): StrictJson<InviteMembersRequest>,
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

    // Mitigation A: only ws Owner/Admin or global Admin can auto-add an
    // existing org user. Other callers can still send email invites for
    // unknown emails — only the same-tenant short-circuit is gated.
    let caller_ws_role =
        workspaces::get_workspace_member_role(&state.db, payload.workspace_id, auth.0.user_id)
            .await?;
    let caller_is_admin = matches!(auth.0.role, UserRole::Admin | UserRole::SuperAdmin)
        || matches!(
            caller_ws_role,
            Some(WorkspaceMemberRole::Owner | WorkspaceMemberRole::Admin)
        );

    let mut invited_count = 0;
    let mut pending_count = 0;

    for email in &payload.emails {
        let email = email.trim().to_lowercase();

        // Validate email format (RFC-compliant)
        if !is_valid_email(&email) {
            tracing::debug!("Skipping invalid email: {}", email);
            continue;
        }

        // Check if user already exists
        if let Some(existing_user) = auth::get_user_by_email(&state.db, &email).await? {
            if !caller_is_admin {
                tracing::debug!(
                    "Skipping existing-user auto-add: caller {} lacks admin role",
                    auth.0.user_id
                );
                continue;
            }

            // Check if already a workspace member
            let already_member =
                workspaces::is_workspace_member(&state.db, payload.workspace_id, existing_user.id)
                    .await?;

            if !already_member {
                // Add existing user directly to workspace
                match workspaces::add_workspace_member(
                    &state.db,
                    payload.workspace_id,
                    existing_user.id,
                )
                .await
                {
                    Ok(_) => invited_count += 1,
                    Err(e) => {
                        tracing::error!(
                            "Failed to add existing user to workspace: user_id={}, workspace_id={}, error={}",
                            existing_user.id,
                            payload.workspace_id,
                            e
                        );
                    }
                }
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
                match invitations::create_invitation(
                    &state.db,
                    &email,
                    payload.workspace_id,
                    UserRole::Member, // Default role for invited members
                    auth.0.user_id,
                    expires_at,
                )
                .await
                {
                    Ok(_) => pending_count += 1,
                    Err(e) => {
                        tracing::error!(
                            "Failed to create invitation: email={}, workspace_id={}, error={}",
                            email,
                            payload.workspace_id,
                            e
                        );
                    }
                }
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
    StrictJson(payload): StrictJson<GenerateSampleBoardRequest>,
) -> Result<Json<GenerateSampleBoardResponse>> {
    // Verify user is a workspace member
    let is_member =
        workspaces::is_workspace_member(&state.db, payload.workspace_id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    // Generate the sample board
    let use_case = payload.use_case.as_deref().unwrap_or("software");
    let board_id = generate_sample_board(
        &state.db,
        payload.workspace_id,
        auth.0.user_id,
        auth.0.tenant_id,
        use_case,
    )
    .await
    .map_err(|e| AppError::InternalError(format!("Failed to generate sample board: {}", e)))?;

    Ok(Json(GenerateSampleBoardResponse {
        board_id,
        workspace_id: payload.workspace_id,
    }))
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
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware));

    // Public routes
    let public = Router::new().route("/invitation-context", get(get_invitation_context));

    // Combine both
    Router::new().merge(protected).merge(public)
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod email_validation_tests {
    use super::*;

    // Valid emails (should pass)
    #[test]
    fn test_valid_emails() {
        assert!(is_valid_email("user@example.com"));
        assert!(is_valid_email("first.last@example.co.uk"));
        assert!(is_valid_email("user+tag@example.com"));
        assert!(is_valid_email("user_name@example.com"));
        assert!(is_valid_email("123@example.com"));
    }

    // Invalid emails (should fail)
    #[test]
    fn test_invalid_emails() {
        assert!(!is_valid_email("@example.com")); // Missing local part
        assert!(!is_valid_email("user@")); // Missing domain
        assert!(!is_valid_email("user")); // No @
        assert!(!is_valid_email("user@.com")); // Domain starts with dot
        assert!(!is_valid_email("user@domain")); // No TLD
        assert!(!is_valid_email("user name@example.com")); // Space in local
        assert!(!is_valid_email("")); // Empty
    }

    // Length validation
    #[test]
    fn test_email_length_limits() {
        assert!(is_valid_email("a@b.co")); // Minimum valid (6 chars)

        // Create email exactly 254 chars (max valid)
        let long_local = "a".repeat(240);
        let long_email = format!("{}@example.com", long_local);
        assert_eq!(long_email.len(), 252);
        assert!(is_valid_email(&long_email));

        // Create email over 254 chars (too long)
        let very_long_local = "a".repeat(250);
        let too_long = format!("{}@example.com", very_long_local);
        assert!(too_long.len() > 254);
        assert!(!is_valid_email(&too_long));
    }

    /// Verify the EMAIL_REGEX Lazy static compiles successfully.
    /// This documents that the .unwrap() in Lazy::new is safe
    /// because the regex pattern is a compile-time constant.
    #[test]
    fn email_regex_compiles() {
        assert!(EMAIL_REGEX.is_match("user@example.com"));
        assert!(!EMAIL_REGEX.is_match("not-an-email"));
    }

    // Edge cases
    #[test]
    fn test_email_edge_cases() {
        assert!(!is_valid_email("user@example.c")); // Single char TLD not valid
        assert!(is_valid_email("user@example.co")); // Two char TLD valid
        assert!(is_valid_email("user@example.international")); // Long TLD
        assert!(!is_valid_email("user@@example.com")); // Double @
                                                       // Our simplified regex allows dots at start/end of local part
                                                       // (stricter than RFC but acceptable for onboarding)
        assert!(is_valid_email(".user@example.com")); // Dot at start (allowed by our regex)
        assert!(is_valid_email("user.@example.com")); // Dot at end (allowed by our regex)
        assert!(!is_valid_email("user@exam ple.com")); // Space in domain
    }
}
