# TaskFlow Frontend Codemap

> Generated: 2026-02-23 | Commit: f6f3095

## Config

| Setting | Value |
|---------|-------|
| Angular | 19.2 (standalone, no NgModules) |
| UI | PrimeNG 19 (Aura theme) + Tailwind CSS 4 |
| State | Signals + RxJS (no NgRx) |
| Test (unit) | Vitest (via @analogjs/vitest-angular) |
| Test (E2E) | Playwright 1.58 |
| Charts | Chart.js 4 |
| Ordering | fractional-indexing |
| Change Detection | OnPush throughout |

## Bootstrap (app.config.ts)

- provideZoneChangeDetection({ eventCoalescing: true })
- provideRouter(routes, withComponentInputBinding())
- provideHttpClient(withInterceptors([authInterceptor, errorInterceptor]))
- provideAnimationsAsync()
- providePrimeNG({ theme: Aura, darkModeSelector: '.dark' })
- APP_INITIALIZER: authInitializerFactory - validates session before routing

## Route Map

```
/                           -> redirect /dashboard
/auth/sign-in               SignInComponent              [publicOnly]
/auth/sign-up               SignUpComponent              [publicOnly]
/auth/forgot-password       ForgotPasswordComponent      [publicOnly]
/auth/reset-password        ResetPasswordComponent       [publicOnly]
/auth/accept-invite         AcceptInviteComponent        [publicOnly]
/onboarding                 OnboardingComponent          [authGuard]
/dashboard                  DashboardComponent           [authGuard]
/my-tasks                   MyTasksTimelineComponent     [authGuard]
/eisenhower                 EisenhowerMatrixComponent    [authGuard]
/favorites                  FavoritesComponent           [authGuard]
/archive                    ArchiveComponent             [authGuard]
/team                       TeamPageComponent            [authGuard]
/help                       HelpComponent                [authGuard]
/discover                   DiscoverWorkspacesComponent  [authGuard]
/task/:taskId               TaskDetailPageComponent      [authGuard]
/workspace/:wid             WorkspaceComponent           [authGuard]
/workspace/:wid/board/:bid  BoardViewComponent           [authGuard]
/workspace/:wid/board/:bid/settings  BoardSettingsComponent [authGuard]
/workspace/:wid/team        TeamOverviewComponent        [authGuard]
/workspace/:wid/team/balance WorkloadBalanceComponent    [authGuard]
/workspace/:wid/team/member/:uid MemberDetailComponent   [authGuard]
/settings                   -> redirect /settings/profile
/settings/profile           ProfileSectionComponent      [authGuard]
/settings/security          SecuritySectionComponent     [authGuard]
/settings/appearance        AppearanceSectionComponent   [authGuard]
/settings/notifications     NotificationsSectionComponent [authGuard]
/admin/audit-log            AuditLogComponent            [adminGuard]
/admin/users                AdminUsersComponent          [adminGuard]
/admin/trash                AdminTrashComponent          [adminGuard]
```

All routes use lazy loadComponent/loadChildren.

## Feature Tree

```
features/
├── auth/           5 components (sign-in/up, password reset, invite)
├── onboarding/     Shell + 4 steps (welcome, workspace, invite, sample-board)
├── dashboard/      Shell + 8 widgets (stats, status, priority, trend, overdue, deadlines, my-tasks, workload)
├── board/          Core kanban feature (LARGEST)
│   ├── board-view/         Shell + create dialogs + toolbar
│   ├── kanban-column/      Drag-drop column
│   ├── task-card/          Card in kanban
│   ├── task-detail/        Drawer (header, description, fields, metadata, activity, custom-fields, dependencies, recurring, time-tracking)
│   ├── task-group-header/  Section headers
│   ├── list-view/          Table view
│   ├── calendar-view/      Calendar view
│   ├── gantt-view/         Gantt chart
│   ├── reports-view/       Board analytics
│   ├── time-report/        Time tracking report
│   ├── bulk-actions/       Multi-select bar
│   ├── subtask-list/       Subtask management
│   ├── attachment-list/    File attachments + confirm dialog
│   ├── milestone-list/     Milestone tracking
│   ├── column-manager/     Column configuration
│   ├── custom-fields/      Custom field manager
│   ├── automations/        Rule builder
│   ├── positions/          Position/role list
│   ├── share/              Public share settings
│   ├── webhooks/           Webhook config
│   ├── import-export/      JSON/CSV import/export
│   ├── project-templates/  Save/load templates
│   ├── board-settings/     Board settings + invite dialog
│   ├── create-task-group-dialog/  Group creation
│   └── file-upload-zone/   File drop zone
├── project/        Project-mode views (table, card, detail, settings)
├── my-tasks/       Timeline + Eisenhower matrix + task-list-item
├── task-detail/    Standalone task page + sidebar
├── tasks/          Shared sub-components (activity, comments, mentions)
├── team/           Team hub
│   ├── team-page/          Central team management
│   ├── team-overview/      Workspace-level stats
│   ├── workload-dashboard/ Workload visualization
│   ├── workload-balance/   Workload balancing
│   ├── org-members/        Organization members
│   ├── member-detail/      Individual member profile
│   ├── member-workload-card/ Workload summary card
│   ├── overload-banner/    Overload warning
│   ├── workspaces-panel/   Workspace selector
│   ├── add-to-workspace-dialog/ Add member to workspace
│   └── create-workspace-dialog/ Create workspace
├── workspace/      Hub + settings (general, API keys, advanced) + members + teams + discover
├── settings/       Layout + profile, security, appearance, notifications sections
├── admin/          Audit log, user management, trash (adminGuard)
├── favorites/      Bookmarks
├── archive/        Archived items
├── shared-board/   Public board view
└── help/           Help page
```

## Core Services (51+)

### Auth & Session (5)
| Service | Purpose |
|---------|---------|
| auth.service | signal<User>, isAuthenticated, sign-in/up/out, refresh (deduplicated) |
| profile.service | User profile CRUD, avatar upload |
| session.service | List/revoke active sessions |
| invitation.service | Workspace/team invites |
| onboarding.service | Onboarding flow state |

### Workspace & Team (6)
| Service | Purpose |
|---------|---------|
| workspace.service | Workspace CRUD + members + invitations |
| workspace-state.service | signal<string> active workspace (localStorage) |
| team.service | Team CRUD, members, workload |
| team-groups.service | Team group management |
| workspace-settings-dialog.service | Settings dialog trigger |
| user-preferences.service | Theme, notifications, layout prefs |

### Board & Task (13)
| Service | Purpose |
|---------|---------|
| board.service | Board + column CRUD, getBoardFull() batch |
| task.service | Task CRUD, move, labels, assignees, bulk, all views |
| task-group.service | Task group/section management |
| subtask.service | Subtask CRUD |
| milestone.service | Project milestones |
| comment.service | Task comments (threaded, mentions) |
| activity.service | Activity log (cursor pagination) |
| attachment.service | Presigned upload flow (3-step) |
| custom-field.service | Custom field definitions + values |
| time-tracking.service | Timer start/stop, manual entries, reports |
| dependency.service | Task dependencies |
| recurring.service | Recurring task config |
| position.service | Fractional indexing for task order |

### Dashboard & Reporting (4)
| Service | Purpose |
|---------|---------|
| dashboard.service | 7 dashboard stat endpoints |
| my-tasks.service | Personal tasks + summary (cursor pagination) |
| eisenhower.service | Urgency/importance matrix |
| reports.service | Board analytics (burndown, workload, overdue) |

### Notifications & Real-time (3)
| Service | Purpose |
|---------|---------|
| notification.service | signal<unreadCount>, WebSocket + 30s polling fallback |
| notification-sound.service | Audio on new notification |
| websocket.service | rxjs/webSocket with auto-reconnect |

### Search & Navigation (3)
| Service | Purpose |
|---------|---------|
| search.service | Global search (tasks, boards, comments) |
| favorites.service | Favorite tasks/boards |
| keyboard-shortcuts.service | Global shortcut registry (? = help) |

### Integrations & Data (6)
| Service | Purpose |
|---------|---------|
| automation.service | Automation rules + logs |
| board-share.service | Public share links |
| import-export.service | CSV/JSON/Trello import/export |
| webhook.service | Webhook config per board |
| project-template.service | Board template save/load |
| task-template.service | Task template CRUD |

### Theme & Appearance (2)
| Service | Purpose |
|---------|---------|
| theme.service | signal<Theme> (light/dark/system), localStorage + cookie |
| theme-api.service | Custom theme CRUD |

### Admin & System (6)
| Service | Purpose |
|---------|---------|
| admin.service | Audit log, users, trash |
| archive.service | Board/task archiving |
| upload.service | File upload (avatar, workspace logo) |
| api.service | Thin HttpClient wrapper with /api base |
| api-key.service | Workspace API key management |
| toast.service | Toast notification trigger |

## Guards & Interceptors

| Name | Type | Logic |
|------|------|-------|
| authGuard | CanActivate | isAuthenticated() -> redirect /auth/sign-in?returnUrl= |
| publicOnlyGuard | CanActivate | Inverse: redirect to /dashboard |
| adminGuard | CanActivate | role === 'Admin' check |
| authInterceptor | HttpInterceptor | withCredentials, 401 -> refresh -> retry or sign-out |
| errorInterceptor | HttpInterceptor | Display toast for 400/403/404/5xx; skip 401 and auth endpoints |
| authInitializer | APP_INITIALIZER | /api/auth/me -> verify session before routing |

## Shared Components

layout, sidebar (+favorites, +recent, +workspace-item), notification-bell (+item), global-search, create-workspace-dialog, create-board-dialog, invite-member-dialog, toast (+service), member-picker, avatar-upload, task-filter-bar, priority-badge, empty-state, background-pattern, shortcut-help

## State Management Pattern

```
Signals (sync state):
  AuthService._currentUser = signal<User|null>
  NotificationService._unreadCount = signal<number>
  ThemeService._theme = signal<Theme>
  ThemeService._accent = signal<AccentColor>
  ThemeService._resolvedTheme = computed
  WorkspaceStateService.currentWorkspaceId = signal<string|null>
  WorkspaceStateService.workspaces = signal<Workspace[]>
  + component-local signals (searchOpen, showSidebar, etc.)

RxJS (async flows):
  HTTP calls -> Observable<T> via HttpClient
  WebSocket -> webSocket() Subject with retry()
  Token refresh -> BehaviorSubject deduplication

Pattern: signal.asReadonly() exposed; .set()/.update() via HTTP tap()
Immutable updates: spread/map in signal updates
```

## Key Dependencies

| Category | Packages |
|----------|----------|
| Framework | @angular/core 19.2, @angular/cdk 19.2 (drag-drop) |
| UI | primeng 19.1, @primeng/themes 19.1, primeicons 7 |
| Styling | tailwindcss 4.1, @tailwindcss/postcss 4.1 |
| State | rxjs 7.8, zone.js 0.15 |
| Utilities | fractional-indexing 3.2 |
| Testing | @playwright/test 1.58, vitest 3.2, @vitest/coverage-v8 3.2 |
| Build | @angular/cli 19.2, typescript 5.7, eslint 9.39 |

## E2E Tests

Page Objects: SignIn, SignUp, Dashboard, Workspace, TaskDetail, Onboarding, Archive, Favorites, Help, Settings
Standard suite: 16 specs (auth, board, dashboard, workspace, my-tasks, eisenhower, favorites, archive, task-detail, team, settings, admin, onboarding, help, cross-cutting, health)
Comprehensive suite: 9 specs in e2e/comprehensive/
