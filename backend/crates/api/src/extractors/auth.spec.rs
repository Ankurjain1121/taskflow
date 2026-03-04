// Tests for auth extractors
// These test role-based access control (RBAC) enforcement
#[cfg(test)]
mod tests {
    use axum::extract::FromRequestParts;
    use axum::http::{request::Parts, Request, StatusCode};
    use uuid::Uuid;

    use crate::extractors::auth::{
        AdminUser, AuthUserExtractor, ManagerOrAdmin, OptionalAuthUser, TenantContext,
    };
    use crate::middleware::auth::AuthUser;
    use taskflow_db::models::UserRole;

    /// Helper: create mock HTTP request Parts
    fn create_mock_parts() -> Parts {
        let (parts, _body) = Request::builder()
            .uri("/test")
            .body(())
            .expect("test request builder")
            .into_parts();
        parts
    }

    /// Helper: create an AuthUser with a given role
    fn make_auth_user(role: UserRole) -> AuthUser {
        AuthUser {
            user_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            role,
            token_id: Uuid::new_v4(),
        }
    }

    /// Helper: extract status code from a Response rejection
    fn rejection_status(response: axum::response::Response) -> StatusCode {
        response.status()
    }

    // ========================================================================
    // AuthUserExtractor tests
    // ========================================================================

    mod auth_user_extractor {
        use super::*;

        #[tokio::test]
        async fn should_extract_auth_user_when_present() {
            let mut parts = create_mock_parts();
            let auth_user = make_auth_user(UserRole::Member);
            let expected_id = auth_user.user_id;
            parts.extensions.insert(auth_user);

            let result = AuthUserExtractor::from_request_parts(&mut parts, &()).await;
            assert!(result.is_ok());
            assert_eq!(result.unwrap().0.user_id, expected_id);
        }

        #[tokio::test]
        async fn should_return_401_when_no_auth_user() {
            let mut parts = create_mock_parts();
            // No AuthUser inserted

            let result = AuthUserExtractor::from_request_parts(&mut parts, &()).await;
            assert!(result.is_err());
            let status = rejection_status(result.unwrap_err());
            assert_eq!(status, StatusCode::UNAUTHORIZED);
        }
    }

    // ========================================================================
    // AdminUser extractor tests
    // CRITICAL: Admin role enforcement
    // ========================================================================

    mod admin_user_extractor {
        use super::*;

        #[tokio::test]
        async fn should_pass_with_admin_role() {
            let mut parts = create_mock_parts();
            let auth_user = make_auth_user(UserRole::Admin);
            let expected_id = auth_user.user_id;
            parts.extensions.insert(auth_user);

            let result = AdminUser::from_request_parts(&mut parts, &()).await;
            assert!(result.is_ok());
            assert_eq!(result.unwrap().0.user_id, expected_id);
        }

        #[tokio::test]
        async fn should_fail_with_member_role() {
            let mut parts = create_mock_parts();
            parts.extensions.insert(make_auth_user(UserRole::Member));

            let result = AdminUser::from_request_parts(&mut parts, &()).await;
            assert!(result.is_err());
            let status = rejection_status(result.unwrap_err());
            assert_eq!(status, StatusCode::FORBIDDEN);
        }

        #[tokio::test]
        async fn should_fail_with_manager_role() {
            let mut parts = create_mock_parts();
            parts.extensions.insert(make_auth_user(UserRole::Manager));

            let result = AdminUser::from_request_parts(&mut parts, &()).await;
            assert!(result.is_err());
            let status = rejection_status(result.unwrap_err());
            assert_eq!(status, StatusCode::FORBIDDEN);
        }

        #[tokio::test]
        async fn should_return_401_when_no_auth_user() {
            let mut parts = create_mock_parts();
            // No AuthUser inserted at all

            let result = AdminUser::from_request_parts(&mut parts, &()).await;
            assert!(result.is_err());
            let status = rejection_status(result.unwrap_err());
            assert_eq!(status, StatusCode::UNAUTHORIZED);
        }
    }

    // ========================================================================
    // ManagerOrAdmin extractor tests
    // Tests role hierarchy: admin > manager > member
    // ========================================================================

    mod manager_or_admin_extractor {
        use super::*;

        #[tokio::test]
        async fn should_pass_with_admin_role() {
            let mut parts = create_mock_parts();
            let auth_user = make_auth_user(UserRole::Admin);
            let expected_id = auth_user.user_id;
            parts.extensions.insert(auth_user);

            let result = ManagerOrAdmin::from_request_parts(&mut parts, &()).await;
            assert!(result.is_ok());
            assert_eq!(result.unwrap().0.user_id, expected_id);
        }

        #[tokio::test]
        async fn should_pass_with_manager_role() {
            let mut parts = create_mock_parts();
            let auth_user = make_auth_user(UserRole::Manager);
            let expected_id = auth_user.user_id;
            parts.extensions.insert(auth_user);

            let result = ManagerOrAdmin::from_request_parts(&mut parts, &()).await;
            assert!(result.is_ok());
            assert_eq!(result.unwrap().0.user_id, expected_id);
        }

        #[tokio::test]
        async fn should_fail_with_member_role() {
            let mut parts = create_mock_parts();
            parts.extensions.insert(make_auth_user(UserRole::Member));

            let result = ManagerOrAdmin::from_request_parts(&mut parts, &()).await;
            assert!(result.is_err());
            let status = rejection_status(result.unwrap_err());
            assert_eq!(status, StatusCode::FORBIDDEN);
        }

        #[tokio::test]
        async fn should_return_401_when_no_auth_user() {
            let mut parts = create_mock_parts();

            let result = ManagerOrAdmin::from_request_parts(&mut parts, &()).await;
            assert!(result.is_err());
            let status = rejection_status(result.unwrap_err());
            assert_eq!(status, StatusCode::UNAUTHORIZED);
        }
    }

    // ========================================================================
    // TenantContext extractor tests
    // CRITICAL: Multi-tenant isolation
    // ========================================================================

    mod tenant_context_extractor {
        use super::*;

        #[tokio::test]
        async fn should_extract_tenant_and_user_ids() {
            let mut parts = create_mock_parts();
            let auth_user = make_auth_user(UserRole::Member);
            let expected_tenant_id = auth_user.tenant_id;
            let expected_user_id = auth_user.user_id;
            parts.extensions.insert(auth_user);

            let result = TenantContext::from_request_parts(&mut parts, &()).await;
            assert!(result.is_ok());
            let ctx = result.unwrap();
            assert_eq!(ctx.tenant_id, expected_tenant_id);
            assert_eq!(ctx.user_id, expected_user_id);
            assert_eq!(ctx.role, UserRole::Member);
        }

        #[tokio::test]
        async fn should_return_401_without_auth_user() {
            let mut parts = create_mock_parts();

            let result = TenantContext::from_request_parts(&mut parts, &()).await;
            assert!(result.is_err());
            let status = rejection_status(result.unwrap_err());
            assert_eq!(status, StatusCode::UNAUTHORIZED);
        }

        #[tokio::test]
        async fn should_isolate_different_tenants() {
            let mut parts1 = create_mock_parts();
            let auth1 = make_auth_user(UserRole::Admin);
            let tenant1 = auth1.tenant_id;
            parts1.extensions.insert(auth1);

            let mut parts2 = create_mock_parts();
            let auth2 = make_auth_user(UserRole::Admin);
            let tenant2 = auth2.tenant_id;
            parts2.extensions.insert(auth2);

            let ctx1 = TenantContext::from_request_parts(&mut parts1, &())
                .await
                .unwrap();
            let ctx2 = TenantContext::from_request_parts(&mut parts2, &())
                .await
                .unwrap();

            assert_ne!(ctx1.tenant_id, ctx2.tenant_id);
            assert_eq!(ctx1.tenant_id, tenant1);
            assert_eq!(ctx2.tenant_id, tenant2);
        }

        #[tokio::test]
        async fn should_preserve_role_in_context() {
            for role in [UserRole::Admin, UserRole::Manager, UserRole::Member] {
                let mut parts = create_mock_parts();
                parts.extensions.insert(make_auth_user(role));

                let ctx = TenantContext::from_request_parts(&mut parts, &())
                    .await
                    .unwrap();
                assert_eq!(ctx.role, role);
            }
        }
    }

    // ========================================================================
    // OptionalAuthUser extractor tests
    // Tests fallback for unauthenticated requests
    // ========================================================================

    mod optional_auth_user_extractor {
        use super::*;

        #[tokio::test]
        async fn should_return_some_when_authenticated() {
            let mut parts = create_mock_parts();
            let auth_user = make_auth_user(UserRole::Member);
            let expected_id = auth_user.user_id;
            parts.extensions.insert(auth_user);

            let result = OptionalAuthUser::from_request_parts(&mut parts, &()).await;
            assert!(result.is_ok());
            let opt = result.unwrap();
            assert!(opt.0.is_some());
            assert_eq!(opt.0.unwrap().user_id, expected_id);
        }

        #[tokio::test]
        async fn should_return_none_without_auth() {
            let mut parts = create_mock_parts();

            let result = OptionalAuthUser::from_request_parts(&mut parts, &()).await;
            assert!(result.is_ok());
            let opt = result.unwrap();
            assert!(opt.0.is_none());
        }

        #[tokio::test]
        async fn should_never_reject() {
            // OptionalAuthUser uses Infallible as rejection, so it should always Ok
            let mut parts = create_mock_parts();
            let result = OptionalAuthUser::from_request_parts(&mut parts, &()).await;
            assert!(result.is_ok(), "OptionalAuthUser should never reject");
        }
    }

    // ========================================================================
    // Cross-extractor edge case tests
    // ========================================================================

    mod edge_cases {
        use super::*;

        #[tokio::test]
        async fn admin_extractor_should_preserve_all_user_fields() {
            let mut parts = create_mock_parts();
            let auth_user = AuthUser {
                user_id: Uuid::parse_str("11111111-1111-1111-1111-111111111111").unwrap(),
                tenant_id: Uuid::parse_str("22222222-2222-2222-2222-222222222222").unwrap(),
                role: UserRole::Admin,
                token_id: Uuid::parse_str("33333333-3333-3333-3333-333333333333").unwrap(),
            };
            parts.extensions.insert(auth_user.clone());

            let result = AdminUser::from_request_parts(&mut parts, &())
                .await
                .unwrap();
            assert_eq!(result.0.user_id, auth_user.user_id);
            assert_eq!(result.0.tenant_id, auth_user.tenant_id);
            assert_eq!(result.0.role, auth_user.role);
            assert_eq!(result.0.token_id, auth_user.token_id);
        }

        #[tokio::test]
        async fn manager_or_admin_should_preserve_all_user_fields() {
            let mut parts = create_mock_parts();
            let auth_user = AuthUser {
                user_id: Uuid::parse_str("11111111-1111-1111-1111-111111111111").unwrap(),
                tenant_id: Uuid::parse_str("22222222-2222-2222-2222-222222222222").unwrap(),
                role: UserRole::Manager,
                token_id: Uuid::parse_str("33333333-3333-3333-3333-333333333333").unwrap(),
            };
            parts.extensions.insert(auth_user.clone());

            let result = ManagerOrAdmin::from_request_parts(&mut parts, &())
                .await
                .unwrap();
            assert_eq!(result.0.user_id, auth_user.user_id);
            assert_eq!(result.0.tenant_id, auth_user.tenant_id);
            assert_eq!(result.0.role, auth_user.role);
            assert_eq!(result.0.token_id, auth_user.token_id);
        }

        #[tokio::test]
        async fn all_extractors_return_401_when_no_auth() {
            // AuthUserExtractor
            let mut parts = create_mock_parts();
            let r = AuthUserExtractor::from_request_parts(&mut parts, &()).await;
            assert_eq!(rejection_status(r.unwrap_err()), StatusCode::UNAUTHORIZED);

            // AdminUser
            let mut parts = create_mock_parts();
            let r = AdminUser::from_request_parts(&mut parts, &()).await;
            assert_eq!(rejection_status(r.unwrap_err()), StatusCode::UNAUTHORIZED);

            // ManagerOrAdmin
            let mut parts = create_mock_parts();
            let r = ManagerOrAdmin::from_request_parts(&mut parts, &()).await;
            assert_eq!(rejection_status(r.unwrap_err()), StatusCode::UNAUTHORIZED);

            // TenantContext
            let mut parts = create_mock_parts();
            let r = TenantContext::from_request_parts(&mut parts, &()).await;
            assert_eq!(rejection_status(r.unwrap_err()), StatusCode::UNAUTHORIZED);

            // OptionalAuthUser should succeed with None
            let mut parts = create_mock_parts();
            let r = OptionalAuthUser::from_request_parts(&mut parts, &()).await;
            assert!(r.is_ok());
            assert!(r.unwrap().0.is_none());
        }

        #[tokio::test]
        async fn member_role_should_only_pass_basic_extractors() {
            let auth_user = make_auth_user(UserRole::Member);

            // Should pass AuthUserExtractor
            let mut parts = create_mock_parts();
            parts.extensions.insert(auth_user.clone());
            assert!(AuthUserExtractor::from_request_parts(&mut parts, &())
                .await
                .is_ok());

            // Should pass TenantContext
            let mut parts = create_mock_parts();
            parts.extensions.insert(auth_user.clone());
            assert!(TenantContext::from_request_parts(&mut parts, &())
                .await
                .is_ok());

            // Should pass OptionalAuthUser
            let mut parts = create_mock_parts();
            parts.extensions.insert(auth_user.clone());
            assert!(OptionalAuthUser::from_request_parts(&mut parts, &())
                .await
                .is_ok());

            // Should FAIL AdminUser
            let mut parts = create_mock_parts();
            parts.extensions.insert(auth_user.clone());
            let r = AdminUser::from_request_parts(&mut parts, &()).await;
            assert!(r.is_err());
            assert_eq!(rejection_status(r.unwrap_err()), StatusCode::FORBIDDEN);

            // Should FAIL ManagerOrAdmin
            let mut parts = create_mock_parts();
            parts.extensions.insert(auth_user);
            let r = ManagerOrAdmin::from_request_parts(&mut parts, &()).await;
            assert!(r.is_err());
            assert_eq!(rejection_status(r.unwrap_err()), StatusCode::FORBIDDEN);
        }
    }
}
