import { Routes } from '@angular/router';
import { authGuard, publicOnlyGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { workspaceRedirectGuard } from './core/guards/workspace-redirect.guard';

export const routes: Routes = [
  {
    path: 'auth',
    children: [
      {
        path: 'sign-in',
        loadComponent: () =>
          import('./features/auth/sign-in/sign-in.component').then(
            (m) => m.SignInComponent,
          ),
        canActivate: [publicOnlyGuard],
      },
      {
        path: 'sign-up',
        loadComponent: () =>
          import('./features/auth/sign-up/sign-up.component').then(
            (m) => m.SignUpComponent,
          ),
        canActivate: [publicOnlyGuard],
      },
      {
        path: 'forgot-password',
        loadComponent: () =>
          import('./features/auth/forgot-password/forgot-password.component').then(
            (m) => m.ForgotPasswordComponent,
          ),
        canActivate: [publicOnlyGuard],
      },
      {
        path: 'reset-password',
        loadComponent: () =>
          import('./features/auth/reset-password/reset-password.component').then(
            (m) => m.ResetPasswordComponent,
          ),
      },
      {
        path: 'accept-invite',
        loadComponent: () =>
          import('./features/auth/accept-invite/accept-invite.component').then(
            (m) => m.AcceptInviteComponent,
          ),
      },
    ],
  },
  {
    path: 'onboarding',
    loadComponent: () =>
      import('./features/onboarding/onboarding.component').then(
        (m) => m.OnboardingComponent,
      ),
    canActivate: [authGuard],
    data: { hideSidebar: true },
  },

  // ── Workspace-scoped routes ──────────────────────────────────────
  {
    path: 'workspace/:workspaceId',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/workspace/workspace.component').then(
            (m) => m.WorkspaceComponent,
          ),
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent,
          ),
      },
      {
        path: 'my-work',
        loadComponent: () =>
          import('./features/my-work/my-work-shell.component').then(
            (m) => m.MyWorkShellComponent,
          ),
      },
      {
        path: 'inbox',
        loadComponent: () =>
          import('./features/inbox/inbox.component').then(
            (m) => m.InboxComponent,
          ),
      },
      {
        path: 'eisenhower',
        loadComponent: () =>
          import('./features/my-work/my-work-shell.component').then(
            (m) => m.MyWorkShellComponent,
          ),
        data: { defaultTab: 'matrix' },
      },
      {
        path: 'all-tasks',
        loadComponent: () =>
          import('./features/workspace/all-tasks/all-tasks.component').then(
            (m) => m.AllTasksComponent,
          ),
      },
      {
        path: 'favorites',
        loadComponent: () =>
          import('./features/favorites/favorites.component').then(
            (m) => m.FavoritesComponent,
          ),
      },
      {
        path: 'archive',
        loadComponent: () =>
          import('./features/archive/archive.component').then(
            (m) => m.ArchiveComponent,
          ),
      },
      {
        path: 'help',
        loadComponent: () =>
          import('./features/help/help.component').then((m) => m.HelpComponent),
      },
      {
        path: 'manage',
        loadComponent: () =>
          import('./features/manage/manage.component').then(
            (m) => m.ManageComponent,
          ),
      },
      {
        path: 'people',
        loadComponent: () =>
          import('./features/people/people-hub.component').then(
            (m) => m.PeopleHubComponent,
          ),
      },
      {
        path: 'team-page',
        redirectTo: 'manage',
        pathMatch: 'full' as const,
      },
      // Project routes
      {
        path: 'project/:projectId',
        loadComponent: () =>
          import('./features/project/project-view/project-view.component').then(
            (m) => m.ProjectViewComponent,
          ),
      },
      {
        path: 'project/:projectId/task/:taskId',
        loadComponent: () =>
          import('./features/task-detail/task-detail-page.component').then(
            (m) => m.TaskDetailPageComponent,
          ),
      },
      {
        path: 'project/:projectId/settings',
        loadComponent: () =>
          import('./features/project/project-settings/project-settings.component').then(
            (m) => m.ProjectSettingsComponent,
          ),
      },
      // Redirects from old /board/ URLs for bookmarks
      {
        path: 'board/:boardId',
        redirectTo: 'project/:boardId',
        pathMatch: 'full' as const,
      },
      {
        path: 'board/:boardId/settings',
        redirectTo: 'project/:boardId/settings',
        pathMatch: 'full' as const,
      },
      {
        path: 'portfolio',
        loadComponent: () =>
          import(
            './features/portfolio/portfolio-dashboard.component'
          ).then((m) => m.PortfolioDashboardComponent),
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./features/reports/reports.component').then(
            (m) => m.ReportsComponent,
          ),
      },
      {
        path: 'team',
        redirectTo: 'manage',
        pathMatch: 'full' as const,
      },
      {
        path: 'settings',
        redirectTo: '',
        pathMatch: 'full' as const,
      },
      {
        path: 'team/balance',
        loadComponent: () =>
          import('./features/team/workload-balance/workload-balance.component').then(
            (m) => m.WorkloadBalanceComponent,
          ),
      },
      {
        path: 'team/member/:userId',
        loadComponent: () =>
          import('./features/team/member-detail/member-detail.component').then(
            (m) => m.MemberDetailComponent,
          ),
      },
    ],
  },

  // ── Legacy redirect routes (keep 90 days for backwards compat) ───
  // These catch old global routes and redirect to workspace-scoped equivalents
  { path: 'dashboard', canActivate: [workspaceRedirectGuard('dashboard')], children: [] },
  { path: 'my-tasks', canActivate: [workspaceRedirectGuard('my-work')], children: [] },
  { path: 'inbox', canActivate: [workspaceRedirectGuard('inbox')], children: [] },
  { path: 'eisenhower', canActivate: [workspaceRedirectGuard('eisenhower')], children: [] },
  { path: 'favorites', canActivate: [workspaceRedirectGuard('favorites')], children: [] },
  { path: 'archive', canActivate: [workspaceRedirectGuard('archive')], children: [] },
  { path: 'team', canActivate: [workspaceRedirectGuard('manage')], children: [] },
  { path: 'help', canActivate: [workspaceRedirectGuard('help')], children: [] },

  {
    path: 'discover',
    loadComponent: () =>
      import('./features/discover/org-command-center.component').then(
        (m) => m.OrgCommandCenterComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/settings/settings-layout/settings-layout.component').then(
        (m) => m.SettingsLayoutComponent,
      ),
    children: [
      { path: '', redirectTo: 'profile', pathMatch: 'full' as const },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/settings/profile-section/profile-section.component').then(
            (m) => m.ProfileSectionComponent,
          ),
      },
      {
        path: 'security',
        loadComponent: () =>
          import('./features/settings/security-section/security-section.component').then(
            (m) => m.SecuritySectionComponent,
          ),
      },
      {
        path: 'appearance',
        loadComponent: () =>
          import('./features/settings/appearance-section/appearance-section.component').then(
            (m) => m.AppearanceSectionComponent,
          ),
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/settings/notifications-section/notifications-section.component').then(
            (m) => m.NotificationsSectionComponent,
          ),
      },
      {
        path: 'templates',
        loadComponent: () =>
          import('./features/settings/task-templates/task-templates.component').then(
            (m) => m.TaskTemplatesComponent,
          ),
      },
    ],
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadChildren: () =>
      import('./features/admin/admin.routes').then((m) => m.adminRoutes),
  },
  {
    path: 'task/:taskId',
    loadComponent: () =>
      import('./features/task-detail/task-detail-page.component').then(
        (m) => m.TaskDetailPageComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'templates',
    loadComponent: () =>
      import('./features/project/project-templates/template-list.component').then(
        (m) => m.TemplateListComponent,
      ),
    canActivate: [authGuard],
  },
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: '/dashboard' },
];
