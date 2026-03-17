import {
  Component,
  inject,
  Injector,
  OnInit,
  signal,
  computed,
  effect,
  untracked,
  ChangeDetectionStrategy,
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
  CycleTimePoint,
  VelocityPoint,
  WorkloadBalanceEntry,
  OnTimeMetric,
} from '../../core/services/dashboard.service';
import { WorkspaceStateService } from '../../core/services/workspace-state.service';
import { Workspace } from '../../core/services/workspace.service';
import {
  TeamGroupsService,
  TeamGroup,
} from '../../core/services/team-groups.service';
import { MyTasksTodayComponent } from './widgets/my-tasks-today.component';
import { OverdueTasksTableComponent } from './widgets/overdue-tasks-table.component';
import { TeamWorkloadComponent } from './widgets/team-workload.component';
import { CompletionTrendComponent } from './widgets/completion-trend.component';
import { TasksByStatusComponent } from './widgets/tasks-by-status.component';
import { TasksByPriorityComponent } from './widgets/tasks-by-priority.component';
import { UpcomingDeadlinesComponent } from './widgets/upcoming-deadlines.component';
import { CycleTimeChartComponent } from './widgets/cycle-time-chart.component';
import { VelocityChartComponent } from './widgets/velocity-chart.component';
import { WorkloadBalanceComponent } from './widgets/workload-balance.component';
import { ResourceUtilizationComponent } from './widgets/resource-utilization.component';
import { OnTimeMetricComponent } from './widgets/on-time-metric.component';
import {
  ReportsService,
  ResourceUtilizationEntry,
} from '../../core/services/reports.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { OnboardingChecklistComponent } from '../../shared/components/onboarding-checklist/onboarding-checklist.component';
import { OnboardingChecklistService } from '../../core/services/onboarding-checklist.service';
import { CountUpDirective } from '../../shared/directives/count-up.directive';

type DashboardView = 'workspace' | 'team' | 'personal';

interface WorkspaceOption {
  label: string;
  value: string | null;
}

interface TeamOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    SelectModule,
    MyTasksTodayComponent,
    OverdueTasksTableComponent,
    TeamWorkloadComponent,
    CompletionTrendComponent,
    TasksByStatusComponent,
    TasksByPriorityComponent,
    UpcomingDeadlinesComponent,
    CycleTimeChartComponent,
    VelocityChartComponent,
    WorkloadBalanceComponent,
    ResourceUtilizationComponent,
    OnTimeMetricComponent,
    EmptyStateComponent,
    OnboardingChecklistComponent,
    CountUpDirective,
  ],
  template: `
    <div class="min-h-screen" style="background: var(--background)">
      <!-- Main Content (no separate header) -->
      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <!-- Dashboard Header (inline, not a separate bar) -->
        <div class="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div class="animate-fade-in-up">
            <h1
              class="text-2xl font-bold tracking-tight font-display"
              style="color: var(--foreground)"
            >
              {{ getGreeting() }}{{ userName() ? ', ' + userName() : '' }}
            </h1>
            <p class="text-sm mt-1" style="color: var(--muted-foreground)">
              @if ((stats()?.overdue || 0) > 0) {
                You have <span class="font-semibold text-red-500">{{ stats()?.overdue }}</span> overdue {{ stats()?.overdue === 1 ? 'task' : 'tasks' }} that {{ stats()?.overdue === 1 ? 'needs' : 'need' }} attention
              } @else if ((stats()?.due_today || 0) > 0) {
                {{ stats()?.due_today }} {{ stats()?.due_today === 1 ? 'task' : 'tasks' }} due today &mdash; you've got this
              } @else {
                Here's what's happening across your projects
              }
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
              class="animate-fade-in-up stagger-1 stat-card stat-card--primary cursor-pointer group"
            >
              <div class="stat-card-icon">
                <i class="pi pi-clipboard" aria-hidden="true"></i>
              </div>
              <p class="stat-card-value animate-count-up" [appCountUp]="stats()?.total_tasks || 0"></p>
              <p class="stat-card-label">Total Tasks</p>
            </a>

            <!-- Overdue -->
            <a
              routerLink="/my-tasks"
              [queryParams]="{ sort_by: 'due_date', sort_order: 'asc' }"
              class="animate-fade-in-up stagger-2 stat-card stat-card--danger cursor-pointer group"
              [class.stat-card--danger-active]="(stats()?.overdue || 0) > 0"
            >
              <div class="stat-card-icon">
                <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
              </div>
              <p class="stat-card-value animate-count-up" [appCountUp]="stats()?.overdue || 0"></p>
              <p class="stat-card-label">Overdue</p>
            </a>

            <!-- Due Today -->
            <a
              routerLink="/my-tasks"
              [queryParams]="{ sort_by: 'due_date' }"
              class="animate-fade-in-up stagger-3 stat-card stat-card--warning cursor-pointer group"
            >
              <div class="stat-card-icon">
                <i class="pi pi-clock" aria-hidden="true"></i>
              </div>
              <p class="stat-card-value animate-count-up" [appCountUp]="stats()?.due_today || 0"></p>
              <p class="stat-card-label">Due Today</p>
            </a>

            <!-- Completed This Week -->
            <div class="animate-fade-in-up stagger-4 stat-card stat-card--success">
              <div class="stat-card-icon">
                <i class="pi pi-check-circle" aria-hidden="true"></i>
              </div>
              <p class="stat-card-value animate-count-up" [appCountUp]="stats()?.completed_this_week || 0"></p>
              <p class="stat-card-label">Completed This Week</p>
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
                          <span class="font-medium text-primary">{{
                            activity.metadata['task_title']
                          }}</span>
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

          <!-- Metrics View Toggle -->
          @if (metricsLoading() || hasAnyMetrics()) {
          @defer (on viewport) {
          <div class="animate-fade-in-up stagger-6 mb-6">
            <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div class="flex items-center gap-2">
                <h2 class="widget-title text-sm">Metrics</h2>
                <div
                  class="flex gap-0.5 rounded-lg p-0.5 ml-2"
                  style="background: var(--muted)"
                >
                  @for (view of viewOptions; track view.value) {
                    <button
                      (click)="setActiveView(view.value)"
                      class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
                      [attr.aria-pressed]="activeView() === view.value"
                      [style.background]="
                        activeView() === view.value
                          ? 'var(--card)'
                          : 'transparent'
                      "
                      [style.color]="
                        activeView() === view.value
                          ? 'var(--primary)'
                          : 'var(--muted-foreground)'
                      "
                      [style.box-shadow]="
                        activeView() === view.value
                          ? '0 1px 2px rgba(0,0,0,0.05)'
                          : 'none'
                      "
                    >
                      <i [class]="view.icon + ' mr-1'"></i>
                      {{ view.label }}
                    </button>
                  }
                </div>
              </div>

              <div class="flex items-center gap-2">
                @if (activeView() === 'team' && teamOptions().length > 0) {
                  <p-select
                    [options]="teamOptions()"
                    [ngModel]="selectedTeamId()"
                    (ngModelChange)="onTeamChange($event)"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Select a team"
                    [style]="{ 'min-width': '180px' }"
                  />
                }
                <button
                  (click)="exportMetricsCsv()"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                  style="background: var(--muted); color: var(--muted-foreground)"
                  title="Export metrics as CSV"
                >
                  <i class="pi pi-download text-xs"></i>
                  Export
                </button>
              </div>
            </div>

            @if (metricsLoading()) {
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
                @for (i of [1, 2, 3, 4]; track i) {
                  <div class="widget-card p-5 min-h-[300px] animate-pulse">
                    <div
                      class="h-4 w-32 rounded mb-4"
                      style="background: var(--muted)"
                    ></div>
                    <div
                      class="h-52 w-full rounded-lg"
                      style="background: var(--muted)"
                    ></div>
                  </div>
                }
              </div>
            } @else {
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <app-cycle-time-chart
                  [data]="metricsCycleTime()"
                  class="min-h-[300px]"
                />
                <app-velocity-chart
                  [data]="metricsVelocity()"
                  class="min-h-[300px]"
                />
                @if (activeView() !== 'personal') {
                  <app-workload-balance
                    [data]="metricsWorkload()"
                    class="min-h-[300px]"
                  />
                }
                @if (activeView() === 'workspace' && utilization().length > 0) {
                  <app-resource-utilization
                    [data]="utilization()"
                    class="min-h-[300px]"
                  />
                }
                <app-on-time-metric
                  [data]="metricsOnTime()"
                  class="min-h-[300px]"
                />
              </div>
            }
          </div>
          } @placeholder {
            <div class="h-[300px]"></div>
          }
          }

          <!-- Analytics Section -->
          <div class="animate-fade-in-up stagger-6 mb-6">
            @defer (on viewport) {
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
            } @placeholder {
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
                @for (i of [1, 2, 3, 4]; track i) {
                  <div class="widget-card p-5 min-h-[360px] animate-pulse">
                    <div
                      class="h-4 w-32 rounded mb-4"
                      style="background: var(--muted)"
                    ></div>
                    <div
                      class="h-64 w-full rounded-lg"
                      style="background: var(--muted)"
                    ></div>
                  </div>
                }
              </div>
            }
          </div>

          <!-- Workspaces Section -->
          @if (workspaces().length === 0) {
            <app-empty-state
              variant="workspace"
              (ctaClicked)="navigateToOnboarding()"
            />
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

      <app-onboarding-checklist />
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  private dashboardService = inject(DashboardService);
  private workspaceState = inject(WorkspaceStateService);
  private teamGroupsService = inject(TeamGroupsService);
  private checklistService = inject(OnboardingChecklistService);
  private reportsService = inject(ReportsService);
  private injector = inject(Injector);

  workspaces = signal<Workspace[]>([]);
  loading = signal(true);
  userName = signal<string | null>(null);
  stats = signal<DashboardStats | null>(null);
  recentActivity = signal<DashboardActivityEntry[]>([]);
  showAllActivity = signal(false);

  selectedWorkspaceId = signal<string | null>(null);

  // Metrics view state
  activeView = signal<DashboardView>('workspace');
  selectedTeamId = signal<string | null>(null);
  teams = signal<TeamGroup[]>([]);
  metricsLoading = signal(false);
  metricsCycleTime = signal<CycleTimePoint[]>([]);
  metricsVelocity = signal<VelocityPoint[]>([]);
  metricsWorkload = signal<WorkloadBalanceEntry[]>([]);
  metricsOnTime = signal<OnTimeMetric | null>(null);
  utilization = signal<ResourceUtilizationEntry[]>([]);

  hasAnyMetrics = computed(
    () =>
      this.metricsCycleTime().length > 0 ||
      this.metricsVelocity().length > 0 ||
      this.metricsWorkload().length > 0 ||
      this.metricsOnTime() !== null,
  );

  viewOptions: { value: DashboardView; label: string; icon: string }[] = [
    { value: 'workspace', label: 'Workspace', icon: 'pi pi-building' },
    { value: 'team', label: 'Team', icon: 'pi pi-users' },
    { value: 'personal', label: 'Personal', icon: 'pi pi-user' },
  ];

  teamOptions = computed<TeamOption[]>(() =>
    this.teams().map((t) => ({ label: t.name, value: t.id })),
  );

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

  ngOnInit(): void {
    const user = this.authService.currentUser();
    if (!user) {
      this.router.navigate(['/auth/sign-in']);
      return;
    }

    this.userName.set(user.name?.split(' ')[0] || null);
    this.loadWorkspaces();
    this.checklistService.initialize();

    // Sync workspace list and handle loading state
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
          // Load stats for current selection (fires on init AND workspace changes)
          this.loadStats(this.selectedWorkspaceId() ?? undefined);
          this.loadRecentActivity(this.selectedWorkspaceId() ?? undefined);
          this.loadTeams(this.selectedWorkspaceId() ?? undefined);
          this.loadMetrics();
        });
      },
      { injector: this.injector },
    );
  }

  onWorkspaceChange(value: string | null): void {
    this.selectedWorkspaceId.set(value);
    this.workspaceState.selectWorkspace(value);
    this.loadStats(value ?? undefined);
    this.loadRecentActivity(value ?? undefined);
    this.loadTeams(value ?? undefined);
    this.loadMetrics();
  }

  setActiveView(view: DashboardView): void {
    this.activeView.set(view);
    this.loadMetrics();
  }

  onTeamChange(teamId: string | null): void {
    this.selectedTeamId.set(teamId);
    this.loadMetrics();
  }

  exportMetricsCsv(): void {
    const cycleData = this.metricsCycleTime().map((p) => ({
      week_start: p.week_start,
      avg_cycle_days: p.avg_cycle_days,
    }));
    const velocityData = this.metricsVelocity().map((p) => ({
      week_start: p.week_start,
      tasks_completed: p.tasks_completed,
    }));
    const combined: Record<string, unknown>[] = cycleData.map((c, i) => ({
      week_start: c.week_start,
      avg_cycle_days: c.avg_cycle_days,
      tasks_completed: velocityData[i]?.tasks_completed ?? 0,
    }));
    if (combined.length > 0) {
      this.dashboardService.exportDashboardCsv(combined);
    }
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

  navigateToOnboarding(): void {
    this.router.navigate(['/onboarding']);
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

  private loadTeams(workspaceId?: string): void {
    if (!workspaceId) {
      this.teams.set([]);
      return;
    }
    this.teamGroupsService.listTeams(workspaceId).subscribe({
      next: (teams) => this.teams.set(teams),
      error: () => this.teams.set([]),
    });
  }

  private loadMetrics(): void {
    const view = this.activeView();
    this.metricsLoading.set(true);
    this.metricsCycleTime.set([]);
    this.metricsVelocity.set([]);
    this.metricsWorkload.set([]);
    this.metricsOnTime.set(null);
    this.utilization.set([]);

    if (view === 'personal') {
      this.dashboardService.getPersonalDashboard().subscribe({
        next: (d) => {
          this.metricsCycleTime.set(d.cycle_time);
          this.metricsVelocity.set(d.velocity);
          this.metricsOnTime.set(d.on_time);
          this.metricsLoading.set(false);
        },
        error: () => this.metricsLoading.set(false),
      });
    } else if (view === 'team') {
      const teamId = this.selectedTeamId();
      if (!teamId) {
        this.metricsLoading.set(false);
        return;
      }
      this.dashboardService.getTeamDashboard(teamId).subscribe({
        next: (d) => {
          this.metricsCycleTime.set(d.cycle_time);
          this.metricsVelocity.set(d.velocity);
          this.metricsWorkload.set(d.workload_balance);
          this.metricsOnTime.set(d.on_time);
          this.metricsLoading.set(false);
        },
        error: () => this.metricsLoading.set(false),
      });
    } else {
      // workspace view
      const wsId = this.selectedWorkspaceId();
      if (!wsId) {
        this.metricsLoading.set(false);
        return;
      }
      this.dashboardService.getWorkspaceDashboard(wsId).subscribe({
        next: (d) => {
          this.metricsCycleTime.set(d.cycle_time);
          this.metricsVelocity.set(d.velocity);
          this.metricsWorkload.set(d.workload_balance);
          this.metricsOnTime.set(d.on_time);
          this.metricsLoading.set(false);
        },
        error: () => this.metricsLoading.set(false),
      });
      // Fetch resource utilization in parallel
      this.reportsService.getUtilizationByWorkspace(wsId).subscribe({
        next: (data) => this.utilization.set(data),
        error: () => this.utilization.set([]),
      });
    }
  }
}
