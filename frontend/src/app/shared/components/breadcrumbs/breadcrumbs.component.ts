import {
  Component,
  inject,
  signal,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { WorkspaceStateService } from '../../../core/services/workspace-state.service';

export interface Breadcrumb {
  label: string;
  url: string | null;
}

@Component({
  selector: 'app-breadcrumbs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (breadcrumbs().length > 0) {
      <nav class="flex items-center gap-1 text-sm min-w-0" aria-label="Breadcrumb">
        @for (crumb of breadcrumbs(); track crumb.url ?? crumb.label; let last = $last) {
          @if (crumb.url && !last) {
            <a
              class="truncate max-w-[160px] transition-colors cursor-pointer hover:underline"
              style="color: var(--muted-foreground)"
              (click)="navigate(crumb.url)"
            >{{ crumb.label }}</a>
          } @else {
            <span
              class="truncate max-w-[200px] font-medium"
              [style.color]="last ? 'var(--foreground)' : 'var(--muted-foreground)'"
            >{{ crumb.label }}</span>
          }
          @if (!last) {
            <span style="color: var(--muted-foreground); opacity: 0.5">/</span>
          }
        }
      </nav>
    }
  `,
})
export class BreadcrumbsComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private workspaceState = inject(WorkspaceStateService);

  breadcrumbs = signal<Breadcrumb[]>([]);
  private sub: Subscription | null = null;

  ngOnInit(): void {
    this.updateBreadcrumbs();
    this.sub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.updateBreadcrumbs());
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  navigate(url: string | null): void {
    if (url) {
      this.router.navigateByUrl(url);
    }
  }

  private updateBreadcrumbs(): void {
    const url = this.router.url.split('?')[0];
    const segments = url.split('/').filter(Boolean);
    const crumbs: Breadcrumb[] = [];

    if (segments.length === 0 || (segments.length === 1 && segments[0] === 'dashboard')) {
      crumbs.push({ label: 'Dashboard', url: null });
      this.breadcrumbs.set(crumbs);
      return;
    }

    // Route-specific breadcrumb logic
    if (segments[0] === 'dashboard') {
      crumbs.push({ label: 'Dashboard', url: null });
    } else if (segments[0] === 'my-tasks') {
      crumbs.push({ label: 'My Tasks', url: null });
    } else if (segments[0] === 'eisenhower') {
      crumbs.push({ label: 'Eisenhower Matrix', url: null });
    } else if (segments[0] === 'favorites') {
      crumbs.push({ label: 'Favorites', url: null });
    } else if (segments[0] === 'archive') {
      crumbs.push({ label: 'Archive', url: null });
    } else if (segments[0] === 'team') {
      crumbs.push({ label: 'Team', url: null });
    } else if (segments[0] === 'help') {
      crumbs.push({ label: 'Help', url: null });
    } else if (segments[0] === 'discover') {
      crumbs.push({ label: 'Discover', url: null });
    } else if (segments[0] === 'settings') {
      crumbs.push({ label: 'Settings', url: '/settings' });
      if (segments[1]) {
        const settingsLabels: Record<string, string> = {
          profile: 'Profile',
          security: 'Security',
          appearance: 'Appearance',
          notifications: 'Notifications',
        };
        crumbs.push({ label: settingsLabels[segments[1]] ?? segments[1], url: null });
      }
    } else if (segments[0] === 'workspace' && segments[1]) {
      const workspaceId = segments[1];
      const workspaceName = this.resolveWorkspaceName(workspaceId);
      crumbs.push({ label: workspaceName, url: `/workspace/${workspaceId}` });

      if (segments[2] === 'board' && segments[3]) {
        const boardId = segments[3];
        const boardName = this.resolveBoardName(workspaceId, boardId);
        crumbs.push({ label: boardName, url: `/workspace/${workspaceId}/board/${boardId}` });

        if (segments[4] === 'settings') {
          crumbs.push({ label: 'Settings', url: null });
        }
      } else if (segments[2] === 'team') {
        crumbs.push({ label: 'Team', url: null });
      } else if (segments[2] === 'settings') {
        crumbs.push({ label: 'Settings', url: null });
      }
    } else if (segments[0] === 'task' && segments[1]) {
      crumbs.push({ label: 'Task Detail', url: null });
    } else if (segments[0] === 'admin') {
      crumbs.push({ label: 'Admin', url: '/admin' });
      if (segments[1]) {
        const adminLabels: Record<string, string> = {
          dashboard: 'Dashboard',
          users: 'Users',
          'audit-log': 'Audit Log',
          trash: 'Trash',
        };
        crumbs.push({ label: adminLabels[segments[1]] ?? segments[1], url: null });
      }
    }

    this.breadcrumbs.set(crumbs);
  }

  private resolveWorkspaceName(workspaceId: string): string {
    const workspaces = this.workspaceState.workspaces();
    const ws = workspaces.find((w) => w.id === workspaceId);
    return ws?.name ?? 'Workspace';
  }

  private resolveBoardName(_workspaceId: string, _boardId: string): string {
    // Board name resolution relies on URL or cached data.
    // For now, use a generic label; board name will be resolved
    // when board data is available from the sidebar/board-state.
    return 'Board';
  }
}
