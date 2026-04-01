# Deep Scan Fix List

## Objective
Fix all issues found by the deep scan (2026-04-01). Priority order by user impact.

## Completed (2026-04-01, commits 8a118b3, 7d2883e)
- [x] 1. Fix unprotected subscriptions — 8 workspace components, 27 subs protected with takeUntilDestroyed. 7 dashboard/task-detail files reviewed and confirmed safe (HTTP auto-complete).
- [x] 3. Replace hardcoded colors — 11 edits across 9 files. #22c55e→var(--success), rgba→color-mix, white→var(--primary-foreground).
- [x] 4. Add LIMIT 500 to list_all_invitations() query.
- [x] Unused WahaClient import removed from phone_otp.rs.

## Remaining Tasks

### ~~HIGH — Task 2: Fix Clippy Raw String Hashes (426 instances)~~ DONE
Fixed all 426 `r#"..."#` → `r"..."` across 57 query files. Build passes, zero hash warnings remain. ~36 non-hash clippy errors remain (Task 7+).

### MEDIUM — Task 5: Add aria-label to Icon-Only Buttons (20+ instances)
**What:** Buttons with only an `<i class="pi pi-*">` icon and no text label are missing `aria-label` for screen readers.
**Where:** Scattered across feature components. Key files:
- `features/task-detail/task-detail-sidebar.component.ts` — reminder buttons, action buttons
- `features/settings/task-templates/task-templates.component.ts` — edit/delete buttons
- `features/manage/manage.component.ts` — invite button
- `features/dashboard/components/focus-task-card.component.ts` — done/snooze buttons (have `title` but not `aria-label`)
- `features/project/` — various action buttons
**How:**
1. Grep for `<button` followed by `<i class="pi` without `aria-label` in between
2. Add `aria-label="descriptive action"` to each button
3. Where `pTooltip="X"` or `title="X"` exists, use same text for `aria-label`
4. Verify with `npx tsc --noEmit`
**Estimated:** ~15 min with agent

### MEDIUM — Task 6: Investigate Frontend Bundle Size (1.24 MB vs 800 KB budget)
**What:** Production build reports bundle 1.24 MB, exceeding the 800 KB angular.json budget by 55%.
**Where:** `frontend/angular.json` budget config, `frontend/src/app/app.routes.ts` lazy loading
**How:**
1. Run `npx ng build --configuration=production --stats-json` to get bundle analysis
2. Run `npx webpack-bundle-analyzer dist/frontend/stats.json` or `source-map-explorer`
3. Identify largest chunks — likely PrimeNG, Chart.js, or non-lazy-loaded feature modules
4. Options: increase budget (if justified), add more lazy loading, tree-shake PrimeNG imports
5. Check if all feature modules use `loadComponent` (lazy) in app.routes.ts
**Estimated:** ~20 min investigation, fix depends on findings
**Risk:** Medium — may require architectural changes

### MEDIUM — Task 7: Fix Type Casting Wraparound (9 instances)
**What:** Clippy warns about `usize as i32` and `u64 as i64` casts that could wrap on large values.
**Where:** `backend/crates/db/src/queries/*.rs`
**How:**
1. Find all: `cargo clippy 2>&1 | grep "casting.*may wrap"`
2. Replace `x as i32` with `i32::try_from(x).unwrap_or(i32::MAX)` or use `.min(i32::MAX as usize) as i32`
3. For pagination counts, clamp to reasonable max (e.g., 10_000)
**Estimated:** ~10 min

### LOW — Task 8: Remove TODO in sample_board.rs
**What:** `sample_board.rs:45` has `// TODO: Rewrite for new schema (project_statuses, task_lists, status_id).`
**Where:** `backend/crates/services/src/sample_board.rs`
**How:** Either implement the rewrite or convert to a tracked issue and remove the TODO
**Estimated:** ~30 min if rewriting, 2 min if just converting to issue

### LOW — Task 9: Fix Empty CSS Sub-Selector Warnings (112 rules)
**What:** Production build shows 112 `& -> Empty sub-selector` warnings from CSS.
**Where:** `frontend/src/styles.css` and component CSS files
**How:**
1. Search for bare `&` selectors in CSS/SCSS that don't have a suffix
2. These are typically from Tailwind's `@apply` or nesting syntax issues
3. Remove or fix the empty selectors
**Estimated:** ~15 min

## Session Summary (2026-04-01)

### This session accomplished:
1. **WhatsApp OTP phone verification** — full feature (37 files, deployed)
2. **491 new unit tests** across 23 spec files (discover, inbox, people, my-work, portfolio, automations-hub, task-templates, workspace×6, manage×2)
3. **Slack webhook TODOs fixed** in task_collaboration.rs and task_movement.rs
4. **Deep scan** — found 9 issues, fixed 4 (subscriptions, colors, unbounded query, unused import)
5. **Skills updated** — /research-build-loop and /auto-build made project-agnostic
6. **gstack upgraded** to v0.14.5, routing rules added to CLAUDE.md
7. **QA passed** — health score 93/100, 10 pages tested, 0 critical bugs
8. **Password reset** for test account

### Commits pushed:
| SHA | Description |
|-----|-------------|
| 30c5ce0 | feat: WhatsApp OTP phone verification + phone login |
| 6ee1dc1 | test: add 353 unit tests across 7 untested features |
| 48e590f | test: add 138 tests for workspace and manage components |
| 1a16ea2 | fix: wire Slack webhook URL from project settings |
| 8a118b3 | fix: subscription leaks, unbounded query, unused import |
| 7d2883e | fix: replace hardcoded colors with CSS variable tokens |

### To resume:
```
Read TASK.md, start with Task 2 (clippy raw string hashes)
```
