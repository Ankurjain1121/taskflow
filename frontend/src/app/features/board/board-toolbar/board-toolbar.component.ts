import {
  Component,
  input,
  output,
  signal,
  inject,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime, takeUntil } from 'rxjs';
import { TaskPriority, Assignee } from '../../../core/services/task.service';
import { PRIORITY_COLORS, getPriorityLabel } from '../../../shared/utils/task-colors';

export type ViewMode = 'kanban' | 'list';

export interface TaskFilters {
  search: string;
  priorities: TaskPriority[];
  assigneeIds: string[];
  dueDateStart: string | null;
  dueDateEnd: string | null;
  labelIds: string[];
}

const DEFAULT_FILTERS: TaskFilters = {
  search: '',
  priorities: [],
  assigneeIds: [],
  dueDateStart: null,
  dueDateEnd: null,
  labelIds: [],
};

@Component({
  selector: 'app-board-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white border-b border-gray-200 px-4 py-3">
      <div class="flex items-center gap-4 flex-wrap">
        <!-- Search Input -->
        <div class="relative flex-1 min-w-[200px] max-w-md">
          <input
            type="text"
            [ngModel]="searchTerm()"
            (ngModelChange)="onSearchChange($event)"
            placeholder="Search tasks..."
            class="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <svg
            class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        <!-- Priority Filter -->
        <div class="relative">
          <button
            (click)="togglePriorityDropdown()"
            class="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            [class.ring-2]="filters().priorities.length > 0"
            [class.ring-indigo-500]="filters().priorities.length > 0"
          >
            <span>Priority</span>
            @if (filters().priorities.length > 0) {
              <span
                class="inline-flex items-center justify-center w-5 h-5 text-xs font-medium bg-indigo-100 text-indigo-800 rounded-full"
              >
                {{ filters().priorities.length }}
              </span>
            }
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
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          @if (showPriorityDropdown()) {
            <div
              class="absolute top-full left-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10"
            >
              <div class="p-2 space-y-1">
                @for (priority of priorityOptions; track priority) {
                  <label
                    class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      [checked]="filters().priorities.includes(priority)"
                      (change)="togglePriority(priority)"
                      class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span
                      [class]="
                        'w-2 h-2 rounded-full ' +
                        getPriorityDotClass(priority)
                      "
                    ></span>
                    <span class="text-sm">{{ getPriorityLabel(priority) }}</span>
                  </label>
                }
              </div>
            </div>
          }
        </div>

        <!-- Assignee Filter -->
        <div class="relative">
          <button
            (click)="toggleAssigneeDropdown()"
            class="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            [class.ring-2]="filters().assigneeIds.length > 0"
            [class.ring-indigo-500]="filters().assigneeIds.length > 0"
          >
            <span>Assignee</span>
            @if (filters().assigneeIds.length > 0) {
              <span
                class="inline-flex items-center justify-center w-5 h-5 text-xs font-medium bg-indigo-100 text-indigo-800 rounded-full"
              >
                {{ filters().assigneeIds.length }}
              </span>
            }
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
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          @if (showAssigneeDropdown()) {
            <div
              class="absolute top-full left-0 mt-1 w-56 bg-white rounded-md shadow-lg border border-gray-200 z-10"
            >
              <div class="p-2 space-y-1 max-h-64 overflow-y-auto">
                @for (assignee of assignees(); track assignee.id) {
                  <label
                    class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      [checked]="filters().assigneeIds.includes(assignee.id)"
                      (change)="toggleAssignee(assignee.id)"
                      class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <div
                      class="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium"
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
                    <span class="text-sm truncate">{{
                      assignee.display_name
                    }}</span>
                  </label>
                }
                @if (assignees().length === 0) {
                  <div class="px-2 py-4 text-sm text-gray-500 text-center">
                    No assignees available
                  </div>
                }
              </div>
            </div>
          }
        </div>

        <!-- Due Date Range -->
        <div class="flex items-center gap-2">
          <input
            type="date"
            [ngModel]="filters().dueDateStart"
            (ngModelChange)="onDueDateStartChange($event)"
            class="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Start date"
          />
          <span class="text-gray-500">to</span>
          <input
            type="date"
            [ngModel]="filters().dueDateEnd"
            (ngModelChange)="onDueDateEndChange($event)"
            class="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="End date"
          />
        </div>

        <!-- View Toggle -->
        <div class="flex items-center border border-gray-300 rounded-md overflow-hidden ml-auto">
          <button
            (click)="viewModeChanged.emit('kanban')"
            class="px-3 py-2 text-sm transition-colors"
            [class.bg-indigo-600]="viewMode() === 'kanban'"
            [class.text-white]="viewMode() === 'kanban'"
            [class.bg-white]="viewMode() !== 'kanban'"
            [class.text-gray-600]="viewMode() !== 'kanban'"
            [class.hover:bg-gray-50]="viewMode() !== 'kanban'"
            title="Kanban View"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
          </button>
          <button
            (click)="viewModeChanged.emit('list')"
            class="px-3 py-2 text-sm transition-colors"
            [class.bg-indigo-600]="viewMode() === 'list'"
            [class.text-white]="viewMode() === 'list'"
            [class.bg-white]="viewMode() !== 'list'"
            [class.text-gray-600]="viewMode() !== 'list'"
            [class.hover:bg-gray-50]="viewMode() !== 'list'"
            title="List View"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
        </div>

        <!-- Clear Filters -->
        @if (activeFilterCount() > 0) {
          <button
            (click)="clearFilters()"
            class="inline-flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            Clear ({{ activeFilterCount() }})
          </button>
        }
      </div>
    </div>
  `,
  host: {
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class BoardToolbarComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  assignees = input<Assignee[]>([]);
  viewMode = input<ViewMode>('kanban');

  filtersChanged = output<TaskFilters>();
  viewModeChanged = output<ViewMode>();

  searchTerm = signal('');
  filters = signal<TaskFilters>({ ...DEFAULT_FILTERS });
  showPriorityDropdown = signal(false);
  showAssigneeDropdown = signal(false);

  priorityOptions: TaskPriority[] = ['urgent', 'high', 'medium', 'low'];

  ngOnInit(): void {
    // Load filters from URL query params
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const filters: TaskFilters = {
        search: params['search'] || '',
        priorities: params['priorities']
          ? params['priorities'].split(',')
          : [],
        assigneeIds: params['assignees']
          ? params['assignees'].split(',')
          : [],
        dueDateStart: params['dueDateStart'] || null,
        dueDateEnd: params['dueDateEnd'] || null,
        labelIds: params['labels'] ? params['labels'].split(',') : [],
      };
      this.searchTerm.set(filters.search);
      this.filters.set(filters);
    });

    // Debounce search input
    this.searchSubject
      .pipe(debounceTime(300), takeUntil(this.destroy$))
      .subscribe((term) => {
        this.updateFilter('search', term);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  activeFilterCount(): number {
    const f = this.filters();
    let count = 0;
    if (f.search) count++;
    if (f.priorities.length) count++;
    if (f.assigneeIds.length) count++;
    if (f.dueDateStart || f.dueDateEnd) count++;
    if (f.labelIds.length) count++;
    return count;
  }

  getPriorityLabel(priority: TaskPriority): string {
    return getPriorityLabel(priority);
  }

  getPriorityDotClass(priority: TaskPriority): string {
    return PRIORITY_COLORS[priority].dot;
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  onSearchChange(term: string): void {
    this.searchTerm.set(term);
    this.searchSubject.next(term);
  }

  togglePriorityDropdown(): void {
    this.showPriorityDropdown.update((v) => !v);
    this.showAssigneeDropdown.set(false);
  }

  toggleAssigneeDropdown(): void {
    this.showAssigneeDropdown.update((v) => !v);
    this.showPriorityDropdown.set(false);
  }

  togglePriority(priority: TaskPriority): void {
    const current = this.filters().priorities;
    const updated = current.includes(priority)
      ? current.filter((p) => p !== priority)
      : [...current, priority];
    this.updateFilter('priorities', updated);
  }

  toggleAssignee(assigneeId: string): void {
    const current = this.filters().assigneeIds;
    const updated = current.includes(assigneeId)
      ? current.filter((id) => id !== assigneeId)
      : [...current, assigneeId];
    this.updateFilter('assigneeIds', updated);
  }

  onDueDateStartChange(date: string | null): void {
    this.updateFilter('dueDateStart', date || null);
  }

  onDueDateEndChange(date: string | null): void {
    this.updateFilter('dueDateEnd', date || null);
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.filters.set({ ...DEFAULT_FILTERS });
    this.persistFilters(DEFAULT_FILTERS);
    this.filtersChanged.emit(DEFAULT_FILTERS);
  }

  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('[class*="dropdown"]') && !target.closest('button')) {
      this.showPriorityDropdown.set(false);
      this.showAssigneeDropdown.set(false);
    }
  }

  private updateFilter<K extends keyof TaskFilters>(
    key: K,
    value: TaskFilters[K]
  ): void {
    const updated = { ...this.filters(), [key]: value };
    this.filters.set(updated);
    this.persistFilters(updated);
    this.filtersChanged.emit(updated);
  }

  private persistFilters(filters: TaskFilters): void {
    const queryParams: Record<string, string | null> = {
      search: filters.search || null,
      priorities: filters.priorities.length
        ? filters.priorities.join(',')
        : null,
      assignees: filters.assigneeIds.length
        ? filters.assigneeIds.join(',')
        : null,
      dueDateStart: filters.dueDateStart,
      dueDateEnd: filters.dueDateEnd,
      labels: filters.labelIds.length ? filters.labelIds.join(',') : null,
    };

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}
