# TaskBolt Deployment Checklist

Reference this before every deploy. Each item is here because it burned us before.

---

## 1. Code Quality (MUST pass — no exceptions)

- [ ] `./scripts/quick-check.sh --backend` — zero errors, zero warnings
- [ ] `./scripts/quick-check.sh --frontend` — tsc clean, build succeeds
- [ ] No `unwrap()` / `todo!()` / `println!()` in Rust code
- [ ] No `console.log` in TypeScript
- [ ] No hardcoded secrets / DB credentials / API keys

---

## 2. Database / Migrations

- [ ] All new migrations are in `backend/crates/db/src/migrations/` with correct timestamp prefix
- [ ] Migration is idempotent where possible (`CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE`)
- [ ] Data migrations run BEFORE constraint additions (UPDATE first, then ADD CONSTRAINT)
- [ ] Check DB triggers still valid after column renames:
  ```sql
  SELECT proname, prosrc FROM pg_proc WHERE prosrc LIKE '%old_column_name%';
  ```
- [ ] `_sqlx_migrations` table matches source files (no VersionMissing / VersionMismatch)
- [ ] If migration was manually applied: checksum matches `sha384sum <file>.sql`

---

## 3. SQLx Offline Cache

- [ ] After ANY schema change or query edit, regenerate:
  ```bash
  cd backend && cargo sqlx prepare --workspace
  ```
- [ ] New `.sqlx/query-*.json` files are staged/committed alongside code changes
- [ ] No stale hashes from deleted/modified queries

---

## 4. Query Correctness

- [ ] `query_as!` / `query!` macros: use actual base tables, NOT views (views make columns nullable)
- [ ] Runtime `sqlx::query_as::<_, T>()`: column aliases must NOT use `!` suffix (`as col_name`, not `as "col_name!"`)
- [ ] Task list queries include `WHERE parent_task_id IS NULL` unless explicitly showing children
- [ ] After table/column renames: grep all queries for old name
  ```bash
  grep -r "old_name" backend/
  ```

---

## 5. Cache Keys

- [ ] After renaming entities, grep ALL cache invalidation calls across ALL services:
  ```bash
  grep -r "cache_key\|invalidate\|redis" frontend/src/
  ```
- [ ] Cache keys in `*.service.ts` match the keys stored by the API responses

---

## 6. Docker Build

- [ ] Backend image: `docker build -t taskbolt-backend ./backend/`
- [ ] Frontend image: `docker build -t taskbolt-frontend ./frontend/`
- [ ] Docker base image is `ubuntu:24.04` (NOT `debian:bookworm-slim`) — GLIBC 2.39 required
- [ ] Verify containers start cleanly: `docker compose -f docker-compose.yml up -d`
- [ ] Check logs: `docker logs taskbolt-backend --tail=30`

---

## 7. Post-Deploy Smoke Tests

- [ ] Health: `curl http://localhost:8180/api/health` → all critical services up
- [ ] Auth: login with `alice@acme.com / password123` succeeds
- [ ] Boards load (non-empty list returned)
- [ ] Create a task — no 500 errors
- [ ] Check browser console — no JS errors

---

## 8. Common Footguns (things that silently break)

| Symptom | Likely Cause |
|---------|-------------|
| Frontend shows stale UI after revert | Stale Docker image — force rebuild |
| `ColumnNotFound("is_done!")` | Used `as "col!"` alias in runtime query_as |
| All columns `Option<T>` in query_as! | Querying a view instead of base table |
| `VersionMissing(XXXXXXX)` on startup | Migration file deleted but DB still has entry |
| `VersionMismatch` | Migration file edited after being applied |
| Cache never invalidated | Key uses old entity name (board vs project) |
| Child tasks appear in parent list | Missing `parent_task_id IS NULL` filter |
| Docker build GLIBC error | Wrong base image (`debian` vs `ubuntu:24.04`) |
| DB trigger broken after column rename | Trigger body not updated — check pg_proc |
| Boards return `[]` for test user | User not added to workspace/board — check memberships |

---

## Quick Deploy Commands

```bash
# From /home/ankur/taskflow

# Full checks
./scripts/pre-deploy-check.sh

# Rebuild + restart backend
docker build -t taskbolt-backend ./backend/ && docker compose -f docker-compose.yml up -d backend

# Rebuild + restart frontend
docker build -t taskbolt-frontend ./frontend/ && docker compose -f docker-compose.yml up -d frontend

# Restart everything
docker compose -f docker-compose.yml up -d

# Tail logs
docker logs taskbolt-backend -f
docker logs taskbolt-frontend -f
```
