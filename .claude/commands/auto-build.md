---
name: auto-build
description: Auto-continuing loop that implements Stitch UX changes phase by phase
---

# Auto-Build: Stitch UX Implementation Loop

Implements the 18-phase Stitch design system changes from analysis reports. Auto-continues until all phases are complete.

## How it works

1. Read TASKS.md to find current phase and status
2. Find the first incomplete phase
3. Read that phase's report from `stitch-analysis/reports/phases/phase-NN-name.md`
4. Read the corresponding Stitch screenshot(s) as visual reference
5. Implement every TODO item in the phase report
6. Verify: `cd frontend && npx tsc --noEmit && npm run build -- --configuration=production`
7. Commit with: `feat(stitch): phase NN — description`
8. Push: `git push origin master`
9. Update TASKS.md, then immediately start next phase

## Phase Inventory (18 phases, 281 TODOs)

### Tier 1 — Most Visible
- Phase 01: Dashboard (12 TODOs)
- Phase 02: Kanban Board (14 TODOs)
- Phase 03: Task Detail (18 TODOs)
- Phase 04: List & Table Views (17 TODOs)
- Phase 07: Sidebar & Navigation (15 TODOs)
- Phase 14: Dialogs & Overlays (15 TODOs)

### Tier 2 — Frequently Used
- Phase 08: Auth & Onboarding (17 TODOs)
- Phase 06: My Work & All Tasks (15 TODOs)
- Phase 09: Settings (20 TODOs)
- Phase 12: Inbox & Notifications (9 TODOs)
- Phase 05: Calendar & Gantt (15 TODOs)
- Phase 13: Archive & Favorites (12 TODOs)

### Tier 3 — Less Frequent
- Phase 10: Reports & Portfolio (15 TODOs)
- Phase 11: Team Hub (11 TODOs)
- Phase 15: Automations & Recurring (17 TODOs)
- Phase 16: Time Tracking & Activity (17 TODOs)
- Phase 17: Advanced Views (14 TODOs)
- Phase 18: Misc (28 TODOs)

## Execution Order (follow MASTER-TODO sprint plan)

Sprint 1: Phase 07, 14
Sprint 2: Phase 02, 04, 01
Sprint 3: Phase 03, 08
Sprint 4: Phase 06, 05, 12
Sprint 5: Phase 09, 13
Sprint 6: Phase 10, 11, 17
Sprint 7: Phase 15, 16, 18

## Per-Phase Pipeline

### STEP 1: READ
- Read `stitch-analysis/reports/phases/phase-NN-name.md` for the TODO list
- Read `stitch-analysis/reports/MASTER-TODO.md` for cross-cutting tokens
- Look at the Stitch screenshots in `stitch-designs/` for visual reference

### STEP 2: IMPLEMENT
- Work through each TODO item tagged [S], [M], or [L]
- [S] items: CSS-only changes (spacing, typography, radius)
- [M] items: Template/component restructuring
- [L] items: New components or major features
- IGNORE colors — the Terracotta Studio theme handles colors
- Focus on: layout, typography, component structure, spacing, interactions

### STEP 3: VERIFY
- `cd frontend && npx tsc --noEmit` — zero type errors
- `npm run build -- --configuration=production` — clean build
- Fix any errors before proceeding

### STEP 4: COMMIT & PUSH
- `git add <changed-files>`
- `git commit -m "feat(stitch): phase NN — short description"`
- `git push origin master`

### STEP 5: UPDATE TASKS.md
```
- [x] Phase 07: Sidebar & Navigation — SHIPPED (date, commit)
- [ ] Phase 14: Dialogs & Overlays — IN PROGRESS
- [ ] Phase 02: Kanban Board — PENDING
```

## Rules

1. After completing a phase, do NOT stop. Immediately start the next one.
2. Do NOT change colors. The theme system handles colors via CSS variables.
3. Focus on structure, layout, typography, spacing, component design, interactions.
4. If a TODO requires a backend change, skip it and mark BLOCKED.
5. If build fails 3 times on same issue, mark that TODO as BLOCKED and continue.
6. Always read the phase report FIRST before making changes.
7. Use the Stitch screenshots as visual reference — match the UX, not pixel-perfect.
8. Apply cross-cutting design tokens from MASTER-TODO before phase-specific work.

## Start
Read TASKS.md. If it doesn't exist, create it from the phase inventory above. Find first incomplete phase. Begin.
