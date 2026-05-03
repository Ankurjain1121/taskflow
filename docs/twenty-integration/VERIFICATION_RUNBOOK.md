# Phase 9 — Verification Runbook (Twenty CRM Integration)

Source plan: `/home/ankur/.claude/plans/donwload-twenty-one-open-purring-parasol.md` (Phase 9).
Test plan artifact: `/home/ankur/.gstack/projects/Ankurjain1121-taskflow/ankur-master-eng-review-test-plan-20260503-130000.md`.
Run from VPS2 against staging compose project before flipping production DNS, and again after Phase 8 deploys.
Test user: `admin1@paraslace.in`. URLs: `https://taskflow.paraslace.in`, `https://crm.taskflow.paraslace.in`, Twenty admin local: `http://127.0.0.1:3000`.

Set once per shell:
```bash
export TASKBOLT_URL=https://taskflow.paraslace.in
export CRM_URL=https://crm.taskflow.paraslace.in
export TWENTY_LOCAL=http://127.0.0.1:3000
export TEST_EMAIL=admin1@paraslace.in
export TEST_PASS='<paste-from-vault>'
cd /home/ankur/projects/taskflow
TZ=Asia/Kolkata date   # log start time IST
```

---

## Step 1: Infra healthchecks
**Goal:** All containers up, both nginx vhosts return 200.
**Prereq:** `docker compose up -d` complete on VPS2; nginx + certbot configured for both hostnames.
**Run:**
```bash
docker compose ps --format 'table {{.Name}}\t{{.State}}\t{{.Status}}'
docker compose ps --format json | jq -r '.[] | select(.Health!="" and .Health!="healthy") | "UNHEALTHY: \(.Name) → \(.Health)"'
curl -fsS -o /dev/null -w 'taskbolt=%{http_code}\n' "$TASKBOLT_URL/health"
curl -fsS -o /dev/null -w 'crm=%{http_code}\n'      "$CRM_URL/healthz"
```
**Expect:** All rows `running` + `healthy`; jq prints nothing; both curls print `=200`.
**Pass criteria:** No `UNHEALTHY` lines AND both HTTP codes equal 200.
**On fail:** `docker compose logs --tail=200 <name>`; check nginx `/var/log/nginx/error.log`; verify certbot expiry `certbot certificates`.

---

## Step 2: TaskBolt smoke (login, board, task, drag, WS, MinIO)
**Goal:** End-to-end happy path on TaskBolt unaffected by Twenty colocation.
**Prereq:** `admin1@paraslace.in` exists; Playwright installed (`cd frontend && npx playwright install chromium`).
**Run:**
```bash
cd /home/ankur/projects/taskflow/frontend
BASE_URL="$TASKBOLT_URL" TEST_EMAIL="$TEST_EMAIL" TEST_PASSWORD="$TEST_PASS" \
  npx playwright test e2e/smoke/full-flow.spec.ts --reporter=line --project=chromium
TOKEN=$(curl -fsS -X POST "$TASKBOLT_URL/api/auth/sign-in" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASS\"}" | jq -r '.token')
curl -fsS -H "Authorization: Bearer $TOKEN" "$TASKBOLT_URL/api/me" | jq '.email'
curl -fsS -H "Authorization: Bearer $TOKEN" -F "file=@/etc/hostname" "$TASKBOLT_URL/api/uploads" | jq '.url'
docker exec taskbolt-minio mc ls local/taskbolt-uploads/ | tail -3
```
**Expect:** Playwright `passed`; `.email` == test email; upload returns S3-style URL; `mc ls` shows the just-uploaded object.
**Pass criteria:** Playwright exit 0 AND upload URL non-empty AND object visible in MinIO.
**On fail:** `docker logs taskbolt-backend --tail=200`; if WS spec fails, check Nginx `proxy_set_header Upgrade $http_upgrade` is in vhost.

---

## Step 3: Twenty standalone smoke
```bash
source /home/ankur/projects/taskflow/.env
H=(-H "Authorization: Bearer $TWENTY_API_KEY" -H 'Content-Type: application/json')
curl -fsS "${H[@]}" "$TWENTY_LOCAL/healthz"
COMPANY_ID=$(curl -fsS "${H[@]}" -X POST "$TWENTY_LOCAL/rest/companies" \
  -d '{"name":"Acme","domainName":{"primaryLinkUrl":"acme.test"}}' | jq -r '.data.createCompany.id')
PERSON_ID=$(curl -fsS "${H[@]}" -X POST "$TWENTY_LOCAL/rest/people" \
  -d "{\"name\":{\"firstName\":\"Ada\",\"lastName\":\"Lovelace\"},\"companyId\":\"$COMPANY_ID\"}" \
  | jq -r '.data.createPerson.id')
OPP_ID=$(curl -fsS "${H[@]}" -X POST "$TWENTY_LOCAL/rest/opportunities" \
  -d "{\"name\":\"Acme Pilot\",\"companyId\":\"$COMPANY_ID\",\"amount\":{\"amountMicros\":50000000000,\"currencyCode\":\"INR\"}}" \
  | jq -r '.data.createOpportunity.id')
echo "company=$COMPANY_ID person=$PERSON_ID opp=$OPP_ID"
```
**Pass:** All three IDs non-empty UUIDs.

---

## Step 4: SSO bridge
```bash
TOKEN=$(curl -fsS -X POST "$TASKBOLT_URL/api/auth/sign-in" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASS\"}" | jq -r '.token')
curl -fsS -i -H "Authorization: Bearer $TOKEN" "$TASKBOLT_URL/api/integrations/twenty/sso" | tee /tmp/sso.headers | head -20
LOCATION=$(grep -i '^location:' /tmp/sso.headers | awk '{print $2}' | tr -d '\r')
curl -fsS -c /tmp/cookies.txt -L "$LOCATION" -o /tmp/twenty-landing.html
grep -c "Sign in\|Login" /tmp/twenty-landing.html   # MUST be 0
```
**Pass:** `grep -c 'Sign in'` returns `0` AND landing page contains workspace markers.

---

## Step 5: Inbound sync (5s window)
```bash
BEFORE=$(date +%s)
curl -fsS -H "Authorization: Bearer $TWENTY_API_KEY" -H 'Content-Type: application/json' \
  -X PATCH "$TWENTY_LOCAL/rest/companies/$COMPANY_ID" -d '{"employees":42}'
sleep 5
docker exec taskbolt-postgres psql -U taskbolt -d taskbolt -tAc \
  "select extract(epoch from updated_at)::int, raw_json->>'employees'
     from crm_companies_cache where twenty_entity_id='$COMPANY_ID';"
```
**Pass:** Row present with `employees=42`, delta ≤ 7s.

---

## Step 6: Outbound sync (5s window)
```bash
TASK_ID=$(curl -fsS -H "Authorization: Bearer $TOKEN" "$TASKBOLT_URL/api/me/tasks?limit=1" | jq -r '.data[0].id')
curl -fsS -X PATCH -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  "$TASKBOLT_URL/api/crm/contacts/$PERSON_ID/phone" -d '{"phone":"+919999000111"}'
sleep 5
curl -fsS -H "Authorization: Bearer $TWENTY_API_KEY" \
  "$TWENTY_LOCAL/rest/people/$PERSON_ID" | jq -r '.data.person.phones.primaryPhoneNumber'
```
**Pass:** Output equals `+919999000111`. Sync log row `success`.

---

## Step 7: Linking (both sides)
```bash
curl -fsS -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  "$TASKBOLT_URL/api/tasks/$TASK_ID/linked-crm-companies" \
  -d "{\"crm_company_id\":\"$COMPANY_ID\"}"
sleep 3
docker exec taskbolt-postgres psql -U taskbolt -d taskbolt -tAc \
  "select task_id, crm_company_id from task_crm_companies
     where task_id='$TASK_ID' and crm_company_id='$COMPANY_ID';"
curl -fsS -H "Authorization: Bearer $TWENTY_API_KEY" \
  "$TWENTY_LOCAL/rest/companies/$COMPANY_ID" \
  | jq -r '.data.company.taskboltTaskIds[]?' | grep -c "$TASK_ID"
```
**Pass:** psql returns one row; grep prints `1`.

---

## Step 8: Tenant isolation (RLS)
```bash
TOKEN_A=$TOKEN
TOKEN_B=$(curl -fsS -X POST "$TASKBOLT_URL/api/auth/sign-in" -H 'Content-Type: application/json' \
  -d '{"email":"tenantb@paraslace.in","password":"<vault>"}' | jq -r '.token')
A_COUNT=$(curl -fsS -H "Authorization: Bearer $TOKEN_A" "$TASKBOLT_URL/api/crm/companies?limit=100" | jq '.data|length')
B_SEES_A=$(curl -fsS -H "Authorization: Bearer $TOKEN_B" "$TASKBOLT_URL/api/crm/companies/$COMPANY_ID" -o /dev/null -w '%{http_code}')
echo "tenantA_count=$A_COUNT tenantB_status=$B_SEES_A"
docker exec taskbolt-postgres psql -U taskbolt -d taskbolt -c \
  "begin; set local app.tenant_id='<tenant_b_uuid>';
   select count(*) from crm_companies_cache where twenty_entity_id='$COMPANY_ID'; rollback;"
docker exec taskbolt-postgres psql -U taskbolt -d taskbolt -tAc \
  "select tenant_id, count(*) from crm_workspace_links where valid_to is null group by 1 having count(*)>1;"
```
**Pass:** A_COUNT≥1, B_SEES_A=404, RLS-scoped count=0, uniqueness query empty.

---

## Step 9: Failure modes (Twenty offline)
```bash
docker compose stop twenty-server twenty-worker
sleep 10
curl -fsS -H "Authorization: Bearer $TOKEN" "$TASKBOLT_URL/api/integrations/twenty/health" | jq '{status, twenty_reachable}'
curl -fsS -o /dev/null -w '%{http_code}\n' "$TASKBOLT_URL/dashboard"
QUEUE_BEFORE=$(docker exec taskbolt-redis redis-cli LLEN twenty:sync:queue)
curl -fsS -X PATCH -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  "$TASKBOLT_URL/api/crm/contacts/$PERSON_ID/phone" -d '{"phone":"+919999000222"}'
QUEUE_AFTER=$(docker exec taskbolt-redis redis-cli LLEN twenty:sync:queue)
docker compose start twenty-server twenty-worker
sleep 20
docker exec taskbolt-redis redis-cli LLEN twenty:sync:queue
```
**Pass:** Dashboard 200; QUEUE_AFTER > QUEUE_BEFORE; post-restart length ≤ QUEUE_BEFORE.

---

## Step 10: AGPL compliance (no source mods)
```bash
cd /home/ankur/projects/twenty-research/twenty
git fetch --tags
git diff --stat
git status --porcelain
grep -E 'image:\s*twenty' /home/ankur/projects/taskflow/docker-compose.yml
```
**Pass:** All git outputs empty; compose `image:` line references upstream tag (no `build:` directive).

---

## Step 11: Auto-update dry-run (Renovate, NOT Watchtower per UC5)
```bash
docker ps --format '{{.Names}}' | grep -i watchtower && echo 'FAIL: watchtower present' || echo 'OK: no watchtower'
grep -i watchtower /home/ankur/projects/taskflow/docker-compose.yml && echo 'FAIL: in compose' || echo 'OK'
test -f /home/ankur/projects/taskflow/renovate.json && jq '{packageRules,extends,schedule}' /home/ankur/projects/taskflow/renovate.json
CURRENT=$(grep -E 'image:\s*twentyhq/twenty:' /home/ankur/projects/taskflow/docker-compose.yml | awk '{print $2}')
docker pull "$CURRENT"
curl -fsS "$TASKBOLT_URL/api/integrations/twenty/health" | jq '.status'
PREV=$(docker images twentycrm/twenty --format '{{.Tag}}' | grep -v latest | sed -n '2p')
[[ -n "$PREV" ]] && echo 'OK: rollback image cached' || echo 'WARN: no prior image'
```
**Pass:** Watchtower absent (container + compose); renovate.json valid; image pinned to minor; prior image cached.

---

## Step 12: Migration ordering
```bash
cd /home/ankur/projects/taskflow
ls backend/crates/db/src/migrations/*.sql | sort > /tmp/mig.sorted
awk -F/ '{print $NF}' /tmp/mig.sorted | cut -c1-14 | sort | uniq -d > /tmp/mig.dups
[[ -s /tmp/mig.dups ]] && { echo "FAIL duplicates:"; cat /tmp/mig.dups; } || echo "OK: no duplicates"
docker exec taskbolt-postgres psql -U postgres -c "DROP DATABASE IF EXISTS taskbolt_migtest;"
docker exec taskbolt-postgres psql -U postgres -c "CREATE DATABASE taskbolt_migtest OWNER taskbolt;"
DATABASE_URL="postgres://taskbolt:taskbolt@127.0.0.1:5432/taskbolt_migtest" \
  sqlx migrate run --source backend/crates/db/src/migrations
docker exec taskbolt-postgres psql -U taskbolt -d taskbolt_migtest -tAc \
  "select count(*) from _sqlx_migrations where success=false;"
docker exec taskbolt-postgres psql -U postgres -c "DROP DATABASE taskbolt_migtest;"
```
**Pass:** No duplicates; sqlx exit 0; failed count = 0.

---

## Step 13: Test plan artifact execution
```bash
TEST_PLAN=/home/ankur/.gstack/projects/Ankurjain1121-taskflow/ankur-master-eng-review-test-plan-20260503-130000.md
test -f "$TEST_PLAN" && echo "OK: plan present"
cd /home/ankur/projects/taskflow/backend
cargo test --workspace --all-features -- --test-threads=4 2>&1 | tee /tmp/cargo-test.log
grep -E '^test result:' /tmp/cargo-test.log | tail
cd /home/ankur/projects/taskflow/frontend
npx ng test --watch=false --browsers=ChromeHeadlessCI --code-coverage
BASE_URL="$TASKBOLT_URL" npx playwright test \
  e2e/crm/sso.spec.ts e2e/crm/link-task-deal.spec.ts e2e/crm/inbound-webhook.spec.ts \
  e2e/crm/disconnect-reconnect.spec.ts --reporter=line
```
**Pass:** Zero failed across cargo + ng + playwright; coverage ≥ 80%.

---

## Run summary template
```
Date (IST): __________   Operator: __________   Commit: __________
Step  1 [ ] Step  2 [ ] Step  3 [ ] Step  4 [ ] Step  5 [ ] Step  6 [ ] Step  7 [ ]
Step  8 [ ] Step  9 [ ] Step 10 [ ] Step 11 [ ] Step 12 [ ] Step 13 [ ]
Blockers: ____________________________________________________________________
Sign-off to flip DNS / promote release: ______________________________________
```
