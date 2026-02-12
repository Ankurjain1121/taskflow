# TaskFlow - Future Implementation TODO List

Based on ProjectPulse spec gap analysis. Last updated: 2026-02-13

---

## 🔴 PHASE 1: CRITICAL GAPS (4-5 weeks)

### 1. Task Groups Integration (2-3 hours) ⚠️ 90% COMPLETE
**Status**: Backend + Components complete, needs board-view integration

- [ ] Integrate TaskGroupService into board-view.component.ts
- [ ] Load groups with stats on board initialization
- [ ] Add "Create Group" button in board toolbar
- [ ] Group tasks by `group_id` in Kanban rendering
- [ ] Render `<app-task-group-header>` above each group's tasks
- [ ] Wire up event handlers:
  - [ ] Name change → update API
  - [ ] Color change → update API
  - [ ] Toggle collapse → update API + hide/show tasks
  - [ ] Delete → confirm + API call + refresh
- [ ] Update drag-drop to support moving tasks between groups
- [ ] Update CreateTaskDialog to include group_id selector
- [ ] Add "Move to Group" bulk action
- [ ] Test with Docker build (backend must compile in Docker on Windows)
- [ ] Run database migration on VPS

**Files to Modify**:
- `frontend/src/app/features/board/board-view/board-view.component.ts`
- `frontend/src/app/features/board/create-task-dialog.component.ts`
- `frontend/src/app/features/board/bulk-actions/bulk-actions-bar.component.ts`

---

### 2. WhatsApp Integration (1-2 weeks) 🎯 KILLER FEATURE
**Status**: Not started - THE differentiator mentioned 50+ times in spec

#### Research Phase (1-2 days)
- [ ] Research WhatsApp Business API options:
  - [ ] DoubleTick API pricing and features
  - [ ] Meta Business API requirements and costs
  - [ ] Self-hosted WAHA (WhatsApp HTTP API) option
  - [ ] Compare rate limits and reliability
- [ ] Choose provider based on cost and features
- [ ] Create test WhatsApp Business account
- [ ] Get API credentials

#### Backend Implementation (Week 1)
- [ ] Database migrations:
  - [ ] `whatsapp_connections` table (user_id, phone, verified, active)
  - [ ] `whatsapp_preferences` table (daily summary time, alert settings, quiet hours)
  - [ ] `whatsapp_messages` table (user_id, direction, type, content, status, task_id)
- [ ] Create models in `backend/crates/db/src/models/whatsapp.rs`
- [ ] Create queries in `backend/crates/db/src/queries/whatsapp.rs`:
  - [ ] Connection management (create, verify OTP, update status)
  - [ ] Preferences CRUD
  - [ ] Message history
- [ ] Create routes in `backend/crates/api/src/routes/whatsapp.rs`:
  - [ ] POST `/api/whatsapp/connect` - Phone + OTP verification
  - [ ] GET `/api/whatsapp/status` - Connection status
  - [ ] PUT `/api/whatsapp/preferences` - Update settings
  - [ ] POST `/api/whatsapp/send-message` - Manual send
  - [ ] POST `/api/whatsapp/webhook` - Incoming messages
  - [ ] GET `/api/whatsapp/messages` - Message history
- [ ] Implement WhatsApp service in `backend/crates/services/src/whatsapp/`:
  - [ ] `mod.rs` - Main service struct
  - [ ] `client.rs` - API client wrapper
  - [ ] `messages.rs` - Message templates
  - [ ] `parser.rs` - Reply command parser ("done", "extend 2", "status")
  - [ ] `scheduler.rs` - Cron job integration
- [ ] Message types to implement:
  - [ ] Daily standup summary (tasks due today, overdue, completed yesterday)
  - [ ] Task assignment alerts
  - [ ] Due date reminders (configurable: 1 day, 2 hours, etc.)
  - [ ] Overdue alerts
  - [ ] Weekly project summary
  - [ ] Status change notifications (optional)
- [ ] Reply command handlers:
  - [ ] "done" → mark task complete
  - [ ] "extend [N]" → reschedule due date by N days
  - [ ] "status" → get task details
  - [ ] "today" → list today's tasks
  - [ ] "help" → show available commands
- [ ] Cron jobs in `backend/crates/api/src/routes/cron.rs`:
  - [ ] Daily summary job (respects user time preference)
  - [ ] Reminder check job (runs every hour)
  - [ ] Weekly summary job (runs on configured day)
- [ ] Respect quiet hours (pause notifications)

#### Frontend Implementation (Week 2)
- [ ] Create WhatsApp service: `frontend/src/app/core/services/whatsapp.service.ts`
- [ ] Create WhatsApp settings page: `frontend/src/app/features/whatsapp/`
  - [ ] `whatsapp-settings.component.ts` - Main settings page
  - [ ] `phone-verification-dialog.component.ts` - OTP flow
  - [ ] Connection status indicator (connected/disconnected)
  - [ ] Phone number display with verify/disconnect buttons
- [ ] Preference controls:
  - [ ] Toggle: Daily summary enabled
  - [ ] Time picker: Daily summary time (default 09:00)
  - [ ] Toggle: Assignment alerts
  - [ ] Toggle: Due reminders
  - [ ] Dropdown: Reminder timing (1 day before, 2 hours before, etc.)
  - [ ] Toggle: Overdue alerts
  - [ ] Toggle: Status change notifications
  - [ ] Toggle: Weekly summary
  - [ ] Dropdown: Weekly summary day (Monday-Sunday)
  - [ ] Time range: Quiet hours start/end
  - [ ] Pause notifications button (temporary disable)
- [ ] Message history component:
  - [ ] List view of sent/received messages
  - [ ] Filter by type (summary, alert, reply)
  - [ ] Message status indicators (sent, delivered, read)
  - [ ] Link to related tasks
- [ ] Test message button (send sample message)
- [ ] Add WhatsApp icon/badge in notifications dropdown
- [ ] Update `/whatsapp` route in app-routing

#### Testing & Polish
- [ ] End-to-end testing:
  - [ ] Phone verification flow
  - [ ] Daily summary delivery
  - [ ] Task assignment alert
  - [ ] Due date reminder
  - [ ] Reply command processing
  - [ ] Quiet hours respected
- [ ] Error handling:
  - [ ] Invalid phone number
  - [ ] OTP verification failure
  - [ ] Message send failure
  - [ ] API rate limiting
- [ ] Documentation:
  - [ ] User guide for WhatsApp setup
  - [ ] Available commands reference
  - [ ] Troubleshooting guide

**Files to Create**:
- Backend: 10+ files (migrations, models, queries, routes, services)
- Frontend: 5+ files (service, components, dialogs)

---

### 3. Missing Navigation Routes (2-3 days)
**Status**: Sidebar items exist, pages 404

#### /favorites Page (1 day)
- [ ] Create `frontend/src/app/features/favorites/favorites.component.ts`
- [ ] Backend: Add `favorites` table (user_id, entity_type, entity_id)
- [ ] Backend: Create routes for starring/unstarring items
- [ ] Frontend: List starred tasks, boards, workspaces
- [ ] Add star button to task cards, board headers
- [ ] Filter by entity type (tasks/boards/workspaces)
- [ ] Sort options (date starred, name, priority)

#### /archive Page (1 day)
- [ ] Create `frontend/src/app/features/archive/archive.component.ts`
- [ ] Query items with `deleted_at IS NOT NULL`
- [ ] Display archived workspaces, boards, tasks
- [ ] Filter by entity type and date archived
- [ ] Restore button (set deleted_at to NULL)
- [ ] Permanent delete button (with confirmation)
- [ ] Auto-cleanup after 30 days option

#### /team Page (0.5 day)
- [ ] Create `frontend/src/app/features/team/team.component.ts`
- [ ] Extract team management from workspace settings
- [ ] Show all team members across workspaces
- [ ] Workload visualization (tasks assigned per person)
- [ ] Activity feed per team member
- [ ] Invite new members globally
- [ ] Role management

#### /help Page (0.5 day)
- [ ] Create `frontend/src/app/features/help/help.component.ts`
- [ ] Documentation sections:
  - [ ] Getting Started guide
  - [ ] Feature tutorials
  - [ ] Keyboard shortcuts reference (from KeyboardShortcutsService)
  - [ ] WhatsApp commands reference
  - [ ] FAQ section
- [ ] Feedback form (send to admin email or save to DB)
- [ ] Version information
- [ ] Contact support link

**Files to Create**:
- `frontend/src/app/features/favorites/favorites.component.ts`
- `frontend/src/app/features/archive/archive.component.ts`
- `frontend/src/app/features/team/team.component.ts`
- `frontend/src/app/features/help/help.component.ts`
- Backend favorites routes/queries (if not exist)
- Update app-routing.module.ts

---

### 4. Freemium Feature Gating (2-3 days)
**Status**: Backend subscriptions table exists, frontend enforcement missing

#### Backend Verification
- [ ] Audit existing subscription checks in backend
- [ ] Add missing checks for:
  - [ ] Project creation (limit: 3 for free)
  - [ ] Task creation per project (limit: 50 for free)
  - [ ] Team member invites (limit: 3 members + unlimited viewers)
  - [ ] File storage (limit: 500MB for free)
  - [ ] WhatsApp connections (limit: 1 user for free)
  - [ ] Custom fields (blocked for free)
  - [ ] Dependencies (blocked for free)
  - [ ] Time tracking (blocked for free)
  - [ ] Export (blocked for free)

#### Frontend Implementation
- [ ] Create `frontend/src/app/core/guards/feature-gate.guard.ts`
- [ ] Create `frontend/src/app/core/services/subscription.service.ts`
- [ ] Create upgrade prompt dialog: `upgrade-prompt-dialog.component.ts`
- [ ] Add usage tracking to AuthService:
  - [ ] Current project count
  - [ ] Tasks per project
  - [ ] Storage used
  - [ ] Team member count
- [ ] Gate features in UI:
  - [ ] Calendar view - Show "Pro only" overlay
  - [ ] Gantt view - Show "Pro only" overlay
  - [ ] Custom fields - Show upgrade prompt on click
  - [ ] Dependencies - Show upgrade prompt on add
  - [ ] Time tracking - Show upgrade prompt
  - [ ] Export buttons - Show upgrade prompt
  - [ ] Limit project creation at 3
  - [ ] Limit task creation at 50/project
  - [ ] Limit team invites at 3 members
- [ ] Add plan indicator in UI:
  - [ ] Badge in sidebar (Free/Pro)
  - [ ] Usage meters (projects: 2/3, tasks: 45/50)
  - [ ] Storage meter (250MB / 500MB)
- [ ] Upgrade flow:
  - [ ] Link to billing page (create billing component)
  - [ ] Show pricing comparison table
  - [ ] Stripe integration for payments (if monetizing)

**Files to Create**:
- `frontend/src/app/core/guards/feature-gate.guard.ts`
- `frontend/src/app/core/services/subscription.service.ts`
- `frontend/src/app/shared/components/upgrade-prompt-dialog.component.ts`
- `frontend/src/app/features/billing/billing.component.ts` (optional)

---

## ⚠️ PHASE 2: POLISH & VERIFICATION (1 week)

### 5. Onboarding Flow Audit (1 day)
**Status**: Component exists, needs verification against spec

- [ ] Read `frontend/src/app/features/onboarding/onboarding.component.ts`
- [ ] Verify 4-screen flow:
  - [ ] Screen 1: Signup (Email/Password or Google OAuth) ✓
  - [ ] Screen 2: About You (Name, Team Name, Team Size, **What will you manage?** multi-select)
  - [ ] Screen 3: Invite Team (Email inputs or skip)
  - [ ] Screen 4: First Project (Auto-created with sample tasks)
- [ ] Check for "What will you manage?" field:
  - [ ] Options: Software Dev, Marketing, Sales, Operations, HR, Other
  - [ ] Multi-select capability
  - [ ] Used to customize initial project template
- [ ] Verify sample project creation:
  - [ ] Creates board with columns (To Do, In Progress, Done)
  - [ ] Adds 3-5 sample tasks
  - [ ] Shows tooltip tour after creation
- [ ] Test tooltip tour (highlight key features)
- [ ] Verify WhatsApp setup modal appears (optional, after tour)
- [ ] Polish UI/UX if needed

---

### 6. Dashboard & My Work Audit (1-2 days)
**Status**: Components exist, need spec compliance check

#### Dashboard Audit
- [ ] Read `frontend/src/app/features/dashboard/dashboard.component.ts`
- [ ] Verify widgets exist:
  - [ ] Personalized greeting ✓
  - [ ] Recent activity feed ✓
  - [ ] Overdue items count (red badge) ✓
  - [ ] Today's tasks ✓
  - [ ] Quick-create button
  - [ ] My Overdue Tasks widget
  - [ ] Recent Activity widget
  - [ ] Team Activity widget
  - [ ] Project Progress bars (per board)
- [ ] Add missing widgets
- [ ] Verify data refresh on page load
- [ ] Check responsive design

#### My Work Audit
- [ ] Read `frontend/src/app/features/my-tasks/my-tasks.component.ts`
- [ ] Verify timeline view sections:
  - [ ] Overdue (red)
  - [ ] Today (blue)
  - [ ] This Week
  - [ ] Next Week
  - [ ] Later / No Due Date
- [ ] Verify filters work:
  - [ ] By project
  - [ ] By priority
  - [ ] By status (column)
  - [ ] By tag/label
  - [ ] Has subtasks
- [ ] Verify inline actions:
  - [ ] Checkbox to complete
  - [ ] Date picker to reschedule
  - [ ] Priority dropdown
- [ ] Verify grouping options:
  - [ ] By time (default)
  - [ ] By project
  - [ ] By priority
  - [ ] By status
- [ ] Verify "Tasks I Created" toggle exists
- [ ] Check Eisenhower Matrix integration ✓

---

### 7. Mobile PWA Support (2-3 days)
**Status**: Not started

#### Setup
- [ ] Install @angular/pwa: `ng add @angular/pwa`
- [ ] Verify generated files:
  - [ ] `manifest.webmanifest`
  - [ ] `ngsw-config.json`
  - [ ] Service worker registration
- [ ] Configure manifest.webmanifest:
  - [ ] App name: "TaskFlow"
  - [ ] Short name: "TaskFlow"
  - [ ] Theme color: #6366f1 (indigo)
  - [ ] Background color: #ffffff
  - [ ] Display: standalone
  - [ ] Icons: 192x192, 512x512
  - [ ] Start URL: /
- [ ] Configure service worker caching:
  - [ ] Cache static assets
  - [ ] Cache API responses (read-only)
  - [ ] Fresh network-first strategy for mutations

#### Mobile Optimizations
- [ ] Add bottom tab navigation for mobile:
  - [ ] Home
  - [ ] My Tasks
  - [ ] Dashboard
  - [ ] Notifications
  - [ ] More (menu)
- [ ] Implement swipe gestures on task cards:
  - [ ] Swipe right: Mark complete
  - [ ] Swipe left: Snooze/reschedule
- [ ] Add pull-to-refresh on list views
- [ ] Camera integration for attachments:
  - [ ] Use `<input type="file" accept="image/*" capture="environment">`
  - [ ] Preview before upload
- [ ] Voice-to-text for task creation:
  - [ ] Web Speech API (if supported)
  - [ ] Fallback to text input
- [ ] Haptic feedback on actions (if supported)
- [ ] Test installability on:
  - [ ] iOS (Safari)
  - [ ] Android (Chrome)

#### Offline Mode
- [ ] Cache last viewed board
- [ ] Show offline indicator
- [ ] Queue mutations when offline
- [ ] Sync when back online
- [ ] Handle conflicts (server wins)

**Files to Create/Modify**:
- `manifest.webmanifest`
- `ngsw-config.json`
- `frontend/src/app/shared/components/mobile-nav-bar.component.ts`
- Service worker configuration

---

## 🟢 PHASE 3: NICE-TO-HAVE (1 week)

### 8. API Documentation (1 day)
**Status**: Backend exists, needs OpenAPI spec

- [ ] Install Rust OpenAPI tools (e.g., `utoipa`)
- [ ] Add OpenAPI annotations to routes:
  - [ ] #[utoipa::path] macros
  - [ ] Request/response schemas
  - [ ] Authentication requirements
  - [ ] Example requests/responses
- [ ] Generate OpenAPI JSON spec
- [ ] Host Swagger UI or Redoc:
  - [ ] Serve at `/api/docs`
  - [ ] Interactive API explorer
- [ ] Add API documentation sections:
  - [ ] Getting Started
  - [ ] Authentication (JWT cookies)
  - [ ] Rate limiting
  - [ ] Error codes
  - [ ] Webhooks guide
  - [ ] Code examples (curl, JS, Python)
- [ ] Generate SDK clients (optional):
  - [ ] TypeScript client
  - [ ] Python client
  - [ ] Go client

**Files to Create**:
- OpenAPI spec generation code
- Swagger UI hosting route
- API documentation markdown files

---

### 9. Additional Polish
**Status**: Optional enhancements

#### Performance Optimizations
- [ ] Add Redis caching for frequent queries
- [ ] Optimize database queries (add missing indexes)
- [ ] Enable gzip compression
- [ ] Add CDN for static assets
- [ ] Lazy load non-critical components
- [ ] Reduce frontend bundle size

#### Testing
- [ ] Backend unit tests (cargo test)
- [ ] Backend integration tests
- [ ] Frontend unit tests (Jasmine/Karma)
- [ ] E2E tests (Playwright) for critical flows:
  - [ ] Sign up and onboarding
  - [ ] Create board and tasks
  - [ ] Task drag-drop
  - [ ] WhatsApp setup
  - [ ] Team collaboration
- [ ] Load testing (artillery or k6)

#### Security Hardening
- [ ] Run security audit: npm audit, cargo audit
- [ ] Add rate limiting to all endpoints
- [ ] Implement CSRF tokens
- [ ] Add Content Security Policy headers
- [ ] Enable HTTPS only
- [ ] Add security headers (X-Frame-Options, etc.)
- [ ] Audit for OWASP Top 10

#### Monitoring & Observability
- [ ] Add application logging (structured logs)
- [ ] Add error tracking (Sentry)
- [ ] Add analytics (PostHog or Plausible)
- [ ] Add uptime monitoring (UptimeRobot)
- [ ] Create health dashboard

---

## 🚀 DEPLOYMENT CHECKLIST

### VPS Deployment
- [ ] Pull latest code on VPS: `cd /root/taskflow && git pull`
- [ ] Run database migrations: `docker compose exec backend sqlx migrate run`
- [ ] Rebuild containers: `docker compose build --no-cache`
- [ ] Restart services: `docker compose up -d`
- [ ] Verify health: `curl https://taskflow.paraslace.in/api/health`
- [ ] Check logs: `docker compose logs -f backend`
- [ ] Test frontend: Visit https://taskflow.paraslace.in
- [ ] Test task groups feature
- [ ] Monitor for errors

### Database Backup
- [ ] Set up automated PostgreSQL backups
- [ ] Test restore procedure
- [ ] Document backup schedule

---

## 📊 PRIORITY SUMMARY

| Priority | Task | Effort | Impact | Status |
|----------|------|--------|--------|--------|
| 🔴 CRITICAL | Task Groups Integration | 2-3 hours | High | 90% Done |
| 🔴 CRITICAL | WhatsApp Integration | 1-2 weeks | **CRITICAL** | Not Started |
| 🔴 CRITICAL | Missing Routes | 2-3 days | Medium | Not Started |
| 🔴 CRITICAL | Freemium Gating | 2-3 days | High | Not Started |
| ⚠️ MEDIUM | Onboarding Audit | 1 day | Medium | Needs Check |
| ⚠️ MEDIUM | Dashboard Audit | 1-2 days | Medium | Needs Check |
| ⚠️ MEDIUM | PWA Support | 2-3 days | Medium | Not Started |
| 🟢 LOW | API Docs | 1 day | Low | Not Started |
| 🟢 LOW | Polish | Ongoing | Low | Not Started |

**Total Estimated Effort**: 6-7 weeks for full ProjectPulse spec compliance

---

## 🎯 RECOMMENDED NEXT STEPS

1. **Complete Task Groups** (2-3 hours) - Finish what's started
2. **WhatsApp Integration** (1-2 weeks) - THE differentiator
3. **Missing Routes** (2-3 days) - Quick wins
4. **Freemium Gating** (2-3 days) - Business model
5. **Audits & PWA** (1 week) - Polish

After Phase 1-2, TaskFlow will be 100% spec-compliant and ready for users.

---

*Last Updated: 2026-02-13*
*Based on: ProjectPulse Spec Gap Analysis*
