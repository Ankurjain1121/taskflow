<!-- Generated: 2026-03-05 | Files scanned: 150+ | Token estimate: ~800 -->

# Frontend Codemap (Angular 19)

## Feature Modules (15)

| Feature | Key Components | Description |
|---------|---------------|-------------|
| admin | admin, audit-log, trash, users | Tenant admin panel |
| archive | archive | Archived boards/tasks |
| auth | sign-in, sign-up, forgot/reset-password, accept-invite | Authentication flows |
| board | board-view, kanban-column, calendar/gantt/list-view, automations, bulk-ops, milestones, import-export | Main kanban board |
| dashboard | dashboard, widgets | Workspace dashboard with charts |
| favorites | favorites | User bookmarks |
| help | help | Help/documentation page |
| my-tasks | my-tasks, eisenhower-matrix, timeline | Personal task views |
| onboarding | step-welcome, step-workspace, step-use-case, step-sample-board, step-invite | New user wizard |
| settings | profile, security, appearance, notifications, task-templates | User settings |
| shared-board | shared-board-view | Public board sharing |
| task-detail | task-detail-page, task-detail-sidebar | Full task view |
| tasks | comment-list, task components | Task-related shared components |
| team | team-page, team-overview, member-detail, workload-balance | Team management |
| workspace | workspace, discover, members, teams, labels, settings, trash | Workspace management |

## Core Services (43 services, grouped)

**Auth:** auth, session
**Board/Task:** board, task, position, subtask, milestone, dependency, comment, activity, attachment, custom-field
**Workspace/Team:** workspace, workspace-state, team, team-groups, profile
**Automation:** automation, bulk-operations, recurring, task-template, project-template, import-export
**UI:** notification, notification-sound, push-notification, theme, theme-api, user-preferences, keyboard-shortcuts, feature-hints, onboarding, onboarding-checklist, filter-presets, recent-items, favorites, search, eisenhower, my-tasks
**Admin:** admin, archive, api (base), api-key, webhook, board-share, invitation
**Infra:** cache, upload, save-status, conflict-notification, presence, websocket, workspace-settings-dialog, reports, time-tracking, dashboard

## Shared Components (25)

avatar-upload, background-pattern, board-presence, breadcrumbs, command-palette, conflict-dialog, dialogs (create-board, create-workspace, invite-member, user-profile), empty-state, feature-help-icon, global-search, member-picker, notification-bell, onboarding-checklist, priority-badge, rich-text-editor, save-status-indicator, shortcut-discovery-banner, shortcut-help, sidebar (+favorites, recent, workspace-item), skeleton, spotlight-overlay, task-filter-bar, toast, top-nav

## Route Tree

```
/auth/sign-in|sign-up|forgot-password|reset-password|accept-invite (public)
/onboarding (protected, hideSidebar)
/dashboard (protected)
/my-tasks (protected)
/eisenhower (protected)
/favorites (protected)
/archive (protected)
/team (protected)
/help (protected)
/discover (protected)
/workspace/:id (protected)
  /board/:boardId[/settings]
  /team[/balance|/member/:userId]
/settings/profile|security|appearance|notifications|templates (protected)
/admin/** (admin-only)
/task/:taskId (protected)
/templates (protected)
```

## State Management

- **Pattern:** Per-service signals (no central store)
- **Signals:** auth (currentUser), workspace-state, theme, save-status, notifications, feature-hints, recent-items, onboarding
- **Observables:** HTTP calls, WebSocket subscriptions
- **Caching:** cache.service (shareReplay + invalidation), localStorage for preferences

## Guards & Interceptors

| Type | Name | Purpose |
|------|------|---------|
| Guard | auth.guard | JWT check, redirect to /auth/sign-in |
| Guard | admin.guard | Role === Admin check |
| Guard | publicOnlyGuard | Redirect authenticated away from /auth/* |
| Interceptor | auth.interceptor | Attach JWT bearer token |
| Interceptor | error.interceptor | Map 401→logout, 403→forbidden |
