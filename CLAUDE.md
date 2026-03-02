# TaskFlow

Multi-tenant project management SaaS with kanban boards, task tracking, team collaboration, automations, and real-time updates via WebSockets.

## Core Rules

- **Direct Tools First:** Glob/Grep/Read/Edit before agents
- **KISS + YAGNI:** Simple > Complex
- **No Silent Workarounds:** Report failures, ask user
- **Visual Over Verbal:** Tables > paragraphs
- **Full-Stack Features:** Every feature MUST be implemented end-to-end (backend API + frontend UI). Never build frontend calling endpoints that don't exist, or backend endpoints with no frontend consumer. Optimize the implementation before moving on.
- **Use Subagents & Teams:** Use subagents, worker agents, and TeamCreate wherever possible. Parallelize independent work across agents (research, implementation, review). Prefer multi-agent teams over doing everything sequentially in the main context.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Rust 1.93, Axum 0.8, Tokio, SQLx 0.8 |
| Frontend | Angular 19, TypeScript 5.7, Tailwind CSS 4, PrimeNG 19 |
| Database | PostgreSQL 16, Redis 7 |
| Storage | MinIO (S3-compatible) |
| Infra | Docker Compose, Nginx reverse proxy |

## Project Structure

```
backend/
  crates/
    api/src/          # Axum routes, middleware, extractors, WebSocket
    db/src/           # SQLx models, queries, migrations
    auth/src/         # JWT auth, password hashing (Argon2)
    services/src/     # Background jobs, notifications
frontend/src/app/
  core/               # Guards, interceptors, services, initializers
  features/           # 15 modules: admin, archive, auth, board, dashboard,
                      #   favorites, help, my-tasks, onboarding, settings,
                      #   shared-board, task-detail, tasks, team, workspace
  shared/             # Reusable components, pipes, types, utils
scripts/              # quick-check.sh, pre-deploy-check.sh, deploy-vps.sh,
                      #   setup-hooks.sh, smoke-test-*.sh, init-db.sh, run_seed.sh
```

## Organization Rules

- **Backend routes** -> `backend/crates/api/src/routes/`, one file per resource
- **DB models** -> `backend/crates/db/src/models/`, one per entity
- **SQL migrations** -> `backend/crates/db/src/migrations/`
- **Frontend features** -> `frontend/src/app/features/`, one dir per feature
- **Shared components** -> `frontend/src/app/shared/components/`
- **Services** -> `frontend/src/app/core/services/`, one per API domain
- Single responsibility per file, <800 lines max

## Code Quality

After editing ANY file, run the relevant check:

```bash
# Backend
cd backend && cargo check --workspace --all-targets && cargo clippy --workspace --all-targets -- -D warnings && cargo fmt --all -- --check

# Frontend
cd frontend && npx tsc --noEmit && npm run build -- --configuration=production
```

Fix ALL errors before continuing. Use `./scripts/quick-check.sh` for combined checks.

---

## Test Credentials

| Email | Password | Role |
|-------|----------|------|
| alice@acme.com | Password123! | Admin |
| bob@acme.com | Password123! | Member |

Use `alice@acme.com / Password123!` for all testing and browser verification.

---

## VPS Deployment

**This IS the VPS.** App path: `/home/ankur/taskflow` | **Domain:** taskflow.paraslace.in

> **IMPORTANT:** `/root/taskflow` is DEPRECATED. Do NOT use it. All work happens in `/home/ankur/taskflow`.

```bash
# Deploy (from /home/ankur/taskflow):
docker compose build && docker compose up -d
```

## Pre-Deploy Safety Protocol

**MANDATORY before ANY deploy or `docker compose build`:**

1. Backend changes: `./scripts/quick-check.sh --backend`
2. Frontend changes: `./scripts/quick-check.sh --frontend`
3. Full deploy: `./scripts/pre-deploy-check.sh`

**NEVER skip checks.** Fix errors before proceeding.

## Pre-Commit Hooks (Active)

**Setup:** `git config core.hooksPath .githooks` (already configured)

| # | Check | Blocks? |
|---|-------|---------|
| 1 | Hardcoded secrets (passwords, API keys, tokens) | YES |
| 2 | `debugger` statements in TypeScript | YES |
| 3 | TypeScript type-check (`tsc --noEmit`) if frontend changed | YES |
| 4 | Rust `.unwrap()` / `todo!()` / `println!()` | Warns |
| 5 | SQL: TRUNCATE, DELETE without WHERE, DROP without IF EXISTS | YES |
| 6 | Files > 1MB | YES |
| 7 | Auth file modifications | YES |

`console.log` in TypeScript triggers a **warning** (not a block).
Bypass: `git commit --no-verify` (use sparingly).

---

*Do the work, show results.*
