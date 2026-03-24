---
name: deploy
description: Post-deploy verification skill — validates that new code is live after docker compose up
user_invocable: true
---

# Deploy Verification Skill

Run this after every `docker compose up` or image rebuild to verify the deployment end-to-end.

## Pre-Deploy Checks

1. **TypeScript check**: `cd frontend && npx tsc --noEmit`
2. **Production build**: `cd frontend && npm run build -- --configuration=production`
3. If either fails, STOP and fix before deploying.

## Build & Restart

```bash
cd /home/ankur/projects/taskflow
docker compose build frontend
docker compose up -d frontend
```

Wait for the container to be healthy:
```bash
# Poll until healthy (max 60s)
for i in $(seq 1 12); do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' taskbolt-frontend 2>/dev/null || echo "no-health")
  if [ "$STATUS" = "healthy" ] || [ "$STATUS" = "no-health" ]; then break; fi
  sleep 5
done
docker ps --filter name=taskbolt-frontend --format '{{.Status}}'
```

## Verify Bundle Hash

```bash
# Get the main.js hash from the container
CONTAINER_HASH=$(docker exec taskbolt-frontend ls /usr/share/nginx/html/ 2>/dev/null | grep -o 'main-[A-Za-z0-9]*\.js' || docker exec taskbolt-frontend ls /app/dist/frontend/browser/ 2>/dev/null | grep -o 'main-[A-Za-z0-9]*\.js')
echo "Container bundle: $CONTAINER_HASH"

# Get the main.js hash from the live site
LIVE_HASH=$(curl -s https://taskflow.paraslace.in/ | grep -o 'main-[A-Za-z0-9]*\.js')
echo "Live bundle: $LIVE_HASH"

# Compare
if [ "$CONTAINER_HASH" = "$LIVE_HASH" ]; then
  echo "PASS: Bundle hashes match"
else
  echo "FAIL: Bundle mismatch — container=$CONTAINER_HASH live=$LIVE_HASH"
  echo "Try: sudo systemctl reload nginx"
fi
```

## Verify Service Worker Manifest

```bash
# Check ngsw.json is fresh
curl -s -H 'Cache-Control: no-cache' https://taskflow.paraslace.in/ngsw.json | python3 -m json.tool | head -5
```

## Smoke Test

```bash
# HTTP 200 check
HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' https://taskflow.paraslace.in/)
if [ "$HTTP_CODE" = "200" ]; then
  echo "PASS: Site returns HTTP 200"
else
  echo "FAIL: Site returns HTTP $HTTP_CODE"
fi

# Confirm new hash in HTML
curl -s https://taskflow.paraslace.in/ | grep -o 'main-[A-Za-z0-9]*\.js'
```

## Nginx Reload (if config changed)

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## Checklist

Print this checklist with pass/fail for each:

- [ ] `tsc --noEmit` passes
- [ ] Production build succeeds
- [ ] Docker image built with new content (not cached)
- [ ] Container recreated and healthy
- [ ] `main-*.js` hash in container matches hash served by live site
- [ ] `ngsw.json` in container has current timestamp
- [ ] Site returns HTTP 200
- [ ] Nginx reloaded if config changed

## Cache Bust for Existing Users

After deploy, existing users with stale service worker caches will get the new version via `SwUpdateService` which:
- Checks for updates every 5 minutes
- Shows a toast notification when a new version is ready
- Reloads the page on user click

If users report stale content, they can hard-refresh (Ctrl+Shift+R) or clear site data in DevTools.
