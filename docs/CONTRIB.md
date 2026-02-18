# Contributing to TaskFlow

> Auto-generated from source-of-truth: package.json, Cargo.toml, .env.example, scripts/
> Last updated: 2026-02-18

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
│       ├── api/            HTTP routes, middleware, WebSocket
│       ├── auth/           JWT, passwords, RBAC
│       ├── db/             Models, queries, migrations
│       └── services/       Broadcast, notifications, S3, jobs
├── frontend/               Angular 19 SPA
│   ├── src/app/
│   │   ├── core/           Services, guards, interceptors
│   │   ├── features/       Feature components
│   │   └── shared/         Shared components, pipes, utils
│   └── e2e/                Playwright E2E tests
├── scripts/                Automation scripts
├── codemaps/               Architecture documentation
├── .githooks/              Pre-commit hooks
└── .github/workflows/      CI/CD pipeline
```

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
| `cargo check` | Type-check without building (fast) |
| `cargo clippy -- -D warnings` | Lint with warnings as errors |
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
| `MINIO_PUBLIC_URL` | `http://localhost:9000` | Public endpoint (frontend uploads) |

### Application

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Bind address |
| `PORT` | `8080` | Backend API port |
| `RUST_LOG` | `info,sqlx=warn,tower_http=debug` | Log levels |
| `APP_URL` | `http://localhost:4200` | Frontend URL (CORS origin) |
| `SKIP_INIT` | `false` | Skip DB init on startup |
| `SKIP_SEED` | `false` | Skip DB seeding |

### Optional Integrations

| Variable | Service | Enable with |
|----------|---------|-------------|
| `LAGO_API_KEY`, `LAGO_SECRET_KEY` | Lago billing | `--profile billing` |
| `NOVU_API_KEY`, `NOVU_JWT_SECRET` | Novu notifications | `--profile notifications` |
| `POSTAL_API_KEY`, `POSTAL_FROM_ADDRESS` | Postal email | `--profile email` |
| `WAHA_API_KEY` | WAHA WhatsApp | `--profile whatsapp` |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe payments | — |

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
| Backend | cargo check + clippy (warnings=errors) + test |
| Backend Security | cargo audit |
| Frontend | tsc --noEmit + ng lint + ng build --production |
| Frontend Security | npm audit --audit-level=high |
| Docker Lint | hadolint on both Dockerfiles |

## Development Workflow

1. Create feature branch from `master`
2. Make changes with pre-commit hooks active
3. Run `./scripts/quick-check.sh` before committing
4. Push and create PR -> CI runs automatically
5. After merge, deploy via `./scripts/deploy-vps.sh`
