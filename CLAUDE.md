# CLAUDE.md - Behavioral Directives

## Core Rules

- **Direct Tools First:** Glob/Grep/Read/Edit before agents
- **KISS + YAGNI:** Simple > Complex
- **No Silent Workarounds:** Report failures, ask user
- **Visual Over Verbal:** Tables > paragraphs

---

## VPS Access

**Note:** SSH alias `vps-ankur` needs to be added to `~/.ssh/config`:
```
Host vps-ankur
    HostName <VPS_IP>
    User root
    IdentityFile ~/.ssh/id_rsa
```

**Project Path:** `/root/taskflow`
**Domain:** taskflow.paraslace.in

### Required: Pull Latest and Rebuild
The VPS needs to pull commit `6145591` which has Rust 1.93 Dockerfile.
```bash
# On VPS - run these commands:
cd /root/taskflow
git fetch origin
git reset --hard origin/master  # Force sync with remote
head -10 backend/Dockerfile     # Verify: should show rust:1.93-slim
docker compose build --no-cache
docker compose up -d
```

---

## Pre-Deploy Safety Protocol

**MANDATORY before ANY deploy or `docker compose build`:**

1. After making backend changes: verify with `./scripts/quick-check.sh --backend`
2. After making frontend changes: verify with `./scripts/quick-check.sh --frontend`
3. Before deploying to VPS: `./scripts/pre-deploy-check.sh` (runs ALL checks)

**What the checks catch:**
- Rust compile errors (cargo check)
- Rust lint issues (cargo clippy -D warnings)
- Angular/TypeScript build errors (ng build --production)
- SQL migration issues
- Docker image build failures

**NEVER skip checks.** If a check fails, fix the error before proceeding.

---

## Pre-Commit Hooks (Active)

**Setup:** `git config core.hooksPath .githooks` (already configured)

Every `git commit` automatically runs 7 checks:

| # | Check | Blocks Commit? |
|---|-------|---------------|
| 1 | Hardcoded secrets (passwords, API keys, tokens) | YES |
| 2 | `debugger` statements in TypeScript | YES |
| 3 | TypeScript type-check (`tsc --noEmit`) if frontend changed | YES |
| 4 | Rust `.unwrap()` / `todo!()` / `println!()` warnings | No (warns) |
| 5 | SQL: TRUNCATE, DELETE without WHERE, DROP without IF EXISTS | YES |
| 6 | Files > 1MB | YES |
| 7 | Auth file modifications (sensitive auth-related files) | YES |

`console.log` in TypeScript triggers a **warning** (not a block).

Emergency bypass: `git commit --no-verify` (use sparingly).

---

*Do the work, show results.*
