import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
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
      },
      {
        path: 'sign-up',
        loadComponent: () =>
          import('./features/auth/sign-up/sign-up.component').then(
            (m) => m.SignUpComponent,
          ),
      },
      {
        path: 'forgot-password',
        loadComponent: () =>
          import('./features/auth/forgot-password/forgot-password.component').then(
            (m) => m.ForgotPasswordComponent,
          ),
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
        path: 'board/:boardId',
        loadComponent: () =>
          import('./features/board/board-view/board-view.component').then(
            (m) => m.BoardViewComponent,
          ),
      },
      {
        path: 'board/:boardId/settings',
        loadComponent: () =>
          import('./features/board/board-settings/board-settings.component').then(
            (m) => m.BoardSettingsComponent,
          ),
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
        loadComponent: () =>
          import('./features/workspace/workspace-settings/workspace-settings.component').then(
            (m) => m.WorkspaceSettingsComponent,
          ),
      },
    ],
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    children: [
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/settings/profile/profile.component').then(
            (m) => m.ProfileComponent,
          ),
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/settings/notifications/notifications.component').then(
            (m) => m.NotificationsComponent,
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
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: '/dashboard' },
];
