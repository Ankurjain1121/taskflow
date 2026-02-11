# Task #23: Final Testing, Documentation & VPS Deployment Checklist

## Phase 1: Feature Testing ✓

### A. Eisenhower Matrix (Task #18)
- [ ] Navigate to `/eisenhower` route
- [ ] Verify 2×2 grid renders with 4 quadrants
- [ ] Check task auto-assignment based on priority + due date
- [ ] Test drag-and-drop between quadrants
- [ ] Verify manual override saves correctly
- [ ] Check coaching text displays per quadrant
- [ ] Test quick actions (Delegate: reassign, Eliminate: archive)

### B. My Work Timeline (Task #19)
- [ ] Navigate to `/my-tasks` route
- [ ] Verify 7 timeline groups render correctly:
  - Overdue (red)
  - Today (blue)
  - This Week (green)
  - Next Week (purple)
  - Later (gray)
  - No Due Date (gray)
  - Completed Today (green)
- [ ] Check welcome banner with personalized greeting
- [ ] Test view mode toggle: "My Tasks" vs "Tasks I Created"
- [ ] Verify task counts in each group
- [ ] Test collapsible groups (default states)
- [ ] Check task completion detection via column_status_mapping

### C. Dashboard Widgets (Task #22)
- [ ] Navigate to `/dashboard` route
- [ ] Verify all 9 widgets render:
  - 4 summary cards (Total Tasks, Overdue, Due Today, Completed This Week)
  - Tasks by Status (donut chart with legend)
  - Tasks by Priority (horizontal bars)
  - Overdue Tasks Table (sortable, clickable)
  - Completion Trend (line chart with 30/60/90 toggle)
  - Upcoming Deadlines (timeline list)
- [ ] Check widget loading states (spinners)
- [ ] Check empty states with helpful messages
- [ ] Test responsive grid (2-column on lg screens)
- [ ] Verify all API calls return correct data
- [ ] Test navigation from widgets (e.g., click overdue task → board view)

### D. Existing Features Smoke Test
- [ ] Auth: Sign in/Sign up/Sign out
- [ ] Workspaces: Create, list, navigate
- [ ] Boards: Create, list, view
- [ ] Tasks: Create, edit, move, delete
- [ ] Subtasks: Create, complete, track progress
- [ ] Task Groups: Create, collapse, reorder
- [ ] Dependencies: Create, verify blocking
- [ ] Labels: Create, apply, filter
- [ ] Calendar view: Display tasks, drag to reschedule
- [ ] Gantt view: Display timeline, dependencies
- [ ] Time tracking: Log hours, view totals
- [ ] Custom fields: Configure, apply, display
- [ ] Comments: Add, @mention, attach files
- [ ] Search: Find tasks across boards
- [ ] WebSocket: Real-time updates (multi-user)

---

## Phase 2: Backend Verification ✓

### A. New API Endpoints
```bash
# Test Eisenhower Matrix endpoints
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/eisenhower
curl -X PUT -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/eisenhower/tasks/{id} -d '{"urgency":true,"importance":false}'
curl -X PUT -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/eisenhower/reset

# Test Dashboard widget endpoints
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/dashboard/tasks-by-status
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/dashboard/tasks-by-priority
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/dashboard/overdue-tasks?limit=10"
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/dashboard/completion-trend?days=30"
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/dashboard/upcoming-deadlines?days=14"
```

### B. Database Migrations
- [ ] Verify Eisenhower columns exist: `eisenhower_urgency`, `eisenhower_importance`
- [ ] Check indexes: `idx_tasks_eisenhower`
- [ ] Verify all existing migrations applied successfully

---

## Phase 3: Documentation Updates ✓

### A. README.md
- [ ] Update feature list with new additions:
  - Eisenhower Matrix View
  - Enhanced My Work Timeline (7 groups)
  - Enhanced Dashboard (9 widgets)
- [ ] Update screenshots (if applicable)
- [ ] Verify installation instructions are current
- [ ] Check technology stack section

### B. FEATURE_VERIFICATION_REPORT.md
- [ ] Mark Eisenhower Matrix as ✅ IMPLEMENTED
- [ ] Mark My Work Timeline as ✅ IMPLEMENTED
- [ ] Mark Dashboard Widgets as ✅ IMPLEMENTED
- [ ] Update summary statistics

### C. API Documentation (if exists)
- [ ] Document new Eisenhower endpoints
- [ ] Document new Dashboard widget endpoints
- [ ] Update Postman collection (if applicable)

---

## Phase 4: Build & Bundle Optimization ✓

### A. Frontend Build
```bash
cd frontend
npm run build
# Expected: ✅ Success with warnings (bundle size 543KB)
# Acceptable: Budget exceeded by 43KB (per project memory)
```

### B. Backend Build (Docker)
```bash
cd backend
docker compose build --no-cache
# Expected: ✅ Success with Rust 1.93
```

### C. Linting & Type Checking
```bash
# Frontend
cd frontend
npm run lint
ng build --configuration production

# Backend
cd backend
cargo clippy --all-targets --all-features
cargo fmt --check
```

---

## Phase 5: VPS Deployment 🚀

### A. Pre-Deployment Checklist
- [ ] Commit all changes to git
- [ ] Tag release: `git tag -a v1.0.0 -m "Release: Eisenhower, Timeline, Dashboard"`
- [ ] Push to remote: `git push origin master && git push --tags`
- [ ] Verify VPS has Docker & Docker Compose installed
- [ ] Backup VPS database before deployment

### B. VPS Deployment Steps

**VPS Details:**
- Host: `vps-ankur` (SSH alias)
- Path: `/root/taskflow`
- Domain: `taskflow.paraslace.in`
- Required commit: `6145591` (Rust 1.93 Dockerfile)

**Commands:**
```bash
# 1. SSH into VPS
ssh vps-ankur

# 2. Navigate to project
cd /root/taskflow

# 3. Backup database (IMPORTANT!)
docker compose exec postgres pg_dump -U taskflow taskflow > backup_$(date +%Y%m%d_%H%M%S).sql

# 4. Pull latest code
git fetch origin
git reset --hard origin/master  # Force sync with remote

# 5. Verify Dockerfile has Rust 1.93
head -10 backend/Dockerfile
# Expected: FROM rust:1.93-slim

# 6. Run database migrations
docker compose run --rm backend-migration

# 7. Rebuild containers
docker compose build --no-cache

# 8. Restart services
docker compose down
docker compose up -d

# 9. Verify services are running
docker compose ps
docker compose logs -f --tail=100

# 10. Health check
curl http://localhost:3000/health
curl http://localhost:4200/
```

### C. Post-Deployment Verification
- [ ] Visit `https://taskflow.paraslace.in`
- [ ] Verify frontend loads correctly
- [ ] Test login functionality
- [ ] Navigate to Dashboard → verify widgets load
- [ ] Navigate to My Tasks → verify timeline groups load
- [ ] Navigate to Eisenhower Matrix → verify grid loads
- [ ] Create test task → verify WebSocket updates
- [ ] Check browser console for errors
- [ ] Check backend logs: `docker compose logs backend -f`
- [ ] Check database connection: `docker compose exec postgres psql -U taskflow -d taskflow -c "SELECT COUNT(*) FROM tasks;"`

### D. Rollback Plan (If Issues)
```bash
# If deployment fails, rollback to previous commit
cd /root/taskflow
git reset --hard <PREVIOUS_COMMIT_HASH>
docker compose down
docker compose up -d

# Restore database backup if needed
docker compose exec -T postgres psql -U taskflow taskflow < backup_YYYYMMDD_HHMMSS.sql
```

---

## Phase 6: Performance & Security Audit ✓

### A. Performance
- [ ] Lighthouse audit (Performance, Accessibility, Best Practices, SEO)
- [ ] Check bundle sizes (frontend dist folder)
- [ ] Verify lazy loading works (dashboard, board-view, etc.)
- [ ] Test real-time WebSocket performance (multi-user scenario)

### B. Security
- [ ] Verify authentication on all protected routes
- [ ] Check CORS configuration
- [ ] Verify SQL injection protection (parameterized queries)
- [ ] Check XSS protection (Angular sanitization)
- [ ] Verify HTTPS redirect
- [ ] Check secrets not exposed in frontend bundle

---

## Success Criteria ✅

### Minimum Requirements
- ✅ All 3 new features (Eisenhower, Timeline, Dashboard) working in production
- ✅ No critical errors in browser console
- ✅ No critical errors in backend logs
- ✅ All existing features remain functional (smoke test passed)
- ✅ VPS deployment successful with services running
- ✅ Documentation updated

### Nice-to-Have
- 🎯 Lighthouse Performance score > 80
- 🎯 Bundle size < 600KB
- 🎯 API response times < 200ms
- 🎯 WebSocket latency < 500ms

---

## Timeline Estimate
- Phase 1: Feature Testing → **30 minutes**
- Phase 2: Backend Verification → **15 minutes**
- Phase 3: Documentation Updates → **20 minutes**
- Phase 4: Build & Bundle → **10 minutes**
- Phase 5: VPS Deployment → **30 minutes**
- Phase 6: Performance & Security → **20 minutes**

**Total: ~2 hours**

---

## Current Status
- [x] Checklist created
- [ ] Phase 1: Feature Testing
- [ ] Phase 2: Backend Verification
- [ ] Phase 3: Documentation Updates
- [ ] Phase 4: Build & Bundle
- [ ] Phase 5: VPS Deployment
- [ ] Phase 6: Performance & Security
