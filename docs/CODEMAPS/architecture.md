<!-- Generated: 2026-03-16 | Files scanned: ~350 | Token estimate: ~900 -->
# Architecture

## System Overview

```
Browser ──HTTPS──> Nginx (reverse proxy, certbot SSL)
                     ├──> Frontend (Angular 19 SPA, port 80)
                     └──> Backend  (Rust/Axum, port 8080)
                            ├──> PostgreSQL 16 (host, port 5432)
                            ├──> Redis 7 (host, port 6379)
                            └──> MinIO (S3, port 9000)
```

Multi-tenant SaaS: `tenant_id` scopes all data. Single DB, row-level isolation.

## Backend (Rust)

```
backend/crates/
  api/      Axum routes (~150 endpoints), middleware, extractors, WebSocket handler
  db/       SQLx models (~30), queries (~35 modules), 47 migrations, offline cache
  auth/     JWT (RS256+HS256), Argon2 passwords, RBAC permissions
  services/ Background jobs, notifications (email/Slack/WhatsApp), MinIO, audit, presence
```

Entry: `api/src/main.rs` → loads config → PgPool + Redis + S3 + JwtKeys → runs migrations → mounts ~60 route groups → spawns recurring task scheduler (10min tick) + channel GC (60s).

## Frontend (Angular 19)

```
frontend/src/app/
  core/       Guards (auth, admin), interceptors (JWT, error), ~55 services, initializers
  features/   16 modules: admin, archive, auth, board, dashboard, favorites, help,
              my-tasks, onboarding, portfolio, settings, shared-board, task-detail,
              tasks, team, workspace
  shared/     ~25 reusable components, pipes, utils, types
```

State: Angular Signals (primary) + RxJS BehaviorSubject (async streams). No NgRx.

## Real-Time (WebSocket)

```
Client ──WS──> /api/ws (JWT auth via cookie/query/message)
  ──subscribe──> project channels
Backend publishes events ──> Redis pubsub ──> PubSubRelay ──> broadcast::channel (per-project, cap 256)
```

Supports: board events, presence tracking, task locking, batch messages.

## Infrastructure

| Component | Runtime | Notes |
|-----------|---------|-------|
| PostgreSQL 16 | Host (10.0.2.1:5432) | Not containerized |
| Redis 7 | Host (10.0.2.1:6379) | Cache + pubsub, not containerized |
| MinIO | Docker (minio/minio) | S3-compatible, port 9000/9001 |
| Backend | Docker (custom) | Rust binary, port 8080 |
| Frontend | Docker (custom) | Nginx-served SPA, port 80 |
| Network | taskflow-network | Bridge, 10.0.2.0/24 |

Deploy: `docker compose build && docker compose up -d` from `/home/ankur/taskflow`
Domain: taskflow.paraslace.in (Nginx + certbot SSL)
