<!-- Generated: 2026-03-05 | Token estimate: ~400 -->

# Dependencies Codemap

## External Services

| Service | Purpose | Connection |
|---------|---------|------------|
| PostgreSQL 16 | Primary data store | Host: 10.0.2.1:5432, user: taskflow_app |
| Redis 7 | Cache, rate limits, bulk undo snapshots (1hr TTL) | Host: 10.0.2.1:6379 |
| MinIO | S3-compatible file storage (attachments) | Container: taskflow-minio:9000 |
| Postal | Transactional email (digests, invites, reminders) | External SMTP via env vars |
| Nginx | Reverse proxy, SSL termination, rate limiting | Host: /etc/nginx/sites-available/ |

## Backend Dependencies (Rust)

| Crate | Version | Purpose |
|-------|---------|---------|
| axum | 0.8 | HTTP framework + WebSocket |
| sqlx | 0.8 | Async PostgreSQL driver |
| tokio | 1.x | Async runtime |
| jsonwebtoken | * | JWT encode/decode |
| argon2 | * | Password hashing |
| serde/serde_json | 1.x | Serialization |
| tower-http | * | CORS, compression, tracing layers |
| minio-rs | * | S3 client for MinIO |

## Frontend Dependencies (Angular)

| Package | Purpose |
|---------|---------|
| Angular 19 | SPA framework (standalone components, signals) |
| TypeScript 5.7 | Type system |
| Tailwind CSS 4 | Utility-first styling |
| PrimeNG 19 | UI component library (Aura theme) |
| RxJS | Reactive streams (HTTP, WS) |

## Infrastructure

| Component | Config |
|-----------|--------|
| Docker Compose | 3 containers: backend, frontend, minio |
| Nginx | Reverse proxy at taskflow.paraslace.in, SSL via certbot |
| Network | Bridge: 10.0.2.0/24, gateway 10.0.2.1 |
| UFW | Ports: 80, 443, 5432 (local), 6379 (local), 9000 |
