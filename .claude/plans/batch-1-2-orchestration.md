# Orchestration Plan: Batches 1-4

## Current Status

### Completed Batches
| Batch | Agents | Status |
|-------|--------|--------|
| 1-2 | 5 agents | ✅ DONE |
| 3 | 6 agents | ✅ DONE |

### Batch 4 Running Agents
| ID | Section | Ownership | Status |
|----|---------|-----------|--------|
| a5111eb | 08 Backend | Team Overview + My Tasks endpoints | 🔄 Running |
| a888505 | 10 Backend | Onboarding + Sample Board | 🔄 Running |
| aaaab19 | 08 Frontend | Team Overview + My Tasks UI | 🔄 Running |
| a31168c | 10 Frontend | Onboarding + Theme System | 🔄 Running |

### Skipped
| Section | Reason |
|---------|--------|
| 09 Billing | Deferred per user request (stub endpoints only later) |

---

## Batch 4 Plan (Sections 08 + 10)

### Agent 1: Section 08 Backend (Team Overview + My Tasks)
```
OWNS:
- crates/api/src/routes/team_overview.rs (new)
- crates/api/src/routes/my_tasks.rs (new)
- crates/db/src/queries/team_overview.rs (new)
- crates/db/src/queries/my_tasks.rs (new)
- crates/api/src/routes/task.rs (update - workspace broadcast)
```

### Agent 2: Section 10 Backend (Onboarding + Sample Board)
```
OWNS:
- crates/api/src/routes/onboarding.rs (new)
- crates/services/src/sample_board.rs (new)
- migrations/*_add_onboarding_completed.sql (new)
```

### Agent 3: Section 08 Frontend (Team Overview + My Tasks UI)
```
OWNS:
- frontend/src/app/features/team/team-overview/team-overview.component.ts
- frontend/src/app/features/team/member-workload-card/member-workload-card.component.ts
- frontend/src/app/features/team/overload-banner/overload-banner.component.ts
- frontend/src/app/features/my-tasks/my-tasks/my-tasks.component.ts
- frontend/src/app/features/my-tasks/task-list-item/task-list-item.component.ts
- frontend/src/app/core/services/team.service.ts
- frontend/src/app/core/services/my-tasks.service.ts
```

### Agent 4: Section 10 Frontend (Onboarding + Theme)
```
OWNS:
- frontend/src/app/features/onboarding/*.component.ts (5 components)
- frontend/src/app/core/services/theme.service.ts
- frontend/src/app/core/services/onboarding.service.ts
- frontend/src/app/shared/components/priority-badge/priority-badge.component.ts
- frontend/src/app/shared/utils/task-colors.ts (update)
- frontend/src/styles.css (update)
```

---

## Execution Order

1. ✅ Batches 1-2 complete (Auth, RBAC, Workspace, Board, Task, WebSocket, Angular init)
2. ✅ Batch 3 complete (Comments, Activity, Files, Notifications, Kanban UI)
3. ✅ Batch 4 complete (Team Overview, My Tasks, Onboarding, Theme)
4. ✅ Security fixes complete (5 CRITICAL + 2 HIGH issues resolved)
5. 🔄 Batch 5 running (Section 11 Audit + Section 12 Deployment)

---

## Verification Commands

```bash
# After Batch 4
cd backend && cargo build
cd frontend && ng build
```
