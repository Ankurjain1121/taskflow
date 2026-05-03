# MERGE_RUNBOOK — crm/integration

**Target branch:** `crm/integration`
**Source worktrees:** 11 sequential merges (W1 → W12)
**Architect verdict:** YELLOW (routes/mod.rs 3-way RED, TenantContext shadow YELLOW)

## Pre-flight

```bash
cd /home/ankur/projects/taskflow
git fetch --all --prune
git checkout crm/integration
git pull --ff-only origin crm/integration || true
git status   # MUST be clean
./scripts/quick-check.sh   # baseline must be green BEFORE merging
```

If baseline fails, fix master first. Do not merge into a broken base.

---

## Universal merge template

For each step:

```bash
git checkout crm/integration
git merge --no-ff crm/<branch> -m "merge: <branch> into crm/integration"
# resolve conflicts per recipe below
git add -A
git commit --no-edit                # only after resolution
cd backend && cargo check --workspace --all-targets
```

**Rollback if `cargo check` fails:**

```bash
git merge --abort                   # if still mid-merge
# OR if already committed:
git reset --hard HEAD~1
```

---

## Step 1 — `crm/phase-0.5b-tech` (W1 docs)

```bash
git merge --no-ff crm/phase-0.5b-tech
```

Conflicts: none expected (docs/* only).
Verify: `ls docs/twenty-integration/00c-tech-feasibility.md`. No `cargo check` needed; run anyway as smoke.

## Step 2 — `crm/phase-1-vps2` (W2 infra)

```bash
git merge --no-ff crm/phase-1-vps2
```

Conflicts: none expected (`infra/nginx/*`, `infra/twenty-compose-snippet.yml`).
Verify: `nginx -t -c $(pwd)/infra/nginx/crm.taskflow.paraslace.in` (syntax only).

## Step 3 — `crm/phase-3-twenty` (W3 root compose)

```bash
git merge --no-ff crm/phase-3-twenty
```

Conflicts: possible on root `docker-compose.yml` if both touched (W3 adds new file `docker-compose.twenty.yml` — should be clean).
Verify: `docker compose -f docker-compose.twenty.yml config -q`.

## Step 4 — `crm/phase-4-sso` (W4 OIDC + crm_workspace_links)

```bash
git merge --no-ff crm/phase-4-sso
```

**Expected conflicts:**
- `backend/crates/api/src/routes/mod.rs` (new `pub mod integrations;` + `pub use integrations::integrations_router;`)
- `backend/crates/services/Cargo.toml` (new `openidconnect`, `oauth2`, `jsonwebtoken` deps if any)
- `backend/crates/db/src/migrations/` (additive — no conflict)

**Resolve routes/mod.rs:** see "routes/mod.rs 3-way recipe" below.
**Resolve Cargo.toml:** keep both dep blocks; sort alphabetically inside `[dependencies]`.

```bash
cd backend && cargo check --workspace --all-targets
cargo sqlx prepare --workspace
```

## Step 5 — `crm/phase-6a-inbound` (W5 webhook + mirror tables)

```bash
git merge --no-ff crm/phase-6a-inbound
```

**Expected conflicts:**
- `backend/crates/api/src/routes/mod.rs` (`pub mod webhooks_incoming;`)
- `backend/crates/api/Cargo.toml` (`hmac`, `sha2`, `chrono` features)
- `backend/crates/db/src/migrations/` (new `crm_*_mirror` files — additive)

**TenantContext disambiguation (YELLOW from architect):**
W5 introduces a `TenantContext` struct in `backend/crates/db/src/queries/crm_mirror.rs` (or `db/src/tenant.rs`) that shadows the existing `api::extractors::TenantContext`. Rename W5's db-layer struct **before** `cargo check`:

```bash
cd backend
# Rename struct + all references in db crate
rg -l 'TenantContext' crates/db/src | xargs sed -i 's/\bTenantContext\b/RlsContext/g'
# Verify api crate's TenantContext untouched
rg 'pub struct TenantContext' crates/api/src/extractors/  # must still exist
cargo check --workspace
```

If any callers in `services/` or `api/` referenced the db-layer struct, fix import to `db::queries::crm_mirror::RlsContext` (or wherever).

## Step 6 — `crm/phase-7-links` (W8 task_crm_* link tables)

```bash
git merge --no-ff crm/phase-7-links
```

**Expected conflicts:**
- `backend/crates/api/src/routes/mod.rs` (`pub mod task_crm_links;`)
- `backend/crates/db/src/migrations/` (additive)

Apply 3-way recipe. `cargo check`, then `cargo sqlx prepare --workspace`.

## Step 7 — `crm/phase-6b-outbound` (W6 outbound + DLQ + 6c)

**Depends on W4 (`twenty/client.rs`) and W5 (mirror tables).** Order matters — do not reorder.

```bash
git merge --no-ff crm/phase-6b-outbound
```

**Expected conflicts:**
- `backend/crates/services/src/jobs/mod.rs` (new outbound job module)
- `backend/crates/api/src/routes/integrations/mod.rs` (new submodule)

Resolve by accepting both additions; preserve alphabetical `pub mod` order. `cargo check + cargo test -p taskbolt-services --no-run`.

## Step 8 — `crm/phase-8-renovate` (W11 renovate + health adapter)

```bash
git merge --no-ff crm/phase-8-renovate
```

**Expected conflicts:**
- `backend/crates/api/src/routes/integrations/mod.rs` (must coexist with W6's additions)
- `renovate.json` (new file at root, no conflict)

Resolve integrations/mod.rs by keeping **both** W6 outbound submodules and W11 health adapter; alphabetize.

## Step 9 — `crm/phase-5-shell` (W9 frontend shell)

```bash
git merge --no-ff crm/phase-5-shell
```

Conflicts: `frontend/src/app/app.routes.ts` (new `/crm` route), possibly `app.config.ts`.
Verify: `cd frontend && npx tsc --noEmit`.

## Step 10 — `crm/phase-7-drawer` (W10 task drawer picker)

```bash
git merge --no-ff crm/phase-7-drawer
```

Conflicts: possibly `task-detail` component template + new `crm.service.ts`.
Verify: `cd frontend && npx tsc --noEmit && npm run build -- --configuration=production`.

## Step 11 — `crm/phase-9-tests` (W12 cross-phase tests)

```bash
git merge --no-ff crm/phase-9-tests
```

Conflicts: none expected (test-only).
Verify: `cd backend && cargo test --workspace -- --test-threads=2`.

---

## routes/mod.rs 3-way merge recipe

W4, W5, W8 all add `pub mod` + `pub use` lines. W11 + W6 add to integrations/mod.rs. Conflict marker example:

```
<<<<<<< HEAD
pub mod webhook;
pub mod workspace;
=======
pub mod integrations;
pub mod task_crm_links;
pub mod webhook;
pub mod webhooks_incoming;
pub mod workspace;
>>>>>>> crm/phase-6a-inbound
```

**Recipe:**
1. **Preserve all `pub mod` additions from every branch.** Never drop one.
2. Sort the entire `pub mod` block alphabetically within its section.
3. Mirror the same rule for `pub use` re-exports — alphabetical, all branches preserved.
4. After resolution, `rg '^pub mod ' crates/api/src/routes/mod.rs | sort -c` must succeed (already sorted).
5. Commit, then `cargo check --workspace`.

If a brace/paren error appears, you likely dropped a line — re-apply from `git show :3:backend/crates/api/src/routes/mod.rs`.

---

## Post-merge final verification

After **all 11 merges land**:

```bash
cd /home/ankur/projects/taskflow
./scripts/quick-check.sh                                # combined gate
cd backend
cargo check --workspace --all-targets
cargo clippy --workspace --all-targets -- -D warnings
cargo fmt --all -- --check
cargo sqlx prepare --workspace --check
cargo test --workspace -- --test-threads=2
cd ../frontend
npx tsc --noEmit
npm run build -- --configuration=production
npx playwright test --project=chromium --grep @crm
cd ..
./scripts/pre-deploy-check.sh
```

All gates GREEN → push:

```bash
git push origin crm/integration
```

If any gate fails, do **not** push. Bisect with `git log --merges --oneline crm/integration` and revert the offending merge:

```bash
git revert -m 1 <merge-sha>
```

---

## Notes

- Never squash these merges — `--no-ff` preserves worktree provenance for forensics.
- After every merge, regenerate the graph if 3+ files changed: `/graphify --update`.
- Keep `crm/integration` rebased onto `master` only via merge (`git merge master`), never `rebase` — it would destroy the per-worktree history.
- Test credentials: `admin1@paraslace.in` for any manual smoke after merge 9–10.
