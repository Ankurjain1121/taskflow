# Technical Plan: Task Management Tool

> Generated: 2026-02-05
> Updated: 2026-02-05 (Rust + Angular rewrite)
> PRD: 10 sections approved
> Sections: 12 | Tasks: ~92 | Parallel batches: 5

---

## Architecture Overview

```
Browser (Angular 19 + Tailwind CSS v4 + Angular CDK + Angular Material)
    |
    |-- REST API (JSON over HTTPS)
    |-- WebSocket (native Axum WS for real-time board updates)
    |-- MinIO presigned URLs (direct file upload)
    |
Rust Backend (Axum + Tower middleware)
    |
    |-- SQLx --> PostgreSQL 16 (with RLS)
    |-- JWT Auth (argon2 password hashing, jsonwebtoken)
    |-- Novu SDK (notification orchestration)
    |       |-- Postal (email)
    |       |-- Slack API (webhooks)
    |       |-- WAHA (WhatsApp)
    |-- Lago API (billing/subscriptions)
    |-- Stripe API (payment processing)
    |-- aws-sdk-s3 (MinIO presigned URL generation)
    |
Infrastructure (all Docker containers):
    PostgreSQL 16 | Redis | MongoDB | MinIO | Novu | Postal | Lago | WAHA
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Angular 19 (standalone components) | SPA with SSR via Angular Universal |
| Styling | Tailwind CSS v4 + Angular Material | Utility-first CSS, material components |
| Drag-and-Drop | Angular CDK DragDrop | Kanban board card/column movement |
| State | Angular Signals + RxJS | Reactive state management |
| API Client | Angular HttpClient | REST API communication |
| Real-time (client) | RxJS WebSocketSubject | WebSocket connection management |
| Backend Framework | Axum 0.8 + Tower | Async HTTP/WebSocket server |
| Database | PostgreSQL 16 + SQLx | Compile-time checked SQL queries |
| Auth | JWT (jsonwebtoken) + argon2 | Stateless auth with secure password hashing |
| Real-time (server) | Axum WebSocket + Redis pub/sub | Fan-out real-time updates |
| File Storage | MinIO via aws-sdk-s3 | S3-compatible self-hosted object storage |
| Notifications | Novu (self-hosted) | Multi-channel notification orchestration |
| Email | Postal (self-hosted) | Transactional email delivery |
| Slack | Slack Incoming Webhooks | Channel notifications per board |
| WhatsApp | WAHA (self-hosted) | WhatsApp message delivery |
| Billing | Lago (self-hosted) | Subscription management, invoicing |
| Payment | Stripe | Payment processing via Checkout Sessions |
| Deployment | Docker Compose | One-command full-stack deployment |

### Key Rust Crates

| Crate | Purpose |
|-------|---------|
| axum 0.8 | Web framework (routing, extractors, middleware) |
| tokio | Async runtime |
| sqlx 0.8 | Async PostgreSQL driver with compile-time checks |
| serde / serde_json | Serialization/deserialization |
| jsonwebtoken | JWT creation and validation |
| argon2 | Password hashing |
| uuid | UUID generation and parsing |
| chrono | Date/time handling |
| aws-sdk-s3 | MinIO/S3 presigned URL generation |
| tower / tower-http | Middleware (CORS, logging, rate limiting) |
| redis | Redis client for pub/sub and caching |
| reqwest | HTTP client for external APIs (Novu, Lago, Stripe) |
| validator | Input validation (email, length, regex) |
| tracing / tracing-subscriber | Structured logging |
| ts-rs | TypeScript type generation from Rust structs |

### Key Angular Libraries

| Library | Purpose |
|---------|---------|
| @angular/cdk | Drag-and-drop, overlay, accessibility |
| @angular/material | UI components (dialog, menu, snackbar, etc.) |
| tailwindcss 4.x | Utility-first CSS |
| date-fns | Date formatting and manipulation |
| fractional-indexing | String-based position indexing for Kanban cards |

---

## Section Overview

| # | Section | Risk | Batch | Tasks | Focus |
|---|---------|------|-------|-------|-------|
| 01 | Project Setup & Database Schema | green | 1 | ~8 | Rust workspace, Angular app, SQLx, PostgreSQL |
| 02 | Auth & Multi-Tenancy | yellow | 1 | ~8 | JWT auth, RBAC, PostgreSQL RLS |
| 03 | Workspace & Board Management | green | 2 | ~6 | Workspace/board CRUD, Angular sidebar |
| 04 | Task CRUD & Kanban Board | yellow | 2 | ~8 | Tasks, Angular CDK DnD, bright colors, optimistic updates |
| 05 | Comments & Activity Log | green | 3 | ~7 | Comments with @mentions, activity timeline |
| 06 | File Uploads (MinIO) | green | 3 | ~6 | Presigned URL uploads, attachments |
| 07 | Notification System (Novu) | yellow | 3 | ~10 | In-app, email, Slack, WhatsApp routing |
| 08 | Team Overview & My Tasks | green | 4 | ~6 | Manager dashboard, personal task list |
| 09 | Billing & Freemium (Lago) | yellow | 4 | ~7 | Free tier, trial, flat pricing |
| 10 | Onboarding & Theme System | green | 4 | ~8 | Setup wizard, sample board, light/dark + colors |
| 11 | Audit Log & Admin Panel | green | 5 | ~7 | Company-wide audit, user management, trash bin |
| 12 | Docker Compose & Deployment | yellow | 5 | ~10 | Full stack Docker, health checks, deployment guide |

---

## Execution Strategy

### Parallel Batch Groups

**Batch 1** (start immediately, no dependencies):
- Section 01: Project Setup
- Section 02: Auth & Multi-Tenancy

**Batch 2** (after Batch 1 completes):
- Section 03: Workspace & Board Management
- Section 04: Task CRUD & Kanban Board

**Batch 3** (after Batch 2 completes):
- Section 05: Comments & Activity Log
- Section 06: File Uploads
- Section 07: Notification System

**Batch 4** (after Batches 2-3 complete):
- Section 08: Team Overview & My Tasks
- Section 09: Billing & Freemium
- Section 10: Onboarding & Theme System

**Batch 5** (after all previous):
- Section 11: Audit Log & Admin Panel
- Section 12: Docker Compose & Deployment

### Dependency Graph

```
Batch 1:  [01 Setup] ----+---- [02 Auth]
               |         |         |
Batch 2:  [03 Workspace]  [04 Kanban Board]
               |         |    |    |
Batch 3:  [05 Comments] [06 Files] [07 Notifs]
               |              |         |
Batch 4:  [08 Team Overview] [09 Billing] [10 Onboarding]
               |              |              |
Batch 5:  [11 Audit & Admin] [12 Docker Deployment]
```

---

## Project Structure

```
taskflow/
├── backend/                    # Rust workspace
│   ├── Cargo.toml              # Workspace manifest
│   ├── crates/
│   │   ├── api/                # Axum HTTP/WS server
│   │   │   ├── src/
│   │   │   │   ├── main.rs
│   │   │   │   ├── routes/     # Route handlers per domain
│   │   │   │   ├── middleware/  # Auth, tenant, plan limits
│   │   │   │   ├── extractors/ # Custom Axum extractors
│   │   │   │   └── ws/         # WebSocket handlers
│   │   │   └── Cargo.toml
│   │   ├── db/                 # SQLx queries and migrations
│   │   │   ├── src/
│   │   │   │   ├── lib.rs
│   │   │   │   ├── models/     # Rust structs mapping to tables
│   │   │   │   ├── queries/    # SQL query functions
│   │   │   │   └── migrations/ # SQLx migrations (.sql files)
│   │   │   └── Cargo.toml
│   │   ├── auth/               # JWT, password hashing, RBAC
│   │   │   └── Cargo.toml
│   │   └── services/           # Business logic (billing, notifications, etc.)
│   │       └── Cargo.toml
│   └── .env
├── frontend/                   # Angular workspace
│   ├── angular.json
│   ├── package.json
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/           # Guards, interceptors, services
│   │   │   ├── features/       # Feature modules (board, workspace, etc.)
│   │   │   ├── shared/         # Shared components, pipes, directives
│   │   │   └── app.routes.ts   # Top-level routing
│   │   ├── environments/
│   │   └── styles.css          # Tailwind + CSS custom properties
│   └── tailwind.config.ts
├── docker-compose.yml
├── .env.example
└── scripts/
```

---

## Risk Summary

| Risk Level | Count | Sections |
|------------|-------|----------|
| Green | 7 | 01, 03, 05, 06, 08, 10, 11 |
| Yellow | 5 | 02, 04, 07, 09, 12 |
| Red | 0 | -- |

### Yellow Risk Sections (need extra attention)

| Section | Risk Factor | Mitigation |
|---------|------------|------------|
| 02: Auth | Security-critical RLS policies + JWT | Automated tenant isolation tests, token rotation |
| 04: Kanban | DnD + real-time + optimistic updates | Angular CDK proven patterns, thorough WebSocket testing |
| 07: Notifications | 4 external services with different failure modes | Novu handles retry; each channel is optional |
| 09: Billing | Wrong limits/charges damage trust | Comprehensive billing state machine tests |
| 12: Deployment | 9+ services must work together | Health checks, restart policies, clear docs |

---

## How to Execute This Plan

1. Open any AI coding tool (Claude Code, Cursor, etc.)
2. Share the `.ultraplan/` folder
3. Say: "Read `.ultraplan/sections/index.md` and execute section 1"
4. After section completes, say: "Execute section [next number]"
5. Sections in the same batch can be run in parallel
6. Yellow-risk sections may need human review after completion
