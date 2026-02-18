# TaskFlow Architecture Codemap

> Generated: 2026-02-18 | Commit: dfb29e9

## System Overview

```
                        INTERNET
                            |
                     [Caddy :80/:443]
                    taskflow.paraslace.in
                     /           \
                    /             \
          [frontend:80]      [backend:8080]
          nginx + Angular    Rust / Axum
          SPA + API proxy         |
                              /---+---\
                             /    |    \
                     [postgres] [redis] [minio]
                       :5432    :6379   :9000
                                  |
                            [mongodb:27017]

  Optional profiles:
    billing:       lago-api:3000, lago-front:8085
    notifications: novu:3001
    email:         postal:8086/:25
    whatsapp:      waha:3002
```

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Angular (standalone) | 19.2 |
| UI Library | PrimeNG + Tailwind CSS | 19 / 4 |
| Backend | Rust + Axum | 1.93 / 0.8 |
| Database | PostgreSQL | 16 |
| Cache/PubSub | Redis | 7 |
| Object Storage | MinIO (S3-compat) | latest |
| Reverse Proxy | Caddy (prod), nginx (frontend) | 2 |
| Auth | JWT (RS256/HS256) + HttpOnly cookies | - |
| Testing | Vitest (unit), Playwright (E2E), cargo test | - |

## Crate Workspace (Backend)

```
backend/
├── crates/
│   ├── api/          Binary: HTTP server, routes, middleware, WebSocket
│   ├── auth/         JWT tokens, Argon2 passwords, RBAC
│   ├── db/           SQLx models, queries, migrations
│   └── services/     Broadcast, notifications, S3, audit, jobs
```

Dependencies: `api -> {auth, db, services}`, `services -> {auth, db}`, `auth -> db`

## Frontend Module Map

```
frontend/src/app/
├── core/             Guards, interceptors, initializers, 39 services
├── features/
│   ├── auth/         Sign-in, sign-up, forgot/reset password, accept-invite
│   ├── onboarding/   4-step wizard
│   ├── dashboard/    Stats + 8 widgets
│   ├── board/        Kanban, list, calendar, gantt, reports views
│   ├── project/      Project-mode views (table, task-card, detail)
│   ├── my-tasks/     Personal task timeline + Eisenhower matrix
│   ├── team/         Team workload + overload detection
│   ├── workspace/    Workspace settings + members
│   ├── settings/     Profile + notification preferences
│   ├── admin/        Audit log, users, trash (adminGuard)
│   ├── favorites/    Bookmarked items
│   ├── archive/      Archived items
│   └── help/         Help page
└── shared/           Layout, sidebar, search, dialogs, pipes, utils
```

## Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| State management | Signals + RxJS | No NgRx; signals for sync state, RxJS for async |
| Auth storage | HttpOnly cookies | XSS-safe; withCredentials on all API calls |
| Real-time | WebSocket + Redis pub/sub | Per-board/user/workspace channels; 30s polling fallback |
| Multi-tenancy | PostgreSQL RLS | SET app.tenant_id per transaction via middleware |
| File uploads | Presigned URLs | Client uploads directly to MinIO; backend confirms |
| Position ordering | Fractional indexing | Stable kanban ordering without full re-index |
| API design | RESTful nested resources | /api/boards/{id}/tasks, /api/tasks/{id}/comments |

## Docker Services (15)

| Service | Always | Profile |
|---------|--------|---------|
| postgres, redis, mongodb, minio, minio-setup | Yes | - |
| migrate (one-shot), backend, frontend | Yes | - |
| lago-api, lago-front | No | billing |
| novu | No | notifications |
| postal-init, postal | No | email |
| waha | No | whatsapp |
| caddy | VPS only | - |

## CI/CD Pipeline

GitHub Actions on push/PR to master:
1. backend: cargo check + clippy + test (Rust 1.93)
2. backend-security: cargo audit
3. frontend: tsc + ng lint + ng build (Node 22)
4. frontend-security: npm audit
5. docker-lint: hadolint on Dockerfiles
