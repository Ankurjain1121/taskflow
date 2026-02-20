import {
  Component,
  inject,
  OnInit,
  signal,
  computed,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import {
  DashboardService,
  DashboardStats,
  DashboardActivityEntry,
} from '../../core/services/dashboard.service';
import { WorkspaceStateService } from '../../core/services/workspace-state.service';
import { Workspace } from '../../core/services/workspace.service';
import { TasksByStatusComponent } from './widgets/tasks-by-status.component';
import { TasksByPriorityComponent } from './widgets/tasks-by-priority.component';
import { OverdueTasksTableComponent } from './widgets/overdue-tasks-table.component';
import { CompletionTrendComponent } from './widgets/completion-trend.component';
import { UpcomingDeadlinesComponent } from './widgets/upcoming-deadlines.component';
import { MyTasksTodayComponent } from './widgets/my-tasks-today.component';
import { TeamWorkloadComponent } from './widgets/team-workload.component';

interface WorkspaceOption {
  label: string;
  value: string | null;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    SelectModule,
    TasksByStatusComponent,
    TasksByPriorityComponent,
    OverdueTasksTableComponent,
    CompletionTrendComponent,
    UpcomingDeadlinesComponent,
    MyTasksTodayComponent,
    TeamWorkloadComponent,
  ],
  template: `
    <div class="min-h-screen" style="background: var(--background)">
      <!-- Main Content (no separate header) -->
      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <!-- Dashboard Header (inline, not a separate bar) -->
        <div class="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div class="animate-fade-in-up">
            <h1
              class="text-2xl font-semibold tracking-tight font-display"
              style="color: var(--foreground)"
            >
              {{ getGreeting() }}{{ userName() ? ', ' + userName() : '' }}
            </h1>
            <p class="text-sm mt-0.5" style="color: var(--muted-foreground)">
              Here's what's happening across your projects
            </p>
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

            <a
              routerLink="/my-tasks"
              class="animate-fade-in-up stagger-2 inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:opacity-90 transition-colors font-medium text-sm"
            >
              <i class="pi pi-clipboard text-sm"></i>
              My Tasks
            </a>
          </div>
        </div>

        @if (loading()) {
          <!-- Skeleton Loading -->
          <div
            class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
          >
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
        } @else {
          <!-- Stats Cards -->
          <div
            class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
          >
            <!-- Total Tasks -->
            <a
              routerLink="/my-tasks"
              class="animate-fade-in-up stagger-1 widget-card p-5 cursor-pointer group"
              style="border-left: 4px solid var(--primary)"
            >
              <div class="flex items-center justify-between">
                <div>
                  <p class="widget-title">Total Tasks</p>
                  <p
                    class="text-3xl font-bold tracking-tight mt-1 animate-count-up font-display"
                    style="color: var(--foreground)"
                  >
                    {{ stats()?.total_tasks || 0 }}
                  </p>
                </div>
                <div
                  class="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform"
                >
                  <i
                    class="pi pi-clipboard text-primary"
                  ></i>
                </div>
              </div>
            </a>

            <!-- Overdue -->
            <a
              routerLink="/my-tasks"
              [queryParams]="{ sort_by: 'due_date', sort_order: 'asc' }"
              class="animate-fade-in-up stagger-2 widget-card p-5 cursor-pointer group"
              style="border-left: 4px solid #ef4444"
            >
              <div class="flex items-center justify-between">
                <div>
                  <p class="widget-title">Overdue</p>
                  <p
                    class="text-3xl font-bold mt-1 tracking-tight animate-count-up font-display"
                    [class]="
                      (stats()?.overdue || 0) > 0
                        ? 'text-red-600 dark:text-red-400'
                        : ''
                    "
                    [style.color]="
                      (stats()?.overdue || 0) === 0 ? 'var(--foreground)' : ''
                    "
                  >
                    {{ stats()?.overdue || 0 }}
                  </p>
                </div>
                <div
                  class="w-9 h-9 bg-red-50 dark:bg-red-900/30 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform"
                >
                  <i
                    class="pi pi-exclamation-triangle text-red-500 dark:text-red-400"
                  ></i>
                </div>
              </div>
            </a>

            <!-- Due Today -->
            <a
              routerLink="/my-tasks"
              [queryParams]="{ sort_by: 'due_date' }"
              class="animate-fade-in-up stagger-3 widget-card p-5 cursor-pointer group"
              style="border-left: 4px solid #f97316"
            >
              <div class="flex items-center justify-between">
                <div>
                  <p class="widget-title">Due Today</p>
                  <p
                    class="text-3xl font-bold mt-1 tracking-tight animate-count-up font-display"
                    style="color: var(--foreground)"
                  >
                    {{ stats()?.due_today || 0 }}
                  </p>
                </div>
                <div
                  class="w-9 h-9 bg-orange-50 dark:bg-orange-900/30 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform"
                >
                  <i
                    class="pi pi-clock text-orange-500 dark:text-orange-400"
                  ></i>
                </div>
              </div>
            </a>

            <!-- Completed This Week -->
            <div
              class="animate-fade-in-up stagger-4 widget-card p-5"
              style="border-left: 4px solid #10b981"
            >
              <div class="flex items-center justify-between">
                <div>
                  <p class="widget-title">Completed This Week</p>
                  <p
                    class="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tracking-tight animate-count-up font-display"
                  >
                    {{ stats()?.completed_this_week || 0 }}
                  </p>
                </div>
                <div
                  class="w-9 h-9 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center"
                >
                  <i
                    class="pi pi-check-circle text-emerald-500 dark:text-emerald-400"
                  ></i>
                </div>
              </div>
            </div>
          </div>

          <!-- My Tasks Today Widget -->
          <div class="mb-6 animate-fade-in-up stagger-5">
            <app-my-tasks-today [workspaceId]="activeWorkspaceId()" />
          </div>

          <!-- Recent Activity -->
          @if (recentActivity().length > 0) {
            <div
              class="animate-fade-in-up stagger-5 widget-card mb-6 overflow-hidden"
            >
              <div
                class="px-5 py-3.5"
                style="border-bottom: 1px solid var(--border)"
              >
                <h2 class="widget-title">Recent Activity</h2>
              </div>
              <div style="border-color: var(--border)">
                @for (
                  activity of displayedActivity();
                  track activity.id;
                  let i = $index
                ) {
                  <div
                    class="px-5 py-3 flex items-start gap-3 animate-fade-in-up"
                    [style.animation-delay]="i * 0.04 + 's'"
                    [style.border-bottom]="
                      i < displayedActivity().length - 1
                        ? '1px solid var(--border)'
                        : 'none'
                    "
                  >
                    <div class="flex-shrink-0">
                      @if (activity.actor_avatar_url) {
                        <img
                          [src]="activity.actor_avatar_url"
                          [alt]="activity.actor_name"
                          class="w-7 h-7 rounded-full object-cover"
                        />
                      } @else {
                        <div
                          class="w-7 h-7 rounded-full bg-primary flex items-center justify-center"
                        >
                          <span class="text-xs font-medium text-white">{{
                            activity.actor_name.charAt(0).toUpperCase()
                          }}</span>
                        </div>
                      }
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm" style="color: var(--foreground)">
                        <span class="font-medium">{{
                          activity.actor_name
                        }}</span>
                        <span style="color: var(--muted-foreground)">
                          {{ formatAction(activity.action) }}
                        </span>
                        <span style="color: var(--muted-foreground)"
                          >a {{ activity.entity_type }}</span
                        >
                        @if (
                          activity.metadata && activity.metadata['task_title']
                        ) {
                          <span style="color: var(--muted-foreground)">
                            &middot;
                          </span>
                          <span
                            class="font-medium text-primary"
                            >{{ activity.metadata['task_title'] }}</span
                          >
                        }
                      </p>
                      <p
                        class="text-xs mt-0.5"
                        style="color: var(--muted-foreground)"
                      >
                        {{ formatRelativeTime(activity.created_at) }}
                      </p>
                    </div>
                    <div class="flex-shrink-0">
                      <span
                        class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium"
                        [class]="getActionBadgeClass(activity.action)"
                      >
                        {{ activity.action }}
                      </span>
                    </div>
                  </div>
                }
              </div>
              @if (recentActivity().length > 5 && !showAllActivity()) {
                <div
                  class="px-5 py-2.5 text-center"
                  style="border-top: 1px solid var(--border)"
                >
                  <button
                    (click)="showAllActivity.set(true)"
                    class="text-xs font-medium text-primary hover:underline"
                  >
                    Show {{ recentActivity().length - 5 }} more
                  </button>
                </div>
              }
            </div>
          }

          <!-- Analytics Section -->
          <div class="animate-fade-in-up stagger-6 mb-6">
            <div class="mb-4">
              <h2 class="widget-title text-sm">Analytics & Insights</h2>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <!-- Completion trend: full-width hero -->
              <app-completion-trend
                [workspaceId]="activeWorkspaceId()"
                class="lg:col-span-2 min-h-[360px]"
              />
              <!-- Status + Priority: 2-col -->
              <app-tasks-by-status
                [workspaceId]="activeWorkspaceId()"
                class="min-h-[360px]"
              />
              <app-tasks-by-priority
                [workspaceId]="activeWorkspaceId()"
                class="min-h-[360px]"
              />
              <!-- Deadlines + Workload: 2-col -->
              <app-upcoming-deadlines
                [workspaceId]="activeWorkspaceId()"
                class="min-h-[360px]"
              />
              <app-team-workload
                [workspaceId]="activeWorkspaceId()"
                class="min-h-[360px]"
              />
              <!-- Overdue table: full-width bottom -->
              <app-overdue-tasks-table
                [workspaceId]="activeWorkspaceId()"
                class="lg:col-span-2 min-h-[360px]"
              />
            </div>
          </div>

          <!-- Workspaces Section -->
          @if (workspaces().length === 0) {
            <div class="animate-fade-in-up text-center py-16">
              <div
                class="mx-auto w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
                style="background: var(--muted)"
              >
                <i
                  class="pi pi-building text-3xl"
                  style="color: var(--muted-foreground)"
                ></i>
              </div>
              <h3
                class="text-xl font-semibold mb-2"
                style="color: var(--foreground)"
              >
                Your workspace awaits
              </h3>
              <p
                class="mb-1 max-w-sm mx-auto"
                style="color: var(--muted-foreground)"
              >
                Create your first workspace and start organizing your projects.
              </p>
              <p class="text-sm mb-8" style="color: var(--muted-foreground)">
                It only takes a few seconds to get going.
              </p>
              <a
                routerLink="/onboarding"
                class="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:opacity-90 transition-colors font-medium text-sm"
              >
                <i class="pi pi-plus"></i>
                Create Workspace
              </a>
            </div>
          } @else {
            <div
              class="animate-fade-in-up stagger-6 mb-4 flex items-center justify-between"
            >
              <h2 class="widget-title text-sm">Your Workspaces</h2>
              <span class="text-xs" style="color: var(--muted-foreground)">
                {{ workspaces().length }} workspace{{
                  workspaces().length !== 1 ? 's' : ''
                }}
              </span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              @for (
                workspace of workspaces();
                track workspace.id;
                let i = $index
              ) {
                <div
                  class="animate-fade-in-up widget-card overflow-hidden group"
                  [style.animation-delay]="0.3 + i * 0.08 + 's'"
                >
                  <div class="p-5">
                    <div class="flex items-start justify-between">
                      <h3
                        class="text-base font-semibold group-hover:text-primary transition-colors"
                        style="color: var(--foreground)"
                      >
                        {{ workspace.name }}
                      </h3>
                      <div
                        class="w-9 h-9 bg-primary rounded-lg flex items-center justify-center"
                      >
                        <span class="text-white font-bold text-sm">{{
                          workspace.name.charAt(0).toUpperCase()
                        }}</span>
                      </div>
                    </div>
                  </div>
                  <div
                    class="px-5 py-2.5 transition-colors"
                    style="border-top: 1px solid var(--border); background: var(--muted)"
                  >
                    <a
                      [routerLink]="['/workspace', workspace.id]"
                      class="text-sm text-primary hover:text-primary font-medium inline-flex items-center gap-1"
                    >
                      Open Workspace
                      <i
                        class="pi pi-arrow-right text-xs transition-transform group-hover:translate-x-0.5"
                      ></i>
                    </a>
                  </div>
                </div>
              }
            </div>
          }
        }
      </main>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  private dashboardService = inject(DashboardService);
  private workspaceState = inject(WorkspaceStateService);

  workspaces = signal<Workspace[]>([]);
  loading = signal(true);
  userName = signal<string | null>(null);
  stats = signal<DashboardStats | null>(null);
  recentActivity = signal<DashboardActivityEntry[]>([]);
  showAllActivity = signal(false);

  selectedWorkspaceId = signal<string | null>(null);

  displayedActivity = computed(() => {
    const all = this.recentActivity();
    return this.showAllActivity() ? all : all.slice(0, 5);
  });

  workspaceOptions = computed<WorkspaceOption[]>(() => {
    const ws = this.workspaces();
    if (ws.length <= 1) return [];
    return [
      { label: 'All Workspaces', value: null },
      ...ws.map((w) => ({ label: w.name, value: w.id })),
    ];
  });

  activeWorkspaceId = computed(() => {
    const id = this.selectedWorkspaceId();
    return id ?? undefined;
  });

  constructor() {
    effect(() => {
      const ws = this.workspaceState.workspaces();
      this.workspaces.set(ws);
      if (this.workspaceState.loading()) return;
      this.loading.set(false);

      const saved = this.workspaceState.currentWorkspaceId();
      if (saved && ws.some((w) => w.id === saved)) {
        this.selectedWorkspaceId.set(saved);
      }
    });

    effect(() => {
      const wsId = this.selectedWorkspaceId();
      this.loadStats(wsId ?? undefined);
      this.loadRecentActivity(wsId ?? undefined);
    });
  }

  ngOnInit(): void {
    const user = this.authService.currentUser();
    if (!user) {
      this.router.navigate(['/auth/sign-in']);
      return;
    }

    this.userName.set(user.name?.split(' ')[0] || null);
    this.loadWorkspaces();
  }

  onWorkspaceChange(value: string | null): void {
    this.selectedWorkspaceId.set(value);
    this.workspaceState.selectWorkspace(value);
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  formatAction(action: string): string {
    const actionMap: Record<string, string> = {
      created: 'created',
      updated: 'updated',
      moved: 'moved',
      assigned: 'assigned',
      unassigned: 'unassigned',
      commented: 'commented on',
      attached: 'attached a file to',
      status_changed: 'changed status of',
      priority_changed: 'changed priority of',
      deleted: 'deleted',
    };
    return actionMap[action] || action;
  }

  formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  getActionBadgeClass(action: string): string {
    switch (action) {
      case 'created':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'deleted':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'moved':
      case 'status_changed':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'commented':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'assigned':
      case 'unassigned':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
      default:
        return 'bg-[var(--secondary)] text-[var(--secondary-foreground)]';
    }
  }

  private loadWorkspaces(): void {
    this.workspaceState.loadWorkspaces();
  }

  private loadStats(workspaceId?: string): void {
    this.dashboardService.getStats(workspaceId).subscribe({
      next: (stats) => this.stats.set(stats),
      error: () => {
        // Stats loading failed - cards show 0
      },
    });
  }

  private loadRecentActivity(workspaceId?: string): void {
    this.dashboardService.getRecentActivity(10, workspaceId).subscribe({
      next: (activity) => this.recentActivity.set(activity),
      error: () => {
        // Activity loading failed - section won't show
      },
    });
  }
}
