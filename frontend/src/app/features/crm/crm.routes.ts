import { Routes } from '@angular/router';

export const crmRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./crm-shell.component').then((m) => m.CrmShellComponent),
  },
];
