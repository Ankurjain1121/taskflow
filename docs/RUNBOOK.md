# TaskFlow Operations Runbook

> Auto-generated from source-of-truth: scripts/, docker-compose.yml, .env.example, codemaps/
> Last updated: 2026-02-23

## Deployment

### VPS Info

- **App path**: `/home/ankur/taskflow` (NEVER use `/root/taskflow` -- deprecated)
- **Domain**: taskflow.paraslace.in
- **Reverse proxy**: nginx (NOT Caddy)
- **SSL**: Certbot (Let's Encrypt)

### Standard Deploy (on VPS)

```bash
cd /home/ankur/taskflow
docker compose build && docker compose up -d
```

### Deploy with Pre-Checks

```bash
# Runs pre-deploy checks, then deploys
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
8. Configures nginx reverse proxy
9. Runs auth smoke test

### Hotfix Deploy (skip checks)

```bash
./scripts/deploy-vps.sh --skip-checks
```

### Manual Deploy (step-by-step)

```bash
cd /home/ankur/taskflow
git pull origin master
docker compose build --no-cache
docker compose up -d
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

## Docker Services (15)

| Service | Always On | Profile |
|---------|-----------|---------|
| postgres | Yes | - |
| redis | Yes | - |
| mongodb | Yes | - |
| minio, minio-setup | Yes | - |
| migrate (one-shot) | Yes | - |
| backend | Yes | - |
| frontend | Yes | - |
| lago-api, lago-front | No | billing |
| novu | No | notifications |
| postal-init, postal | No | email |
| waha | No | whatsapp |

## Service Management

### Start/Stop/Restart

```bash
# All services
docker compose up -d
docker compose down
docker compose restart

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

# Production
curl https://taskflow.paraslace.in/api/health
```

## Database Operations

### Overview

- **PostgreSQL 16** with multi-tenant RLS
- **45+ tables**, **12 enums**, **21 migrations**
- Migrations auto-run on backend startup via `sqlx::migrate!()`

### Run Migrations Manually

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

### Key Tables Reference

| Category | Tables |
|----------|--------|
| Core Identity | tenants, users, accounts, refresh_tokens, password_reset_tokens, user_preferences |
| Workspace & Board | workspaces, workspace_members, boards, board_members, board_columns |
| Teams & Positions | teams, team_members, positions, position_holders |
| Tasks | tasks, task_assignees, task_groups, subtasks, labels, task_labels, task_dependencies, milestones |
| Collaboration | comments, attachments, activity_log |
| Notifications | notifications, notification_preferences |
| Time Tracking | time_entries |
| Recurring Tasks | recurring_task_configs |
| Custom Fields | board_custom_fields, task_custom_field_values |
| Templates | project_templates (+columns/tasks), task_templates (+subtasks/labels/custom_fields) |
| Automations | automation_rules, automation_actions, automation_logs |
| Sharing | board_shares, webhooks, webhook_deliveries, favorites |
| Themes | themes |
| Billing | invitations, subscriptions, processed_webhooks |

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
| CRON_SECRET not set | Add CRON_SECRET to `.env` (required for cron endpoints) |

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
3. nginx proxy config has WebSocket upgrade headers (`proxy_set_header Upgrade $http_upgrade`)
4. Cookie domain matches (HttpOnly `access_token` cookie)

### MinIO upload failures

**Check**:
1. MinIO is running: `curl http://localhost:9000/minio/health/live`
2. Bucket exists: `docker compose exec minio mc ls local/task-attachments`
3. CORS configured: `./scripts/configure-minio-cors.sh`
4. `MINIO_PUBLIC_URL` matches what frontend uses (production: `https://files.paraslace.in`)

### Redis connection issues

```bash
# Check Redis is running
docker compose exec redis redis-cli ping
# Expected: PONG

# Check database isolation
docker compose exec redis redis-cli -n 0 DBSIZE  # App (pub/sub, rate limiting)
docker compose exec redis redis-cli -n 1 DBSIZE  # Lago
docker compose exec redis redis-cli -n 2 DBSIZE  # Novu
```

## Rollback Procedures

### Quick Rollback (to previous commit)

```bash
cd /home/ankur/taskflow
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

nginx handles HTTPS via Let's Encrypt (certbot):

```bash
# Certificate location
/etc/letsencrypt/live/taskflow.paraslace.in/

# Renewal (auto via certbot timer, or manual)
sudo certbot renew

# nginx config
/etc/nginx/sites-available/taskflow.paraslace.in
```

- Certificates auto-renewed via certbot systemd timer
- HTTP automatically redirected to HTTPS
- Domain: `taskflow.paraslace.in`

## nginx Configuration

nginx reverse proxy config at `/etc/nginx/sites-available/`:

Key proxy rules:
- `/api/*` -> `backend:8080`
- `/ws` -> `backend:8080` (with WebSocket upgrade headers)
- `/` -> `frontend:80` (Angular SPA)
- Static files served with caching headers

WebSocket upgrade config:
```nginx
location /ws {
    proxy_pass http://localhost:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

## Background Jobs

| Job | Module | Purpose |
|-----|--------|---------|
| automation_executor | services/jobs/ | Evaluate automation trigger rules |
| deadline_scanner | services/jobs/ | Scan for overdue/upcoming tasks |
| trash_cleanup | services/jobs/ | Permanently delete expired trash (30-day retention) |
| weekly_digest | services/jobs/ | Send weekly task summaries |

## Architecture Quick Reference

```
                    INTERNET
                        |
                 [nginx :80/:443]
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
```

Backend crates: `api -> {auth, db, services}`, `services -> {auth, db}`, `auth -> db`
