<!-- Generated: 2026-03-16 | Token estimate: ~500 -->
# Dependencies

## External Services

| Service | Type | Status |
|---------|------|--------|
| PostgreSQL 16 | Primary database (host 10.0.2.1:5432) | Active |
| Redis 7 | Cache + WebSocket pubsub (host 10.0.2.1:6379) | Active |
| MinIO | S3-compatible file storage (Docker, port 9000) | Active |
| Postal | Self-hosted SMTP email | Active |
| Novu | Notification platform | Configured, inactive |
| LAGO | Usage-based billing | Schema only, inactive |
| WAHA | WhatsApp HTTP API | Implemented, inactive |
| Slack | Webhook notifications (per-project URL) | Partial |
| Stripe | Payment processing | Schema only, no client |

## Backend Key Crates

| Crate | Version | Purpose |
|-------|---------|---------|
| axum | 0.8 | Web framework + WebSocket |
| tokio | 1 | Async runtime |
| sqlx | 0.8 | PostgreSQL driver (offline mode) |
| redis | 0.27 | Redis client (async) |
| aws-sdk-s3 | 1 | MinIO/S3 client |
| jsonwebtoken | 10 | JWT (RS256 + HS256) |
| argon2 | 0.5 | Password hashing |
| tower / tower-http | 0.5/0.6 | Middleware (CORS, compression, tracing) |
| serde / serde_json | 1 | Serialization |
| chrono | 0.4 | Date/time |
| reqwest | 0.12 | HTTP client (email, webhooks) |
| ts-rs | 10 | TypeScript type generation |
| dashmap | 6 | Concurrent hashmap |
| tracing | 0.1 | Structured logging |

## Frontend Key Packages

| Package | Version | Purpose |
|---------|---------|---------|
| @angular/* | ^19.2 | Full framework |
| primeng | ^19.1.4 | UI components |
| @tiptap/* | ^3.20 | Rich text editor |
| chart.js | ^4.5.1 | Charts/dashboards |
| tailwindcss | ^4.1.18 | Utility CSS |
| rxjs | ~7.8.0 | Reactive streams |
| fractional-indexing | ^3.2.0 | Drag-and-drop ordering |
| vitest | ^3.2.4 | Unit testing |
| @playwright/test | ^1.58.2 | E2E testing |

## Docker Services

```
minio (minio/minio:latest) ──port 9000/9001
minio-setup (minio/mc:latest) ──one-shot bucket provisioner
backend (taskflow-backend) ──port 8080
frontend (taskflow-frontend) ──port 80 (Nginx)
Network: taskflow-network (10.0.2.0/24)
```

PostgreSQL and Redis run on the host, not in Docker.
