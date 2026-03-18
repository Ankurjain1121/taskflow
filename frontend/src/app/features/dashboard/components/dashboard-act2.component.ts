import {
  Component,
  input,
  signal,
  effect,
  inject,
  Injector,
  untracked,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ProjectPulseComponent } from './project-pulse.component';
import { CompletionTrendComponent } from '../widgets/completion-trend.component';
import { TasksByStatusComponent } from '../widgets/tasks-by-status.component';
import { TasksByPriorityComponent } from '../widgets/tasks-by-priority.component';
import { UpcomingDeadlinesComponent } from '../widgets/upcoming-deadlines.component';
import { TeamWorkloadComponent } from '../widgets/team-workload.component';
import { OverdueTasksTableComponent } from '../widgets/overdue-tasks-table.component';
import { DashboardService } from '../../../core/services/dashboard.service';
import { ProjectPulse } from '../dashboard.types';

@Component({
  selector: 'app-dashboard-act2',
  standalone: true,
  imports: [
    ProjectPulseComponent,
    CompletionTrendComponent,
    TasksByStatusComponent,
    TasksByPriorityComponent,
    UpcomingDeadlinesComponent,
    TeamWorkloadComponent,
    OverdueTasksTableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Project Pulse -->
    <div class="mb-8 animate-fade-in-up">
      <app-project-pulse [projects]="projectPulse()" />
    </div>

    <!-- Analytics -->
    <div class="mb-8 animate-fade-in-up stagger-2">
      <div class="mb-4 mt-2">
        <h2 class="text-xs font-semibold tracking-widest uppercase" style="color: var(--muted-foreground)">
          Analytics & Insights
        </h2>
      </div>
      @defer (on viewport) {
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <app-completion-trend
            [workspaceId]="workspaceId()"
            class="lg:col-span-2 min-h-[360px]"
          />
          <app-tasks-by-status
            [workspaceId]="workspaceId()"
            class="min-h-[360px]"
          />
          <app-tasks-by-priority
            [workspaceId]="workspaceId()"
            class="min-h-[360px]"
          />
          <app-upcoming-deadlines
            [workspaceId]="workspaceId()"
            class="min-h-[360px]"
          />
          <app-team-workload
            [workspaceId]="workspaceId()"
            class="min-h-[360px]"
          />
          <app-overdue-tasks-table
            [workspaceId]="workspaceId()"
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
  `,
})
export class DashboardAct2Component {
  private dashboardService = inject(DashboardService);
  private injector = inject(Injector);

  readonly workspaceId = input<string | undefined>();

  readonly projectPulse = signal<ProjectPulse[]>([]);

  constructor() {
    effect(
      () => {
        const wsId = this.workspaceId();
        untracked(() => this.loadProjectPulse(wsId));
      },
      { injector: this.injector },
    );
  }

  private loadProjectPulse(wsId?: string): void {
    this.dashboardService.getProjectPulse(wsId).subscribe({
      next: (data) => this.projectPulse.set(data),
      error: () => this.projectPulse.set([]),
    });
  }
}
