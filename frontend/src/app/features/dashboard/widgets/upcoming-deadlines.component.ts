import { Component, OnInit, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TimelineModule } from 'primeng/timeline';
import { DashboardService, UpcomingDeadline } from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-upcoming-deadlines',
  standalone: true,
  imports: [CommonModule, TimelineModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 h-full flex flex-col">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Upcoming Deadlines</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Next 14 days</p>
      </div>

      @if (loading()) {
        <div class="flex-1 flex items-center justify-center">
          <svg class="animate-spin h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      } @else if (deadlines().length > 0) {
        <div class="overflow-auto flex-1 p-6">
          <p-timeline [value]="deadlines()" align="left">
            <ng-template pTemplate="marker" let-item>
              <div
                class="w-3 h-3 rounded-full ring-4 ring-white dark:ring-gray-800"
                [class]="getUrgencyColor(item.days_until_due)">
              </div>
            </ng-template>
            <ng-template pTemplate="content" let-item>
              <div
                class="flex flex-col gap-1 pb-4 cursor-pointer hover:opacity-80 transition-opacity"
                (click)="navigateToTask(item)">
                <div class="flex items-start justify-between gap-2">
                  <span class="font-medium text-sm text-gray-900 dark:text-white">{{ item.title }}</span>
                  <span
                    class="px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0"
                    [class]="getPriorityClass(item.priority)">
                    {{ item.priority }}
                  </span>
                </div>
                <span class="text-xs text-gray-500 dark:text-gray-400">{{ item.board_name }}</span>
                <span
                  class="text-xs font-medium"
                  [class]="getUrgencyTextColor(item.days_until_due)">
                  {{ getRelativeTime(item.days_until_due) }}
                </span>
              </div>
            </ng-template>
          </p-timeline>
        </div>
      } @else {
        <div class="flex-1 flex items-center justify-center text-gray-400">
          <div class="text-center">
            <i class="pi pi-calendar text-4xl text-gray-300 mb-2"></i>
            <p class="text-sm">No upcoming deadlines</p>
          </div>
        </div>
      }
    </div>
  `,
})
export class UpcomingDeadlinesComponent implements OnInit {
  private dashboardService = inject(DashboardService);
  private router = inject(Router);

  loading = signal(true);
  deadlines = signal<UpcomingDeadline[]>([]);

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.loading.set(true);
    try {
      const data = await firstValueFrom(this.dashboardService.getUpcomingDeadlines(14));
      this.deadlines.set(data || []);
    } catch {
      // Timeline will show empty state
    } finally {
      this.loading.set(false);
    }
  }

  navigateToTask(deadline: UpcomingDeadline): void {
    this.router.navigate(['/board', deadline.board_id], { queryParams: { task: deadline.id } });
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
      case 'urgent': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      case 'medium': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'low': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
    }
  }
}
