import { Routes } from '@angular/router';
import { adminGuard } from '../../core/guards/admin.guard';

export const adminRoutes: Routes = [
  {
    path: '',
    canActivate: [adminGuard],
    children: [
      {
        path: 'audit-log',
        loadComponent: () =>
          import('./audit-log/audit-log.component').then(
            (m) => m.AuditLogComponent
          ),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./users/admin-users.component').then(
            (m) => m.AdminUsersComponent
          ),
      },
      {
        path: 'trash',
        loadComponent: () =>
          import('./trash/admin-trash.component').then(
            (m) => m.AdminTrashComponent
          ),
      },
      {
        path: '',
        redirectTo: 'audit-log',
        pathMatch: 'full',
      },
    ],
  },
];
