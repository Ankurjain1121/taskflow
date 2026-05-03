# VPS2 Audit — Phase 1 CRM Pre-flight

**Date:** 2026-05-03 (IST)  
**Branch:** crm/phase-1-vps2  
**Purpose:** Baseline snapshot before Twenty CRM deployment

---

## 1. Hardware & OS

| Item | Value |
|------|-------|
| CPU cores | 8 (AMD EPYC) |
| RAM total | 23 GiB |
| RAM used | 7.7 GiB |
| RAM available | 15 GiB |
| Swap total | 4.0 GiB |
| Swap used | 512 KiB |
| Disk (/) total | 193 G |
| Disk (/) used | 85 G (44%) |
| Disk (/) free | 109 G |
| Uptime | 69 days |
| Load avg (1/5/15 min) | 6.68 / 2.97 / 1.61 |

> Load avg of 6.68 at audit time is elevated (above core count of 8 ÷ some margin). Likely transient — qdrant indexing or ollama inference burst. Monitor before scheduling heavy Twenty migrations.

---

## 2. Installed Binaries

| Binary | Path | Status |
|--------|------|--------|
| nginx | /usr/sbin/nginx | ✅ present |
| docker | /usr/bin/docker | ✅ present |
| certbot | /usr/bin/certbot | ✅ present |
| postgres-client (psql) | — | ❌ not found |
| redis-tools (redis-cli) | — | ❌ not found |

**Action needed:** `postgres-client` and `redis-tools` are absent — cannot inspect Twenty's DB/Redis from host shell without them. Install before Phase 2 ops, or exec into containers.

---

## 3. System Services

| Service | Status |
|---------|--------|
| nginx | active (running) |
| docker | active (running) |

---

## 4. Docker Containers

| Name | Status | Ports |
|------|--------|-------|
| pipeline | Up 6 days | 0.0.0.0:8000→8000/tcp (public-facing) |
| qdrant | Up 2 weeks | 127.0.0.1:6333-6334→6333-6334/tcp (loopback only) |
| ollama | Up 2 weeks | 127.0.0.1:11434→11434/tcp (loopback only) |

> Port 8000 is the only public container port. Twenty will add ports 3000 (server) — all loopback, served via nginx.

---

## 5. AI Workloads (Host Process)

| PID | Binary | VSZ | RSS |
|-----|--------|-----|-----|
| 2806624 | /bin/ollama serve | ~3.2 GiB (virtual) | ~42 MiB (resident) |

RSS of 42 MiB reflects the server process; model weights reside in GPU VRAM or are mmap'd. Virtual footprint of 3.2 GiB indicates at least one model is mapped. Effective RAM pressure from ollama is low when idle.

---

## 6. Nginx Sites

| Symlink | Config file |
|---------|-------------|
| default | /etc/nginx/sites-available/default |
| pcai.myescaperoute.in | /etc/nginx/sites-available/pcai.myescaperoute.in |

**No existing TaskBolt or CRM nginx config found.**  
The staged config `infra/nginx/crm.taskflow.paraslace.in` in this worktree will be the first one for the CRM subdomain.

---

## 7. Resource Ceiling Recommendation

### Baseline consumption (pre-Twenty)

| Workload | Est. RAM |
|----------|----------|
| OS + system | ~500 MiB |
| nginx | ~50 MiB |
| ollama serve (resident) | ~42 MiB |
| qdrant | ~500 MiB |
| pipeline (port 8000) | ~300 MiB |
| **Subtotal existing** | **~1.4 GiB** |

### Available headroom

- Available RAM at audit: **15 GiB**
- After existing workloads: **~13.6 GiB usable**

### Recommended ceilings for TaskBolt + Twenty

| Service group | RAM cap | CPU shares |
|---------------|---------|------------|
| TaskBolt (backend + postgres + redis) | 3,072 MiB | 2.0 CPUs |
| Twenty (server + worker + postgres + redis) | 4,096 MiB | 3.0 CPUs |
| **Combined** | **7,168 MiB** | **5.0 CPUs** |
| Safety buffer remaining | ~6.4 GiB | 3.0 CPUs |

> Safety buffer covers ollama inference spikes (models load into RAM if no GPU), qdrant query bursts, and OS page cache.  
> Set `mem_limit` in docker-compose per service, not just combined — prevents one runaway service from starving the other.

### Port availability check

| Port | Required by | Conflict? |
|------|-------------|-----------|
| 3000 | Twenty server | ✅ free (loopback only) |
| 5432 | Twenty postgres | ✅ free (loopback, container network) |
| 6379 | Twenty redis | ✅ free (loopback, container network) |
| 3000 (public via nginx) | CRM subdomain → nginx proxy | ✅ no conflict (nginx handles TLS) |

---

## 8. Pre-deployment Checklist (Phase 2 prerequisites)

- [ ] DNS: `crm.taskflow.paraslace.in` → 185.249.225.79 propagated
- [ ] TLS cert: `certbot certonly --nginx -d crm.taskflow.paraslace.in`
- [ ] Install nginx config from `infra/nginx/crm.taskflow.paraslace.in` → `/etc/nginx/sites-available/`
- [ ] Enable site: `ln -s /etc/nginx/sites-available/crm.taskflow.paraslace.in /etc/nginx/sites-enabled/`
- [ ] Merge `infra/twenty-compose-snippet.yml` services into main `docker-compose.yml`
- [ ] Populate `.env` with Twenty secrets (STORAGE_TYPE, DATABASE_URL, etc.)
- [ ] `docker compose pull` Twenty images (v2.2.0)
- [ ] `docker compose up -d twenty-postgres twenty-redis` → verify health
- [ ] `docker compose up -d twenty-server twenty-worker`
- [ ] `nginx -t && systemctl reload nginx`
- [ ] Smoke test: `curl -I https://crm.taskflow.paraslace.in`
- [ ] Install `postgresql-client` and `redis-tools` for host-side ops
