# Twenty CRM v2.2.0 — Startup Report

**Date:** 2026-05-03 IST  
**Branch:** crm/phase-3-twenty  
**Agent:** W3 (twenty-standup)

---

## Services

| Service | Container | Image | Status | Port |
|---------|-----------|-------|--------|------|
| twenty-server | twenty-server | twentycrm/twenty:v2.2.0 | healthy | 127.0.0.1:3000 |
| twenty-worker | twenty-worker | twentycrm/twenty:v2.2.0 | healthy | — |
| twenty-postgres | twenty-postgres | postgres:16 | healthy | internal only |
| twenty-redis | twenty-redis | redis:7-alpine | healthy | internal only |

## Healthcheck Status

All 4 services: **healthy**

```
NAME              IMAGE                     STATUS
twenty-postgres   postgres:16               Up (healthy)
twenty-redis      redis:7-alpine            Up (healthy)
twenty-server     twentycrm/twenty:v2.2.0   Up (healthy)   127.0.0.1:3000->3000/tcp
twenty-worker     twentycrm/twenty:v2.2.0   Up (healthy)
```

## Smoke Check Results

| Check | Result |
|-------|--------|
| `curl http://127.0.0.1:3000/healthz` | HTTP 200 `{"status":"ok","info":{},"error":{},"details":{}}` |
| All 4 containers healthy | PASS |
| Server logs — no fatal errors | PASS (Nest application successfully started) |
| Postgres `\dt core.*` shows Twenty tables | PASS (core.apiKey, core.workspace, etc.) |
| DB migrations ran | PASS (`_typeorm_migrations` table present, core schema seeded) |

## URLs

- Loopback only (no nginx yet): http://127.0.0.1:3000
- Healthz: http://127.0.0.1:3000/healthz
- GraphQL: http://127.0.0.1:3000/graphql
- Public (after Phase 4 nginx): https://crm.taskflow.paraslace.in

## Resource Snapshot at Boot

### Host memory (`free -h`)

```
               total        used        free      shared  buff/cache   available
Mem:            23Gi        10Gi       7.3Gi        50Mi       6.1Gi        12Gi
Swap:          4.0Gi       512Ki       4.0Gi
```

### Container stats (`docker stats --no-stream`)

| Container | CPU % | MEM | MEM % | Limit |
|-----------|-------|-----|-------|-------|
| twenty-postgres | 0.00% | 46 MiB | 4.5% | 1 GiB |
| twenty-redis | 1.51% | 4 MiB | 0.4% | 1 GiB |
| twenty-server | 0.00% | 642 MiB | 31% | 2 GiB |
| twenty-worker | 109% | 397 MiB | 39% | 1 GiB |

> Worker CPU at 109% is normal at first boot — BullMQ worker initializing queues and processing first-run jobs.

## Network

- Network: `twenty-standup_twenty-network` (bridge, isolated)
- `taskbolt-network` was absent at deploy time — Twenty is on its own network.
- To connect Twenty to TaskBolt after TaskBolt deploys:
  ```bash
  docker network connect taskbolt-network twenty-server
  ```

## Boot Notes

- First boot took ~3.5 min: entrypoint ran full schema init + 41 migration commands + cron registration
- Second boot (same data): ~2 min for upgrade-check + cron registration
- `start_period: 360s` set in compose to accommodate full first-boot migration time
- Worker command: `yarn worker:prod` (BullMQ queue processor)

## Next Steps

1. **Admin user bootstrap:** Visit https://crm.taskflow.paraslace.in on first browser visit — Twenty will prompt to create the first workspace admin account
2. **Phase 4 — nginx install:** Install `infra/nginx/crm.taskflow.paraslace.in` config, obtain TLS cert via certbot, reload nginx (requires user approval)
3. **Phase 4 — DNS:** Ensure `crm.taskflow.paraslace.in` → 185.249.225.79 propagated before certbot
4. **Phase 5 — TaskBolt integration:** Wire CRM iframe/link into TaskBolt frontend; connect networks once TaskBolt deployed
5. **Phase 3.4 — Storage:** Switch `STORAGE_TYPE=local` to S3/MinIO once MinIO instance provisioned
6. **Monitoring:** Add `twenty-server` and `twenty-worker` to any uptime monitoring in place
