# Section 12: Docker Compose & Deployment

## Overview
Create complete Docker Compose configuration for the full stack: Rust backend, Angular frontend (nginx), PostgreSQL, Redis, MongoDB (for Novu), MinIO, Lago, Novu, Postal, WAHA. Includes health checks, migration service, and deployment docs. No Soketi needed (WebSocket is native Axum + Redis pub/sub).

## Risk: [yellow] - 10+ services must work together
## Dependencies
- Depends on: all previous sections
- Blocks: none (final section)
- Parallel batch: 5

## TDD Test Stubs
- Test: docker compose up starts all services without errors
- Test: Health check returns 200 for all services
- Test: Data persists across restarts
- Test: Redis isolation correct (app=db0, Lago=db1, Novu=db2)
- Test: Migration service runs sqlx migrate and exits before app starts
- Test: Health endpoint checks ALL critical services

## Tasks

<task type="auto" id="12-01">
  <name>Create multi-stage Dockerfile for Rust backend</name>
  <files>backend/Dockerfile, backend/.dockerignore</files>
  <action>Create .dockerignore: target/, .git, *.md, .env*. Create Dockerfile with cargo-chef pattern for layer caching:

Stage 1 "chef": FROM rust:1.83-slim AS chef. RUN cargo install cargo-chef. WORKDIR /app.

Stage 2 "planner": FROM chef AS planner. COPY . . RUN cargo chef prepare --recipe-path recipe.json.

Stage 3 "builder": FROM chef AS builder. COPY --from=planner /app/recipe.json . RUN cargo chef cook --release --recipe-path recipe.json (caches dependencies). COPY . . RUN cargo build --release --bin api.

Stage 4 "runner": FROM debian:bookworm-slim AS runner. RUN apt-get update && apt-get install -y ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*. RUN adduser --system --group app. COPY --from=builder /app/target/release/api /usr/local/bin/api. USER app. EXPOSE 8080. CMD ["api"].</action>
  <verify>docker build produces image < 100MB. Container starts and serves /api/health.</verify>
  <done>Created multi-stage Rust Dockerfile with cargo-chef for dependency caching.</done>
</task>

<task type="auto" id="12-02">
  <name>Create multi-stage Dockerfile for Angular frontend</name>
  <files>frontend/Dockerfile, frontend/.dockerignore, frontend/nginx.conf</files>
  <action>Create .dockerignore: node_modules, dist, .git, *.md. Create Dockerfile:

Stage 1 "builder": FROM node:22-alpine AS builder. WORKDIR /app. COPY package*.json . RUN npm ci. COPY . . RUN npm run build -- --configuration=production.

Stage 2 "runner": FROM nginx:alpine AS runner. COPY --from=builder /app/dist/frontend/browser /usr/share/nginx/html. COPY nginx.conf /etc/nginx/conf.d/default.conf. EXPOSE 80.

Create nginx.conf: server block listening on 80. location / serves static files with try_files $uri $uri/ /index.html (SPA fallback). location /api/ proxies to http://backend:8080/api/ (reverse proxy to Rust backend). Gzip enabled for js, css, json, svg.</action>
  <verify>docker build produces image. Nginx serves Angular app and proxies /api to backend.</verify>
  <done>Created Angular Dockerfile with nginx for serving and API proxying.</done>
</task>

<task type="auto" id="12-03">
  <name>Create Docker Compose with core infrastructure</name>
  <files>docker-compose.yml</files>
  <action>Create docker-compose.yml (Compose V2, no version field). Network: taskflow-network (bridge).

Services:
1. postgres: image postgres:16-alpine. Env: POSTGRES_USER/PASSWORD/DB from env with defaults (taskflow). Volume postgres-data. Healthcheck: pg_isready. Restart unless-stopped. Port 5432.

2. redis: image redis:7-alpine. Command: redis-server --appendonly yes --requirepass $REDIS_PASSWORD. Volume redis-data. Healthcheck: redis-cli ping. Port 6379. Note: db0=app, db1=Lago, db2=Novu.

3. mongodb: image mongo:7. Env: MONGO_INITDB_ROOT_USERNAME/PASSWORD. Volume mongodb-data. Healthcheck: mongosh eval ping. Port 27017. Required by Novu.

4. minio: image minio/minio:latest. Command: server /data --console-address ":9001". Volume minio-data. Healthcheck: curl minio health. Ports 9000, 9001.

Named volumes: postgres-data, redis-data, mongodb-data, minio-data. All join taskflow-network.</action>
  <verify>docker compose up postgres redis mongodb minio starts with passing health checks.</verify>
  <done>Created Docker Compose with PostgreSQL, Redis, MongoDB, MinIO with health checks and volumes.</done>
</task>

<task type="auto" id="12-04">
  <name>Add Lago, Novu, Postal, and WAHA services</name>
  <files>docker-compose.yml</files>
  <action>Append services:

5. lago-api: image getlago/api:v1.20.1. Depends on postgres+redis healthy. Env: DATABASE_URL (lago db), REDIS_URL with /1 (db1), SECRET_KEY_BASE, encryption keys. Volume lago-storage. Healthcheck: curl /health. Port 3001:3000.

6. lago-front: image getlago/front:v1.20.1. Depends lago-api. Env API_URL. Port 8080:80.

7. novu: image ghcr.io/novuhq/novu/api:latest. Depends redis+mongodb healthy. Env: REDIS_DB_INDEX=2 (db2), MONGO_URL. Healthcheck: curl /v1/health-check. Port 3002:3000.

8. postal: image ghcr.io/postalserver/postal:3. Depends postgres. Volume postal-config. Ports 25, 8082.

9. waha: image devlikeapro/waha:latest. Env WHATSAPP_API_KEY. Healthcheck: curl /api/health. Port 3003:3000.

Add volumes: lago-storage, postal-config.</action>
  <verify>docker compose config validates. All services defined.</verify>
  <done>Added Lago, Novu, Postal, WAHA with health checks and Redis db isolation.</done>
</task>

<task type="auto" id="12-05">
  <name>Add backend, frontend, and migration services</name>
  <files>docker-compose.yml</files>
  <action>Add services:

10. migrate: build backend/. Command: sqlx migrate run. Depends postgres healthy. Env DATABASE_URL. Restart no. One-shot container.

11. backend: build backend/. Depends: migrate (completed_successfully), postgres+redis+mongodb+minio+lago-api+novu healthy, postal+waha started. Env: DATABASE_URL (db0), REDIS_URL (/0), MINIO_ENDPOINT=http://minio:9000, MINIO_PUBLIC_URL from env, LAGO_API_URL=http://lago-api:3000, NOVU_API_URL=http://novu:3000, JWT_SECRET, STRIPE keys. Healthcheck: curl /api/health. Port 8080. Restart unless-stopped.

12. frontend: build frontend/. Depends backend healthy. Port 80:80 (or 4200:80 for dev). Restart unless-stopped.

Create docker-compose.override.yml for dev: backend uses cargo-watch with bind mount. Frontend uses ng serve with bind mount.</action>
  <verify>docker compose up builds and starts all. Migrate runs first. App accessible.</verify>
  <done>Added backend, frontend, migration services with full dependency chain.</done>
</task>

<task type="auto" id="12-06">
  <name>Create environment template</name>
  <files>.env.example</files>
  <action>Create .env.example with sections:

Database: DATABASE_URL, POSTGRES_USER/PASSWORD/DB.
Redis (db0=app, db1=Lago, db2=Novu): REDIS_PASSWORD, REDIS_URL.
MongoDB (Novu): MONGODB_USER/PASSWORD/URL.
Auth: JWT_SECRET, JWT_REFRESH_SECRET.
MinIO: MINIO_ENDPOINT, MINIO_PUBLIC_URL, MINIO_ROOT_USER/PASSWORD, MINIO_BUCKET.
Lago: LAGO_API_URL/KEY/WEBHOOK_SECRET, encryption keys.
Stripe: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.
Novu: NOVU_API_URL/KEY.
Postal: POSTAL_SMTP_HOST/PORT/EMAIL.
WAHA: WHATSAPP_API_KEY.
Cron: CRON_SECRET.
App: APP_URL (for frontend).</action>
  <verify>Copy to .env provides all required variables.</verify>
  <done>Created comprehensive environment template.</done>
</task>

<task type="auto" id="12-07">
  <name>Create health check endpoint in Rust</name>
  <files>backend/crates/api/src/routes/health.rs</files>
  <action>Create GET /api/health (no auth required). Checks: (1) PostgreSQL: sqlx::query("SELECT 1"). (2) Redis: PING command. (3) MinIO: list_buckets. (4) Novu: HTTP GET /v1/health-check. (5) Lago: HTTP GET /health. Each check wrapped in tokio::time::timeout(5 seconds). Returns JSON: { status: "healthy"|"degraded", services: { postgres, redis, minio, novu, lago: "up"|"down" }, timestamp }. Status 200 if all up, 503 if any down. One failure doesn't prevent checking others.</action>
  <verify>All services up: 200 healthy. Stop postgres: 503 degraded with postgres "down".</verify>
  <done>Created health endpoint checking all 5 critical services independently.</done>
</task>

<task type="auto" id="12-08">
  <name>Create database init and seed script</name>
  <files>scripts/init-db.sh, scripts/docker-entrypoint.sh</files>
  <action>Create init-db.sh: (1) Wait for PostgreSQL (pg_isready loop, max 30 retries). (2) Create Lago database if not exists. (3) If empty DB (no tenants), run seed: could be a Rust binary (cargo run --bin seed) or SQL file. Seed creates: Acme Corp tenant, 3 users (Alice admin, Bob manager, Carol member), Engineering workspace, Sprint 1 board with 3 columns and 5 tasks. (4) Create MinIO bucket.

Create docker-entrypoint.sh that runs init-db.sh then starts the Rust binary. Note: migrations handled by separate migrate service.</action>
  <verify>First startup seeds DB. Subsequent restarts skip seeding.</verify>
  <done>Created init script with conditional seeding and MinIO bucket creation.</done>
</task>

<task type="auto" id="12-09">
  <name>Add Postal initialization and reverse proxy notes</name>
  <files>docker-compose.yml</files>
  <action>Add postal-init service: image ghcr.io/postalserver/postal:3, command "postal initialize", depends postgres healthy, restart no, same volume as postal. Postal service depends on postal-init completed_successfully.

Add comment block at top of docker-compose.yml with reverse proxy recommendations: Caddy (automatic HTTPS) and Traefik (Docker-native) examples. Note to remove port mappings when using proxy.</action>
  <verify>postal-init completes. Postal starts after. Comments validate in docker compose config.</verify>
  <done>Added Postal init service and reverse proxy documentation.</done>
</task>

<task type="checkpoint" id="12-10">
  <name>Verify full stack deployment</name>
  <files>docker-compose.yml, .env.example</files>
  <verify>Run docker compose up. Confirm: (1) All services start including MongoDB. (2) Redis db isolation correct. (3) Migrate service runs sqlx migrations. (4) Postal initializes. (5) Backend starts after all deps. (6) Frontend serves Angular app. (7) /api/health returns 200 with all services up. (8) App accessible at configured port.</verify>
  <done>Verified complete Docker Compose stack with Rust backend, Angular frontend, and all services.</done>
</task>
