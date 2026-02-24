import {
  Component,
  signal,
  inject,
  input,
  effect,
  untracked,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TimelineModule } from 'primeng/timeline';
import {
  DashboardService,
  UpcomingDeadline,
} from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-upcoming-deadlines',
  standalone: true,
  imports: [CommonModule, TimelineModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="widget-card h-full flex flex-col overflow-hidden">
      <div class="px-5 py-3.5" style="border-bottom: 1px solid var(--border)">
        <h3 class="widget-title">Upcoming Deadlines</h3>
        <p class="text-xs mt-0.5" style="color: var(--muted-foreground)">
          Next 14 days
        </p>
      </div>

      @if (loading()) {
        <div class="flex-1 p-5 space-y-3">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="skeleton skeleton-row"></div>
          }
        </div>
      } @else if (deadlines().length > 0) {
        <div class="overflow-auto flex-1 p-5">
          <p-timeline [value]="deadlines()" align="left">
            <ng-template pTemplate="marker" let-item>
              <div
                class="w-2.5 h-2.5 rounded-full"
                style="box-shadow: 0 0 0 3px var(--card)"
                [class]="getUrgencyColor(item.days_until_due)"
              ></div>
            </ng-template>
            <ng-template pTemplate="content" let-item>
              <div
                class="flex flex-col gap-0.5 pb-4 cursor-pointer hover:opacity-80 transition-opacity"
                (click)="navigateToTask(item)"
              >
                <div class="flex items-start justify-between gap-2">
                  <span
                    class="font-medium text-sm"
                    style="color: var(--foreground)"
                    >{{ item.title }}</span
                  >
                  <span
                    class="px-2 py-0.5 text-[11px] font-medium rounded-md flex-shrink-0"
                    [class]="getPriorityClass(item.priority)"
                  >
                    {{ item.priority }}
                  </span>
                </div>
                <span class="text-xs" style="color: var(--muted-foreground)">{{
                  item.board_name
                }}</span>
                <span
                  class="text-xs font-medium"
                  [class]="getUrgencyTextColor(item.days_until_due)"
                >
                  {{ getRelativeTime(item.days_until_due) }}
                </span>
              </div>
            </ng-template>
          </p-timeline>
        </div>
      } @else {
        <div
          class="flex-1 flex items-center justify-center"
          style="color: var(--muted-foreground)"
        >
          <div class="text-center">
            <i
              class="pi pi-calendar text-3xl mb-2"
              style="color: var(--border)"
            ></i>
            <p class="text-sm">No upcoming deadlines</p>
          </div>
        </div>
      }
    </div>
  `,
})
export class UpcomingDeadlinesComponent {
  private dashboardService = inject(DashboardService);
  private router = inject(Router);

  workspaceId = input<string | undefined>();

  loading = signal(true);
  deadlines = signal<UpcomingDeadline[]>([]);

  constructor() {
    effect(() => {
      this.workspaceId();
      untracked(() => this.loadData());
    });
  }

  async loadData() {
    this.loading.set(true);
    try {
      const data = await firstValueFrom(
        this.dashboardService.getUpcomingDeadlines(14, this.workspaceId()),
      );
      this.deadlines.set(data || []);
    } catch {
      // Timeline will show empty state
    } finally {
      this.loading.set(false);
    }
  }

  navigateToTask(deadline: UpcomingDeadline): void {
    this.router.navigate(['/board', deadline.board_id], {
      queryParams: { task: deadline.id },
    });
  }

  getRelativeTime(days: number): string {
    if (days === 0) return 'Due today';
    if (days === 1) return 'Due tomorrow';
    if (days < 7) return `Due in ${days} days`;
    const weeks = Math.floor(days / 7);
    return `Due in ${weeks} week${weeks > 1 ? 's' : ''}`;
  }

  getUrgencyColor(days: number): string {
    if (days === 0) return 'bg-red-500';
    if (days <= 2) return 'bg-orange-500';
    if (days <= 7) return 'bg-yellow-500';
    return 'bg-blue-500';
  }

  getUrgencyTextColor(days: number): string {
    if (days === 0) return 'text-red-600 dark:text-red-400';
    if (days <= 2) return 'text-orange-600 dark:text-orange-400';
    if (days <= 7) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-blue-600 dark:text-blue-400';
  }

  getPriorityClass(priority: string): string {
    switch (priority.toLowerCase()) {
      case 'urgent':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      case 'medium':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'low':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
    }
  }
}
