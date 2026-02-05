# Section 02: Auth & Multi-Tenancy

## Overview
Set up user authentication with JWT tokens (access + refresh) in the Rust backend, implement three permission roles (Admin, Manager, Member) as global roles on the users table, and configure PostgreSQL Row-Level Security for multi-tenant data isolation. Sign-up is invitation-only: the first user creates the organization during onboarding, all other users join via invitation links. Angular frontend handles token storage, HTTP interceptor for auth headers, and route guards.

## Risk: [yellow] - Auth and RLS policies are security-critical; bugs here can leak data

## Dependencies
- Depends on: none (can start in parallel with section 01 if schema is defined)
- Blocks: 03, 04, 05, 06, 07, 08, 09, 10, 11, 12
- Parallel batch: 1

## TDD Test Stubs
- Test: First user can sign up and create an organization via onboarding
- Test: Invited user can accept invitation token and sign up
- Test: Uninvited user cannot sign up (no tenant auto-creation)
- Test: User can sign in and receive valid JWT access + refresh tokens
- Test: Admin can access admin-only routes; Member cannot
- Test: Manager can create tasks; Member can only view/update assigned tasks
- Test: RLS prevents user from workspace A seeing data from workspace B
- Test: Unauthenticated requests to protected routes return 401
- Test: Expired access token returns 401; refresh token can get a new one
- Test: `app_user` PostgreSQL role cannot bypass RLS policies

## Tasks

<task type="auto" id="02-01">
  <name>Create auth crate with JWT token generation and validation</name>
  <files>backend/crates/auth/Cargo.toml, backend/crates/auth/src/lib.rs, backend/crates/auth/src/jwt.rs, backend/crates/auth/src/password.rs</files>
  <action>Create the `auth` crate within the Rust workspace. Add dependencies: `jsonwebtoken`, `argon2`, `serde`, `chrono`, `uuid`, `thiserror`. In `jwt.rs`, define `Claims` struct with fields: `sub` (user UUID as string), `tenant_id` (UUID string), `role` (String), `exp` (usize), `iat` (usize), `token_type` (String, "access" or "refresh"). Implement `encode_access_token(user_id: Uuid, tenant_id: Uuid, role: &str, secret: &str) -> Result<String>` that creates a JWT with 15-minute expiry. Implement `encode_refresh_token(user_id: Uuid, tenant_id: Uuid, role: &str, secret: &str) -> Result<String>` with 7-day expiry. Implement `decode_token(token: &str, secret: &str) -> Result<Claims>` that validates and decodes. Implement `TokenPair { access_token: String, refresh_token: String }` and `generate_token_pair(...)` that returns both. In `password.rs`, implement `hash_password(password: &str) -> Result<String>` using argon2 with default params and `verify_password(password: &str, hash: &str) -> Result<bool>`. Export all from `lib.rs`.</action>
  <verify>Unit test: generating a token pair and decoding the access token returns correct claims with sub, tenant_id, and role. Password hash and verify roundtrip succeeds.</verify>
  <done>Created auth crate with JWT access/refresh token generation and argon2 password hashing.</done>
</task>

<task type="auto" id="02-02">
  <name>Implement role-based access control in auth crate</name>
  <files>backend/crates/auth/src/rbac.rs, backend/crates/auth/src/lib.rs</files>
  <action>Create `rbac.rs` defining the RBAC system. All permissions are based on the global `users.role` field -- there is no per-workspace role. Define `#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)] pub enum Role { Admin, Manager, Member }` with `impl FromStr` and `impl Display`. Define `#[derive(Debug, Clone, PartialEq, Eq, Hash)] pub enum Permission` with variants: `WorkspaceCreate`, `WorkspaceDelete`, `WorkspaceManageMembers`, `BoardCreate`, `BoardDelete`, `BoardUpdate`, `TaskCreate`, `TaskUpdate`, `TaskDelete`, `TaskAssign`, `TaskView`, `CommentCreate`, `CommentDeleteOwn`, `CommentDeleteAny`, `AdminAccess`, `AdminManageUsers`, `AdminViewAuditLog`. Implement `Role::permissions(&self) -> HashSet<Permission>` where Admin gets all, Manager gets all except Admin*, Member gets TaskView, TaskUpdate, TaskCreate, CommentCreate, CommentDeleteOwn, BoardCreate. NOTE: Member does NOT get WorkspaceCreate. Implement `pub fn has_permission(role: &Role, permission: &Permission) -> bool` and `pub fn require_permission(role: &Role, permission: &Permission) -> Result<(), AuthError>` that returns `Err(AuthError::Forbidden)` on failure. Re-export from `lib.rs`.</action>
  <verify>Calling `has_permission(Role::Member, Permission::AdminAccess)` returns false. `has_permission(Role::Admin, Permission::AdminAccess)` returns true. `has_permission(Role::Member, Permission::WorkspaceCreate)` returns false.</verify>
  <done>Implemented RBAC permission system with role-to-permission mapping using HashSet lookups.</done>
</task>

<task type="auto" id="02-03">
  <name>Create Axum auth middleware and extractors</name>
  <files>backend/crates/api/src/middleware/auth.rs, backend/crates/api/src/extractors/auth.rs, backend/crates/api/src/extractors/mod.rs</files>
  <action>Create `backend/crates/api/src/middleware/auth.rs` with an Axum middleware layer. The middleware reads the `Authorization: Bearer <token>` header, decodes the JWT using `auth::jwt::decode_token()`, and inserts `AuthUser { user_id: Uuid, tenant_id: Uuid, role: Role }` into request extensions. If the token is missing or invalid, return 401 Unauthorized JSON response `{ "error": "Unauthorized" }`. Create `backend/crates/api/src/extractors/auth.rs` with custom Axum extractors: `AuthUser` extractor that reads from request extensions (requires the auth middleware to have run), `AdminUser` extractor that additionally checks `role == Admin` and returns 403 if not, `ManagerOrAdmin` extractor that checks `role == Admin || role == Manager`. Create `TenantContext` extractor that reads `tenant_id` from `AuthUser`. IMPORTANT: `tenant_id` is ALWAYS derived from the JWT, never from request headers or body, to prevent spoofing. Register the auth middleware as a Tower layer that can be applied to route groups.</action>
  <verify>A request with a valid JWT token passes through the middleware and the `AuthUser` extractor returns the correct user_id, tenant_id, and role. A request without a token returns 401. An `AdminUser` extractor on a Member user returns 403.</verify>
  <done>Created Axum auth middleware and custom extractors for AuthUser, AdminUser, ManagerOrAdmin, and TenantContext.</done>
</task>

<task type="auto" id="02-04">
  <name>Set up PostgreSQL RLS policies via SQLx migration</name>
  <files>backend/crates/db/src/migrations/0002_rls_policies.sql, backend/crates/db/src/rls.rs</files>
  <action>Create SQLx migration file `0002_rls_policies.sql`. First, create a restricted PostgreSQL role for the application: `CREATE ROLE app_user WITH LOGIN PASSWORD 'app_user_password'; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;`. Then for each tenant-scoped table (`workspaces`, `boards`, `board_columns`, `board_members`, `tasks`, `task_assignees`, `labels`, `task_labels`, `comments`, `attachments`, `activity_log`), execute: `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY; ALTER TABLE <table> FORCE ROW LEVEL SECURITY;` (FORCE ensures RLS applies even to the table owner). Create policy: `CREATE POLICY tenant_isolation ON <table> USING (tenant_id = current_setting('app.tenant_id')::uuid);`. For tables without direct `tenant_id` column (like `board_columns`, `board_members`, `task_assignees`, `task_labels`, `comments`, `attachments`), create the policy with a subquery join. Create `backend/crates/db/src/rls.rs` that exports an `async fn set_tenant_context(tx: &mut sqlx::Transaction<'_, Postgres>, tenant_id: Uuid) -> Result<()>`. This function validates the UUID format then executes `SET LOCAL app.tenant_id = '<validated_uuid>'` inside the transaction. The application database pool must connect as the `app_user` role.</action>
  <verify>After calling `set_tenant_context` inside a transaction, a `SELECT * FROM workspaces` query returns only workspaces belonging to that tenant. Connecting as `app_user` confirms RLS cannot be bypassed.</verify>
  <done>Created PostgreSQL RLS policies as SQLx migration with restricted `app_user` role and UUID-validated tenant context setting in Rust.</done>
</task>

<task type="auto" id="02-05">
  <name>Create tenant-scoped database middleware for Axum</name>
  <files>backend/crates/api/src/middleware/tenant.rs, backend/crates/api/src/state.rs</files>
  <action>Create `backend/crates/api/src/state.rs` defining `AppState` struct that holds: `db: PgPool` (SQLx connection pool), `jwt_secret: String`, `redis: redis::Client`. Implement `Clone` for `AppState`. Create `backend/crates/api/src/middleware/tenant.rs` with a helper function `with_tenant<F, T>(state: &AppState, tenant_id: Uuid, f: F) -> Result<T>` where `F: FnOnce(&mut Transaction) -> Future<Output = Result<T>>`. This function begins a SQLx transaction, calls `set_tenant_context(&mut tx, tenant_id)` to set `SET LOCAL app.tenant_id`, executes the closure `f` with the transaction, then commits. This ensures all database queries within the closure are automatically scoped to the tenant via RLS. All protected route handlers will use this pattern: `with_tenant(&state, auth_user.tenant_id, |tx| async { ... })`. Export a convenience Axum extractor or function that route handlers call.</action>
  <verify>A route handler using `with_tenant` can only see data belonging to the authenticated user's tenant. Direct queries outside the transaction do not have tenant scoping.</verify>
  <done>Created tenant-scoped transaction helper and AppState for Axum with SQLx connection pool.</done>
</task>

<task type="auto" id="02-06">
  <name>Create auth REST endpoints (sign-in, refresh, sign-out)</name>
  <files>backend/crates/api/src/routes/auth.rs, backend/crates/api/src/routes/mod.rs</files>
  <action>Create `backend/crates/api/src/routes/auth.rs` with the following Axum route handlers. `POST /api/auth/sign-in`: accepts JSON `{ "email": string, "password": string }`, queries `users` table by email, verifies password with `auth::password::verify_password()`, generates token pair with `auth::jwt::generate_token_pair()`, returns JSON `{ "access_token": string, "refresh_token": string, "user": { id, name, email, role, tenant_id } }`. `POST /api/auth/refresh`: accepts JSON `{ "refresh_token": string }`, decodes the refresh token, validates `token_type == "refresh"`, generates new token pair, returns same format. `POST /api/auth/sign-out`: protected route, accepts the refresh token and adds it to a Redis blacklist with TTL matching its expiry. `GET /api/auth/me`: protected route, returns the current user's profile from the JWT claims joined with users table data. IMPORTANT: There is NO public sign-up endpoint. Users can only join via invitation (section 02-07). The first user/organization is created through the onboarding wizard (Section 10). Register all routes in a `pub fn auth_routes() -> Router<AppState>` function.</action>
  <verify>Signing in with valid credentials returns access and refresh tokens. The access token decodes to correct claims. Refreshing with a valid refresh token returns a new token pair. Sign-out blacklists the refresh token.</verify>
  <done>Created auth REST endpoints for sign-in, refresh, sign-out, and me with JWT token pair flow.</done>
</task>

<task type="auto" id="02-07">
  <name>Create invitation system (schema, endpoints, acceptance)</name>
  <files>backend/crates/db/src/migrations/0003_invitations.sql, backend/crates/api/src/routes/invitation.rs, backend/crates/db/src/queries/invitations.rs</files>
  <action>Create migration `0003_invitations.sql` with an `invitations` table: `id` (uuid primary key default gen_random_uuid()), `email` (varchar(255) not null), `workspace_id` (uuid not null references workspaces(id) on delete cascade), `role` (user_role not null default 'member'), `token` (uuid not null unique default gen_random_uuid()), `invited_by_id` (uuid not null references users(id)), `expires_at` (timestamptz not null), `accepted_at` (timestamptz nullable), `created_at` (timestamptz not null default now()). Add index on `token`. Create `backend/crates/db/src/queries/invitations.rs` with query functions: `create_invitation`, `get_by_token`, `accept_invitation`, `list_by_workspace`. Create `backend/crates/api/src/routes/invitation.rs` with routes: `POST /api/invitations` (protected, requires WorkspaceManageMembers permission) creates invitation with 7-day expiry, sends email via Postal. `GET /api/invitations/validate/:token` (public) validates token, returns invitation details (email, workspace name, inviter name). `POST /api/invitations/accept` (public) accepts JSON `{ "token": string, "name": string, "password": string }`, validates token not expired/accepted, creates user with hashed password, adds to workspace as member, sets role from invitation, marks invitation accepted, returns token pair. `GET /api/invitations?workspace_id=<uuid>` (protected) lists pending invitations.</action>
  <verify>Creating an invitation generates a token. Validating a valid token returns details. Accepting creates user, adds to workspace, returns JWT. Expired tokens return 400.</verify>
  <done>Created invitation system with schema, REST endpoints, token validation, and user creation on acceptance.</done>
</task>

<task type="auto" id="02-08">
  <name>Build Angular auth service, interceptor, guard, and sign-in page</name>
  <files>frontend/src/app/core/services/auth.service.ts, frontend/src/app/core/interceptors/auth.interceptor.ts, frontend/src/app/core/guards/auth.guard.ts, frontend/src/app/features/auth/sign-in/sign-in.component.ts, frontend/src/app/features/auth/accept-invite/accept-invite.component.ts</files>
  <action>Create `auth.service.ts` as an Angular injectable service. Store tokens in localStorage (`taskflow_access_token`, `taskflow_refresh_token`). Expose: `signIn(email, password): Observable<TokenResponse>`, `refresh(): Observable<TokenResponse>`, `signOut(): void`, `getAccessToken(): string | null`, `isAuthenticated(): boolean` (checks token expiry via decoded JWT), `currentUser: Signal<User | null>` (decoded from JWT). Create `auth.interceptor.ts` as an Angular HTTP interceptor (functional style for Angular 19). On every request, attach `Authorization: Bearer <access_token>` header. On 401 response, attempt token refresh via `auth.refresh()`, retry the original request with the new token. If refresh also fails, redirect to `/sign-in`. Create `auth.guard.ts` as a functional route guard that checks `authService.isAuthenticated()` and redirects to `/sign-in` with `returnUrl` query param if not. Create `sign-in.component.ts` as a standalone Angular component with reactive form: email (required, email validator), password (required, minLength 8). On submit, call `authService.signIn()`, on success navigate to `returnUrl` or `/dashboard`. Display error message on failure. Style with Tailwind: centered card layout. Create `accept-invite.component.ts` that reads `token` from route query params, calls `GET /api/invitations/validate/:token` to show workspace name, renders sign-up form (name, password, confirm password), on submit calls `POST /api/invitations/accept`. On success, stores tokens and navigates to `/onboarding?token=<token>`.</action>
  <verify>Sign-in form submits credentials, stores tokens, redirects to dashboard. HTTP interceptor attaches Bearer token. Auth guard blocks unauthenticated access. Accept-invite validates token and creates account.</verify>
  <done>Built Angular auth service with JWT storage, HTTP interceptor with auto-refresh, route guard, sign-in page, and invitation acceptance page.</done>
</task>
