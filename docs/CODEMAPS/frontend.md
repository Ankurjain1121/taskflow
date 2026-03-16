<!-- Generated: 2026-03-16 | Files scanned: ~230 | Token estimate: ~950 -->
# Frontend

## Feature Modules (16)

| Module | Purpose |
|--------|---------|
| `admin` | User management, audit log, trash recovery |
| `archive` | Archived projects/tasks listing |
| `auth` | Sign-in, sign-up, forgot/reset password, accept-invite |
| `board` | Core workspace: kanban, list, calendar, gantt, reports, automations, custom fields, milestones, bulk ops, file upload, sharing, webhooks, templates |
| `dashboard` | Home dashboard with modular widget cards |
| `favorites` | Starred projects/tasks listing |
| `help` | Static help/documentation page |
| `my-tasks` | Personal tasks: timeline, Eisenhower matrix, task list |
| `onboarding` | Multi-step wizard: welcome, use-case, workspace, sample-board, invite |
| `portfolio` | Cross-project portfolio dashboard |
| `settings` | Profile, security, appearance, notifications, task templates |
| `shared-board` | Public read-only board view (share links) |
| `task-detail` | Full task detail page with sidebar |
| `tasks` | Reusable task list rendering components |
| `team` | Team overview, member detail, workload balance, org members, roles |
| `workspace` | Workspace shell: discover, settings, labels, members, teams, trash, audit |

## Core Services (~55)

Key services: `auth`, `board`, `task`, `workspace-state`, `websocket`, `cache`, `notification`, `theme`, `search`, `keyboard-shortcuts`, `presence`, `save-status`, `onboarding-checklist`, `conflict-notification`, `time-tracking`, `automation`, `bulk-operations`, `import-export`, `portfolio`, `reports`, `milestone`

State pattern: Angular `signal()` for shared mutable state, RxJS for async streams. No NgRx.

## Guards & Interceptors

| Guard/Interceptor | Purpose |
|-------------------|---------|
| `authGuard` | Blocks unauthenticated users |
| `publicOnlyGuard` | Redirects logged-in users from auth pages |
| `adminGuard` | Blocks non-admin users from /admin |
| `auth.interceptor` | Attaches JWT Bearer token |
| `error.interceptor` | Global error handling, 401 logout, error toasts |
| `auth-initializer` | APP_INITIALIZER: rehydrates auth state |

## Shared Components (~25)

Key: `sidebar` (with favorites/recent), `top-nav`, `command-palette` (Cmd+K), `global-search`, `notification-bell`, `rich-text-editor` (TipTap), `timer-widget`, `breadcrumbs`, `board-presence`, `conflict-dialog`, `member-picker`, `priority-badge`, `empty-state`, `save-status-indicator`, `onboarding-checklist`, `toast`, `skeleton`, `avatar-upload`, `shortcut-help`, `spotlight-overlay`, `contextual-hint`

## Routing (app.routes.ts)

All lazy-loaded standalone components.

```
/auth/*                     publicOnlyGuard: sign-in, sign-up, forgot-password, reset-password, accept-invite
/onboarding                 authGuard
/dashboard                  authGuard (default route)
/my-tasks                   authGuard
/eisenhower                 authGuard
/favorites                  authGuard
/archive                    authGuard
/team                       authGuard
/help                       authGuard
/discover                   authGuard
/workspace/:wid             authGuard (shell)
  /project/:pid             project view
  /project/:pid/settings    project settings
  /portfolio                portfolio dashboard
  /team                     team overview
  /team/balance             workload balance
  /team/member/:uid         member detail
/settings                   authGuard (profile, security, appearance, notifications, templates)
/admin                      adminGuard (lazy loaded)
/task/:taskId               authGuard
/templates                  authGuard
```

## Build Config

- Builder: `@angular-devkit/build-angular:application` (esbuild)
- TypeScript: strict mode, ES2022, bundler resolution
- Tailwind CSS 4 via PostCSS
- Tests: Vitest + @testing-library/angular (unit), Playwright (E2E)
- Lint: angular-eslint + typescript-eslint
- Rich text: TipTap v3.20 | Charts: chart.js v4.5 | Icons: primeicons v7
