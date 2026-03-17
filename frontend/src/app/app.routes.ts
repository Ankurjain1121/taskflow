import { Routes } from '@angular/router';
import { authGuard, publicOnlyGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

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
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'my-tasks',
    loadComponent: () =>
      import('./features/my-tasks/my-tasks-timeline/my-tasks-timeline.component').then(
        (m) => m.MyTasksTimelineComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'eisenhower',
    loadComponent: () =>
      import('./features/my-tasks/eisenhower-matrix/eisenhower-matrix.component').then(
        (m) => m.EisenhowerMatrixComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'favorites',
    loadComponent: () =>
      import('./features/favorites/favorites.component').then(
        (m) => m.FavoritesComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'archive',
    loadComponent: () =>
      import('./features/archive/archive.component').then(
        (m) => m.ArchiveComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'team',
    loadComponent: () =>
      import('./features/team/team-page.component').then(
        (m) => m.TeamPageComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'help',
    loadComponent: () =>
      import('./features/help/help.component').then((m) => m.HelpComponent),
    canActivate: [authGuard],
  },
  {
    path: 'discover',
    loadComponent: () =>
      import('./features/workspace/discover/discover-workspaces.component').then(
        (m) => m.DiscoverWorkspacesComponent,
      ),
    canActivate: [authGuard],
  },
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
        path: 'project/:projectId',
        loadComponent: () =>
          import('./features/project/project-view/project-view.component').then(
            (m) => m.ProjectViewComponent,
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
        path: 'team',
        loadComponent: () =>
          import('./features/team/team-overview/team-overview.component').then(
            (m) => m.TeamOverviewComponent,
          ),
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
