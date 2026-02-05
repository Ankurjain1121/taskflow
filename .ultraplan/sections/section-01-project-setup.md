# Section 01: Project Setup & Database Schema

## Overview
Set up the foundation: Cargo workspace with `api`, `db`, `auth`, and `services` crates. Initialize Angular 19 app with standalone components, Tailwind CSS v4, and Angular Material. Configure SQLx with PostgreSQL connection pool and compile-time checked queries. Write all database migrations as raw `.sql` files managed by SQLx. Set up ts-rs for TypeScript type generation from Rust structs to share WebSocket event types with the Angular frontend.

## Risk: [green] - Standard project scaffolding with well-documented tools

## Dependencies
- Depends on: none
- Blocks: 03, 04, 05, 06, 07, 08, 09, 10, 11, 12
- Parallel batch: 1

## TDD Test Stubs
- Test: Database connection succeeds and can run a simple query
- Test: All tables are created with correct columns and constraints
- Test: Foreign key relationships are enforced (cannot create task without valid board)
- Test: SQLx migrations run without errors
- Test: `cargo build` succeeds for all crates
- Test: `ng build` succeeds for the Angular app
- Test: ts-rs generates TypeScript types matching Rust struct definitions

## Tasks

<task type="auto" id="01-01">
  <name>Initialize Cargo workspace with all crates</name>
  <files>backend/Cargo.toml, backend/crates/api/Cargo.toml, backend/crates/api/src/main.rs, backend/crates/db/Cargo.toml, backend/crates/db/src/lib.rs, backend/crates/auth/Cargo.toml, backend/crates/auth/src/lib.rs, backend/crates/services/Cargo.toml, backend/crates/services/src/lib.rs, backend/.env</files>
  <action>Create the root `backend/Cargo.toml` as a workspace with members: `crates/api`, `crates/db`, `crates/auth`, `crates/services`. Set `resolver = "2"`. Define shared workspace dependencies:
- `axum = { version = "0.8", features = ["ws"] }` (WebSocket support included)
- `tokio = { version = "1", features = ["full"] }`
- `serde = { version = "1", features = ["derive"] }`
- `serde_json = "1"`
- `sqlx = { version = "0.8", features = ["runtime-tokio-rustls", "postgres", "uuid", "chrono", "json", "migrate"] }`
- `uuid = { version = "1", features = ["v4", "serde"] }`
- `chrono = { version = "0.4", features = ["serde"] }`
- `tracing = "0.1"`
- `tracing-subscriber = { version = "0.3", features = ["env-filter", "json"] }`
- `thiserror = "2"`
- `ts-rs = { version = "10", features = ["serde-json-impl", "chrono-impl", "uuid-impl"] }`

Create `backend/crates/api/Cargo.toml` with workspace dependencies plus crate-specific:
- `axum` (workspace)
- `tokio` (workspace)
- `sqlx` (workspace)
- `serde`, `serde_json` (workspace)
- `uuid`, `chrono` (workspace)
- `tower = "0.5"`
- `tower-http = { version = "0.6", features = ["cors", "compression-gzip", "trace"] }`
- `jsonwebtoken = "9"` (for JWT validation in middleware)
- `redis = { version = "0.27", features = ["tokio-comp", "connection-manager"] }` (for pub/sub)
- `aws-sdk-s3 = "1"` (for MinIO)
- `reqwest = { version = "0.12", features = ["json"] }`
- `dotenvy = "0.15"`
- `dashmap = "6"` (for per-board broadcast channels)
- `tracing`, `tracing-subscriber`, `thiserror` (workspace)
- Path dependencies: `db`, `auth`, `services`

Create `backend/crates/db/Cargo.toml` with: `sqlx` (workspace), `serde`, `serde_json`, `uuid`, `chrono`, `thiserror` (workspace).

Create `backend/crates/auth/Cargo.toml` with: `jsonwebtoken = "9"`, `argon2 = "0.5"`, `password-hash = { version = "0.5", features = ["rand_core"] }`, `rand = "0.8"`, `sqlx` (workspace), `serde`, `serde_json`, `uuid`, `chrono`, `thiserror` (workspace). Path dependency on `db`.

Create `backend/crates/services/Cargo.toml` with: `sqlx` (workspace), `serde`, `serde_json`, `uuid`, `chrono`, `thiserror` (workspace), `lettre = { version = "0.11", features = ["tokio1-rustls-tls", "smtp-transport", "builder"] }`, `tera = "1"`. Path dependencies on `db`, `auth`.

Create `backend/crates/api/src/main.rs` with a minimal Axum server: load `.env` via `dotenvy`, parse config from environment, connect to PostgreSQL via `sqlx::PgPool::connect(&database_url).await`, run pending migrations via `sqlx::migrate!("../db/src/migrations").run(&pool).await`, build `AppState` struct, set up tracing subscriber with `EnvFilter`, create Axum router with a health check endpoint at `GET /api/health` that returns `Json(json!({"status": "ok"}))`, bind to `0.0.0.0:8080`, serve with `tokio::net::TcpListener` and graceful shutdown via `tokio::signal::ctrl_c()`.

Create minimal `lib.rs` files for `db`, `auth`, and `services` crates with placeholder module declarations.

Create `backend/.env` with `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/taskflow`, `RUST_LOG=info`, `HOST=0.0.0.0`, `PORT=8080`, `JWT_SECRET=dev-secret-change-in-production`, `JWT_REFRESH_SECRET=dev-refresh-secret-change-in-production`, `REDIS_URL=redis://localhost:6379`.</action>
  <verify>Running `cargo build` in `backend/` compiles all crates without errors. Running `cargo run -p api` starts the server and `curl http://localhost:8080/api/health` returns `{"status":"ok"}`.</verify>
  <done>Initialized Cargo workspace with api, db, auth, and services crates. Axum server starts with health check endpoint. SQLx configured with PostgreSQL pool and migration runner.</done>
</task>

<task type="auto" id="01-02">
  <name>Initialize Angular 19 app with Angular Material and Tailwind v4</name>
  <files>frontend/package.json, frontend/angular.json, frontend/tsconfig.json, frontend/src/app/app.config.ts, frontend/src/app/app.routes.ts, frontend/src/app/app.component.ts, frontend/src/styles.css, frontend/proxy.conf.json</files>
  <action>Run `ng new frontend --standalone --style=css --routing --skip-tests=false` to create an Angular 19 app with standalone components. Install dependencies: `@angular/material`, `@angular/cdk`, `fractional-indexing`, `rxjs` (already included). Install dev dependencies: `tailwindcss@4`, `@angular-devkit/build-angular`.

Run `ng add @angular/material` to set up Angular Material with a custom theme. Choose a prebuilt theme or configure custom colors.

Configure `frontend/src/styles.css` as the Tailwind v4 entry point:
```css
@import "tailwindcss";
@import "@angular/material/prebuilt-themes/azure-blue.css";
```

Set up `app.config.ts` with:
```typescript
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimationsAsync(),
    provideZoneChangeDetection({ eventCoalescing: true }),
  ],
};
```

Create `frontend/proxy.conf.json` to proxy `/api/*` and `/ws/*` to `http://localhost:8080` during development:
```json
{
  "/api": { "target": "http://localhost:8080", "secure": false },
  "/ws": { "target": "http://localhost:8080", "secure": false, "ws": true }
}
```

Create `frontend/src/app/app.routes.ts` with lazy-loaded route stubs for: `/auth/login`, `/auth/accept-invite`, `/onboarding`, `/dashboard`, `/workspace/:workspaceId`, `/workspace/:workspaceId/board/:boardId`, `/workspace/:workspaceId/board/:boardId/settings`, `/workspace/:workspaceId/team`, `/my-tasks`, `/settings/*`, `/admin/*`.

Add scripts to `frontend/package.json`: `"build": "ng build"`, `"serve": "ng serve --proxy-config proxy.conf.json"`, `"test": "ng test"`.</action>
  <verify>Running `cd frontend && npm install && ng build` produces a successful build. Running `ng serve` starts the dev server with proxy to the Rust API on port 8080.</verify>
  <done>Initialized Angular 19 app with standalone components, Angular Material, Tailwind v4, proxy config, and lazy-loaded route stubs.</done>
</task>

<task type="auto" id="01-03">
  <name>Create SQLx migration for all database tables</name>
  <files>backend/crates/db/src/migrations/20260205000001_initial.sql</files>
  <action>Create `backend/crates/db/src/migrations/20260205000001_initial.sql` as a raw SQL migration file managed by SQLx. This single migration creates ALL tables needed for the entire application.

Define custom enums first:
```sql
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'member');
CREATE TYPE board_member_role AS ENUM ('viewer', 'editor');
CREATE TYPE task_priority AS ENUM ('urgent', 'high', 'medium', 'low');
CREATE TYPE activity_action AS ENUM ('created', 'updated', 'moved', 'assigned', 'unassigned', 'commented', 'attached', 'status_changed', 'priority_changed', 'deleted');
CREATE TYPE subscription_status AS ENUM ('active', 'trialing', 'past_due', 'cancelled', 'expired');
```

Create the `tenants` table:
```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  plan VARCHAR(10) NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Create the `users` table:
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  phone_number VARCHAR(20),
  role user_role NOT NULL DEFAULT 'member',
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Create the `accounts` table (for auth provider flexibility):
```sql
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  provider_account_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Create the `refresh_tokens` table (for JWT refresh token rotation):
```sql
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
```

Create the `workspaces` table:
```sql
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  created_by_id UUID NOT NULL REFERENCES users(id),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Create the `workspace_members` table (NOTE: NO role column -- global roles only):
```sql
CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);
```

Create the `boards` table:
```sql
CREATE TABLE boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  slack_webhook_url VARCHAR(512),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  created_by_id UUID NOT NULL REFERENCES users(id),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Create the `board_members` table:
```sql
CREATE TABLE board_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role board_member_role NOT NULL DEFAULT 'editor',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(board_id, user_id)
);
```

Create the `board_columns` table:
```sql
CREATE TABLE board_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  position TEXT NOT NULL,
  color VARCHAR(7),
  status_mapping JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Create the `tasks` table (NOTE: NO status column -- status derived from column's statusMapping):
```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  priority task_priority NOT NULL DEFAULT 'medium',
  due_date TIMESTAMPTZ,
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  column_id UUID NOT NULL REFERENCES board_columns(id),
  position TEXT NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  created_by_id UUID NOT NULL REFERENCES users(id),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Create the `task_assignees` table:
```sql
CREATE TABLE task_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(task_id, user_id)
);
```

Create the `labels` table:
```sql
CREATE TABLE labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) NOT NULL,
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE
);
```

Create the `task_labels` table:
```sql
CREATE TABLE task_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  UNIQUE(task_id, label_id)
);
```

Create the `comments` table:
```sql
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id),
  parent_id UUID REFERENCES comments(id),
  mentioned_user_ids JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Create the `attachments` table:
```sql
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name VARCHAR(500) NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  storage_key TEXT NOT NULL,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  uploaded_by_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Create the `activity_log` table:
```sql
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action activity_action NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  metadata JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX idx_activity_log_tenant ON activity_log(tenant_id, created_at DESC);
```

Create the `notifications` table:
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES users(id),
  event_type VARCHAR(50) NOT NULL,
  title VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  link_url VARCHAR(1000),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, is_read, created_at DESC);
```

Create the `notification_preferences` table:
```sql
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  event_type VARCHAR(50) NOT NULL,
  in_app BOOLEAN NOT NULL DEFAULT true,
  email BOOLEAN NOT NULL DEFAULT true,
  slack BOOLEAN NOT NULL DEFAULT false,
  whatsapp BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_type)
);
```

Create the `invitations` table:
```sql
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'member',
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  invited_by_id UUID NOT NULL REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invitations_token ON invitations(token);
```

Create the `subscriptions` table:
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) UNIQUE,
  lago_subscription_id VARCHAR(255),
  stripe_customer_id VARCHAR(255),
  plan_code VARCHAR(50) NOT NULL DEFAULT 'free',
  status subscription_status NOT NULL DEFAULT 'trialing',
  trial_ends_at TIMESTAMPTZ,
  grace_period_ends_at TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Create the `processed_webhooks` table:
```sql
CREATE TABLE processed_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(255) NOT NULL UNIQUE,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```</action>
  <verify>Running `sqlx migrate run` against a PostgreSQL database creates all tables with correct columns, foreign keys, enums, indexes, and constraints. Querying `\dt` in psql lists all 20 tables.</verify>
  <done>Created comprehensive SQLx migration with all tables, enums, indexes, and constraints as a single .sql migration file.</done>
</task>

<task type="auto" id="01-04">
  <name>Create Rust model structs and query functions for SQLx</name>
  <files>backend/crates/db/src/models/mod.rs, backend/crates/db/src/models/user.rs, backend/crates/db/src/models/tenant.rs, backend/crates/db/src/models/workspace.rs, backend/crates/db/src/models/board.rs, backend/crates/db/src/models/task.rs, backend/crates/db/src/models/common.rs, backend/crates/db/src/queries/mod.rs, backend/crates/db/src/lib.rs</files>
  <action>Create `backend/crates/db/src/models/common.rs` defining shared Rust enums that map to PostgreSQL enums using `#[derive(sqlx::Type, Serialize, Deserialize, Clone, Debug, PartialEq)]` with `#[sqlx(type_name = "...", rename_all = "snake_case")]`:
- `UserRole` with variants `Admin`, `Manager`, `Member`
- `BoardMemberRole` with variants `Viewer`, `Editor`
- `TaskPriority` with variants `Urgent`, `High`, `Medium`, `Low`
- `ActivityAction` with variants `Created`, `Updated`, `Moved`, `Assigned`, `Unassigned`, `Commented`, `Attached`, `StatusChanged`, `PriorityChanged`, `Deleted`
- `SubscriptionStatus` with variants `Active`, `Trialing`, `PastDue`, `Cancelled`, `Expired`

Create `backend/crates/db/src/models/user.rs` defining:
```rust
#[derive(sqlx::FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub name: String,
    pub password_hash: String,
    pub avatar_url: Option<String>,
    pub phone_number: Option<String>,
    pub role: UserRole,
    pub tenant_id: Uuid,
    pub onboarding_completed: bool,
    pub deleted_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```
Also define `UserPublic` (without `password_hash` and `deleted_at`) for API responses.

Create `backend/crates/db/src/models/tenant.rs` with `Tenant` struct matching the tenants table.

Create `backend/crates/db/src/models/workspace.rs` with `Workspace`, `WorkspaceMember` structs.

Create `backend/crates/db/src/models/board.rs` with `Board`, `BoardMember`, `BoardColumn` structs.

Create `backend/crates/db/src/models/task.rs` with `Task`, `TaskAssignee`, `Label`, `TaskLabel` structs. NOTE: `Task` has NO `status` field.

Create `backend/crates/db/src/models/mod.rs` re-exporting all model modules.

Create `backend/crates/db/src/queries/mod.rs` as a placeholder that will contain query function modules (populated in later sections).

Update `backend/crates/db/src/lib.rs` to declare `pub mod models;` and `pub mod queries;` and re-export the `sqlx::PgPool` type alias for convenience.</action>
  <verify>`cargo build -p db` compiles. All model structs derive `FromRow` and match the database schema exactly. Enum types map correctly to PostgreSQL custom types.</verify>
  <done>Created all Rust model structs with SQLx FromRow derives and PostgreSQL enum mappings. No status field on Task.</done>
</task>

<task type="auto" id="01-05">
  <name>Configure AppState with DB pool, Redis, and broadcast channels</name>
  <files>backend/crates/api/src/state.rs, backend/crates/api/src/config.rs, backend/crates/api/src/main.rs</files>
  <action>Create `backend/crates/api/src/config.rs` parsing environment variables into a `Config` struct using manual `std::env::var()` calls with defaults:
```rust
pub struct Config {
    pub database_url: String,
    pub host: String,           // default "0.0.0.0"
    pub port: u16,              // default 8080
    pub jwt_secret: String,
    pub jwt_refresh_secret: String,
    pub jwt_access_expiry_secs: i64,  // default 900 (15 minutes)
    pub jwt_refresh_expiry_secs: i64, // default 604800 (7 days)
    pub redis_url: String,
    pub minio_endpoint: String,
    pub minio_public_url: String,
    pub minio_access_key: String,
    pub minio_secret_key: String,
    pub minio_bucket: String,   // default "task-attachments"
    pub postal_smtp_host: String,
    pub postal_smtp_port: u16,
    pub lago_api_url: String,
    pub lago_api_key: String,
    pub stripe_secret_key: String,
    pub stripe_webhook_secret: String,
    pub waha_api_url: String,
    pub waha_api_key: String,
    pub app_url: String,        // frontend URL for email links
}
```
Implement `Config::from_env() -> Result<Self>` that reads all values with `dotenvy::dotenv().ok()` first.

Create `backend/crates/api/src/state.rs` defining:
```rust
#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub config: Arc<Config>,
    pub redis: redis::aio::ConnectionManager,
    pub board_channels: Arc<DashMap<Uuid, tokio::sync::broadcast::Sender<String>>>,
    pub s3_client: aws_sdk_s3::Client,
}
```
Implement `AppState::new(config: Config) -> Result<Self>` that: connects to PostgreSQL via `PgPool::connect_with(PgConnectOptions::from_str(&config.database_url)?.application_name("taskflow-api"))`, runs pending migrations via `sqlx::migrate!("../db/src/migrations").run(&pool).await`, creates a Redis connection manager via `redis::Client::open(&config.redis_url)?.get_connection_manager().await?`, initializes the S3 client configured for MinIO endpoint, returns the populated state.

Update `backend/crates/api/src/main.rs` to use `Config::from_env()` and `AppState::new(config)`, set up tracing with `tracing_subscriber::fmt()`, build the Axum router with `state.clone()` injected via `.with_state(state)`, add CORS layer via `tower_http::cors::CorsLayer`, add compression via `tower_http::compression::CompressionLayer`, and serve.</action>
  <verify>`cargo build -p api` compiles. The `AppState` struct provides database pool, Redis connection, broadcast channels for real-time, S3 client for MinIO, and environment config.</verify>
  <done>Created AppState with SQLx PgPool, Redis connection manager, per-board broadcast channels, S3 client, and typed environment config.</done>
</task>

<task type="auto" id="01-06">
  <name>Create AppError type and error handling</name>
  <files>backend/crates/api/src/errors.rs</files>
  <action>Create `backend/crates/api/src/errors.rs` defining `AppError` as an enum using `thiserror::Error`:
```rust
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Bad request: {0}")]
    BadRequest(String),
    #[error("Unauthorized: {0}")]
    Unauthorized(String),
    #[error("Forbidden: {0}")]
    Forbidden(String),
    #[error("Conflict: {0}")]
    Conflict(String),
    #[error("Precondition failed: {0}")]
    PreconditionFailed(String),
    #[error("Validation error: {0}")]
    ValidationError(String),
    #[error("Internal server error")]
    InternalError(String),
    #[error(transparent)]
    SqlxError(#[from] sqlx::Error),
    #[error(transparent)]
    JwtError(#[from] jsonwebtoken::errors::Error),
}
```

Implement `axum::response::IntoResponse` for `AppError` that maps each variant to the appropriate HTTP status code and returns a JSON body `{ "error": { "code": "NOT_FOUND", "message": "..." } }`:
- NotFound -> 404
- BadRequest -> 400
- Unauthorized -> 401
- Forbidden -> 403
- Conflict -> 409
- PreconditionFailed -> 412
- ValidationError -> 422
- InternalError -> 500
- SqlxError -> 500 (log the actual error with `tracing::error!`, return generic message to client)
- JwtError -> 401

Export a `Result<T> = std::result::Result<T, AppError>` type alias for use in all handlers.</action>
  <verify>`cargo build -p api` compiles. Handlers can return `Result<Json<T>, AppError>` and errors are automatically converted to proper HTTP responses with JSON error bodies and correct status codes.</verify>
  <done>Created AppError enum with IntoResponse implementation for consistent JSON error responses. SqlxError logs internally but returns generic 500 to client.</done>
</task>

<task type="auto" id="01-07">
  <name>Configure ts-rs for WebSocket event types and shared enums</name>
  <files>backend/crates/db/src/models/ws_events.rs, backend/crates/db/src/models/common.rs, backend/crates/db/src/models/mod.rs</files>
  <action>Update `backend/crates/db/src/models/common.rs` to add `#[derive(ts_rs::TS)]` and `#[ts(export, export_to = "../../frontend/src/app/shared/types/")]` to all shared enums: `UserRole`, `TaskPriority`, `BoardMemberRole`, `ActivityAction`, `SubscriptionStatus`.

Create `backend/crates/db/src/models/ws_events.rs` defining WebSocket event types with `#[derive(Clone, Debug, Serialize, Deserialize, ts_rs::TS)]` and `#[ts(export, export_to = "../../frontend/src/app/shared/types/")]`:

```rust
#[derive(Clone, Debug, Serialize, Deserialize, TS)]
#[serde(tag = "type")]
pub enum WsBoardEvent {
    TaskCreated { task: TaskBroadcast, origin_user_id: Uuid },
    TaskUpdated { task: TaskBroadcast, origin_user_id: Uuid },
    TaskMoved { task_id: Uuid, column_id: Uuid, position: String, origin_user_id: Uuid },
    TaskDeleted { task_id: Uuid, origin_user_id: Uuid },
    ColumnCreated { column: ColumnBroadcast, origin_user_id: Uuid },
    ColumnUpdated { column: ColumnBroadcast, origin_user_id: Uuid },
    ColumnDeleted { column_id: Uuid, origin_user_id: Uuid },
}

#[derive(Clone, Debug, Serialize, Deserialize, TS)]
pub struct TaskBroadcast {
    pub id: Uuid,
    pub title: String,
    pub priority: TaskPriority,
    pub column_id: Uuid,
    pub position: String,
    pub assignee_ids: Vec<Uuid>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Serialize, Deserialize, TS)]
pub struct ColumnBroadcast {
    pub id: Uuid,
    pub name: String,
    pub position: String,
    pub color: Option<String>,
    pub status_mapping: Option<serde_json::Value>,
}
```

Update `backend/crates/db/src/models/mod.rs` to declare and re-export the `ws_events` module.

Add a Rust test in `backend/crates/db/src/models/ws_events.rs` that calls `WsBoardEvent::export()` to generate TypeScript files. Create a cargo alias or justfile command: `ts-gen` that runs `cargo test -p db export_types -- --ignored` to generate TypeScript types into `frontend/src/app/shared/types/`.</action>
  <verify>Running `cargo test -p db -- export_types --ignored` generates `.ts` files in `frontend/src/app/shared/types/` with correct TypeScript interfaces matching the Rust structs and enums.</verify>
  <done>Configured ts-rs for WebSocket event type generation, bridging Rust types to TypeScript for Angular consumption. Tagged enum uses discriminated union in TypeScript.</done>
</task>

<task type="auto" id="01-08">
  <name>Create seed script and verify full pipeline</name>
  <files>backend/crates/api/src/bin/seed.rs</files>
  <action>Create `backend/crates/api/src/bin/seed.rs` as a separate binary in the api crate. Add a `[[bin]]` section to `backend/crates/api/Cargo.toml`:
```toml
[[bin]]
name = "seed"
path = "src/bin/seed.rs"
```

The seed script:
1. Loads `.env` via `dotenvy` and connects to the database via `PgPool::connect()`.
2. Runs migrations via `sqlx::migrate!`.
3. Creates a tenant "Acme Corp" with slug "acme-corp" and plan "pro" using `sqlx::query!("INSERT INTO tenants ...")`.
4. Creates three users under that tenant using argon2 password hashing (import from the `auth` crate): "Alice Admin" (admin, alice@acme.com, password "password123"), "Bob Manager" (manager, bob@acme.com), "Carol Member" (member, carol@acme.com). Uses `sqlx::query!("INSERT INTO users (id, email, name, password_hash, role, tenant_id) VALUES ($1, $2, $3, $4, $5::user_role, $6)")`.
5. Creates a workspace "Engineering" under the tenant, created by Alice.
6. Adds all three users as workspace members via `INSERT INTO workspace_members`.
7. Creates a board "Sprint 1" in the Engineering workspace.
8. Auto-adds Alice as board member with role "editor" in `board_members`.
9. Creates three default columns:
   - "To Do" (position "a0", color "#6366f1", status_mapping NULL)
   - "In Progress" (position "a1", color "#3b82f6", status_mapping NULL)
   - "Done" (position "a2", color "#22c55e", status_mapping `{"done": true}`)
   Positions use fractional indexing strings.
10. Creates five sample tasks across columns with varying priorities and assigns them to different users via `task_assignees`.
11. Creates two comments on the first task.
12. Creates a trial subscription for the tenant (plan_code 'free', status 'trialing', trial_ends_at 15 days from now).

Create a workspace-level `justfile` (or `Makefile`) at `backend/justfile` with commands:
```
db-migrate: sqlx migrate run --source crates/db/src/migrations
db-seed: cargo run --bin seed
db-reset: sqlx database reset --source crates/db/src/migrations && cargo run --bin seed
dev-api: cargo run -p api
ts-gen: cargo test -p db -- export_types --ignored
```</action>
  <verify>Running `cargo run --bin seed` creates all seed data. Querying `SELECT count(*) FROM tasks` returns 5. Querying `SELECT count(*) FROM users` returns 3. The subscription is in 'trialing' status. All SQLx compile-time checked queries pass.</verify>
  <done>Created seed binary with tenant, users, workspace, board, columns with statusMapping, tasks using fractional indexing, comments, and trial subscription. Added justfile for common commands.</done>
</task>
