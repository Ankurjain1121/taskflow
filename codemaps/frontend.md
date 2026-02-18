# TaskFlow Frontend Codemap

> Generated: 2026-02-18 | Commit: dfb29e9

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

## Bootstrap (app.config.ts)

- provideRouter(routes, withComponentInputBinding())
- provideHttpClient(withInterceptors([authInterceptor])) - withCredentials, 401 auto-refresh
- providePrimeNG({ theme: Aura, darkModeSelector: '.dark' })
- APP_INITIALIZER: authInitializerFactory - validates session before routing

## Route Map

```
/                           -> redirect /dashboard
/auth/sign-in               SignInComponent              [public]
/auth/sign-up               SignUpComponent              [public]
/auth/forgot-password       ForgotPasswordComponent      [public]
/auth/reset-password        ResetPasswordComponent       [public]
/auth/accept-invite         AcceptInviteComponent        [public]
/onboarding                 OnboardingComponent          [authGuard, hideSidebar]
/dashboard                  DashboardComponent           [authGuard]
/my-tasks                   MyTasksTimelineComponent     [authGuard]
/eisenhower                 EisenhowerMatrixComponent    [authGuard]
/favorites                  FavoritesComponent           [authGuard]
/archive                    ArchiveComponent             [authGuard]
/team                       TeamPageComponent            [authGuard]
/help                       HelpComponent                [authGuard]
/task/:taskId               TaskDetailPageComponent      [authGuard]
/workspace/:wid             WorkspaceComponent           [authGuard]
/workspace/:wid/board/:bid  BoardViewComponent           [authGuard]
/workspace/:wid/board/:bid/settings  BoardSettingsComponent [authGuard]
/workspace/:wid/team        TeamOverviewComponent        [authGuard]
/workspace/:wid/settings    WorkspaceSettingsComponent   [authGuard]
/settings/profile           ProfileComponent             [authGuard]
/settings/notifications     NotificationsComponent       [authGuard]
/admin/audit-log            AuditLogComponent            [adminGuard]
/admin/users                AdminUsersComponent          [adminGuard]
/admin/trash                AdminTrashComponent          [adminGuard]
```

All routes use lazy loadComponent.

## Feature Tree

```
features/
├── auth/           5 components (sign-in/up, password reset, invite)
├── onboarding/     Shell + 4 steps (welcome, workspace, invite, sample-board)
├── dashboard/      Shell + 8 widgets (stats, status, priority, trend, overdue, deadlines, my-tasks, workload)
├── board/          Core kanban feature
│   ├── board-view/         Shell + create dialogs
│   ├── kanban-column/      Drag-drop column
│   ├── task-card/          Card in kanban
│   ├── task-detail/        Drawer (header, description, fields, metadata, activity)
│   ├── list-view/          Table view
│   ├── calendar-view/      Calendar view
│   ├── gantt-view/         Gantt chart
│   ├── reports-view/       Board analytics
│   ├── bulk-actions/       Multi-select bar
│   ├── subtask-list/       Subtask management
│   ├── attachment-list/    File attachments
│   ├── milestone-list/     Milestone tracking
│   ├── time-report/        Time tracking report
│   ├── automations/        Rule builder
│   ├── custom-fields/      Custom field manager
│   ├── share/              Public share settings
│   ├── webhooks/           Webhook config
│   ├── import-export/      JSON/CSV import/export
│   └── project-templates/  Save/load templates
├── project/        Project-mode views (table, card, detail, settings)
├── my-tasks/       Personal timeline + Eisenhower matrix
├── tasks/          Shared sub-components (activity, comments, mentions)
├── team/           Workload cards + overload banner
├── workspace/      Settings + members list
├── settings/       Profile + notification preferences
├── admin/          Audit log, user management, trash (adminGuard)
├── favorites/      Bookmarks
├── archive/        Archived items
└── help/           Help page
```

## Core Services (39)

### Auth & Session
| Service | Signals/Purpose |
|---------|----------------|
| auth.service | signal<User>, isAuthenticated computed, sign-in/up/out, refresh (deduplicated) |
| profile.service | signal<UserProfile>, signal<NotificationPreference[]> |

### Data Services
| Service | Domain |
|---------|--------|
| workspace.service | Workspace CRUD + members + invitations |
| workspace-state.service | signal<string> active workspace (localStorage) |
| board.service | Board + column CRUD, getBoardFull() batch |
| task.service | Task CRUD, move, labels, assignees, bulk, all views |
| project.service | Project CRUD, columns, members |
| label.service | Label CRUD per project |
| subtask.service | Subtask CRUD |
| task-group.service | Task group/section management |
| my-tasks.service | Personal tasks + summary (cursor pagination) |
| eisenhower.service | Urgency/importance matrix |
| recurring.service | Recurring task config |
| dependency.service | Task dependencies |
| milestone.service | Project milestones |
| custom-field.service | Custom field definitions + values |
| time-tracking.service | Timer start/stop, manual entries, reports |

### Collaboration
| Service | Domain |
|---------|--------|
| comment.service | Task comments (threaded, mentions) |
| activity.service | Activity log (cursor pagination) |
| attachment.service | Presigned upload flow (3-step) |
| invitation.service | Workspace invitations |
| team.service | Workload + overloaded members |

### Notifications & Real-time
| Service | Domain |
|---------|--------|
| notification.service | signal<unreadCount>, WebSocket + 30s polling fallback |
| notification-sound.service | Audio on new notification |
| websocket.service | rxjs/webSocket with auto-reconnect |

### Search & Navigation
| Service | Domain |
|---------|--------|
| search.service | Global search (tasks, boards, comments) |
| favorites.service | Favorite tasks/boards |
| keyboard-shortcuts.service | Global shortcut registry (? = help) |

### UI & Admin
| Service | Domain |
|---------|--------|
| theme.service | signal<Theme> (light/dark/system), localStorage + cookie |
| dashboard.service | 7 dashboard stat endpoints |
| admin.service | Audit log, users, trash |
| reports.service | Board analytics (burndown, workload, overdue) |
| api.service | Thin HttpClient wrapper with /api base |
| archive.service | Board/task archiving |
| automation.service | Automation rules + logs |
| board-share.service | Public share links |
| import-export.service | CSV/JSON/Trello import/export |
| project-template.service | Board template save/load |
| onboarding.service | Onboarding flow state |
| webhook.service | Webhook config per board |

## Guards & Interceptors

| Name | Type | Logic |
|------|------|-------|
| authGuard | CanActivate | isAuthenticated() -> redirect /auth/sign-in?returnUrl= |
| publicOnlyGuard | CanActivate | Inverse: redirect to /dashboard |
| adminGuard | CanActivate | role === 'Admin' check |
| authInterceptor | HttpInterceptor | withCredentials, 401 -> refresh -> retry or sign-out |
| authInitializer | APP_INITIALIZER | /api/auth/me -> verify session before routing |

## Shared Components

layout, sidebar (+favorites, +recent, +workspace-item), notification-bell (+item), global-search, create-workspace-dialog, create-board-dialog, invite-member-dialog, toast (+service), label-picker, member-picker, task-filter-bar, priority-badge, empty-state, shortcut-help

## State Management Pattern

```
Signals (sync state):
  AuthService._currentUser = signal<User|null>
  NotificationService._unreadCount = signal<number>
  ThemeService._theme = signal<Theme>
  WorkspaceStateService.currentWorkspaceId = signal<string|null>
  + component-local signals

RxJS (async flows):
  HTTP calls -> Observable<T> via HttpClient
  WebSocket -> webSocket() Subject with retry()
  Token refresh -> BehaviorSubject deduplication

Pattern: signal.asReadonly() exposed; .set()/.update() via HTTP tap()
Immutable updates: spread/map in signal updates
```

## E2E Tests

Page Objects: SignIn, SignUp, Dashboard, Workspace, TaskDetail, Onboarding, Archive, Favorites, Help, Settings
Standard suite: 16 specs (auth, board, dashboard, workspace, my-tasks, eisenhower, favorites, archive, task-detail, team, settings, admin, onboarding, help, cross-cutting, health)
Comprehensive suite: 9 specs in e2e/comprehensive/
