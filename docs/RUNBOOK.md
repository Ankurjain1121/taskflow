# TaskBolt Operations Runbook

> Auto-generated from source-of-truth: scripts/, docker-compose.yml, .env.example, codemaps/
> Last updated: 2026-03-16

## Deployment

### VPS Info

- **App path**: `/home/ankur/taskflow` (NEVER use `/root/taskbolt` -- deprecated)
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
5. Starts infrastructure (minio)
6. Waits for PostgreSQL (host), runs migrations
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

## Docker Services (3 containers + host services)

| Service | Type | Details |
|---------|------|---------|
| backend | Docker | taskbolt-backend:8080 (Rust/Axum) |
| frontend | Docker | taskbolt-frontend:80 (Angular/Nginx) |
| minio | Docker | taskbolt-minio:9000/9001 (S3 storage) |
| PostgreSQL 16 | Host | 10.0.2.1:5432, user: taskbolt_app |
| Redis 7 | Host | 10.0.2.1:6379 |

Network: Docker bridge 10.0.2.0/24 (gateway 10.0.2.1) for host service access.

### Resource Limits

| Container | CPU | Memory |
|-----------|-----|--------|
| backend | 1.0 | 512M |
| frontend | 0.25 | 256M |
| minio | 0.5 | 512M |

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

# Last N lines
docker compose logs --tail 100 backend
```

### Health Checks

| Endpoint | URL | Expected |
|----------|-----|----------|
| Backend health | `GET /api/health` | 200 OK (public) |
| Backend liveness | `GET /api/health/live` | 200 OK (public) |
| Backend readiness | `GET /api/health/ready` | 200 OK (public) |
| Backend detailed | `GET /api/health/detailed` | 200 JSON (requires auth) |
| Frontend health | `GET /health` (nginx) | 200 "healthy" |
| MinIO health | `GET /minio/health/live` | 200 OK |

The `/api/health/detailed` endpoint (requires JWT auth) returns:
- `board_channels`: active WebSocket channel count
- `ws_connections`: current WebSocket connection count
- `db_pool`: pool size, idle, active connections
- `process_rss`: backend memory usage in bytes

```bash
# Quick health check
curl http://localhost:8080/api/health
curl http://localhost/health

# Production
curl https://taskflow.paraslace.in/api/health
```

### Resource Monitoring

```bash
# Docker container stats
docker stats --no-stream

# Memory usage with threshold warnings (>80% limit)
./scripts/monitor-memory.sh

# Disk usage for Docker volumes (warns if MinIO >5GB)
./scripts/check-disk-usage.sh
```

## Database Operations

### Overview

- **PostgreSQL 16** with multi-tenant RLS
- **45+ tables**, **12 enums**, **47 migrations**, **3 materialized views**
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
# Host PostgreSQL (not Docker)
psql -h 10.0.2.1 -U taskbolt_app -d taskbolt

# Or via localhost
sudo -u postgres psql -d taskbolt
```

### Backup Database

```bash
pg_dump -h 10.0.2.1 -U taskbolt_app taskbolt > backup_$(date +%Y%m%d).sql
```

### Restore Database

```bash
psql -h 10.0.2.1 -U taskbolt_app -d taskbolt < backup.sql
```

### Refresh Materialized Views

```bash
psql -h 10.0.2.1 -U taskbolt_app -d taskbolt -c "SELECT refresh_metrics_views();"
```

### Key Tables Reference

| Category | Tables |
|----------|--------|
| Core Identity | tenants, users, accounts, refresh_tokens, password_reset_tokens, user_preferences |
| Workspace | workspaces, workspace_members, workspace_api_keys, invitations |
| Projects | projects, project_members, project_statuses, project_shares |
| Teams & Positions | teams, team_members, positions, position_holders |
| Tasks | tasks, task_assignees, task_lists, subtasks, labels, task_labels, task_dependencies, task_watchers, task_reminders, milestones |
| Collaboration | comments, attachments, activity_log |
| Notifications | notifications, notification_preferences |
| Time Tracking | time_entries |
| Recurring Tasks | recurring_task_configs |
| Custom Fields | project_custom_fields, task_custom_field_values |
| Templates | project_templates (+groups/tasks/labels/custom_fields), task_templates (+subtasks/labels/custom_fields) |
| Automations | automation_rules, automation_actions, automation_logs, automation_templates, automation_rate_counters |
| Sharing | project_shares, webhooks, webhook_deliveries, favorites |
| Billing | subscriptions, processed_webhooks |
| Search & Nav | recent_items, filter_presets, bulk_operations |

## Common Issues and Fixes

### Backend won't start

**Symptom**: Backend container exits immediately.

**Check**: `docker compose logs backend`

| Error | Fix |
|-------|-----|
| "connection refused" to postgres | Ensure host PostgreSQL is running: `systemctl status postgresql` |
| "connection refused" to redis | Ensure host Redis is running: `systemctl status redis` |
| Migration error | Check migration SQL syntax; run `docker compose up migrate` separately |
| JWT_SECRET not set | Check `.env` file has valid JWT_SECRET (min 32 chars) |
| CRON_SECRET not set | Add CRON_SECRET to `.env` (required for cron endpoints) |
| GLIBC mismatch | Use `ubuntu:24.04` base image (not `debian:bookworm-slim`) |

### Frontend build fails

**Symptom**: `ng build` errors in CI or Docker.

```bash
# Check TypeScript errors
cd frontend && npx tsc --noEmit

# Full production build test
cd frontend && npm run build -- --configuration=production
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
# Check Redis is running (host service)
redis-cli -h 10.0.2.1 ping
# Expected: PONG

# Check database size
redis-cli -h 10.0.2.1 -n 0 DBSIZE  # App (pub/sub, rate limiting, bulk undo)
```

### SQLx offline cache stale

After schema changes, regenerate the offline cache:
```bash
cd backend && cargo sqlx prepare --workspace
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

**Important**: SQLx uses SHA-384 checksums for migrations. If you need to manually register a migration, use `sha384sum file.sql`.

### Emergency: Restore from Backup

```bash
# Stop backend to prevent writes
docker compose stop backend

# Restore database
psql -h 10.0.2.1 -U taskbolt_app -d taskbolt < backup.sql

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

# Detailed monitoring scripts
./scripts/monitor-memory.sh        # Memory with threshold warnings
./scripts/check-disk-usage.sh      # Disk usage for volumes
```

### Cron Jobs

Backend exposes cron endpoints (authenticated via `X-Cron-Secret` header):

| Endpoint | Schedule | Purpose |
|----------|----------|---------|
| `POST /api/cron/deadline-scan` | Every 15 min | Notify users of upcoming/overdue deadlines |
| `POST /api/cron/weekly-digest` | Weekly | Send weekly summary emails |
| `POST /api/cron/trash-cleanup` | Daily | Permanently delete items in trash > 30 days |
| `POST /api/cron/recurring-tasks` | Every hour | Create task instances from recurring configs |
| `POST /api/cron/refresh-metrics` | Every 6 hours | Refresh materialized views for metrics |

Set up external cron (e.g., system crontab or uptime monitor):
```bash
# Example crontab — all endpoints use POST (never GET for side-effectful jobs)
*/15 * * * * curl -s -X POST -H "X-Cron-Secret: $CRON_SECRET" https://taskflow.paraslace.in/api/cron/deadline-scan
0 9 * * 1 curl -s -X POST -H "X-Cron-Secret: $CRON_SECRET" https://taskflow.paraslace.in/api/cron/weekly-digest
0 3 * * * curl -s -X POST -H "X-Cron-Secret: $CRON_SECRET" https://taskflow.paraslace.in/api/cron/trash-cleanup
0 * * * * curl -s -X POST -H "X-Cron-Secret: $CRON_SECRET" https://taskflow.paraslace.in/api/cron/recurring-tasks
0 */6 * * * curl -s -X POST -H "X-Cron-Secret: $CRON_SECRET" https://taskflow.paraslace.in/api/cron/refresh-metrics
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
- `/api/ws` -> `backend:8080` (with WebSocket upgrade headers)
- `/` -> `frontend:80` (Angular SPA)
- Static files served with caching headers

WebSocket upgrade config:
```nginx
location /api/ws {
    proxy_pass http://localhost:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

## Background Jobs

| Job | Module | Trigger | Purpose |
|-----|--------|---------|---------|
| automation_executor | services/jobs/ | Event-driven + scheduled | Evaluate automation trigger rules |
| deadline_scanner | services/jobs/ | Cron (15 min) | Scan for overdue/upcoming tasks, send notifications |
| trash_cleanup | services/jobs/ | Cron (daily) | Permanently delete expired trash (30-day retention) |
| weekly_digest | services/jobs/ | Cron (weekly) | Send weekly task summaries via email |
| recurring_tasks | (built-in) | 10-min tick + cron | Create task instances from recurring configs |
| metrics_refresh | (cron endpoint) | Cron (6 hours) | Refresh materialized views |
| channel_gc | (built-in) | Every 60s | Clean up dead WebSocket broadcast channels |

## Architecture Quick Reference

```
                    INTERNET
                        |
                 [nginx :80/:443]
                taskflow.paraslace.in
                 /           \
                /             \
      [frontend:80]     [backend:8080]
      nginx + Angular    Rust / Axum         <- Docker containers
      SPA                     |
                          /---+---\
                         /    |    \
                 [postgres] [redis] [minio]  <- Host PG/Redis, Docker MinIO
                  :5432     :6379   :9000
                 (host)    (host)  (docker)
```

Backend crates: `api -> {auth, db, services}`, `services -> {auth, db}`, `auth -> db`
