import { Component, OnInit, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService, TasksByPriority } from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-tasks-by-priority',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white rounded-xl border border-gray-200 p-6 h-full">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Tasks by Priority</h3>

      @if (loading()) {
        <div class="flex items-center justify-center h-64">
          <svg class="animate-spin h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      } @else if (data().length > 0) {
        <!-- Simple bar visualization (fallback until Chart.js installed) -->
        <div class="space-y-3">
          @for (item of data(); track item.priority) {
            <div>
              <div class="flex items-center justify-between mb-1">
                <span class="text-sm font-medium" [class]="getPriorityTextColor(item.priority)">
                  {{ item.priority }}
                </span>
                <span class="text-sm font-semibold text-gray-900">{{ item.count }}</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div
                  class="h-2 rounded-full transition-all"
                  [class]="getPriorityBarColor(item.priority)"
                  [style.width.%]="(item.count / maxCount()) * 100">
                </div>
              </div>
            </div>
          }
        </div>
      } @else {
        <div class="flex items-center justify-center h-64 text-gray-400">
          <p class="text-sm">No data available</p>
        </div>
      }
    </div>
  `,
})
export class TasksByPriorityComponent implements OnInit {
  private dashboardService = inject(DashboardService);

  loading = signal(true);
  data = signal<TasksByPriority[]>([]);
  maxCount = signal(0);

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.loading.set(true);
    try {
      const data = await this.dashboardService.getTasksByPriority().toPromise();
      this.data.set(data || []);

      const max = Math.max(...(data?.map(d => d.count) || [0]));
      this.maxCount.set(max || 1);
    } catch (error) {
      console.error('Failed to load tasks by priority:', error);
    } finally {
      this.loading.set(false);
    }
  }

  getPriorityTextColor(priority: string): string {
    switch (priority.toLowerCase()) {
      case 'urgent': return 'text-red-700';
      case 'high': return 'text-orange-700';
      case 'medium': return 'text-blue-700';
      case 'low': return 'text-gray-700';
      default: return 'text-gray-700';
    }
  }

  getPriorityBarColor(priority: string): string {
    switch (priority.toLowerCase()) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-blue-500';
      case 'low': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  }
}
