import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';
import { Select } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import {
  WorkspaceService,
  Workspace,
} from '../../core/services/workspace.service';
import { ProjectService, Board } from '../../core/services/project.service';
import {
  ReportsService,
  BurndownPoint,
  BurnupPoint,
  ResourceEntry,
  CompletionRatePoint,
} from '../../core/services/reports.service';
import { BurndownChartComponent } from './burndown-chart.component';
import { BurnupChartComponent } from './burnup-chart.component';
import { ResourceUtilizationComponent } from './resource-utilization.component';
import { CompletionRateChartComponent } from './completion-rate-chart.component';
import { ExportDialogComponent } from './export-dialog.component';

interface RangeOption {
  label: string;
  days: number;
  weeks: number;
}

const RANGE_OPTIONS: RangeOption[] = [
  { label: 'Last 30 days', days: 30, weeks: 4 },
  { label: 'Last 90 days', days: 90, weeks: 13 },
  { label: 'Last 6 months', days: 180, weeks: 26 },
  { label: 'Last year', days: 365, weeks: 52 },
];

@Component({
  selector: 'app-report-hub',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    Select,
    ButtonModule,
    SkeletonModule,
    BurndownChartComponent,
    BurnupChartComponent,
    ResourceUtilizationComponent,
    CompletionRateChartComponent,
    ExportDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`:host { display: block; }`],
  template: `
    <div class="p-6 max-w-7xl mx-auto">
      <!-- Page Header -->
      <div class="mb-6">
        <h1
          class="text-2xl font-bold font-display"
          style="color: var(--foreground)"
        >
          Reports
        </h1>
        <p class="text-sm mt-1" style="color: var(--muted-foreground)">
          Track project progress, team performance, and completion trends.
        </p>
      </div>

      <!-- Controls Row -->
      <div
        class="flex flex-wrap items-center gap-3 mb-6 p-4 rounded-lg border"
        style="background: var(--card); border-color: var(--border)"
      >
        <!-- Workspace Selector -->
        <div class="flex flex-col gap-1">
          <label
            class="text-xs font-medium"
            style="color: var(--muted-foreground)"
            >Workspace</label
          >
          <p-select
            [options]="workspaces()"
            [(ngModel)]="selectedWorkspaceId"
            optionLabel="name"
            optionValue="id"
            placeholder="Select workspace"
            [style]="{ width: '200px' }"
            (onChange)="onWorkspaceChange()"
          />
        </div>

        <!-- Project Selector -->
        <div class="flex flex-col gap-1">
          <label
            class="text-xs font-medium"
            style="color: var(--muted-foreground)"
            >Project</label
          >
          <p-select
            [options]="projects()"
            [(ngModel)]="selectedProjectId"
            optionLabel="name"
            optionValue="id"
            placeholder="Select project"
            [style]="{ width: '220px' }"
            [disabled]="!selectedWorkspaceId()"
            (onChange)="onProjectChange()"
          />
        </div>

        <!-- Date Range Selector -->
        <div class="flex flex-col gap-1">
          <label
            class="text-xs font-medium"
            style="color: var(--muted-foreground)"
            >Date Range</label
          >
          <p-select
            [options]="rangeOptions"
            [(ngModel)]="selectedRange"
            optionLabel="label"
            [style]="{ width: '170px' }"
            (onChange)="loadData()"
          />
        </div>

        <!-- Spacer -->
        <div class="flex-1"></div>

        <!-- Export Button -->
        <div class="flex items-end">
          <button
            pButton
            label="Export"
            icon="pi pi-download"
            [outlined]="true"
            [disabled]="!selectedProjectId()"
            (click)="showExportDialog.set(true)"
          ></button>
        </div>
      </div>

      <!-- Empty state -->
      @if (!selectedProjectId() && !selectedWorkspaceId()) {
        <div
          class="flex flex-col items-center justify-center py-20 rounded-lg border"
          style="background: var(--card); border-color: var(--border)"
        >
          <i
            class="pi pi-chart-bar text-4xl mb-4"
            style="color: var(--muted-foreground)"
          ></i>
          <p
            class="text-lg font-medium"
            style="color: var(--foreground)"
          >
            Select a project to view reports
          </p>
          <p class="text-sm mt-1" style="color: var(--muted-foreground)">
            Choose a workspace and project from the dropdowns above to get
            started.
          </p>
        </div>
      } @else {
        <!-- Tab Navigation -->
        <p-tabs [value]="activeTab()" (valueChange)="onTabChange($event)">
          <p-tablist>
            <p-tab value="burndown">
              <i class="pi pi-chart-line mr-2"></i>Burndown
            </p-tab>
            <p-tab value="burnup">
              <i class="pi pi-chart-line mr-2"></i>Burnup
            </p-tab>
            <p-tab value="resource">
              <i class="pi pi-users mr-2"></i>Resource
            </p-tab>
            <p-tab value="completion">
              <i class="pi pi-percentage mr-2"></i>Completion Rate
            </p-tab>
          </p-tablist>
          <p-tabpanels>
            <p-tabpanel value="burndown">
              @if (loading()) {
                <div class="widget-card p-5 mt-4">
                  <p-skeleton height="300px" />
                </div>
              } @else {
                <div class="mt-4">
                  <app-burndown-chart [data]="burndownData()" />
                </div>
              }
            </p-tabpanel>
            <p-tabpanel value="burnup">
              @if (loading()) {
                <div class="widget-card p-5 mt-4">
                  <p-skeleton height="300px" />
                </div>
              } @else {
                <div class="mt-4">
                  <app-burnup-chart [data]="burnupData()" />
                </div>
              }
            </p-tabpanel>
            <p-tabpanel value="resource">
              @if (loadingResource()) {
                <div class="widget-card p-5 mt-4">
                  <p-skeleton height="300px" />
                </div>
              } @else {
                <div class="mt-4">
                  <app-resource-utilization [data]="resourceData()" />
                </div>
              }
            </p-tabpanel>
            <p-tabpanel value="completion">
              @if (loading()) {
                <div class="widget-card p-5 mt-4">
                  <p-skeleton height="300px" />
                </div>
              } @else {
                <div class="mt-4">
                  <app-completion-rate-chart [data]="completionData()" />
                </div>
              }
            </p-tabpanel>
          </p-tabpanels>
        </p-tabs>
      }

      <!-- Export Dialog -->
      <app-export-dialog
        [visible]="showExportDialog()"
        [projectId]="selectedProjectId() ?? ''"
        [reportType]="activeTab()"
        [days]="selectedRange().days"
        (visibleChange)="showExportDialog.set($event)"
      />
    </div>
  `,
})
export class ReportHubComponent {
  private workspaceService = inject(WorkspaceService);
  private boardService = inject(ProjectService);
  private reportsService = inject(ReportsService);

  readonly rangeOptions = RANGE_OPTIONS;

  workspaces = signal<Workspace[]>([]);
  projects = signal<Board[]>([]);
  selectedWorkspaceId = signal<string | null>(null);
  selectedProjectId = signal<string | null>(null);
  selectedRange = signal<RangeOption>(RANGE_OPTIONS[0]);
  activeTab = signal('burndown');
  showExportDialog = signal(false);

  loading = signal(false);
  loadingResource = signal(false);

  burndownData = signal<BurndownPoint[]>([]);
  burnupData = signal<BurnupPoint[]>([]);
  resourceData = signal<ResourceEntry[]>([]);
  completionData = signal<CompletionRatePoint[]>([]);

  constructor() {
    this.loadWorkspaces();
  }

  onTabChange(value: string | number): void {
    this.activeTab.set(String(value));
    this.loadData();
  }

  onWorkspaceChange(): void {
    const wsId = this.selectedWorkspaceId();
    this.selectedProjectId.set(null);
    this.clearChartData();
    if (wsId) {
      this.loadProjects(wsId);
    } else {
      this.projects.set([]);
    }
  }

  onProjectChange(): void {
    this.loadData();
  }

  loadData(): void {
    const projectId = this.selectedProjectId();
    const workspaceId = this.selectedWorkspaceId();
    const range = this.selectedRange();
    const tab = this.activeTab();

    if (tab === 'resource' && workspaceId) {
      this.loadResourceData(workspaceId, range.weeks);
    }

    if (!projectId) return;

    if (tab === 'burndown') {
      this.loadBurndown(projectId, range.days);
    } else if (tab === 'burnup') {
      this.loadBurnup(projectId, range.days);
    } else if (tab === 'completion') {
      this.loadCompletion(projectId, range.weeks);
    }
  }

  private loadWorkspaces(): void {
    this.workspaceService.list().subscribe({
      next: (ws) => this.workspaces.set(ws),
      error: () => this.workspaces.set([]),
    });
  }

  private loadProjects(workspaceId: string): void {
    this.boardService.listBoards(workspaceId).subscribe({
      next: (boards) => this.projects.set(boards),
      error: () => this.projects.set([]),
    });
  }

  private loadBurndown(projectId: string, days: number): void {
    this.loading.set(true);
    this.reportsService.getBurndown(projectId, days).subscribe({
      next: (data) => {
        this.burndownData.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.burndownData.set([]);
        this.loading.set(false);
      },
    });
  }

  private loadBurnup(projectId: string, days: number): void {
    this.loading.set(true);
    this.reportsService.getBurnup(projectId, days).subscribe({
      next: (data) => {
        this.burnupData.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.burnupData.set([]);
        this.loading.set(false);
      },
    });
  }

  private loadResourceData(workspaceId: string, weeks: number): void {
    this.loadingResource.set(true);
    this.reportsService.getResourceUtilization(workspaceId, weeks).subscribe({
      next: (data) => {
        this.resourceData.set(data);
        this.loadingResource.set(false);
      },
      error: () => {
        this.resourceData.set([]);
        this.loadingResource.set(false);
      },
    });
  }

  private loadCompletion(projectId: string, weeks: number): void {
    this.loading.set(true);
    this.reportsService.getCompletionRate(projectId, weeks).subscribe({
      next: (data) => {
        this.completionData.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.completionData.set([]);
        this.loading.set(false);
      },
    });
  }

  private clearChartData(): void {
    this.burndownData.set([]);
    this.burnupData.set([]);
    this.resourceData.set([]);
    this.completionData.set([]);
  }
}
