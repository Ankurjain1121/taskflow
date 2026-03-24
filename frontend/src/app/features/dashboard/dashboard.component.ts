import {
  Component,
  inject,
  Injector,
  OnInit,
  signal,
  computed,
  effect,
  untracked,
  HostListener,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import {
  DashboardService,
  DashboardStats,
  UpcomingDeadline,
} from '../../core/services/dashboard.service';
import { WorkspaceStateService } from '../../core/services/workspace-state.service';
import { Workspace } from '../../core/services/workspace.service';
import { TaskService } from '../../core/services/task.service';
import { OnboardingChecklistComponent } from '../../shared/components/onboarding-checklist/onboarding-checklist.component';
import { OnboardingChecklistService } from '../../core/services/onboarding-checklist.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { StatusLineComponent } from './components/smart-greeting.component';
import { FocusBoardComponent } from './components/focus-board.component';
import { FocusModeComponent } from './components/focus-mode.component';
import { FocusTask, ProjectPulse } from './dashboard.types';

interface WorkspaceOption {
  label: string;
  value: string | null;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    FormsModule,
    SelectModule,
    EmptyStateComponent,
    OnboardingChecklistComponent,
    StatusLineComponent,
    FocusBoardComponent,
    FocusModeComponent,
  ],
  template: `
    <div class="min-h-screen" style="background: var(--background)">
      <main class="max-w-3xl mx-auto px-4 sm:px-6 py-6">

        <!-- Header -->
        <div class="flex items-center justify-between flex-wrap gap-4 mb-8">
          <app-status-line [stats]="stats()" />

          <div class="flex items-center gap-3">
            @if (workspaceOptions().length > 1) {
              <p-select
                [options]="workspaceOptions()"
                [ngModel]="selectedWorkspaceId()"
                (ngModelChange)="onWorkspaceChange($event)"
                optionLabel="label"
                optionValue="value"
                placeholder="All Workspaces"
                [style]="{ 'min-width': '180px' }"
                [showClear]="false"
              />
            }

            <button
              class="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors btn-press"
              style="background: var(--muted); color: var(--muted-foreground)"
              (click)="toggleFocusMode()"
              title="Focus Mode (F)"
            >
              <i class="pi pi-bolt text-sm"></i>
              Focus
            </button>

            <a
              routerLink="/my-tasks"
              class="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:opacity-90 transition-colors font-medium text-sm"
            >
              <i class="pi pi-clipboard text-sm"></i>
              My Tasks
            </a>
          </div>
        </div>

        @if (loading()) {
          <!-- Skeleton -->
          <div class="space-y-3 mb-8">
            @for (i of [1, 2, 3]; track i) {
              <div class="h-14 rounded-lg skeleton"></div>
            }
          </div>
        } @else {
          <!-- Focus section -->
          <section class="mb-8">
            <h2
              class="text-xs font-semibold uppercase tracking-wider mb-3"
              style="color: var(--muted-foreground)"
            >
              Focus
            </h2>
            <app-focus-board
              [tasks]="focusTasks()"
              [selectedIndex]="focusSelectedIndex()"
              (taskCompleted)="onFocusTaskCompleted($event)"
              (taskSnoozed)="onFocusTaskSnoozed($event)"
            />
          </section>

          <!-- Coming Up section -->
          @if (upcomingDeadlines().length > 0) {
            <section class="mb-8 animate-fade-in-up">
              <h2
                class="text-xs font-semibold uppercase tracking-wider mb-3"
                style="color: var(--muted-foreground)"
              >
                Coming Up
              </h2>
              <div class="space-y-1">
                @for (item of upcomingDeadlines().slice(0, 5); track item.id) {
                  <a
                    [routerLink]="['/task', item.id]"
                    class="flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors hover:bg-[var(--muted)]"
                    style="color: var(--foreground)"
                  >
                    <span
                      class="w-2 h-2 rounded-full flex-shrink-0"
                      [style.background]="getUrgencyColor(item.days_until_due)"
                    ></span>
                    <span class="text-sm truncate flex-1">{{ item.title }}</span>
                    <span
                      class="text-xs flex-shrink-0"
                      style="color: var(--muted-foreground)"
                    >
                      {{ getRelativeDate(item.days_until_due) }}
                    </span>
                  </a>
                }
              </div>
            </section>
          }

          <!-- Projects section -->
          @if (projectPulse().length > 0) {
            <section class="mb-8 animate-fade-in-up">
              <h2
                class="text-xs font-semibold uppercase tracking-wider mb-3"
                style="color: var(--muted-foreground)"
              >
                Projects
              </h2>
              <div class="flex flex-wrap gap-3">
                @for (project of projectPulse(); track project.project_id) {
                  <a
                    [routerLink]="['/project', project.project_id, 'board']"
                    class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors bg-[var(--muted)] hover:bg-[var(--card)]"
                    style="color: var(--foreground)"
                  >
                    <span
                      class="w-2 h-2 rounded-full flex-shrink-0"
                      [style.background]="getHealthColor(project.health)"
                    ></span>
                    <span class="font-medium">{{ project.project_name }}</span>
                    @if (project.overdue_tasks > 0) {
                      <span
                        class="text-xs font-semibold"
                        style="color: var(--destructive)"
                      >
                        {{ project.overdue_tasks }}
                      </span>
                    }
                  </a>
                }
              </div>
            </section>
          }

          <!-- Empty workspace prompt -->
          @if (workspaces().length === 0) {
            <app-empty-state variant="workspace" (ctaClicked)="navigateToOnboarding()" />
          }
        }
      </main>

      <app-onboarding-checklist />

      <!-- Focus Mode Overlay -->
      <app-focus-mode
        [visible]="focusModeOpen()"
        [tasks]="focusTasks()"
        (closed)="closeFocusMode()"
        (taskCompleted)="onFocusTaskCompleted($event)"
      />
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  private dashboardService = inject(DashboardService);
  private workspaceState = inject(WorkspaceStateService);
  private taskService = inject(TaskService);
  private checklistService = inject(OnboardingChecklistService);
  private injector = inject(Injector);

  workspaces = signal<Workspace[]>([]);
  loading = signal(true);
  stats = signal<DashboardStats | null>(null);
  focusTasks = signal<FocusTask[]>([]);
  upcomingDeadlines = signal<UpcomingDeadline[]>([]);
  projectPulse = signal<ProjectPulse[]>([]);
  selectedWorkspaceId = signal<string | null>(null);
  focusModeOpen = signal(false);
  focusSelectedIndex = signal(-1);

  workspaceOptions = computed<WorkspaceOption[]>(() => {
    const ws = this.workspaces();
    if (ws.length <= 1) return [];
    return [
      { label: 'All Workspaces', value: null },
      ...ws.map((w) => ({ label: w.name, value: w.id })),
    ];
  });

  activeWorkspaceId = computed(() => this.selectedWorkspaceId() ?? undefined);

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (this.isInputFocused()) return;
    const tasks = this.focusTasks();
    const idx = this.focusSelectedIndex();

    switch (event.key) {
      case '1': case '2': case '3': case '4': case '5': {
        const num = parseInt(event.key, 10) - 1;
        if (num < tasks.length) this.focusSelectedIndex.set(num);
        break;
      }
      case 'Enter':
        if (idx >= 0 && idx < tasks.length) {
          this.router.navigate(['/task', tasks[idx].id]);
        }
        break;
      case ' ':
        if (idx >= 0 && idx < tasks.length) {
          event.preventDefault();
          this.onFocusTaskCompleted(tasks[idx].id);
        }
        break;
      case 'f':
        this.toggleFocusMode();
        break;
    }
  }

  ngOnInit(): void {
    const user = this.authService.currentUser();
    if (!user) {
      this.router.navigate(['/auth/sign-in']);
      return;
    }

    this.dashboardService.invalidateCache();
    this.loadWorkspaces();
    this.checklistService.initialize();

    effect(
      () => {
        const ws = this.workspaceState.workspaces();
        const isLoading = this.workspaceState.loading();
        untracked(() => {
          this.workspaces.set(ws);
          if (!isLoading && this.loading()) {
            this.loading.set(false);
            const saved = this.workspaceState.currentWorkspaceId();
            if (saved && ws.some((w) => w.id === saved)) {
              this.selectedWorkspaceId.set(saved);
            }
          }
          const wsId = this.selectedWorkspaceId() ?? undefined;
          this.loadStats(wsId);
          this.loadFocusTasks(wsId);
          this.loadUpcomingDeadlines(wsId);
          this.loadProjectPulse(wsId);
        });
      },
      { injector: this.injector },
    );
  }

  onWorkspaceChange(value: string | null): void {
    this.selectedWorkspaceId.set(value);
    this.workspaceState.selectWorkspace(value);
    const wsId = value ?? undefined;
    this.loadStats(wsId);
    this.loadFocusTasks(wsId);
    this.loadUpcomingDeadlines(wsId);
    this.loadProjectPulse(wsId);
  }

  onFocusTaskCompleted(taskId: string): void {
    this.taskService.updateTask(taskId, { status_id: null }).subscribe({
      error: () => {
        // Revert optimistic UI would happen in the card
      },
    });
  }

  onFocusTaskSnoozed(_taskId: string): void {
    // Snooze is handled locally in FocusBoardComponent via localStorage
  }

  toggleFocusMode(): void {
    this.focusModeOpen.update((v) => !v);
  }

  closeFocusMode(): void {
    this.focusModeOpen.set(false);
  }

  navigateToOnboarding(): void {
    this.router.navigate(['/onboarding']);
  }

  getUrgencyColor(daysUntilDue: number): string {
    if (daysUntilDue <= 1) return 'var(--destructive)';
    if (daysUntilDue <= 3) return 'var(--status-amber-text)';
    return 'var(--muted-foreground)';
  }

  getRelativeDate(daysUntilDue: number): string {
    if (daysUntilDue === 0) return 'Today';
    if (daysUntilDue === 1) return 'Tomorrow';
    return `In ${daysUntilDue}d`;
  }

  getHealthColor(health: 'green' | 'amber' | 'red'): string {
    switch (health) {
      case 'green': return '#22c55e';
      case 'amber': return '#f59e0b';
      case 'red': return '#ef4444';
    }
  }

  private loadWorkspaces(): void {
    this.workspaceState.loadWorkspaces();
  }

  private loadStats(workspaceId?: string): void {
    this.dashboardService.getStats(workspaceId).subscribe({
      next: (s) => this.stats.set(s),
      error: () => { /* Stats show 0 */ },
    });
  }

  private loadFocusTasks(workspaceId?: string): void {
    this.dashboardService.getFocusTasks(workspaceId).subscribe({
      next: (tasks) => this.focusTasks.set(tasks),
      error: () => this.focusTasks.set([]),
    });
  }

  private loadUpcomingDeadlines(workspaceId?: string): void {
    this.dashboardService.getUpcomingDeadlines(5, workspaceId).subscribe({
      next: (deadlines) => this.upcomingDeadlines.set(deadlines),
      error: () => this.upcomingDeadlines.set([]),
    });
  }

  private loadProjectPulse(workspaceId?: string): void {
    this.dashboardService.getProjectPulse(workspaceId).subscribe({
      next: (projects) => this.projectPulse.set(projects),
      error: () => this.projectPulse.set([]),
    });
  }

  private isInputFocused(): boolean {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' ||
      (el as HTMLElement).isContentEditable;
  }
}
