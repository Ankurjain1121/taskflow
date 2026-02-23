# Contributing to TaskFlow

> Auto-generated from source-of-truth: package.json, Cargo.toml, .env.example, scripts/, codemaps/
> Last updated: 2026-02-23

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Docker | 20+ | All builds and services run in containers |
| Docker Compose | 2.x | Service orchestration |
| Node.js | 22 | Frontend development (optional, for IDE support) |
| Rust | 1.93 | Backend development (optional, Docker builds available) |
| Git | 2.x | Version control |

## Quick Start

```bash
# 1. Clone and enter project
git clone <repo-url> && cd taskflow

# 2. Copy environment config
cp .env.example .env

# 3. Setup pre-commit hooks
./scripts/setup-hooks.sh

# 4. Start all services
docker compose up -d

# 5. Access the app
open http://localhost:4200
```

## Project Structure

```
taskflow/
├── backend/                Rust API server (Axum 0.8)
│   └── crates/
│       ├── api/            HTTP routes (58 files, 150+ endpoints), middleware (5), WebSocket
│       ├── auth/           JWT (RS256/HS256), Argon2 passwords, RBAC
│       ├── db/             SQLx models (38+ query modules), 21 migrations, 45+ tables
│       └── services/       Broadcast, notifications, S3, audit, trash, jobs (4)
├── frontend/               Angular 19 SPA
│   ├── src/app/
│   │   ├── core/           51+ services, guards, interceptors, initializers
│   │   ├── features/       15 feature modules (auth, board, dashboard, my-tasks, team, workspace, settings, admin, etc.)
│   │   └── shared/         Layout, sidebar, search, dialogs, pipes, utils
│   └── e2e/                Playwright E2E tests (16 standard + 9 comprehensive specs)
├── codemaps/               Architecture documentation (architecture, backend, frontend, data)
├── scripts/                Automation scripts
├── .githooks/              Pre-commit hooks
└── .github/workflows/      CI/CD pipeline
```

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Angular (standalone, OnPush) | 19.2 |
| UI Library | PrimeNG (Aura theme) + Tailwind CSS | 19 / 4 |
| State | Signals + RxJS (no NgRx) | - |
| Backend | Rust + Axum | 1.93 / 0.8 |
| Database | PostgreSQL (multi-tenant via RLS) | 16 |
| Cache/PubSub | Redis | 7 |
| Object Storage | MinIO (S3-compatible) | latest |
| Reverse Proxy | nginx | - |
| Auth | JWT (RS256/HS256) + HttpOnly cookies | - |
| Testing | Vitest (unit), Playwright (E2E), cargo test | - |
| Charts | Chart.js | 4 |
| Type Generation | ts-rs (Rust -> TypeScript) | - |

## Frontend Scripts (package.json)

| Script | Command | Description |
|--------|---------|-------------|
| `npm start` | `ng serve --proxy-config proxy.conf.json` | Dev server with API proxy at localhost:4200 |
| `npm run build` | `ng build` | Production build to dist/frontend |
| `npm run watch` | `ng build --watch --configuration development` | Rebuild on file changes |
| `npm test` | `ng test` | Run unit tests (Vitest) |
| `npm run test:e2e` | `npx playwright test --project=chromium` | Run E2E tests headless |
| `npm run test:e2e:headed` | `npx playwright test --project=chromium --headed` | Run E2E tests with browser |
| `npm run test:e2e:report` | `npx playwright show-report playwright-report` | View E2E test report |

## Backend Commands

| Command | Description |
|---------|-------------|
| `cargo check --workspace --all-targets` | Type-check all crates (fast) |
| `cargo clippy --workspace --all-targets -- -D warnings` | Lint with warnings as errors |
| `cargo test` | Run all unit/integration tests |
| `cargo build --release` | Production build |
| `cargo run --bin taskflow-api` | Run API server locally |

Note: Backend builds require `SQLX_OFFLINE=true` when no database is available.

## Automation Scripts

| Script | Usage | Description |
|--------|-------|-------------|
| `quick-check.sh` | `./scripts/quick-check.sh` | Fast dev check: cargo check + clippy + ng build |
| | `./scripts/quick-check.sh --backend` | Backend only |
| | `./scripts/quick-check.sh --frontend` | Frontend only |
| `pre-deploy-check.sh` | `./scripts/pre-deploy-check.sh` | Full pre-deploy: compile + lint + build + SQL + Docker |
| `deploy-vps.sh` | `./scripts/deploy-vps.sh` | Full VPS deployment with smoke tests |
| | `./scripts/deploy-vps.sh --skip-checks` | Deploy without pre-checks (hotfixes) |
| `setup-hooks.sh` | `./scripts/setup-hooks.sh` | Configure git pre-commit hooks |
| `smoke-test-auth.sh` | `./scripts/smoke-test-auth.sh [url]` | Test auth endpoints (health, signup, login, refresh) |
| `smoke-test-comprehensive.sh` | `./scripts/smoke-test-comprehensive.sh [url]` | Extended endpoint testing |
| `configure-minio-cors.sh` | `./scripts/configure-minio-cors.sh` | Set MinIO CORS rules |
| `docker-entrypoint.sh` | (internal) | Container entrypoint: init-db + start server |
| `init-db.sh` | (internal) | Wait for PG, create Lago DB, create MinIO bucket, seed |

## Environment Variables

### Required (must change from defaults in production)

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | (placeholder) | JWT signing secret (min 32 chars) |
| `JWT_REFRESH_SECRET` | (placeholder) | Refresh token secret (min 32 chars) |
| `POSTGRES_PASSWORD` | `postgres` | PostgreSQL password |
| `CRON_SECRET` | (placeholder) | Secret for cron endpoint auth |

### Database

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_USER` | `postgres` | PostgreSQL user |
| `POSTGRES_DB` | `taskflow` | Primary database |
| `POSTGRES_PORT` | `5432` | PostgreSQL port |
| `DATABASE_URL` | (constructed) | Full connection string |
| `LAGO_DB` | `lago` | Billing database |

### Redis

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_URL` | `redis://localhost:6379/0` | App Redis (db0=app, db1=Lago, db2=Novu) |

### MongoDB (for Novu)

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGO_ROOT_USER` | `admin` | MongoDB admin user |
| `MONGO_ROOT_PASSWORD` | `admin` | MongoDB admin password |
| `MONGO_DB` | `novu` | Notification database |

### Auth

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_ACCESS_EXPIRY_SECS` | `900` | Access token TTL (15 min) |
| `JWT_REFRESH_EXPIRY_SECS` | `604800` | Refresh token TTL (7 days) |
| `JWT_RSA_PRIVATE_KEY` | (empty) | Optional RS256 private key |
| `JWT_RSA_PUBLIC_KEY` | (empty) | Optional RS256 public key |

### MinIO (Object Storage)

| Variable | Default | Description |
|----------|---------|-------------|
| `MINIO_ACCESS_KEY` | `minioadmin` | MinIO access key |
| `MINIO_SECRET_KEY` | `minioadmin` | MinIO secret key |
| `MINIO_BUCKET` | `task-attachments` | Storage bucket name |
| `MINIO_ENDPOINT` | `http://localhost:9000` | Internal endpoint (backend) |
| `MINIO_PUBLIC_URL` | `https://files.paraslace.in` | Public endpoint (frontend uploads) |

### Application

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Bind address |
| `PORT` | `8080` | Backend API port |
| `RUST_LOG` | `info,sqlx=warn,tower_http=debug` | Log levels |
| `APP_URL` | `https://taskflow.paraslace.in` | Frontend URL (CORS origin) |
| `SKIP_INIT` | `false` | Skip DB init on startup |
| `SKIP_SEED` | `false` | Skip DB seeding |

### Optional Integrations

| Variable | Service | Enable with |
|----------|---------|-------------|
| `LAGO_API_KEY`, `LAGO_SECRET_KEY` | Lago billing | `--profile billing` |
| `NOVU_API_KEY`, `NOVU_JWT_SECRET` | Novu notifications | `--profile notifications` |
| `POSTAL_API_KEY`, `POSTAL_FROM_ADDRESS` | Postal email | `--profile email` |
| `WAHA_API_KEY`, `WAHA_DASHBOARD_USER/PASSWORD` | WAHA WhatsApp | `--profile whatsapp` |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe payments | — |

## Backend Architecture

### Crate Workspace (4 crates)

```
backend/crates/
├── api/       Binary: HTTP server, 58 route files, 5 middleware, WebSocket
├── auth/      JWT tokens (RS256/HS256), Argon2, RBAC role hierarchy
├── db/        38+ query modules, 21 migrations, 45+ tables
└── services/  Broadcast (Redis pub/sub), notifications, S3, audit, 4 background jobs
```

Dependencies: `api -> {auth, db, services}`, `services -> {auth, db}`, `auth -> db`

### Middleware Stack

| Middleware | Purpose |
|-----------|---------|
| auth | JWT from cookie/Bearer -> AuthUser{user_id, tenant_id, role} |
| rate_limit | IP sliding-window via DashMap |
| audit | POST/PUT/PATCH/DELETE audit logging (fire-and-forget) |
| tenant | SET app.tenant_id per-tx for RLS |
| request_id | Unique request ID for tracing |

### Key Features

- **150+ API endpoints** across 58 route files
- **Multi-tenancy** via PostgreSQL Row-Level Security (RLS)
- **Real-time** via WebSocket + Redis pub/sub (board/user/workspace channels)
- **Role hierarchy**: Global (Admin > Manager > Member) > Workspace (Owner > Admin > Member > Viewer) > Board (Editor > Viewer)
- **Fractional indexing** for stable kanban ordering
- **Full-text search** via PostgreSQL tsvector + GIN index

## Frontend Architecture

### Feature Modules (15)

| Module | Description |
|--------|-------------|
| auth | Sign-in/up, password reset, accept-invite (5 components) |
| onboarding | 4-step wizard (welcome, workspace, invite, sample-board) |
| dashboard | Stats + 8 widgets (status, priority, trend, overdue, deadlines, my-tasks, workload) |
| board | Core kanban (LARGEST): kanban, list, calendar, gantt, reports, time-report, bulk-actions, automations, webhooks, import/export, templates, settings, custom-fields, positions, shares |
| project | Project-mode views (table, card, detail, settings) |
| my-tasks | Personal task timeline + Eisenhower matrix |
| team | Team hub (org members, workload, boards, member detail) |
| workspace | Workspace settings, members, teams, discover/join |
| settings | Profile, security, appearance, notifications sections |
| admin | Audit log, user management, trash (adminGuard) |
| favorites | Bookmarked items |
| archive | Archived items |
| shared-board | Public board view |
| task-detail | Standalone task page (/task/:id) |
| help | Help page |

### Core Services (51+)

Auth/session (5), workspace/team (6), board/task (13), dashboard/reporting (4), notifications/real-time (3), search/navigation (3), integrations/data (6), theme/appearance (2), admin/system (6), plus shared pipes and utils.

### State Management

- **Signals** for sync state (current user, unread count, theme, workspace)
- **RxJS** for async flows (HTTP calls, WebSocket, token refresh)
- **Pattern**: `signal.asReadonly()` exposed; `.set()/.update()` via HTTP `tap()`
- **Change detection**: OnPush + signals throughout

## Pre-Commit Hooks

Active via `git config core.hooksPath .githooks`:

| # | Check | Action |
|---|-------|--------|
| 1 | Hardcoded secrets | BLOCKS commit |
| 2 | `debugger` in TypeScript | BLOCKS commit |
| 2 | `console.log` in TypeScript | Warning only |
| 3 | TypeScript compilation (`tsc --noEmit`) | BLOCKS commit |
| 4 | Rust `.unwrap()`, `todo!()`, `println!()` | Warning only |
| 5 | SQL: TRUNCATE, bare DELETE, DROP without IF EXISTS | BLOCKS / warns |
| 6 | Files > 1MB | BLOCKS commit |
| 7 | Auth file modifications | Warning + reminder |

Emergency bypass: `git commit --no-verify`

## Testing

### Backend (Rust)
```bash
cargo test                          # All tests
cargo test -- test_name             # Specific test
cargo test --package taskflow-db    # Specific crate
```

### Frontend (Angular)
```bash
npm test                            # Unit tests (Vitest)
npm run test:e2e                    # E2E tests (Playwright, headless)
npm run test:e2e:headed             # E2E tests (visible browser)
```

### Smoke Tests (against running instance)
```bash
./scripts/smoke-test-auth.sh http://localhost:8080
./scripts/smoke-test-comprehensive.sh http://localhost:8080
```

## CI/CD Pipeline

GitHub Actions runs on push/PR to `master`:

| Job | Checks |
|-----|--------|
| Backend | cargo check + clippy (warnings=errors) + test (Rust 1.93) |
| Backend Security | cargo audit |
| Frontend | tsc --noEmit + ng lint + ng build --production (Node 22) |
| Frontend Security | npm audit --audit-level=high |
| Docker Lint | hadolint on both Dockerfiles |

## Development Workflow

1. Create feature branch from `master`
2. Make changes with pre-commit hooks active
3. Run `./scripts/quick-check.sh` before committing
4. Push and create PR -> CI runs automatically
5. After merge, deploy via `./scripts/deploy-vps.sh`

## Database Schema at a Glance

- **45+ tables** across 21 migrations
- **12 enums** (user_role, task_priority, automation_trigger, etc.)
- **Key indexes**: GIN on search_vector, partial indexes on eisenhower, due_date, running time entries, recurring next_run
- **4 triggers**: updated_at auto-set (17+ tables), search_vector maintenance, default task group creation, teams updated_at
- See `codemaps/data.md` for full schema details
