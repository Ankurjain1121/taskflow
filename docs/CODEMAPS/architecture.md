<!-- Generated: 2026-03-05 | Files scanned: 200+ | Token estimate: ~600 -->

# TaskFlow Architecture

## System Diagram

```
Browser ─── Nginx (reverse proxy) ─── Angular 19 SPA (port 4200)
                │
                ├── /api/* ──── Axum Backend (port 8080) ──── PostgreSQL 16 (host:5432)
                │                       │                          │
                │                       ├── Redis (host:6379)      ├── 40 migrations
                │                       ├── MinIO (S3, port 9000)  └── 3 materialized views
                │                       └── Postal (email)
                │
                └── /api/ws ─── WebSocket (Axum upgrade)
```

## Service Boundaries

| Service | Container | Port | Role |
|---------|-----------|------|------|
| Frontend | `taskflow-frontend` | 4200 | Angular SPA + Nginx |
| Backend | `taskflow-backend` | 8080 | REST API + WebSocket |
| MinIO | `taskflow-minio` | 9000/9001 | File storage (S3) |
| PostgreSQL | Host service | 5432 | Primary data store |
| Redis | Host service | 6379 | Cache, rate limits, bulk undo snapshots |

## Data Flow

```
User Action → Angular Component → Core Service (HTTP/WS)
  → Nginx proxy → Axum middleware chain → Route handler
  → SQLx query → PostgreSQL → Response
  → WebSocket broadcast to subscribed clients
```

## Middleware Chain (outermost → innermost)

1. CORS
2. Compression (gzip/deflate)
3. Request Tracing
4. Request ID
5. Security Headers (X-Frame-Options, CSP, etc.)
6. Cache Headers
7. Global Rate Limit (60 req/min per IP)
8. User Rate Limit (100 req/min per user)
9. Auth Middleware (JWT extraction)

## Key Architectural Decisions

- Multi-tenant via `tenant_id` on all core tables
- JWT auth (access + refresh tokens, Argon2 password hashing)
- Signal-based state management (no central store, per-service signals)
- WebSocket for real-time board updates (500 max connections, 50 channels/conn)
- Background jobs: cron endpoints for deadline scans, digests, trash cleanup
