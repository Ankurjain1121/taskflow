import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Workspace } from '../../core/services/workspace.service';
import { PortfolioProject } from '../../core/services/portfolio.service';

@Component({
  selector: 'app-org-project-grid',
  standalone: true,
  imports: [RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      <h2 class="text-lg font-semibold" style="color: var(--foreground)">
        Project Health
      </h2>

      @for (group of projectGroups(); track group.workspace.id) {
        <div>
          <h3 class="text-xs font-semibold uppercase tracking-wider mb-2"
              style="color: var(--muted-foreground)">
            {{ group.workspace.name }}
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            @for (project of group.projects; track project.id) {
              <a [routerLink]="['/workspace', group.workspace.id, 'project', project.id]"
                 class="project-card group">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-sm font-medium truncate" style="color: var(--foreground)">
                    {{ project.name }}
                  </span>
                  <span class="health-badge" [class]="getHealthClass(project.health)">
                    {{ getHealthIcon(project.health) }}
                  </span>
                </div>
                <!-- Progress bar -->
                <div class="w-full h-1.5 rounded-full" style="background: var(--muted)">
                  <div class="h-1.5 rounded-full transition-all"
                       [style.width.%]="project.progress_pct"
                       [style.background]="getHealthColor(project.health)">
                  </div>
                </div>
                <div class="flex items-center justify-between mt-2 text-[11px]"
                     style="color: var(--muted-foreground)">
                  <span>{{ project.progress_pct }}% complete</span>
                  <span>{{ project.total_tasks }} tasks</span>
                </div>
                @if (project.overdue_tasks > 0) {
                  <div class="text-[11px] text-[var(--destructive)] mt-1">
                    {{ project.overdue_tasks }} overdue
                  </div>
                }
              </a>
            }
          </div>
        </div>
      }

      @if (isEmpty()) {
        <div class="text-center py-8">
          <p class="text-sm" style="color: var(--muted-foreground)">
            Create projects to track your organization's progress.
          </p>
        </div>
      }
    </div>
  `,
  styles: [`
    .project-card {
      display: block;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 0.75rem;
      padding: 0.875rem;
      transition: box-shadow 0.15s ease, border-color 0.15s ease;
      cursor: pointer;
    }
    .project-card:hover {
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      border-color: var(--primary);
    }
    .health-badge {
      width: 20px; height: 20px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 10px; font-weight: 700;
    }
    .health-green { background: rgba(94, 140, 74, 0.12); color: #5E8C4A; }
    .health-amber { background: rgba(212, 168, 83, 0.12); color: #D4A853; }
    .health-red { background: rgba(184, 20, 20, 0.12); color: #B81414; }
    .health-gray { background: var(--muted); color: var(--muted-foreground); }
  `],
})
export class OrgProjectGridComponent {
  projectGroups = input<{ workspace: Workspace; projects: PortfolioProject[] }[]>([]);

  isEmpty = computed(() =>
    this.projectGroups().length === 0 ||
    this.projectGroups().every(g => g.projects.length === 0),
  );

  getHealthColor(health: string): string {
    switch (health) {
      case 'on_track': return '#5E8C4A';
      case 'at_risk': return '#D4A853';
      case 'behind': return '#B81414';
      default: return '#9F9F9F';
    }
  }

  getHealthIcon(health: string): string {
    switch (health) {
      case 'on_track': return '\u2713';
      case 'at_risk': return '\u26A0';
      case 'behind': return '!';
      default: return '?';
    }
  }

  getHealthClass(health: string): string {
    switch (health) {
      case 'on_track': return 'health-green';
      case 'at_risk': return 'health-amber';
      case 'behind': return 'health-red';
      default: return 'health-gray';
    }
  }
}
