import { Injectable, inject, signal } from '@angular/core';
import { Observable, shareReplay, tap } from 'rxjs';
import { WorkspaceService, Workspace } from './workspace.service';

@Injectable({ providedIn: 'root' })
export class WorkspaceStateService {
  private workspaceService = inject(WorkspaceService);

  /** Cached workspace list observable — shared across all subscribers. */
  private workspaceList$: Observable<Workspace[]> | null = null;

  currentWorkspaceId = signal<string | null>(
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('taskbolt_active_workspace')
      : null,
  );
  workspaces = signal<Workspace[]>([]);
  loading = signal(false);

  selectWorkspace(id: string | null): void {
    this.currentWorkspaceId.set(id);
    if (id) {
      localStorage.setItem('taskbolt_active_workspace', id);
    } else {
      localStorage.removeItem('taskbolt_active_workspace');
    }
  }

  loadWorkspaces(): void {
    this.loading.set(true);
    this.getWorkspaceList$().subscribe({
      next: (ws) => {
        this.workspaces.set(ws);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  /** Invalidate the cached workspace list so the next call re-fetches. */
  invalidateCache(): void {
    this.workspaceList$ = null;
  }

  private getWorkspaceList$(): Observable<Workspace[]> {
    if (!this.workspaceList$) {
      this.workspaceList$ = this.workspaceService
        .list()
        .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    }
    return this.workspaceList$;
  }
}
