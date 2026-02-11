import { Component, OnInit, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DashboardService, OverdueTask } from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-overdue-tasks-table',
  standalone: true,
  imports: [CommonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white rounded-xl border border-gray-200 h-full flex flex-col">
      <div class="px-6 py-4 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-900">Overdue Tasks</h3>
      </div>

      @if (loading()) {
        <div class="flex-1 flex items-center justify-center">
          <svg class="animate-spin h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      } @else if (tasks().length > 0) {
        <div class="overflow-auto flex-1">
          <table class="w-full">
            <thead class="bg-gray-50 sticky top-0">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Task
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Board
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Days Overdue
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              @for (task of tasks(); track task.id) {
                <tr
                  class="hover:bg-gray-50 cursor-pointer transition-colors"
                  [routerLink]="['/board', task.board_id]"
                  [queryParams]="{ task: task.id }">
                  <td class="px-6 py-4">
                    <p class="text-sm font-medium text-gray-900 truncate max-w-xs">
                      {{ task.title }}
                    </p>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="text-sm text-gray-500">{{ task.board_name }}</span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span
                      class="px-2 py-1 text-xs font-medium rounded-full"
                      [class]="getPriorityClass(task.priority)">
                      {{ task.priority }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="text-sm font-semibold text-red-600">
                      {{ task.days_overdue }} days
                    </span>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <div class="flex-1 flex items-center justify-center text-gray-400">
          <div class="text-center">
            <svg class="mx-auto h-12 w-12 text-green-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <p class="text-sm">No overdue tasks!</p>
          </div>
        </div>
      }
    </div>
  `,
})
export class OverdueTasksTableComponent implements OnInit {
  private dashboardService = inject(DashboardService);

  loading = signal(true);
  tasks = signal<OverdueTask[]>([]);

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.loading.set(true);
    try {
      const data = await this.dashboardService.getOverdueTasks(10).toPromise();
      this.tasks.set(data || []);
    } catch (error) {
      console.error('Failed to load overdue tasks:', error);
    } finally {
      this.loading.set(false);
    }
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
