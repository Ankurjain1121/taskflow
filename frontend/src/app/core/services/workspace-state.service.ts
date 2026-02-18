import { Injectable, inject, signal } from '@angular/core';
import { WorkspaceService, Workspace } from './workspace.service';

@Injectable({ providedIn: 'root' })
export class WorkspaceStateService {
  private workspaceService = inject(WorkspaceService);

  currentWorkspaceId = signal<string | null>(
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('taskflow_active_workspace')
      : null
  );
  workspaces = signal<Workspace[]>([]);
  loading = signal(false);

  selectWorkspace(id: string | null): void {
    this.currentWorkspaceId.set(id);
    if (id) {
      localStorage.setItem('taskflow_active_workspace', id);
    } else {
      localStorage.removeItem('taskflow_active_workspace');
    }
  }

  loadWorkspaces(): void {
    this.loading.set(true);
    this.workspaceService.list().subscribe({
      next: (ws) => {
        this.workspaces.set(ws);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }
}
