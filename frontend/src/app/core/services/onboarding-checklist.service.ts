import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { AuthService } from './auth.service';
import { DashboardService } from './dashboard.service';
import { WorkspaceStateService } from './workspace-state.service';
import { WorkspaceService } from './workspace.service';
import { take } from 'rxjs';

export interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  icon: string;
  ctaLabel: string;
  ctaRoute?: string;
  ctaAction?: string;
}

interface ChecklistState {
  items: Record<string, boolean>;
  dismissed: boolean;
  skipped: boolean;
  lastUpdated: string;
}

const STORAGE_PREFIX = 'tf_checklist_';

function defaultItems(): ChecklistItem[] {
  return [
    {
      id: 'create_task',
      title: 'Create your first task',
      description: 'Add a task to any board to start tracking work',
      completed: false,
      icon: 'pi-plus',
      ctaLabel: 'Go to Board',
      ctaRoute: '/dashboard',
    },
    {
      id: 'set_due_date',
      title: 'Set a due date',
      description: 'Deadlines help keep your team on track',
      completed: false,
      icon: 'pi-calendar',
      ctaLabel: 'Open a Task',
      ctaRoute: '/my-tasks',
    },
    {
      id: 'try_drag_drop',
      title: 'Drag a task between columns',
      description: 'Move tasks across your board to update status',
      completed: false,
      icon: 'pi-arrows-h',
      ctaLabel: 'Go to Board',
      ctaRoute: '/dashboard',
    },
    {
      id: 'explore_shortcuts',
      title: 'Try keyboard shortcuts',
      description: 'Press ? on any board to see all shortcuts',
      completed: false,
      icon: 'pi-key',
      ctaLabel: 'View Shortcuts',
      ctaAction: 'open_shortcuts',
    },
    {
      id: 'invite_teammate',
      title: 'Invite a teammate',
      description: 'Collaboration makes everything better',
      completed: false,
      icon: 'pi-user-plus',
      ctaLabel: 'Invite Team',
      ctaRoute: '/team',
    },
  ];
}

@Injectable({ providedIn: 'root' })
export class OnboardingChecklistService {
  private authService = inject(AuthService);
  private dashboardService = inject(DashboardService);
  private workspaceState = inject(WorkspaceStateService);
  private workspaceService = inject(WorkspaceService);

  private userId: string | null = null;
  private initialized = false;

  readonly items = signal<ChecklistItem[]>(defaultItems());
  readonly isDismissed = signal(false);
  readonly isSkipped = signal(false);

  readonly completedCount = computed(
    () => this.items().filter((i) => i.completed).length,
  );
  readonly totalCount = computed(() => this.items().length);
  readonly progress = computed(() => {
    const total = this.totalCount();
    if (total === 0) return 0;
    return Math.round((this.completedCount() / total) * 100);
  });
  readonly allComplete = computed(
    () => this.completedCount() === this.totalCount(),
  );
  readonly shouldShow = computed(
    () => !this.isSkipped() && !this.allComplete(),
  );

  constructor() {
    effect(() => {
      if (!this.userId) return;
      const state: ChecklistState = {
        items: Object.fromEntries(this.items().map((i) => [i.id, i.completed])),
        dismissed: this.isDismissed(),
        skipped: this.isSkipped(),
        lastUpdated: new Date().toISOString(),
      };
      try {
        localStorage.setItem(
          `${STORAGE_PREFIX}${this.userId}`,
          JSON.stringify(state),
        );
      } catch {
        // localStorage full or unavailable — silently ignore
      }
    });
  }

  initialize(): void {
    if (this.initialized) return;

    const user = this.authService.currentUser();
    if (!user) return;

    this.userId = user.id;
    this.initialized = true;

    this.loadFromStorage();
    this.autoDetect();
  }

  markComplete(itemId: string): void {
    const current = this.items();
    const alreadyDone = current.find((i) => i.id === itemId && i.completed);
    if (alreadyDone) return;

    this.items.set(
      current.map((item) =>
        item.id === itemId ? { ...item, completed: true } : item,
      ),
    );
  }

  dismiss(): void {
    this.isDismissed.set(true);
    this.persistState();
  }

  reopen(): void {
    this.isDismissed.set(false);
    this.persistState();
  }

  skipAll(): void {
    this.isSkipped.set(true);
    this.persistState();
  }

  resetChecklist(): void {
    this.isSkipped.set(false);
    this.isDismissed.set(false);
    this.items.set(defaultItems());
    this.persistState();
    this.autoDetect();
  }

  private persistState(): void {
    if (!this.userId) return;
    const state: ChecklistState = {
      items: Object.fromEntries(this.items().map((i) => [i.id, i.completed])),
      dismissed: this.isDismissed(),
      skipped: this.isSkipped(),
      lastUpdated: new Date().toISOString(),
    };
    try {
      localStorage.setItem(
        `${STORAGE_PREFIX}${this.userId}`,
        JSON.stringify(state),
      );
    } catch {
      // localStorage full or unavailable — silently ignore
    }
  }

  private loadFromStorage(): void {
    if (!this.userId) return;
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${this.userId}`);
      if (!raw) return;

      const state: ChecklistState = JSON.parse(raw);
      if (state.dismissed) this.isDismissed.set(true);
      if (state.skipped) this.isSkipped.set(true);

      if (state.items) {
        this.items.set(
          this.items().map((item) => ({
            ...item,
            completed: state.items[item.id] ?? item.completed,
          })),
        );
      }
    } catch {
      // Corrupted data — start fresh
    }
  }

  private autoDetect(): void {
    // Auto-detect: create_task — check if total_tasks > 0
    this.dashboardService
      .getStats()
      .pipe(take(1))
      .subscribe({
        next: (stats) => {
          if (stats.total_tasks > 0) {
            this.markComplete('create_task');
          }
          // Auto-detect: set_due_date — if there are overdue or due_today tasks,
          // at least one task has a due date
          if (stats.overdue > 0 || stats.due_today > 0) {
            this.markComplete('set_due_date');
          }
        },
      });

    // Auto-detect: invite_teammate — check workspace member count > 1
    const workspaces = this.workspaceState.workspaces();
    if (workspaces.length > 0) {
      this.checkWorkspaceMembers(workspaces[0].id);
    }

    // Auto-detect: try_drag_drop — localStorage flag
    try {
      if (localStorage.getItem('tf_drag_drop_done')) {
        this.markComplete('try_drag_drop');
      }
    } catch {
      /* ignore */
    }

    // Auto-detect: explore_shortcuts — localStorage flag
    try {
      if (localStorage.getItem('tf_shortcut_modal_opened')) {
        this.markComplete('explore_shortcuts');
      }
    } catch {
      /* ignore */
    }
  }

  private checkWorkspaceMembers(workspaceId: string): void {
    this.workspaceService
      .getMembers(workspaceId)
      .pipe(take(1))
      .subscribe({
        next: (members) => {
          if (members.length > 1) {
            this.markComplete('invite_teammate');
          }
        },
      });
  }
}
