# TaskFlow Operations Runbook

> Auto-generated from source-of-truth: scripts/, docker-compose.yml, .env.example
> Last updated: 2026-02-18

## Deployment

### Standard Deploy (from local machine)

```bash
# Runs pre-deploy checks, then deploys to VPS
./scripts/deploy-vps.sh
```

This script:
1. Runs `pre-deploy-check.sh` (cargo check, clippy, ng build, SQL validation, Docker build)
2. Validates `.env` (checks DOMAIN and JWT_SECRET)
3. Creates Docker network
4. Pulls and builds images
5. Starts infrastructure (postgres, redis, mongodb, minio)
6. Waits for PostgreSQL, runs migrations
7. Starts backend + frontend
8. Starts Caddy (HTTPS reverse proxy)
9. Runs auth smoke test

### Hotfix Deploy (skip checks)

```bash
./scripts/deploy-vps.sh --skip-checks
```

### Manual Deploy (step-by-step)

```bash
# On VPS
cd /root/taskflow
git pull origin master
docker compose -f docker-compose.yml -f docker-compose.vps.yml build --no-cache
docker compose -f docker-compose.yml -f docker-compose.vps.yml up -d
```

### Deploy with Optional Services

```bash
# Enable billing (Lago)
docker compose --profile billing up -d

# Enable notifications (Novu)
docker compose --profile notifications up -d

# Enable email (Postal)
docker compose --profile email up -d

# Enable WhatsApp (WAHA)
docker compose --profile whatsapp up -d
```

## Service Management

### Start/Stop/Restart

```bash
# All services (dev)
docker compose up -d
docker compose down
docker compose restart

# All services (VPS)
docker compose -f docker-compose.yml -f docker-compose.vps.yml up -d
docker compose -f docker-compose.yml -f docker-compose.vps.yml down
docker compose -f docker-compose.yml -f docker-compose.vps.yml restart

# Single service
docker compose restart backend
docker compose restart frontend
```

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres

# Last N lines
docker compose logs --tail 100 backend
```

### Health Checks

| Endpoint | URL | Expected |
|----------|-----|----------|
| Backend health | `GET /api/health` | 200 OK |
| Backend liveness | `GET /api/health/live` | 200 OK |
| Backend readiness | `GET /api/health/ready` | 200 OK |
| Frontend health | `GET /health` (nginx) | 200 "healthy" |
| MinIO health | `GET /minio/health/live` | 200 OK |

```bash
# Quick health check
curl http://localhost:8080/api/health
curl http://localhost/health
```

## Database Operations

### Run Migrations

Migrations auto-run on backend startup via `sqlx::migrate!()`.

To run manually:
```bash
# Via the migrate one-shot container
docker compose up migrate

# Or via sqlx-cli (if installed)
cd backend && sqlx migrate run --source crates/db/src/migrations
```

### Connect to PostgreSQL

```bash
docker compose exec postgres psql -U postgres -d taskflow
```

### Backup Database

```bash
docker compose exec postgres pg_dump -U postgres taskflow > backup_$(date +%Y%m%d).sql
```

### Restore Database

```bash
cat backup.sql | docker compose exec -T postgres psql -U postgres -d taskflow
```

## Common Issues and Fixes

### Backend won't start

**Symptom**: Backend container exits immediately.

**Check**: `docker compose logs backend`

| Error | Fix |
|-------|-----|
| "connection refused" to postgres | Wait for postgres healthcheck: `docker compose up -d postgres && sleep 5` |
| "connection refused" to redis | Ensure redis is running: `docker compose up -d redis` |
| Migration error | Check migration SQL syntax; run `docker compose up migrate` separately |
| JWT_SECRET not set | Check `.env` file has valid JWT_SECRET (min 32 chars) |

### Frontend build fails

**Symptom**: `ng build` errors in CI or Docker.

```bash
# Reproduce locally
docker run --rm -v $(pwd)/frontend:/app -w /app node:22-slim sh -c "npm ci && npm run build -- --configuration=production"

# Check TypeScript errors
cd frontend && npx tsc --noEmit
```

### WebSocket not connecting

**Check**:
1. Browser console for WS errors
2. Backend logs: `docker compose logs backend | grep -i websocket`
3. Nginx/Caddy proxy config has WebSocket upgrade headers
4. Cookie domain matches (HttpOnly `access_token` cookie)

### MinIO upload failures

**Check**:
1. MinIO is running: `curl http://localhost:9000/minio/health/live`
2. Bucket exists: `docker compose exec minio mc ls local/task-attachments`
3. CORS configured: `./scripts/configure-minio-cors.sh`
4. `MINIO_PUBLIC_URL` matches what frontend uses

### Redis connection issues

```bash
# Check Redis is running
docker compose exec redis redis-cli ping
# Expected: PONG

# Check database isolation
docker compose exec redis redis-cli -n 0 DBSIZE  # App
docker compose exec redis redis-cli -n 1 DBSIZE  # Lago
docker compose exec redis redis-cli -n 2 DBSIZE  # Novu
```

## Rollback Procedures

### Quick Rollback (to previous commit)

```bash
# On VPS
cd /root/taskflow
git log --oneline -5                    # Find the commit to roll back to
git checkout <commit-hash>              # Checkout that commit
docker compose build --no-cache         # Rebuild
docker compose up -d                    # Restart
```

### Rollback with Database Migration

If a migration needs reverting, write a new "down" migration:
```bash
# Create reverse migration
cat > backend/crates/db/src/migrations/YYYYMMDD_rollback.sql << 'SQL'
-- Reverse the changes from migration X
ALTER TABLE ... ;
SQL

# Deploy the rollback
docker compose up migrate
docker compose restart backend
```

### Emergency: Restore from Backup

```bash
# Stop backend to prevent writes
docker compose stop backend

# Restore database
cat backup.sql | docker compose exec -T postgres psql -U postgres -d taskflow

# Restart
docker compose start backend
```

## Monitoring

### Docker Service Status

```bash
docker compose ps
```

### Resource Usage

```bash
docker stats --no-stream
```

### Cron Jobs

Backend exposes cron endpoints (authenticated via `X-Cron-Secret` header):

| Endpoint | Schedule | Purpose |
|----------|----------|---------|
| `GET /api/cron/deadline-scan` | Every 15 min | Notify users of upcoming/overdue deadlines |
| `GET /api/cron/weekly-digest` | Weekly | Send weekly summary emails |
| `GET /api/cron/trash-cleanup` | Daily | Permanently delete items in trash > 30 days |
| `POST /api/cron/recurring-tasks` | Every hour | Create task instances from recurring configs |

Set up external cron (e.g., system crontab or uptime monitor):
```bash
# Example crontab
*/15 * * * * curl -s -H "X-Cron-Secret: $CRON_SECRET" https://taskflow.paraslace.in/api/cron/deadline-scan
0 9 * * 1 curl -s -H "X-Cron-Secret: $CRON_SECRET" https://taskflow.paraslace.in/api/cron/weekly-digest
0 3 * * * curl -s -H "X-Cron-Secret: $CRON_SECRET" https://taskflow.paraslace.in/api/cron/trash-cleanup
0 * * * * curl -s -X POST -H "X-Cron-Secret: $CRON_SECRET" https://taskflow.paraslace.in/api/cron/recurring-tasks
```

## SSL/TLS

Caddy handles automatic HTTPS via Let's Encrypt:
- Certificates auto-obtained on first request
- Auto-renewed before expiry
- HTTP automatically redirected to HTTPS
- Domain: `taskflow.paraslace.in`

No manual certificate management needed.
