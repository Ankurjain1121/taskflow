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
import { DashboardService, DashboardStats } from '../../core/services/dashboard.service';
import { WorkspaceStateService } from '../../core/services/workspace-state.service';
import { Workspace } from '../../core/services/workspace.service';
import { TaskService } from '../../core/services/task.service';
import { OnboardingChecklistComponent } from '../../shared/components/onboarding-checklist/onboarding-checklist.component';
import { OnboardingChecklistService } from '../../core/services/onboarding-checklist.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { CountUpDirective } from '../../shared/directives/count-up.directive';
import { SmartGreetingComponent } from './components/smart-greeting.component';
import { StreakCounterComponent } from './components/streak-counter.component';
import { FocusBoardComponent } from './components/focus-board.component';
import { DashboardAct2Component } from './components/dashboard-act2.component';
import { DashboardAct3Component } from './components/dashboard-act3.component';
import { FocusModeComponent } from './components/focus-mode.component';
import { FocusTask, StreakData } from './dashboard.types';
import { LOADING_MESSAGES, randomMessage } from '../../shared/utils/delight-messages';

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
    CountUpDirective,
    SmartGreetingComponent,
    StreakCounterComponent,
    FocusBoardComponent,
    DashboardAct2Component,
    DashboardAct3Component,
    FocusModeComponent,
  ],
  template: `
    <div class="min-h-screen" style="background-color: transparent">
      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 view-enter">
        <!-- Act 1: Header + Focus Board -->
        <div class="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div class="flex items-center gap-4">
            <app-smart-greeting [stats]="stats()" [userName]="userName()" />
            <app-streak-counter [streak]="streak()" />
          </div>

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
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            @for (i of [1, 2, 3, 4]; track i) {
              <div class="widget-card p-5">
                <div class="flex items-center justify-between">
                  <div class="space-y-3 flex-1">
                    <div class="skeleton skeleton-text w-20"></div>
                    <div class="skeleton skeleton-heading w-16"></div>
                  </div>
                  <div class="skeleton w-9 h-9 rounded-lg"></div>
                </div>
              </div>
            }
          </div>
          <p class="text-center text-sm mt-4" style="color: var(--muted-foreground)">
            {{ loadingMessage }}
          </p>
        } @else {
          <!-- Stat Cards — number IS the design -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <a routerLink="/my-tasks" class="animate-fade-in-up stagger-1 stat-card cursor-pointer group">
              <div class="flex items-start justify-between">
                <div>
                  <p class="stat-card-label uppercase tracking-wider text-xs font-semibold">Daily Load</p>
                  <p class="stat-card-value animate-count-up mt-2" [appCountUp]="stats()?.total_tasks || 0"></p>
                  <p class="stat-card-desc">total tasks assigned</p>
                </div>
                <div class="stat-card-icon" style="background: color-mix(in srgb, var(--primary) 12%, transparent); color: var(--primary)"><i class="pi pi-clipboard"></i></div>
              </div>
            </a>
            <a routerLink="/my-tasks" [queryParams]="{ sort_by: 'due_date', sort_order: 'asc' }" class="animate-fade-in-up stagger-2 stat-card cursor-pointer group" [class.stat-card--danger-active]="(stats()?.overdue || 0) > 0">
              <div class="flex items-start justify-between">
                <div>
                  <p class="stat-card-label uppercase tracking-wider text-xs font-semibold">Overdue</p>
                  <p class="stat-card-value animate-count-up mt-2" [style.color]="(stats()?.overdue || 0) > 0 ? 'var(--destructive)' : 'var(--foreground)'" [appCountUp]="stats()?.overdue || 0"></p>
                  <p class="stat-card-desc">{{ (stats()?.overdue || 0) === 0 ? 'none right now' : 'need attention' }}</p>
                </div>
                <div class="stat-card-icon" style="background: color-mix(in srgb, var(--destructive) 12%, transparent); color: var(--destructive)"><i class="pi pi-exclamation-triangle"></i></div>
              </div>
            </a>
            <a routerLink="/my-tasks" [queryParams]="{ sort_by: 'due_date' }" class="animate-fade-in-up stagger-3 stat-card cursor-pointer group">
              <div class="flex items-start justify-between">
                <div>
                  <p class="stat-card-label uppercase tracking-wider text-xs font-semibold">Due Today</p>
                  <p class="stat-card-value animate-count-up mt-2" [appCountUp]="stats()?.due_today || 0"></p>
                  <p class="stat-card-desc">tasks due today</p>
                </div>
                <div class="stat-card-icon" style="background: color-mix(in srgb, var(--status-amber-text, #9A6A08) 12%, transparent); color: var(--status-amber-text, #9A6A08)"><i class="pi pi-clock"></i></div>
              </div>
            </a>
            <div class="animate-fade-in-up stagger-4 stat-card">
              <div class="flex items-start justify-between">
                <div>
                  <p class="stat-card-label uppercase tracking-wider text-xs font-semibold">This Week</p>
                  <p class="stat-card-value animate-count-up mt-2" style="color: var(--success)" [appCountUp]="stats()?.completed_this_week || 0"></p>
                  <p class="stat-card-desc">completed this week</p>
                </div>
                <div class="stat-card-icon" style="background: color-mix(in srgb, var(--success) 12%, transparent); color: var(--success)"><i class="pi pi-check-circle"></i></div>
              </div>
            </div>
          </div>

          <!-- Focus Board -->
          <div class="mb-8 animate-fade-in-up stagger-5">
            <app-focus-board
              [tasks]="focusTasks()"
              [selectedIndex]="focusSelectedIndex()"
              (taskCompleted)="onFocusTaskCompleted($event)"
              (taskSnoozed)="onFocusTaskSnoozed($event)"
            />
          </div>

          <!-- Scroll indicator between Act 1 and Act 2 -->
          @if (!hasScrolledPastAct1()) {
            <div class="flex justify-center mb-6 scroll-indicator">
              <div class="flex flex-col items-center gap-1">
                <span class="text-[11px] font-medium" style="color: var(--muted-foreground)">Scroll for more</span>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" class="scroll-chevron" aria-hidden="true">
                  <path d="M5 8l5 5 5-5" stroke="var(--muted-foreground)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>
          }

          <!-- Act 2: Project Pulse + Analytics -->
          @defer (on viewport) {
            <app-dashboard-act2
              [workspaceId]="activeWorkspaceId()"
              [overdueCount]="stats()?.overdue || 0"
              class="block mb-8 animate-fade-in-up"
            />
          } @placeholder {
            <div class="h-[400px]"></div>
          }

          <!-- Act 3: Metrics -->
          @defer (on viewport) {
            <div class="mb-8 animate-fade-in-up">
              <app-dashboard-act3 [workspaceId]="activeWorkspaceId()" />
            </div>
          } @placeholder {
            <div class="h-[300px]"></div>
          }

          <!-- Empty workspace prompt (no workspaces at all) -->
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
  userName = signal<string | null>(null);
  stats = signal<DashboardStats | null>(null);
  focusTasks = signal<FocusTask[]>([]);
  streak = signal<StreakData | null>(null);
  selectedWorkspaceId = signal<string | null>(null);
  focusModeOpen = signal(false);
  focusSelectedIndex = signal(-1);
  hasScrolledPastAct1 = signal(false);
  loadingMessage = randomMessage(LOADING_MESSAGES);

  workspaceOptions = computed<WorkspaceOption[]>(() => {
    const ws = this.workspaces();
    if (ws.length <= 1) return [];
    return [
      { label: 'All Workspaces', value: null },
      ...ws.map((w) => ({ label: w.name, value: w.id })),
    ];
  });

  activeWorkspaceId = computed(() => this.selectedWorkspaceId() ?? undefined);

  @HostListener('window:scroll')
  onScroll(): void {
    if (!this.hasScrolledPastAct1() && window.scrollY > 400) {
      this.hasScrolledPastAct1.set(true);
    }
  }

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
      case 's':
        if (idx >= 0 && idx < tasks.length) {
          // Snooze handled by focus board
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

    this.userName.set(user.name?.split(' ')[0] || null);
    this.dashboardService.invalidateCache();
    this.loadWorkspaces();
    this.checklistService.initialize();
    this.loadStreak();

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
          this.loadStats(this.selectedWorkspaceId() ?? undefined);
          this.loadFocusTasks(this.selectedWorkspaceId() ?? undefined);
        });
      },
      { injector: this.injector },
    );
  }

  onWorkspaceChange(value: string | null): void {
    this.selectedWorkspaceId.set(value);
    this.workspaceState.selectWorkspace(value);
    this.loadStats(value ?? undefined);
    this.loadFocusTasks(value ?? undefined);
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

  private loadStreak(): void {
    this.dashboardService.getStreak().subscribe({
      next: (data) => this.streak.set(data),
      error: () => this.streak.set(null),
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
