import {
  Component,
  input,
  output,
  signal,
  inject,
  OnInit,
  OnChanges,
  OnDestroy,
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
  TaskListItem,
  Assignee,
} from '../../../core/services/task.service';
import { WorkspaceService, MemberSearchResult } from '../../../core/services/workspace.service';
import { BoardService, Column } from '../../../core/services/board.service';
import {
  PRIORITY_COLORS,
  getPriorityLabel,
  getDueDateColor,
} from '../../../shared/utils/task-colors';
import { SubtaskListComponent } from '../subtask-list/subtask-list.component';
import {
  DependencyService,
  TaskDependency,
  DependencyType,
} from '../../../core/services/dependency.service';
import {
  MilestoneService,
  Milestone,
} from '../../../core/services/milestone.service';
import {
  CustomFieldService,
  TaskCustomFieldValueWithField,
  SetFieldValue,
  CustomFieldType,
} from '../../../core/services/custom-field.service';
import {
  RecurringService,
  RecurringTaskConfig,
  RecurrencePattern,
  CreateRecurringRequest,
} from '../../../core/services/recurring.service';
import {
  TimeTrackingService,
  TimeEntry,
} from '../../../core/services/time-tracking.service';

@Component({
  selector: 'app-task-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, SubtaskListComponent],
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
        <div class="flex-1 p-6 space-y-6 animate-fade-in">
          <div class="space-y-3">
            <div class="skeleton skeleton-heading w-3/4"></div>
            <div class="skeleton skeleton-text w-1/2"></div>
          </div>
          <div class="flex gap-2">
            <div class="skeleton w-16 h-6 rounded-full"></div>
            <div class="skeleton w-20 h-6 rounded-full"></div>
            <div class="skeleton w-16 h-6 rounded-full"></div>
          </div>
          <div class="skeleton w-full h-24 rounded-lg"></div>
          <div class="space-y-2">
            <div class="skeleton skeleton-text w-24"></div>
            <div class="skeleton w-full h-12 rounded-lg"></div>
            <div class="skeleton w-full h-12 rounded-lg"></div>
          </div>
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

            <!-- Milestone -->
            <div class="border-t border-gray-200 pt-6">
              <label class="block text-sm font-medium text-gray-500 mb-2">Milestone</label>
              <div class="flex items-center gap-2">
                @if (selectedMilestone()) {
                  <span
                    class="w-3 h-3 rounded-full flex-shrink-0"
                    [style.background-color]="selectedMilestone()!.color"
                  ></span>
                  <span class="text-sm text-gray-900">{{ selectedMilestone()!.name }}</span>
                  <button
                    (click)="onClearMilestone()"
                    class="ml-auto p-1 text-gray-400 hover:text-gray-600 rounded"
                    title="Remove milestone"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                } @else {
                  <span class="text-sm text-gray-400">None</span>
                }
              </div>
              <select
                [ngModel]="task()?.milestone_id || ''"
                (ngModelChange)="onMilestoneChange($event)"
                class="mt-2 w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="">No milestone</option>
                @for (ms of milestones(); track ms.id) {
                  <option [value]="ms.id">{{ ms.name }}</option>
                }
              </select>
            </div>

            <!-- Dependencies -->
            <div class="border-t border-gray-200 pt-6">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <h3 class="text-sm font-medium text-gray-900">Dependencies</h3>
                  <span class="text-xs text-gray-400">({{ dependencies().length }})</span>
                </div>
                <button
                  (click)="toggleAddDependency()"
                  class="inline-flex items-center gap-1 px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Add
                </button>
              </div>

              <!-- Add Dependency Form -->
              @if (showAddDependency()) {
                <div class="mb-3 bg-gray-50 rounded-md p-3 space-y-2">
                  <select
                    [ngModel]="selectedDepType()"
                    (ngModelChange)="selectedDepType.set($event)"
                    class="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    <option value="blocks">Blocks</option>
                    <option value="blocked_by">Blocked by</option>
                    <option value="related">Related to</option>
                  </select>
                  <input
                    type="text"
                    [ngModel]="depSearchQuery()"
                    (ngModelChange)="onDepSearchChange($event)"
                    placeholder="Search tasks..."
                    class="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                  @if (depSearchResults().length > 0) {
                    <div class="max-h-40 overflow-y-auto border border-gray-200 rounded-md bg-white">
                      @for (t of depSearchResults(); track t.id) {
                        <button
                          (click)="onAddDependency(t)"
                          class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 text-left"
                        >
                          <span
                            class="w-2 h-2 rounded-full flex-shrink-0"
                            [class.bg-red-500]="t.priority === 'urgent'"
                            [class.bg-orange-500]="t.priority === 'high'"
                            [class.bg-yellow-500]="t.priority === 'medium'"
                            [class.bg-blue-500]="t.priority === 'low'"
                          ></span>
                          <span class="truncate">{{ t.title }}</span>
                          <span class="text-xs text-gray-400 ml-auto flex-shrink-0">{{ t.column_name }}</span>
                        </button>
                      }
                    </div>
                  }
                </div>
              }

              <!-- Blocking (tasks this task blocks) -->
              @if (blockingDeps().length > 0) {
                <div class="mb-2">
                  <span class="text-xs font-medium text-red-600 uppercase tracking-wide">Blocking</span>
                  <div class="mt-1 space-y-1">
                    @for (dep of blockingDeps(); track dep.id) {
                      <div class="flex items-center justify-between px-2 py-1.5 bg-red-50 rounded text-sm group">
                        <div class="flex items-center gap-2 min-w-0">
                          <span
                            class="w-2 h-2 rounded-full flex-shrink-0"
                            [class.bg-red-500]="dep.related_task_priority === 'urgent'"
                            [class.bg-orange-500]="dep.related_task_priority === 'high'"
                            [class.bg-yellow-500]="dep.related_task_priority === 'medium'"
                            [class.bg-blue-500]="dep.related_task_priority === 'low'"
                          ></span>
                          <span class="truncate text-red-800">{{ dep.related_task_title }}</span>
                          <span class="text-xs text-red-400 flex-shrink-0">{{ dep.related_task_column_name }}</span>
                        </div>
                        <button
                          (click)="onRemoveDependency(dep.id)"
                          class="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 p-0.5"
                        >
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    }
                  </div>
                </div>
              }

              <!-- Blocked by (tasks that block this task) -->
              @if (blockedByDeps().length > 0) {
                <div class="mb-2">
                  <span class="text-xs font-medium text-orange-600 uppercase tracking-wide">Blocked by</span>
                  <div class="mt-1 space-y-1">
                    @for (dep of blockedByDeps(); track dep.id) {
                      <div class="flex items-center justify-between px-2 py-1.5 bg-orange-50 rounded text-sm group">
                        <div class="flex items-center gap-2 min-w-0">
                          <span
                            class="w-2 h-2 rounded-full flex-shrink-0"
                            [class.bg-red-500]="dep.related_task_priority === 'urgent'"
                            [class.bg-orange-500]="dep.related_task_priority === 'high'"
                            [class.bg-yellow-500]="dep.related_task_priority === 'medium'"
                            [class.bg-blue-500]="dep.related_task_priority === 'low'"
                          ></span>
                          <span class="truncate text-orange-800">{{ dep.related_task_title }}</span>
                          <span class="text-xs text-orange-400 flex-shrink-0">{{ dep.related_task_column_name }}</span>
                        </div>
                        <button
                          (click)="onRemoveDependency(dep.id)"
                          class="opacity-0 group-hover:opacity-100 text-orange-400 hover:text-orange-600 p-0.5"
                        >
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    }
                  </div>
                </div>
              }

              <!-- Related -->
              @if (relatedDeps().length > 0) {
                <div class="mb-2">
                  <span class="text-xs font-medium text-gray-500 uppercase tracking-wide">Related</span>
                  <div class="mt-1 space-y-1">
                    @for (dep of relatedDeps(); track dep.id) {
                      <div class="flex items-center justify-between px-2 py-1.5 bg-gray-50 rounded text-sm group">
                        <div class="flex items-center gap-2 min-w-0">
                          <span
                            class="w-2 h-2 rounded-full flex-shrink-0"
                            [class.bg-red-500]="dep.related_task_priority === 'urgent'"
                            [class.bg-orange-500]="dep.related_task_priority === 'high'"
                            [class.bg-yellow-500]="dep.related_task_priority === 'medium'"
                            [class.bg-blue-500]="dep.related_task_priority === 'low'"
                          ></span>
                          <span class="truncate text-gray-800">{{ dep.related_task_title }}</span>
                          <span class="text-xs text-gray-400 flex-shrink-0">{{ dep.related_task_column_name }}</span>
                        </div>
                        <button
                          (click)="onRemoveDependency(dep.id)"
                          class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 p-0.5"
                        >
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    }
                  </div>
                </div>
              }

              @if (dependencies().length === 0 && !showAddDependency()) {
                <div class="text-sm text-gray-400">No dependencies</div>
              }
            </div>

            <!-- Recurring -->
            <div class="border-t border-gray-200 pt-6">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <h3 class="text-sm font-medium text-gray-900">Recurring</h3>
                </div>
                @if (!recurringConfig() && !showRecurringForm()) {
                  <button
                    (click)="toggleRecurringForm()"
                    class="inline-flex items-center gap-1 px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                    Set as recurring
                  </button>
                }
              </div>
              @if (recurringConfig()) {
                <div class="bg-indigo-50 rounded-md p-3 space-y-2">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-medium text-indigo-800">Repeats: {{ getPatternLabel(recurringConfig()!.pattern) }}</span>
                      @if (!recurringConfig()!.is_active) {
                        <span class="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded">Paused</span>
                      }
                    </div>
                    <div class="flex items-center gap-1">
                      <button (click)="toggleRecurringForm()" class="p-1 text-indigo-400 hover:text-indigo-600 rounded" title="Edit">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button (click)="onRemoveRecurring()" class="p-1 text-red-400 hover:text-red-600 rounded" title="Remove">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div class="text-xs text-indigo-600 space-y-1">
                    <div>Next run: {{ formatDate(recurringConfig()!.next_run_at) }}</div>
                    <div>Occurrences: {{ recurringConfig()!.occurrences_created }}{{ recurringConfig()!.max_occurrences ? ' / ' + recurringConfig()!.max_occurrences : '' }}</div>
                    @if (recurringConfig()!.interval_days && recurringConfig()!.pattern === 'custom') {
                      <div>Every {{ recurringConfig()!.interval_days }} days</div>
                    }
                  </div>
                </div>
              }
              @if (showRecurringForm()) {
                <div class="bg-gray-50 rounded-md p-3 space-y-3">
                  <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">Pattern</label>
                    <select [ngModel]="recurringPattern()" (ngModelChange)="recurringPattern.set($event)" class="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Biweekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  @if (recurringPattern() === 'custom') {
                    <div>
                      <label class="block text-xs font-medium text-gray-500 mb-1">Interval (days)</label>
                      <input type="number" min="1" [ngModel]="recurringIntervalDays()" (ngModelChange)="recurringIntervalDays.set($event)" class="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500" placeholder="e.g. 3" />
                    </div>
                  }
                  <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">Max occurrences (optional)</label>
                    <input type="number" min="1" [ngModel]="recurringMaxOccurrences()" (ngModelChange)="recurringMaxOccurrences.set($event)" class="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500" placeholder="Leave empty for unlimited" />
                  </div>
                  <div class="flex items-center gap-2">
                    <button (click)="onSaveRecurring()" class="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                      {{ recurringConfig() ? 'Update' : 'Save' }}
                    </button>
                    <button (click)="toggleRecurringForm()" class="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-md">Cancel</button>
                  </div>
                </div>
              }
              @if (!recurringConfig() && !showRecurringForm()) {
                <div class="text-sm text-gray-400">Not recurring</div>
              }
            </div>

            <!-- Subtasks / Checklist -->
            <div class="border-t border-gray-200 pt-6">
              <app-subtask-list [taskId]="taskId()" />
            </div>

            <!-- Custom Fields -->
            @if (customFields().length > 0) {
              <div class="border-t border-gray-200 pt-6">
                <div class="flex items-center gap-2 mb-3">
                  <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <h3 class="text-sm font-medium text-gray-900">Custom Fields</h3>
                </div>
                <div class="space-y-3">
                  @for (cf of customFields(); track cf.field_id) {
                    <div class="flex flex-col gap-1">
                      <label class="text-xs font-medium text-gray-500">
                        {{ cf.field_name }}
                        @if (cf.is_required) {
                          <span class="text-red-500">*</span>
                        }
                      </label>
                      @switch (cf.field_type) {
                        @case ('text') {
                          <input
                            type="text"
                            [ngModel]="cf.value_text || ''"
                            (ngModelChange)="onCustomFieldTextChange(cf.field_id, $event)"
                            (blur)="saveCustomFields()"
                            class="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            placeholder="Enter text..."
                          />
                        }
                        @case ('number') {
                          <input
                            type="number"
                            [ngModel]="cf.value_number"
                            (ngModelChange)="onCustomFieldNumberChange(cf.field_id, $event)"
                            (blur)="saveCustomFields()"
                            class="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            placeholder="Enter number..."
                          />
                        }
                        @case ('date') {
                          <input
                            type="date"
                            [ngModel]="cf.value_date ? cf.value_date.split('T')[0] : ''"
                            (ngModelChange)="onCustomFieldDateChange(cf.field_id, $event)"
                            class="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                          />
                        }
                        @case ('dropdown') {
                          <select
                            [ngModel]="cf.value_text || ''"
                            (ngModelChange)="onCustomFieldDropdownChange(cf.field_id, $event)"
                            class="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                          >
                            <option value="">Select...</option>
                            @if (cf.options) {
                              @for (opt of getDropdownOptions(cf.options); track opt) {
                                <option [value]="opt">{{ opt }}</option>
                              }
                            }
                          </select>
                        }
                        @case ('checkbox') {
                          <label class="inline-flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              [ngModel]="cf.value_bool || false"
                              (ngModelChange)="onCustomFieldCheckboxChange(cf.field_id, $event)"
                              class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span class="text-sm text-gray-700">{{ cf.value_bool ? 'Yes' : 'No' }}</span>
                          </label>
                        }
                      }
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Time Tracking -->
            <div class="border-t border-gray-200 pt-6">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 class="text-sm font-medium text-gray-900">Time Tracking</h3>
                  @if (timeEntryTotalMinutes() > 0) {
                    <span class="text-xs text-gray-400">({{ formatDuration(timeEntryTotalMinutes()) }})</span>
                  }
                </div>
                <button
                  (click)="toggleLogTimeForm()"
                  class="inline-flex items-center gap-1 px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Log Time
                </button>
              </div>

              <!-- Timer Control -->
              <div class="mb-3">
                @if (runningTimerForTask()) {
                  <div class="flex items-center gap-3 px-3 py-2 bg-red-50 rounded-md">
                    <div class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                    <span class="text-sm font-mono text-red-700 flex-1">{{ elapsedTime() }}</span>
                    <button
                      (click)="onStopTimer()"
                      class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded"
                    >
                      <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="6" width="12" height="12" rx="1" />
                      </svg>
                      Stop
                    </button>
                  </div>
                } @else {
                  <button
                    (click)="onStartTimer()"
                    class="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-md w-full justify-center"
                  >
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Start Timer
                  </button>
                }
              </div>

              <!-- Log Time Form -->
              @if (showLogTimeForm()) {
                <div class="mb-3 bg-gray-50 rounded-md p-3 space-y-2">
                  <div class="flex gap-2">
                    <div class="flex-1">
                      <label class="block text-xs text-gray-500 mb-1">Hours</label>
                      <input
                        type="number"
                        min="0"
                        [ngModel]="logTimeHours()"
                        (ngModelChange)="logTimeHours.set($event)"
                        class="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        placeholder="0"
                      />
                    </div>
                    <div class="flex-1">
                      <label class="block text-xs text-gray-500 mb-1">Minutes</label>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        [ngModel]="logTimeMinutes()"
                        (ngModelChange)="logTimeMinutes.set($event)"
                        class="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <input
                    type="text"
                    [ngModel]="logTimeDescription()"
                    (ngModelChange)="logTimeDescription.set($event)"
                    placeholder="Description (optional)"
                    class="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                  <input
                    type="date"
                    [ngModel]="logTimeDate()"
                    (ngModelChange)="logTimeDate.set($event)"
                    class="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                  <div class="flex gap-2">
                    <button
                      (click)="onSubmitLogTime()"
                      class="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md"
                    >
                      Log Time
                    </button>
                    <button
                      (click)="toggleLogTimeForm()"
                      class="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-md"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              }

              <!-- Time Entries List -->
              @if (timeEntries().length > 0) {
                <div class="space-y-1">
                  @for (entry of timeEntries(); track entry.id) {
                    <div class="flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 rounded text-sm group">
                      <div class="flex items-center gap-2 min-w-0">
                        <span class="font-mono text-gray-700 flex-shrink-0">
                          {{ formatDuration(entry.duration_minutes || 0) }}
                        </span>
                        @if (entry.description) {
                          <span class="text-gray-500 truncate">{{ entry.description }}</span>
                        }
                      </div>
                      <div class="flex items-center gap-2">
                        <span class="text-xs text-gray-400 flex-shrink-0">{{ formatDate(entry.started_at) }}</span>
                        <button
                          (click)="onDeleteTimeEntry(entry.id)"
                          class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 p-0.5"
                        >
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  }
                </div>
              } @else if (!showLogTimeForm()) {
                <div class="text-sm text-gray-400">No time entries</div>
              }
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
export class TaskDetailComponent implements OnInit, OnChanges, OnDestroy {
  private taskService = inject(TaskService);
  private workspaceService = inject(WorkspaceService);
  private boardService = inject(BoardService);
  private dependencyService = inject(DependencyService);
  private milestoneService = inject(MilestoneService);
  private customFieldService = inject(CustomFieldService);
  private recurringService = inject(RecurringService);
  private timeTrackingService = inject(TimeTrackingService);

  taskId = input.required<string>();
  workspaceId = input.required<string>();
  boardId = input<string>('');

  closed = output<void>();
  taskUpdated = output<Task>();

  loading = signal(true);
  task = signal<Task | null>(null);
  column = signal<Column | null>(null);
  showAssigneeSearch = signal(false);
  assigneeSearchQuery = signal('');
  searchResults = signal<MemberSearchResult[]>([]);

  // Dependencies
  dependencies = signal<TaskDependency[]>([]);
  showAddDependency = signal(false);
  selectedDepType = signal<DependencyType>('blocks');
  depSearchQuery = signal('');
  depSearchResults = signal<TaskListItem[]>([]);
  private boardTasks = signal<TaskListItem[]>([]);

  // Milestones
  milestones = signal<Milestone[]>([]);
  selectedMilestone = signal<Milestone | null>(null);

  // Computed dependency groups
  blockingDeps = signal<TaskDependency[]>([]);
  blockedByDeps = signal<TaskDependency[]>([]);
  relatedDeps = signal<TaskDependency[]>([]);

  // Custom Fields
  customFields = signal<TaskCustomFieldValueWithField[]>([]);
  private customFieldDebounceTimer: any = null;

  // Recurring
  recurringConfig = signal<RecurringTaskConfig | null>(null);
  showRecurringForm = signal(false);
  recurringPattern = signal<RecurrencePattern>('weekly');
  recurringIntervalDays = signal<number | null>(null);
  recurringMaxOccurrences = signal<number | null>(null);

  // Time Tracking
  timeEntries = signal<TimeEntry[]>([]);
  runningTimerForTask = signal<TimeEntry | null>(null);
  elapsedTime = signal('00:00:00');
  showLogTimeForm = signal(false);
  logTimeHours = signal(0);
  logTimeMinutes = signal(0);
  logTimeDescription = signal('');
  logTimeDate = signal(new Date().toISOString().split('T')[0]);
  private timerInterval: ReturnType<typeof setInterval> | null = null;

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

  ngOnDestroy(): void {
    this.clearTimerInterval();
  }

  timeEntryTotalMinutes(): number {
    return this.timeEntries().reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
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

  onMilestoneChange(milestoneId: string): void {
    const task = this.task();
    if (!task) return;

    if (milestoneId) {
      this.milestoneService.assignTask(task.id, milestoneId).subscribe({
        next: () => {
          const updatedTask = { ...task, milestone_id: milestoneId };
          this.task.set(updatedTask);
          this.taskUpdated.emit(updatedTask);
          const ms = this.milestones().find(m => m.id === milestoneId) || null;
          this.selectedMilestone.set(ms);
        },
        error: (err) => console.error('Failed to assign milestone:', err),
      });
    } else {
      this.onClearMilestone();
    }
  }

  onClearMilestone(): void {
    const task = this.task();
    if (!task) return;

    this.milestoneService.unassignTask(task.id).subscribe({
      next: () => {
        const updatedTask = { ...task, milestone_id: null };
        this.task.set(updatedTask);
        this.taskUpdated.emit(updatedTask);
        this.selectedMilestone.set(null);
      },
      error: (err) => console.error('Failed to unassign milestone:', err),
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

  // -- Dependency methods --

  toggleAddDependency(): void {
    this.showAddDependency.update((v) => !v);
    if (!this.showAddDependency()) {
      this.depSearchQuery.set('');
      this.depSearchResults.set([]);
    } else if (this.boardTasks().length === 0 && this.boardId()) {
      // Load board tasks for the search dropdown
      this.taskService.listFlat(this.boardId()).subscribe({
        next: (tasks) => this.boardTasks.set(tasks),
        error: (err) => console.error('Failed to load board tasks:', err),
      });
    }
  }

  onDepSearchChange(query: string): void {
    this.depSearchQuery.set(query);
    if (!query || query.length < 2) {
      this.depSearchResults.set([]);
      return;
    }
    const currentTaskId = this.taskId();
    const existingDepTaskIds = new Set(
      this.dependencies().map((d) => d.related_task_id)
    );
    const filtered = this.boardTasks().filter(
      (t) =>
        t.id !== currentTaskId &&
        !existingDepTaskIds.has(t.id) &&
        t.title.toLowerCase().includes(query.toLowerCase())
    );
    this.depSearchResults.set(filtered.slice(0, 10));
  }

  onAddDependency(targetTask: TaskListItem): void {
    this.dependencyService
      .createDependency(this.taskId(), targetTask.id, this.selectedDepType())
      .subscribe({
        next: (dep) => {
          this.dependencies.update((deps) => [dep, ...deps]);
          this.updateDepGroups();
          this.showAddDependency.set(false);
          this.depSearchQuery.set('');
          this.depSearchResults.set([]);
        },
        error: (err) => console.error('Failed to create dependency:', err),
      });
  }

  onRemoveDependency(depId: string): void {
    this.dependencyService.deleteDependency(depId).subscribe({
      next: () => {
        this.dependencies.update((deps) => deps.filter((d) => d.id !== depId));
        this.updateDepGroups();
      },
      error: (err) => console.error('Failed to remove dependency:', err),
    });
  }

  private loadDependencies(): void {
    this.dependencyService.listDependencies(this.taskId()).subscribe({
      next: (deps) => {
        this.dependencies.set(deps);
        this.updateDepGroups();
      },
      error: (err) => console.error('Failed to load dependencies:', err),
    });
  }

  private updateDepGroups(): void {
    const deps = this.dependencies();
    const taskId = this.taskId();

    // "Blocking" = this task is the source of a "blocks" relationship
    const blocking = deps.filter(
      (d) => d.dependency_type === 'blocks' && d.source_task_id === taskId
    );

    // "Blocked by" = this task is the target of a "blocks" relationship
    const blockedBy = deps.filter(
      (d) => d.dependency_type === 'blocks' && d.target_task_id === taskId
    );

    // "Related" = related dependencies
    const related = deps.filter((d) => d.dependency_type === 'related');

    this.blockingDeps.set(blocking);
    this.blockedByDeps.set(blockedBy);
    this.relatedDeps.set(related);
  }

  // -- Custom Field methods --

  onCustomFieldTextChange(fieldId: string, value: string): void {
    this.customFields.update((fields) =>
      fields.map((f) => (f.field_id === fieldId ? { ...f, value_text: value || null } : f))
    );
  }

  onCustomFieldNumberChange(fieldId: string, value: number | null): void {
    this.customFields.update((fields) =>
      fields.map((f) => (f.field_id === fieldId ? { ...f, value_number: value } : f))
    );
  }

  onCustomFieldDateChange(fieldId: string, value: string): void {
    const dateValue = value ? new Date(value).toISOString() : null;
    this.customFields.update((fields) =>
      fields.map((f) => (f.field_id === fieldId ? { ...f, value_date: dateValue } : f))
    );
    this.saveCustomFields();
  }

  onCustomFieldDropdownChange(fieldId: string, value: string): void {
    this.customFields.update((fields) =>
      fields.map((f) => (f.field_id === fieldId ? { ...f, value_text: value || null } : f))
    );
    this.saveCustomFields();
  }

  onCustomFieldCheckboxChange(fieldId: string, value: boolean): void {
    this.customFields.update((fields) =>
      fields.map((f) => (f.field_id === fieldId ? { ...f, value_bool: value } : f))
    );
    this.saveCustomFields();
  }

  getDropdownOptions(options: any): string[] {
    if (Array.isArray(options)) return options;
    return [];
  }

  saveCustomFields(): void {
    if (this.customFieldDebounceTimer) {
      clearTimeout(this.customFieldDebounceTimer);
    }
    this.customFieldDebounceTimer = setTimeout(() => {
      this.doSaveCustomFields();
    }, 500);
  }

  private doSaveCustomFields(): void {
    const fields = this.customFields();
    if (fields.length === 0) return;

    const values: SetFieldValue[] = fields.map((f) => ({
      field_id: f.field_id,
      value_text: f.value_text,
      value_number: f.value_number,
      value_date: f.value_date,
      value_bool: f.value_bool,
    }));

    this.customFieldService.setTaskValues(this.taskId(), values).subscribe({
      error: (err) => console.error('Failed to save custom fields:', err),
    });
  }

  // -- Time Tracking methods --

  formatDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  onStartTimer(): void {
    this.timeTrackingService.startTimer(this.taskId()).subscribe({
      next: (entry) => {
        this.runningTimerForTask.set(entry);
        this.timeEntries.update((entries) => [entry, ...entries]);
        this.startElapsedTimer(entry.started_at);
      },
      error: (err) => console.error('Failed to start timer:', err),
    });
  }

  onStopTimer(): void {
    const running = this.runningTimerForTask();
    if (!running) return;

    this.timeTrackingService.stopTimer(running.id).subscribe({
      next: (stoppedEntry) => {
        this.runningTimerForTask.set(null);
        this.clearTimerInterval();
        this.timeEntries.update((entries) =>
          entries.map((e) => (e.id === stoppedEntry.id ? stoppedEntry : e))
        );
      },
      error: (err) => console.error('Failed to stop timer:', err),
    });
  }

  toggleLogTimeForm(): void {
    this.showLogTimeForm.update((v) => !v);
    if (this.showLogTimeForm()) {
      this.logTimeHours.set(0);
      this.logTimeMinutes.set(0);
      this.logTimeDescription.set('');
      this.logTimeDate.set(new Date().toISOString().split('T')[0]);
    }
  }

  onSubmitLogTime(): void {
    const hours = this.logTimeHours() || 0;
    const minutes = this.logTimeMinutes() || 0;
    const totalMinutes = hours * 60 + minutes;
    if (totalMinutes <= 0) return;

    const dateStr = this.logTimeDate() || new Date().toISOString().split('T')[0];
    const startedAt = new Date(dateStr + 'T09:00:00Z').toISOString();
    const endedAt = new Date(new Date(startedAt).getTime() + totalMinutes * 60000).toISOString();

    this.timeTrackingService
      .createManualEntry(this.taskId(), {
        description: this.logTimeDescription() || undefined,
        started_at: startedAt,
        ended_at: endedAt,
        duration_minutes: totalMinutes,
      })
      .subscribe({
        next: (entry) => {
          this.timeEntries.update((entries) => [entry, ...entries]);
          this.showLogTimeForm.set(false);
        },
        error: (err) => console.error('Failed to log time:', err),
      });
  }

  onDeleteTimeEntry(entryId: string): void {
    this.timeTrackingService.deleteEntry(entryId).subscribe({
      next: () => {
        this.timeEntries.update((entries) => entries.filter((e) => e.id !== entryId));
        if (this.runningTimerForTask()?.id === entryId) {
          this.runningTimerForTask.set(null);
          this.clearTimerInterval();
        }
      },
      error: (err) => console.error('Failed to delete time entry:', err),
    });
  }

  private loadTimeEntries(): void {
    this.timeTrackingService.listEntries(this.taskId()).subscribe({
      next: (entries) => {
        this.timeEntries.set(entries);
        const running = entries.find((e) => e.is_running);
        if (running) {
          this.runningTimerForTask.set(running);
          this.startElapsedTimer(running.started_at);
        } else {
          this.runningTimerForTask.set(null);
          this.clearTimerInterval();
        }
      },
      error: (err) => console.error('Failed to load time entries:', err),
    });
  }

  private startElapsedTimer(startedAt: string): void {
    this.clearTimerInterval();
    const updateElapsed = () => {
      const start = new Date(startedAt).getTime();
      const now = Date.now();
      const diffSec = Math.floor((now - start) / 1000);
      const hours = Math.floor(diffSec / 3600);
      const mins = Math.floor((diffSec % 3600) / 60);
      const secs = diffSec % 60;
      this.elapsedTime.set(
        `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      );
    };
    updateElapsed();
    this.timerInterval = setInterval(updateElapsed, 1000);
  }

  private clearTimerInterval(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.elapsedTime.set('00:00:00');
  }

  private loadCustomFields(): void {
    const bid = this.boardId();
    if (!bid) return;

    this.customFieldService.getTaskValues(this.taskId()).subscribe({
      next: (values) => this.customFields.set(values),
      error: (err) => console.error('Failed to load custom fields:', err),
    });
  }

  // -- Recurring methods --

  getPatternLabel(pattern: RecurrencePattern): string {
    const labels: Record<RecurrencePattern, string> = {
      daily: 'Daily',
      weekly: 'Weekly',
      biweekly: 'Biweekly',
      monthly: 'Monthly',
      custom: 'Custom',
    };
    return labels[pattern] || pattern;
  }

  toggleRecurringForm(): void {
    this.showRecurringForm.update((v) => !v);
    if (this.showRecurringForm()) {
      // Pre-fill form if editing existing config
      const config = this.recurringConfig();
      if (config) {
        this.recurringPattern.set(config.pattern);
        this.recurringIntervalDays.set(config.interval_days);
        this.recurringMaxOccurrences.set(config.max_occurrences);
      } else {
        this.recurringPattern.set('weekly');
        this.recurringIntervalDays.set(null);
        this.recurringMaxOccurrences.set(null);
      }
    }
  }

  onSaveRecurring(): void {
    const config = this.recurringConfig();
    const req: CreateRecurringRequest = {
      pattern: this.recurringPattern(),
      interval_days: this.recurringPattern() === 'custom' ? (this.recurringIntervalDays() || undefined) : undefined,
      max_occurrences: this.recurringMaxOccurrences() || undefined,
    };

    if (config) {
      // Update existing
      this.recurringService.updateConfig(config.id, req).subscribe({
        next: (updated) => {
          this.recurringConfig.set(updated);
          this.showRecurringForm.set(false);
        },
        error: (err) => console.error('Failed to update recurring config:', err),
      });
    } else {
      // Create new
      this.recurringService.createConfig(this.taskId(), req).subscribe({
        next: (created) => {
          this.recurringConfig.set(created);
          this.showRecurringForm.set(false);
        },
        error: (err) => console.error('Failed to create recurring config:', err),
      });
    }
  }

  onRemoveRecurring(): void {
    const config = this.recurringConfig();
    if (!config) return;

    if (!confirm('Remove recurring schedule from this task?')) return;

    this.recurringService.deleteConfig(config.id).subscribe({
      next: () => {
        this.recurringConfig.set(null);
      },
      error: (err) => console.error('Failed to remove recurring config:', err),
    });
  }

  private loadRecurringConfig(): void {
    this.recurringService.getConfig(this.taskId()).subscribe({
      next: (config) => this.recurringConfig.set(config),
      error: () => {
        // 404 means no recurring config - that's fine
        this.recurringConfig.set(null);
      },
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
        this.loadDependencies();
        this.loadMilestones(task);
        this.loadCustomFields();
        this.loadRecurringConfig();
        this.loadTimeEntries();
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

  private loadMilestones(task: Task): void {
    // Use boardId input if available, else we cannot load milestones
    const bid = this.boardId();
    if (!bid) return;

    this.milestoneService.list(bid).subscribe({
      next: (milestones) => {
        this.milestones.set(milestones);
        if (task.milestone_id) {
          const selected = milestones.find(m => m.id === task.milestone_id) || null;
          this.selectedMilestone.set(selected);
        } else {
          this.selectedMilestone.set(null);
        }
      },
      error: (err) => console.error('Failed to load milestones:', err),
    });
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
