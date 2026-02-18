import { Component, inject, input, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { TaskService } from '../../../core/services/task.service';
import { TaskWithDetails } from '../../../shared/types/task.types';

@Component({
  selector: 'app-subtasks-section',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule],
  template: `
    <!-- Progress bar -->
    @if (subtasks().length > 0) {
      <div class="flex items-center gap-3 mb-3">
        <div
          class="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden"
        >
          <div
            class="h-full rounded-full transition-all duration-500 ease-out"
            [class]="
              progressPercent() === 100 ? 'bg-green-500' : 'bg-indigo-500'
            "
            [style.width.%]="progressPercent()"
          ></div>
        </div>
        <span
          class="text-xs font-semibold whitespace-nowrap"
          [class]="
            progressPercent() === 100
              ? 'text-green-600 dark:text-green-400'
              : 'text-gray-500'
          "
        >
          {{ completedCount() }}/{{ subtasks().length }}
          @if (progressPercent() === 100) {
            <i
              class="pi pi-check-circle !text-[12px] inline-block align-middle ml-0.5"
            ></i>
          }
        </span>
      </div>
    }

    <!-- Subtask list -->
    <div class="space-y-1">
      @for (subtask of subtasks(); track subtask.task.id) {
        <div
          class="flex items-center gap-2.5 group/subtask px-2.5 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        >
          <!-- Custom checkbox -->
          <button
            class="flex-shrink-0 w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center transition-all duration-200 cursor-pointer"
            [class]="
              isCompleted(subtask)
                ? 'border-green-500 bg-green-500 shadow-sm shadow-green-500/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 hover:shadow-sm'
            "
            (click)="toggleComplete(subtask)"
          >
            @if (isCompleted(subtask)) {
              <i class="pi pi-check !text-[12px] text-white"></i>
            }
          </button>
          <span
            class="flex-1 text-sm transition-all duration-200"
            [class]="
              isCompleted(subtask)
                ? 'text-gray-400 line-through'
                : 'text-gray-900 dark:text-gray-100'
            "
          >
            {{ subtask.task.title }}
          </span>
          <span
            class="flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full font-semibold"
            [class]="priorityClass(subtask.task.priority)"
          >
            {{ subtask.task.priority }}
          </span>
          <button
            pButton
            [rounded]="true"
            [text]="true"
            severity="secondary"
            class="!w-6 !h-6 opacity-0 group-hover/subtask:opacity-100 transition-opacity"
            (click)="deleteSubtask(subtask)"
          >
            <i
              class="pi pi-times !text-[14px] text-gray-400 hover:text-red-500 transition-colors"
            ></i>
          </button>
        </div>
      }
    </div>

    <!-- Empty state -->
    @if (!loading() && subtasks().length === 0 && !showAddForm()) {
      <div
        class="flex items-center gap-2 px-3 py-3 rounded-lg border border-dashed border-gray-200 dark:border-gray-700"
      >
        <i class="pi pi-list !text-[18px] text-gray-300"></i>
        <span class="text-sm text-gray-400">No subtasks yet</span>
      </div>
    }

    <!-- Add subtask form -->
    @if (showAddForm()) {
      <div class="flex items-center gap-2 mt-2.5">
        <div
          class="flex-shrink-0 w-[18px] h-[18px] rounded-md border-2 border-gray-200 dark:border-gray-700"
        ></div>
        <input
          class="flex-1 text-sm px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 placeholder:text-gray-400 transition-all"
          placeholder="What needs to be done?"
          [(ngModel)]="newSubtaskTitle"
          (keydown.enter)="addSubtask()"
          (keydown.escape)="cancelAdd()"
          #subtaskInput
        />
        <button
          class="w-7 h-7 flex items-center justify-center rounded-lg bg-green-50 hover:bg-green-100 dark:bg-green-900/30 dark:hover:bg-green-900/50 transition-colors"
          (click)="addSubtask()"
          [class.opacity-50]="!newSubtaskTitle.trim()"
          [class.pointer-events-none]="!newSubtaskTitle.trim()"
        >
          <i
            class="pi pi-check !text-[16px] text-green-600 dark:text-green-400"
          ></i>
        </button>
        <button
          class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          (click)="cancelAdd()"
        >
          <i class="pi pi-times !text-[16px] text-gray-400"></i>
        </button>
      </div>
    }

    @if (!showAddForm()) {
      <button
        class="flex items-center gap-1.5 text-xs font-medium text-indigo-500 hover:text-indigo-600 mt-2.5 px-2 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
        (click)="showAdd()"
      >
        <i class="pi pi-plus-circle !text-[14px]"></i>
        Add subtask
      </button>
    }

    @if (loading()) {
      <div class="flex items-center justify-center py-3">
        <div
          class="w-4 h-4 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin"
        ></div>
      </div>
    }
  `,
})
export class SubtasksSectionComponent implements OnInit {
  private taskService = inject(TaskService);
  private messageService = inject(MessageService);

  taskId = input.required<string>();

  subtasks = signal<TaskWithDetails[]>([]);
  loading = signal(false);
  showAddForm = signal(false);
  newSubtaskTitle = '';

  private completedIds = signal<Set<string>>(new Set());

  ngOnInit(): void {
    this.loadSubtasks();
  }

  completedCount(): number {
    return this.subtasks().filter((s) => this.isCompleted(s)).length;
  }

  progressPercent(): number {
    const total = this.subtasks().length;
    if (total === 0) return 0;
    return Math.round((this.completedCount() / total) * 100);
  }

  isCompleted(subtask: TaskWithDetails): boolean {
    return this.completedIds().has(subtask.task.id);
  }

  toggleComplete(subtask: TaskWithDetails): void {
    this.completedIds.update((ids) => {
      const newIds = new Set(ids);
      if (newIds.has(subtask.task.id)) {
        newIds.delete(subtask.task.id);
      } else {
        newIds.add(subtask.task.id);
      }
      return newIds;
    });
  }

  showAdd(): void {
    this.showAddForm.set(true);
    this.newSubtaskTitle = '';
  }

  cancelAdd(): void {
    this.showAddForm.set(false);
    this.newSubtaskTitle = '';
  }

  addSubtask(): void {
    const title = this.newSubtaskTitle.trim();
    if (!title) return;

    this.taskService
      .createSubtask(this.taskId(), {
        title,
        priority: 'medium',
      })
      .subscribe({
        next: () => {
          this.newSubtaskTitle = '';
          this.loadSubtasks();
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to create subtask.',
            life: 3000,
          });
        },
      });
  }

  deleteSubtask(subtask: TaskWithDetails): void {
    this.taskService.deleteTask(subtask.task.id).subscribe({
      next: () => {
        this.subtasks.update((list) =>
          list.filter((s) => s.task.id !== subtask.task.id),
        );
        this.completedIds.update((ids) => {
          const newIds = new Set(ids);
          newIds.delete(subtask.task.id);
          return newIds;
        });
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to delete subtask.',
          life: 3000,
        });
      },
    });
  }

  priorityClass(priority: string): string {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'high':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      case 'medium':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'low':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
    }
  }

  private loadSubtasks(): void {
    this.loading.set(true);
    this.taskService.listSubtasks(this.taskId()).subscribe({
      next: (data) => {
        this.subtasks.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }
}
