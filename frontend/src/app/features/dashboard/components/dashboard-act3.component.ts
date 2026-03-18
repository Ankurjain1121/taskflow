import {
  Component,
  input,
  signal,
  computed,
  effect,
  inject,
  Injector,
  untracked,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import {
  Accordion,
  AccordionPanel,
  AccordionHeader,
  AccordionContent,
} from 'primeng/accordion';
import { CycleTimeChartComponent } from '../widgets/cycle-time-chart.component';
import { VelocityChartComponent } from '../widgets/velocity-chart.component';
import { WorkloadBalanceComponent } from '../widgets/workload-balance.component';
import { ResourceUtilizationComponent } from '../widgets/resource-utilization.component';
import { OnTimeMetricComponent } from '../widgets/on-time-metric.component';
import {
  DashboardService,
  CycleTimePoint,
  VelocityPoint,
  WorkloadBalanceEntry,
  OnTimeMetric,
} from '../../../core/services/dashboard.service';
import {
  ReportsService,
  ResourceUtilizationEntry,
} from '../../../core/services/reports.service';
import {
  TeamGroupsService,
  TeamGroup,
} from '../../../core/services/team-groups.service';

type DashboardView = 'workspace' | 'team' | 'personal';

interface TeamOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-dashboard-act3',
  standalone: true,
  imports: [
    FormsModule,
    SelectModule,
    Accordion,
    AccordionPanel,
    AccordionHeader,
    AccordionContent,
    CycleTimeChartComponent,
    VelocityChartComponent,
    WorkloadBalanceComponent,
    ResourceUtilizationComponent,
    OnTimeMetricComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-accordion [value]="[]" [multiple]="true">
      <p-accordion-panel value="metrics">
        <p-accordion-header>
          <div class="flex items-center gap-2">
            <i class="pi pi-chart-bar text-sm text-primary"></i>
            <span class="widget-title">Metrics</span>
          </div>
        </p-accordion-header>
        <p-accordion-content>
          <div class="pt-4">
            <!-- View toggle + team selector -->
            <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div
                class="flex gap-0.5 rounded-lg p-0.5"
                style="background: var(--muted)"
              >
                @for (view of viewOptions; track view.value) {
                  <button
                    (click)="setActiveView(view.value)"
                    class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
                    [attr.aria-pressed]="activeView() === view.value"
                    [style.background]="
                      activeView() === view.value ? 'var(--card)' : 'transparent'
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
            } @else if (hasAnyMetrics()) {
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
        </p-accordion-content>
      </p-accordion-panel>
    </p-accordion>
  `,
})
export class DashboardAct3Component {
  private dashboardService = inject(DashboardService);
  private reportsService = inject(ReportsService);
  private teamGroupsService = inject(TeamGroupsService);
  private injector = inject(Injector);

  readonly workspaceId = input<string | undefined>();

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

  constructor() {
    effect(
      () => {
        const wsId = this.workspaceId();
        untracked(() => {
          this.loadTeams(wsId);
          this.loadMetrics();
        });
      },
      { injector: this.injector },
    );
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

  private loadTeams(wsId?: string): void {
    if (!wsId) {
      this.teams.set([]);
      return;
    }
    this.teamGroupsService.listTeams(wsId).subscribe({
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
          this.metricsCycleTime.set(d.cycle_time ?? []);
          this.metricsVelocity.set(d.velocity ?? []);
          this.metricsOnTime.set(d.on_time ?? null);
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
          this.metricsCycleTime.set(d.cycle_time ?? []);
          this.metricsVelocity.set(d.velocity ?? []);
          this.metricsWorkload.set(d.workload_balance ?? []);
          this.metricsOnTime.set(d.on_time ?? null);
          this.metricsLoading.set(false);
        },
        error: () => this.metricsLoading.set(false),
      });
    } else {
      const wsId = this.workspaceId();
      if (!wsId) {
        this.metricsLoading.set(false);
        return;
      }
      this.dashboardService.getWorkspaceDashboard(wsId).subscribe({
        next: (d) => {
          this.metricsCycleTime.set(d.cycle_time ?? []);
          this.metricsVelocity.set(d.velocity ?? []);
          this.metricsWorkload.set(d.workload_balance ?? []);
          this.metricsOnTime.set(d.on_time ?? null);
          this.metricsLoading.set(false);
        },
        error: () => this.metricsLoading.set(false),
      });
      this.reportsService.getUtilizationByWorkspace(wsId).subscribe({
        next: (data) => this.utilization.set(data),
        error: () => this.utilization.set([]),
      });
    }
  }
}
