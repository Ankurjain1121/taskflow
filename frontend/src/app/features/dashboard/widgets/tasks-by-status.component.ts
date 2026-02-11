import { Component, OnInit, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { DashboardService, TasksByStatus } from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-tasks-by-status',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white rounded-xl border border-gray-200 p-6 h-full">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Tasks by Status</h3>

      @if (loading()) {
        <div class="flex items-center justify-center h-64">
          <svg class="animate-spin h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      } @else if (data().length > 0) {
        <!-- Canvas for Chart.js -->
        <div class="relative h-64 flex items-center justify-center">
          <canvas #chartCanvas></canvas>
        </div>

        <!-- Legend -->
        <div class="mt-4 space-y-2">
          @for (item of data(); track item.status) {
            <div class="flex items-center justify-between text-sm">
              <div class="flex items-center gap-2">
                <div
                  class="w-3 h-3 rounded-full"
                  [style.background-color]="item.color || '#6366f1'">
                </div>
                <span class="text-gray-700">{{ item.status }}</span>
              </div>
              <span class="font-medium text-gray-900">{{ item.count }}</span>
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
  styles: [`
    canvas {
      max-height: 250px;
    }
  `]
})
export class TasksByStatusComponent implements OnInit {
  private dashboardService = inject(DashboardService);

  loading = signal(true);
  data = signal<TasksByStatus[]>([]);

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.loading.set(true);
    try {
      const data = await firstValueFrom(this.dashboardService.getTasksByStatus());
      this.data.set(data || []);

      // TODO: Initialize Chart.js here once installed
      // For now, just showing legend
    } catch (error) {
      console.error('Failed to load tasks by status:', error);
    } finally {
      this.loading.set(false);
    }
  }
}
