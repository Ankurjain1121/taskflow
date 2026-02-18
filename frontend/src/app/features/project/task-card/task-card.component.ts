import { Component, computed, input, output } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { TaskCard } from '../../../shared/types/task.types';

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [CommonModule, TitleCasePipe],
  template: `
    <div class="group relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg"
         [class.shadow-sm]="true"
         (click)="taskClicked.emit(task())">

      <!-- Priority gradient border (top) -->
      <div class="absolute top-0 left-0 right-0 h-[3px] rounded-t-lg"
           [style.background]="priorityGradient()"></div>

      <!-- Drag handle (visible on hover) -->
      <div class="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 cursor-grab active:cursor-grabbing z-10">
        <div class="flex flex-col gap-[2px]">
          <div class="flex gap-[2px]">
            <span class="w-[3px] h-[3px] rounded-full bg-gray-400"></span>
            <span class="w-[3px] h-[3px] rounded-full bg-gray-400"></span>
          </div>
          <div class="flex gap-[2px]">
            <span class="w-[3px] h-[3px] rounded-full bg-gray-400"></span>
            <span class="w-[3px] h-[3px] rounded-full bg-gray-400"></span>
          </div>
          <div class="flex gap-[2px]">
            <span class="w-[3px] h-[3px] rounded-full bg-gray-400"></span>
            <span class="w-[3px] h-[3px] rounded-full bg-gray-400"></span>
          </div>
        </div>
      </div>

      <div class="p-3 pl-3 group-hover:pl-6 transition-all duration-150">
        <!-- Display ID -->
        @if (task().display_id) {
          <span class="text-[10px] font-mono text-gray-400 dark:text-gray-500 tracking-wide uppercase mb-0.5 block">{{ task().display_id }}</span>
        }

        <!-- Title -->
        <h4 class="text-[13px] font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 mb-2 leading-snug">{{ task().title }}</h4>

        <!-- Labels -->
        @if (task().labels.length > 0) {
          <div class="flex flex-wrap gap-1 mb-2">
            @for (label of visibleLabels(); track label.id) {
              <span class="px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white shadow-sm"
                    [style.background-color]="label.color">
                {{ label.name }}
              </span>
            }
            @if (overflowLabelCount() > 0) {
              <span class="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
                +{{ overflowLabelCount() }}
              </span>
            }
          </div>
        }

        <!-- Bottom row -->
        <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 gap-1">
          <div class="flex items-center gap-1.5 flex-wrap min-w-0">
            <!-- Priority badge -->
            <span class="px-1.5 py-0.5 rounded-full text-[10px] font-semibold inline-flex items-center gap-0.5"
                  [class]="priorityClasses()">
              @if (task().priority === 'urgent') {
                <i class="pi pi-bolt !text-[10px]"></i>
              }
              {{ task().priority | titlecase }}
            </span>

            <!-- Due date -->
            @if (task().due_date) {
              <span class="flex items-center gap-0.5 text-[11px] font-medium rounded-full px-1.5 py-0.5"
                    [class]="dueDateBadgeClass()">
                <i class="pi pi-clock !text-[11px]"></i>
                {{ formatDueDate() }}
              </span>
            }
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <!-- Attachments count -->
            @if (task().attachments_count > 0) {
              <span class="flex items-center gap-0.5 text-gray-400 dark:text-gray-500">
                <i class="pi pi-paperclip !text-[12px]"></i>
                <span class="text-[11px]">{{ task().attachments_count }}</span>
              </span>
            }

            <!-- Comments count -->
            @if (task().comments_count > 0) {
              <span class="flex items-center gap-0.5 text-gray-400 dark:text-gray-500">
                <i class="pi pi-comment !text-[12px]"></i>
                <span class="text-[11px]">{{ task().comments_count }}</span>
              </span>
            }

            <!-- Assignee avatars -->
            @if (task().assignees.length > 0) {
              <div class="flex -space-x-1.5 ml-0.5">
                @for (assignee of task().assignees.slice(0, 3); track assignee.user_id) {
                  <div class="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] text-white font-semibold border-2 border-white dark:border-gray-800 shadow-sm"
                       [title]="assignee.name">
                    {{ assignee.name.charAt(0).toUpperCase() }}
                  </div>
                }
                @if (task().assignees.length > 3) {
                  <div class="w-5 h-5 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-[10px] text-gray-600 dark:text-gray-300 font-semibold border-2 border-white dark:border-gray-800 shadow-sm">
                    +{{ task().assignees.length - 3 }}
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class TaskCardComponent {
  task = input.required<TaskCard>();
  taskClicked = output<TaskCard>();

  /** Show max 3 labels, rest overflow */
  visibleLabels = computed(() => this.task().labels.slice(0, 3));
  overflowLabelCount = computed(() => Math.max(0, this.task().labels.length - 3));

  priorityGradient = computed(() => {
    const gradients: Record<string, string> = {
      urgent: 'linear-gradient(90deg, #ef4444, #f97316)',
      high: 'linear-gradient(90deg, #f97316, #fbbf24)',
      medium: 'linear-gradient(90deg, #eab308, #a3e635)',
      low: 'linear-gradient(90deg, #3b82f6, #06b6d4)',
    };
    return gradients[this.task().priority] || 'linear-gradient(90deg, #6b7280, #9ca3af)';
  });

  priorityClasses = computed(() => {
    const p = this.task().priority;
    const map: Record<string, string> = {
      urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    };
    return map[p] || '';
  });

  dueDateClass = computed(() => {
    const due = this.task().due_date;
    if (!due) return '';
    const dueDate = new Date(due);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    if (dueDate < today) return 'text-red-500';
    if (dueDate.getTime() === today.getTime()) return 'text-amber-500';
    return 'text-gray-500';
  });

  dueDateBadgeClass = computed(() => {
    const due = this.task().due_date;
    if (!due) return '';
    const dueDate = new Date(due);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    if (dueDate < today) return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
    if (dueDate.getTime() === today.getTime()) return 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400';
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (dueDate.getTime() === tomorrow.getTime()) return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
    return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
  });

  formatDueDate(): string {
    const due = this.task().due_date;
    if (!due) return '';
    const dueDate = new Date(due);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    if (dueDate < today) {
      const diffDays = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) return 'Yesterday';
      if (diffDays <= 7) return `${diffDays}d overdue`;
      return 'Overdue';
    }
    if (dueDate.getTime() === today.getTime()) return 'Today';

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (dueDate.getTime() === tomorrow.getTime()) return 'Tomorrow';

    return dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}
