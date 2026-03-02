import {
  Component,
  inject,
  signal,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  DestroyRef,
} from '@angular/core';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WorkspaceStateService } from '../../../core/services/workspace-state.service';
import { BoardService } from '../../../core/services/board.service';

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
  private boardService = inject(BoardService);
  private destroyRef = inject(DestroyRef);

  breadcrumbs = signal<Breadcrumb[]>([]);
  private sub: Subscription | null = null;
  private boardNameCache = new Map<string, string>();
  // Tracks the board ID currently shown in breadcrumbs; guards stale async responses.
  private activeBoardId: string | null = null;

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

    // Reset board tracking; re-set only inside the board branch.
    this.activeBoardId = null;

    if (segments.length === 0 || (segments.length === 1 && segments[0] === 'dashboard')) {
      crumbs.push({ label: 'Dashboard', url: null });
      this.breadcrumbs.set(crumbs);
      return;
    }

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
        this.activeBoardId = boardId;

        // Set 'Board' placeholder immediately so the nav is never blank.
        crumbs.push({ label: 'Board', url: `/workspace/${workspaceId}/board/${boardId}` });

        if (segments[4] === 'settings') {
          crumbs.push({ label: 'Settings', url: null });
        }

        this.breadcrumbs.set(crumbs);
        this.resolveBoardName(boardId);
        return; // label updated asynchronously via resolveBoardName
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

  private resolveBoardName(boardId: string): void {
    // Fast path: name already cached from a previous visit.
    const cached = this.boardNameCache.get(boardId);
    if (cached) {
      this.setBoardName(boardId, cached);
      return;
    }

    // Async path: fetch name and cache it.
    this.boardService
      .getBoard(boardId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (board) => {
          this.boardNameCache.set(boardId, board.name);
          this.setBoardName(boardId, board.name);
        },
        error: () => {
          // 'Board' placeholder already set; silently keep it.
        },
      });
  }

  // Guards against stale responses: only applies the name if we're still
  // viewing the same board (user may have navigated away mid-flight).
  private setBoardName(boardId: string, name: string): void {
    if (this.activeBoardId !== boardId) return;
    this.breadcrumbs.update((crumbs) =>
      crumbs.map((c) => (c.label === 'Board' ? { ...c, label: name } : c)),
    );
  }
}
