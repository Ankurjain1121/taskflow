# TASK: Reimagine Dashboard — Mission Control

## Objective
Transform the dashboard from a long, scroll-heavy data dump (850-line monolith, 13 widgets, 3 empty states) into a mission control with three acts: (1) "Here's Your Day" — action-first, above the fold, (2) "How Things Are Going" — project health + trends, (3) "The Full Picture" — detailed analytics on demand.

## Key Decisions
- **Focus Board priority**: Auto-sort by urgency (overdue → due today → priority). No manual pin.
- **Snooze behavior**: Hide from focus board for today only (localStorage). Due date unchanged.
- **Streak logic**: Count distinct days with at least 1 task completed (from activity_log)
- **Project health thresholds**: green (overdue/active < 0.1), amber (0.1-0.3), red (> 0.3 or overdue > 5)
- **Branch**: `feat/reimagine-dashboard` worktree at `../taskflow-dashboard`

## Accepted Scope (from CEO Review)
1. 3-act progressive disclosure layout
2. Focus Board with interactive task cards (complete, snooze, delegate)
3. Project Pulse cards with health indicators + sparklines
4. Streak counter with completion micro-animations
5. Time-aware greeting with contextual urgency
6. Delightful empty states with illustrations and CTAs
7. Keyboard shortcuts (1-5 select, Enter/Space/S/D act)
8. Focus Mode toggle

## Architecture

### Backend (3 new endpoints)
- `GET /api/dashboard/focus-tasks` — top 5 priority tasks, RBAC-filtered
- `GET /api/dashboard/project-pulse` — per-project health + sparkline
- `GET /api/dashboard/streak` — completion streak data

### Frontend Component Decomposition
```
dashboard-shell.component.ts (<200 lines, orchestrator)
├── Act 1: Here's Your Day
│   ├── smart-greeting.component.ts
│   ├── streak-counter.component.ts
│   ├── summary-numbers.component.ts (existing)
│   ├── focus-board.component.ts
│   │   └── focus-task-card.component.ts
│   └── recent-activity (inline, compact 5 items)
├── Act 2: How Things Are Going (@defer)
│   ├── project-pulse.component.ts
│   │   └── project-pulse-card.component.ts
│   ├── completion-trend (existing)
│   ├── on-time-metric (existing)
│   ├── tasks-by-status (existing)
│   └── tasks-by-priority (existing)
└── Act 3: The Full Picture (@defer, accordion)
    ├── cycle-time-chart (existing)
    ├── velocity-chart (existing)
    ├── workload-balance (existing)
    └── resource-utilization (existing)
```

## Implementation Phases

### Phase 1: Backend Endpoints
- [ ] GET /api/dashboard/focus-tasks
- [ ] GET /api/dashboard/project-pulse
- [ ] GET /api/dashboard/streak

### Phase 2: Dashboard Shell + Act 1
- [ ] Rewrite dashboard.component.ts as thin shell
- [ ] smart-greeting.component.ts
- [ ] streak-counter.component.ts
- [ ] focus-board.component.ts + focus-task-card.component.ts
- [ ] Update dashboard.service.ts with new endpoints

### Phase 3: Act 2 + Act 3
- [ ] dashboard-act2.component.ts (project pulse + charts)
- [ ] project-pulse.component.ts + project-pulse-card.component.ts
- [ ] dashboard-act3.component.ts (metrics accordion)

### Phase 4: Polish
- [ ] Keyboard shortcuts
- [ ] Focus Mode
- [ ] Delightful empty states
- [ ] Animations (count-up, completion, streak)

### Phase 5: Verify + Deploy
- [ ] cargo check + clippy clean
- [ ] tsc --noEmit + ng build clean
- [ ] Docker build + deploy
- [ ] QA test on live site

## Success Criteria
- [ ] Dashboard loads above-the-fold with greeting + stats + focus board
- [ ] Focus Board shows top 5 tasks, inline complete/snooze works
- [ ] Project Pulse shows health cards for all accessible projects
- [ ] Streak counter shows consecutive completion days
- [ ] Smart greeting adapts to time of day and task urgency
- [ ] Empty states are encouraging with CTAs
- [ ] Keyboard shortcuts work (1-5 select, Enter/Space/S/D act)
- [ ] Focus Mode toggles full-screen task view
- [ ] No 850-line monolith — all components < 400 lines
- [ ] Dark mode works for all new components
- [ ] prefers-reduced-motion respected

## Progress Log
- 2026-03-18: CEO review CLEAR (all 8 proposals accepted, SCOPE EXPANSION)
- 2026-03-18: Implementation started — backend + frontend agents in parallel

---

# PAUSED: Hierarchical Permission System (RBAC)
Steps 1 & 4 complete. Steps 2-12 remaining. Independent of dashboard work.
