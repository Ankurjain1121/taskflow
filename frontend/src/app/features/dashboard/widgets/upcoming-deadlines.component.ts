import { Component, OnInit, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DashboardService, UpcomingDeadline } from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-upcoming-deadlines',
  standalone: true,
  imports: [CommonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white rounded-xl border border-gray-200 h-full flex flex-col">
      <div class="px-6 py-4 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-900">Upcoming Deadlines</h3>
        <p class="text-sm text-gray-500 mt-1">Next 14 days</p>
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
          <div class="space-y-4">
            @for (deadline of deadlines(); track deadline.id) {
              <div
                class="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors border border-gray-100"
                [routerLink]="['/board', deadline.board_id]"
                [queryParams]="{ task: deadline.id }">
                <!-- Timeline indicator -->
                <div class="flex flex-col items-center">
                  <div
                    class="w-3 h-3 rounded-full ring-4 ring-white"
                    [class]="getUrgencyColor(deadline.days_until_due)">
                  </div>
                  @if (!$last) {
                    <div class="w-0.5 h-full bg-gray-200 mt-1"></div>
                  }
                </div>

                <!-- Content -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-start justify-between gap-2">
                    <h4 class="text-sm font-medium text-gray-900 truncate">
                      {{ deadline.title }}
                    </h4>
                    <span
                      class="px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0"
                      [class]="getPriorityClass(deadline.priority)">
                      {{ deadline.priority }}
                    </span>
                  </div>
                  <p class="text-xs text-gray-500 mt-1">{{ deadline.board_name }}</p>
                  <p
                    class="text-xs font-medium mt-1"
                    [class]="getUrgencyTextColor(deadline.days_until_due)">
                    {{ getRelativeTime(deadline.days_until_due) }}
                  </p>
                </div>
              </div>
            }
          </div>
        </div>
      } @else {
        <div class="flex-1 flex items-center justify-center text-gray-400">
          <div class="text-center">
            <svg class="mx-auto h-12 w-12 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            <p class="text-sm">No upcoming deadlines</p>
          </div>
        </div>
      }
    </div>
  `,
})
export class UpcomingDeadlinesComponent implements OnInit {
  private dashboardService = inject(DashboardService);

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
    } catch (error) {
      console.error('Failed to load upcoming deadlines:', error);
    } finally {
      this.loading.set(false);
    }
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
    if (days === 0) return 'text-red-600';
    if (days <= 2) return 'text-orange-600';
    if (days <= 7) return 'text-yellow-600';
    return 'text-blue-600';
  }

  getPriorityClass(priority: string): string {
    switch (priority.toLowerCase()) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-blue-100 text-blue-800';
      case 'low': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-600';
    }
  }
}
