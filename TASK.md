# WhatsApp Notification Service

## Objective
Wire existing WhatsApp infrastructure (WAHA + WahaClient) into the notification dispatcher so users get WhatsApp notifications on task events + daily/weekly morning reports.

## Key Decisions
- WAHA session: `tenant-ed0e2bd5-0ee1-4eca-838e-c854d38e4426-1` (Ankur's number: 918750269626)
- Daily report: 8 AM IST (02:30 UTC) hardcoded
- No phone OTP verification (dev stage) — tracked as TODO-014
- NotifyContext struct replaces 10+ positional args in notify()
- Shared WahaClient in AppState (not per-call instantiation)
- Quiet hours enforced for WhatsApp channel only

## Implementation Plan

### Phase 1: Backend Infrastructure
- [x] 1. Migration: `notification_deliveries` table
- [x] 2. Add `waha_session_name` to Config + WahaClient to AppState
- [x] 3. Refactor `notify()` to use `NotifyContext` struct
- [x] 4. Update `comments.rs` call sites to use NotifyContext
- [x] 5. Migrate `task_collaboration.rs` to use `dispatcher::notify()`
- [x] 6. Migrate `task_movement.rs` to use `dispatcher::notify()`

### Phase 2: WhatsApp Wiring
- [x] 7. Add WhatsApp section to dispatcher (pref check -> quiet hrs -> phone -> send -> log)
- [x] 8. Add `notification_deliveries` query module
- [x] 9. Add `get_quiet_hours()` + `is_in_quiet_hours()` query functions
- [x] 10. Task summary queries in whatsapp_digest.rs (batch CTE)

### Phase 3: Digest Jobs
- [x] 11. Create `whatsapp_digest.rs` (daily + weekly)
- [x] 12. Spawn digest jobs in `jobs.rs` (daily at 02:30 UTC, weekly 7d interval)

### Phase 4: Frontend
- [x] 13. Enable WhatsApp toggles in notification settings (phone-gated)
- [x] 14. Phone number input in profile section (already existed, added init fix + helper text)

### Phase 5: Deploy
- [x] 15. Set WAHA env vars in docker-compose.yml
- [x] 16. Add TODO-014 to TODOS.md
- [x] 17. Regenerate SQLx cache
- [ ] 18. Release build + deploy (building...)

## Success Criteria
- [ ] Assigning a task sends WhatsApp notification to assignee (if WA enabled + phone set)
- [ ] Daily report arrives at ~8 AM IST with tasks due today, pending, overdue counts
- [ ] Weekly summary arrives with week's stats
- [ ] Quiet hours respected (no WA during quiet hours)
- [ ] Delivery logged in notification_deliveries table
- [ ] Frontend toggles work (enabled when phone set, disabled when not)
- [ ] WAHA_ENABLED=false kills all WA sends instantly

## Progress Log
- 2026-03-23: Plan reviewed (CEO + Eng), implementation started
- 2026-03-23: All backend code complete — cargo check clean, clippy clean (api+services)
- 2026-03-23: Frontend tsc + production build clean
- 2026-03-23: SQLx cache regenerated
- 2026-03-23: Release build in progress
