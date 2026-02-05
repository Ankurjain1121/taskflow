import {
  Component,
  input,
  output,
  signal,
  inject,
  OnInit,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  TaskService,
  Task,
  TaskWithDetails,
  TaskPriority,
  Assignee,
} from '../../../core/services/task.service';
import { WorkspaceService, MemberSearchResult } from '../../../core/services/workspace.service';
import { BoardService, Column } from '../../../core/services/board.service';
import {
  PRIORITY_COLORS,
  getPriorityLabel,
  getDueDateColor,
} from '../../../shared/utils/task-colors';

@Component({
  selector: 'app-task-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Backdrop -->
    <div
      class="fixed inset-0 bg-black bg-opacity-25 z-40"
      (click)="onClose()"
    ></div>

    <!-- Slide-over Panel -->
    <div
      class="fixed inset-y-0 right-0 w-[480px] bg-white shadow-xl z-50 flex flex-col transform transition-transform"
      [class.translate-x-0]="true"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-500">Task Detail</span>
          @if (column()?.status_mapping?.done) {
            <span
              class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"
            >
              Done
            </span>
          }
        </div>
        <button
          (click)="onClose()"
          class="p-2 hover:bg-gray-100 rounded-md transition-colors"
        >
          <svg
            class="w-5 h-5 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      @if (loading()) {
        <div class="flex-1 flex items-center justify-center">
          <svg
            class="animate-spin h-8 w-8 text-indigo-600"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            ></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </div>
      } @else if (task()) {
        <div class="flex-1 overflow-y-auto">
          <div class="px-6 py-4 space-y-6">
            <!-- Title (Inline Editable) -->
            <div>
              <input
                type="text"
                [ngModel]="task()!.title"
                (ngModelChange)="onTitleChange($event)"
                (blur)="saveTitle()"
                class="w-full text-xl font-semibold text-gray-900 border-0 border-b-2 border-transparent hover:border-gray-200 focus:border-indigo-500 focus:ring-0 px-0 py-1"
                placeholder="Task title"
              />
            </div>

            <!-- Metadata Grid -->
            <div class="grid grid-cols-2 gap-4">
              <!-- Column -->
              <div>
                <label class="block text-sm font-medium text-gray-500 mb-1"
                  >Column</label
                >
                <div class="flex items-center gap-2 py-2">
                  <span
                    class="w-3 h-3 rounded-full"
                    [style.background-color]="column()?.color || '#6366f1'"
                  ></span>
                  <span class="text-sm text-gray-900">{{
                    column()?.name || 'Unknown'
                  }}</span>
                </div>
              </div>

              <!-- Priority -->
              <div>
                <label class="block text-sm font-medium text-gray-500 mb-1"
                  >Priority</label
                >
                <select
                  [ngModel]="task()!.priority"
                  (ngModelChange)="onPriorityChange($event)"
                  class="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  @for (priority of priorityOptions; track priority) {
                    <option [value]="priority">
                      {{ getPriorityLabel(priority) }}
                    </option>
                  }
                </select>
              </div>

              <!-- Due Date -->
              <div>
                <label class="block text-sm font-medium text-gray-500 mb-1"
                  >Due Date</label
                >
                <input
                  type="date"
                  [ngModel]="task()!.due_date || ''"
                  (ngModelChange)="onDueDateChange($event)"
                  [class]="
                    'w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 ' +
                    getDueDateColor(task()!.due_date)
                  "
                />
              </div>

              <!-- Assignees -->
              <div>
                <label class="block text-sm font-medium text-gray-500 mb-1"
                  >Assignees</label
                >
                <div class="flex flex-wrap gap-2 py-1">
                  @if (task()!.assignees && task()!.assignees!.length > 0) {
                    @for (assignee of task()!.assignees!; track assignee.id) {
                      <div
                        class="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full text-sm"
                      >
                        <div
                          class="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-xs"
                        >
                          @if (assignee.avatar_url) {
                            <img
                              [src]="assignee.avatar_url"
                              [alt]="assignee.display_name"
                              class="w-full h-full rounded-full object-cover"
                            />
                          } @else {
                            {{ getInitials(assignee.display_name) }}
                          }
                        </div>
                        <span>{{ assignee.display_name }}</span>
                        <button
                          (click)="onUnassign(assignee)"
                          class="ml-1 text-gray-400 hover:text-gray-600"
                        >
                          <svg
                            class="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    }
                  }
                  <button
                    (click)="toggleAssigneeSearch()"
                    class="inline-flex items-center gap-1 px-2 py-1 text-sm text-indigo-600 hover:bg-indigo-50 rounded-full"
                  >
                    <svg
                      class="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    Add
                  </button>
                </div>

                <!-- Assignee Search Dropdown -->
                @if (showAssigneeSearch()) {
                  <div
                    class="mt-2 bg-white border border-gray-200 rounded-md shadow-lg"
                  >
                    <input
                      type="text"
                      [ngModel]="assigneeSearchQuery()"
                      (ngModelChange)="onAssigneeSearchChange($event)"
                      placeholder="Search members..."
                      class="w-full px-3 py-2 text-sm border-0 border-b border-gray-200 focus:ring-0"
                    />
                    <div class="max-h-48 overflow-y-auto p-2">
                      @for (member of searchResults(); track member.id) {
                        <button
                          (click)="onAssign(member)"
                          class="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-gray-100 rounded"
                        >
                          <div
                            class="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs"
                          >
                            {{ getInitials(member.name || '') }}
                          </div>
                          <span>{{ member.name || member.email }}</span>
                        </button>
                      }
                      @if (searchResults().length === 0 && assigneeSearchQuery()) {
                        <div class="px-2 py-4 text-sm text-gray-500 text-center">
                          No members found
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>

            <!-- Description -->
            <div>
              <label class="block text-sm font-medium text-gray-500 mb-1"
                >Description</label
              >
              <textarea
                [ngModel]="task()!.description || ''"
                (ngModelChange)="onDescriptionChange($event)"
                (blur)="saveDescription()"
                rows="4"
                class="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="Add a description..."
              ></textarea>
            </div>

            <!-- Labels -->
            <div>
              <label class="block text-sm font-medium text-gray-500 mb-2"
                >Labels</label
              >
              <div class="flex flex-wrap gap-2">
                @if (task()!.labels && task()!.labels!.length > 0) {
                  @for (label of task()!.labels!; track label.id) {
                    <span
                      class="inline-flex items-center px-2.5 py-1 rounded text-sm font-medium"
                      [style.background-color]="label.color + '20'"
                      [style.color]="label.color"
                    >
                      {{ label.name }}
                      <button
                        (click)="onRemoveLabel(label.id)"
                        class="ml-1.5 hover:opacity-70"
                      >
                        <svg
                          class="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </span>
                  }
                } @else {
                  <span class="text-sm text-gray-400">No labels</span>
                }
              </div>
            </div>

            <!-- Comments Placeholder -->
            <div class="border-t border-gray-200 pt-6">
              <div class="flex items-center gap-2 mb-4">
                <svg
                  class="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <h3 class="text-sm font-medium text-gray-900">Comments</h3>
              </div>
              <div class="bg-gray-50 rounded-md p-4 text-center text-sm text-gray-500">
                Comments will be available in a future update
              </div>
            </div>

            <!-- Attachments Placeholder -->
            <div class="border-t border-gray-200 pt-6">
              <div class="flex items-center gap-2 mb-4">
                <svg
                  class="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                  />
                </svg>
                <h3 class="text-sm font-medium text-gray-900">Attachments</h3>
              </div>
              <div class="bg-gray-50 rounded-md p-4 text-center text-sm text-gray-500">
                Attachments will be available in a future update
              </div>
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="border-t border-gray-200 px-6 py-4">
          <div class="flex items-center justify-between">
            <div class="text-xs text-gray-500">
              Created {{ formatDate(task()!.created_at) }}
            </div>
            <button
              (click)="onDelete()"
              class="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              Delete
            </button>
          </div>
        </div>
      }
    </div>
  `,
})
export class TaskDetailComponent implements OnInit, OnChanges {
  private taskService = inject(TaskService);
  private workspaceService = inject(WorkspaceService);
  private boardService = inject(BoardService);

  taskId = input.required<string>();
  workspaceId = input.required<string>();

  closed = output<void>();
  taskUpdated = output<Task>();

  loading = signal(true);
  task = signal<Task | null>(null);
  column = signal<Column | null>(null);
  showAssigneeSearch = signal(false);
  assigneeSearchQuery = signal('');
  searchResults = signal<MemberSearchResult[]>([]);

  priorityOptions: TaskPriority[] = ['urgent', 'high', 'medium', 'low'];

  private pendingTitle = '';
  private pendingDescription = '';

  ngOnInit(): void {
    this.loadTask();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['taskId'] && !changes['taskId'].firstChange) {
      this.loadTask();
    }
  }

  getPriorityLabel(priority: TaskPriority): string {
    return getPriorityLabel(priority);
  }

  getDueDateColor(dueDate: string | null): string {
    return getDueDateColor(dueDate);
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  onClose(): void {
    this.closed.emit();
  }

  onTitleChange(title: string): void {
    this.pendingTitle = title;
  }

  saveTitle(): void {
    if (this.pendingTitle && this.pendingTitle !== this.task()?.title) {
      this.updateTask({ title: this.pendingTitle });
    }
  }

  onDescriptionChange(description: string): void {
    this.pendingDescription = description;
  }

  saveDescription(): void {
    if (this.pendingDescription !== this.task()?.description) {
      this.updateTask({ description: this.pendingDescription || null });
    }
  }

  onPriorityChange(priority: TaskPriority): void {
    this.updateTask({ priority });
  }

  onDueDateChange(dueDate: string): void {
    this.updateTask({ due_date: dueDate || null });
  }

  toggleAssigneeSearch(): void {
    this.showAssigneeSearch.update((v) => !v);
    if (!this.showAssigneeSearch()) {
      this.assigneeSearchQuery.set('');
      this.searchResults.set([]);
    }
  }

  onAssigneeSearchChange(query: string): void {
    this.assigneeSearchQuery.set(query);
    if (!query || query.length < 2) {
      this.searchResults.set([]);
      return;
    }
    this.workspaceService.searchMembers(this.workspaceId(), query).subscribe({
      next: (results) => this.searchResults.set(results),
      error: (err) => {
        console.error('Failed to search members:', err);
        this.searchResults.set([]);
      },
    });
  }

  onAssign(member: MemberSearchResult): void {
    const task = this.task();
    if (!task) return;

    this.taskService.assignUser(task.id, member.id).subscribe({
      next: () => {
        // Add assignee to local state
        const newAssignee: Assignee = {
          id: member.id,
          display_name: member.name || 'Unknown',
          avatar_url: member.avatar_url,
        };
        const updatedTask = {
          ...task,
          assignees: [...(task.assignees || []), newAssignee],
        };
        this.task.set(updatedTask);
        this.taskUpdated.emit(updatedTask);
        this.toggleAssigneeSearch();
      },
      error: (err) => console.error('Failed to assign user:', err),
    });
  }

  onUnassign(assignee: Assignee): void {
    const task = this.task();
    if (!task) return;

    this.taskService.unassignUser(task.id, assignee.id).subscribe({
      next: () => {
        const updatedTask = {
          ...task,
          assignees: (task.assignees || []).filter((a) => a.id !== assignee.id),
        };
        this.task.set(updatedTask);
        this.taskUpdated.emit(updatedTask);
      },
      error: (err) => console.error('Failed to unassign user:', err),
    });
  }

  onRemoveLabel(labelId: string): void {
    const task = this.task();
    if (!task) return;

    this.taskService.removeLabel(task.id, labelId).subscribe({
      next: () => {
        const updatedTask = {
          ...task,
          labels: (task.labels || []).filter((l) => l.id !== labelId),
        };
        this.task.set(updatedTask);
        this.taskUpdated.emit(updatedTask);
      },
      error: (err) => console.error('Failed to remove label:', err),
    });
  }

  onDelete(): void {
    const task = this.task();
    if (!task) return;

    if (!confirm('Are you sure you want to delete this task?')) {
      return;
    }

    this.taskService.deleteTask(task.id).subscribe({
      next: () => {
        this.closed.emit();
      },
      error: (err) => console.error('Failed to delete task:', err),
    });
  }

  private loadTask(): void {
    this.loading.set(true);

    this.taskService.getTask(this.taskId()).subscribe({
      next: (task) => {
        this.task.set(task);
        this.pendingTitle = task.title;
        this.pendingDescription = task.description || '';
        this.loadColumn(task.column_id);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load task:', err);
        this.loading.set(false);
      },
    });
  }

  private loadColumn(columnId: string): void {
    // Get board ID from task, then fetch columns
    // For simplicity, we'll fetch columns from the service
    const task = this.task();
    if (!task) return;

    // We need to get board ID - for now we'll parse it from URL or skip
    // In a real implementation, task would include board_id
  }

  private updateTask(updates: Partial<Task>): void {
    const task = this.task();
    if (!task) return;

    this.taskService.updateTask(task.id, updates).subscribe({
      next: (updatedTask) => {
        this.task.set(updatedTask);
        this.taskUpdated.emit(updatedTask);
      },
      error: (err) => console.error('Failed to update task:', err),
    });
  }
}
