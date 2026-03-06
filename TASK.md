# Phase 1: Board -> Project Rename + Zoho-Style List View

## Objective
Rename Board -> Project across entire stack + implement Zoho-style list view as default view.

## Key Decisions
- Single coordinated commit for rename (1A-1E), separate commit for list view (1F)
- Backward-compat DB views (boards, board_members, etc.) during transition, dropped after code update
- DB enum: board_member_role -> project_member_role
- AppState: board_channels -> project_channels
- WS channel format: board:{uuid} -> project:{uuid}
- Default view changes from 'kanban' to 'list'
- Frontend route: /workspace/:workspaceId/project/:projectId (redirect from /board/:boardId)

## Progress Log
- [x] Sub-Phase 1A: DB migration (board -> project rename) - DONE, verified in DB
- [ ] Sub-Phase 1B: Backend models + queries rename
- [ ] Sub-Phase 1C: Backend routes + API paths rename
- [ ] Sub-Phase 1D: Frontend services + types rename
- [ ] Sub-Phase 1E: Frontend components + routing rename
- [ ] Sub-Phase 1F-backend: Enhanced task list API
- [ ] Sub-Phase 1F-frontend: Zoho-style list view component
- [ ] Backend cargo check + clippy clean
- [ ] Frontend tsc + production build clean
- [ ] Docker deploy + browser verify

## Success Criteria
- [ ] All DB tables/columns/enums renamed (board -> project)
- [ ] Backend compiles with zero clippy warnings
- [ ] All API paths use /projects/ (no /boards/ in active routes)
- [ ] Frontend routes: /project/:projectId with redirect from /board/
- [ ] UI says "Projects" everywhere (sidebar, dialogs, tooltips)
- [ ] Default view = List (not Kanban)
- [ ] List view: inline editing (title, priority, status, due date, assignees)
- [ ] List view: configurable columns (show/hide/reorder)
- [ ] List view: server-side sort, filter, pagination
- [ ] List view: subtask progress roll-up
- [ ] List view: real-time WebSocket updates
- [ ] All existing views still functional
- [ ] Frontend production build succeeds
- [ ] Docker deployment works
