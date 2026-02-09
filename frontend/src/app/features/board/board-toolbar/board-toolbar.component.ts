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

export type ViewMode = 'kanban' | 'list' | 'calendar' | 'gantt' | 'reports' | 'time-report';

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
    <div class="toolbar-wrapper border-b border-gray-200/80 px-5 py-3">
      <div class="flex items-center gap-3 flex-wrap">
        <!-- Search Input -->
        <div class="relative flex-1 min-w-[200px] max-w-md">
          <input
            type="text"
            [ngModel]="searchTerm()"
            (ngModelChange)="onSearchChange($event)"
            placeholder="Search tasks..."
            class="search-input w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 placeholder-gray-400"
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
            class="filter-btn inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium border rounded-lg"
            [class.filter-btn--active]="filters().priorities.length > 0"
            [class.border-gray-200]="filters().priorities.length === 0"
            [class.text-gray-600]="filters().priorities.length === 0"
            [class.border-indigo-300]="filters().priorities.length > 0"
            [class.text-indigo-700]="filters().priorities.length > 0"
            [class.bg-indigo-50]="filters().priorities.length > 0"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
            <span>Priority</span>
            @if (filters().priorities.length > 0) {
              <span
                class="count-badge inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold text-white rounded-full"
              >
                {{ filters().priorities.length }}
              </span>
            }
            <svg
              class="w-3.5 h-3.5 opacity-50"
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
              class="filter-dropdown absolute top-full left-0 mt-2 w-52 bg-white rounded-xl border border-gray-100 z-10"
            >
              <div class="p-2 space-y-0.5">
                @for (priority of priorityOptions; track priority) {
                  <label
                    class="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      [checked]="filters().priorities.includes(priority)"
                      (change)="togglePriority(priority)"
                      class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span
                      [class]="
                        'w-2.5 h-2.5 rounded-full ' +
                        getPriorityDotClass(priority)
                      "
                    ></span>
                    <span class="text-sm font-medium text-gray-700">{{ getPriorityLabel(priority) }}</span>
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
            class="filter-btn inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium border rounded-lg"
            [class.filter-btn--active]="filters().assigneeIds.length > 0"
            [class.border-gray-200]="filters().assigneeIds.length === 0"
            [class.text-gray-600]="filters().assigneeIds.length === 0"
            [class.border-indigo-300]="filters().assigneeIds.length > 0"
            [class.text-indigo-700]="filters().assigneeIds.length > 0"
            [class.bg-indigo-50]="filters().assigneeIds.length > 0"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Assignee</span>
            @if (filters().assigneeIds.length > 0) {
              <span
                class="count-badge inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold text-white rounded-full"
              >
                {{ filters().assigneeIds.length }}
              </span>
            }
            <svg
              class="w-3.5 h-3.5 opacity-50"
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
              class="filter-dropdown absolute top-full left-0 mt-2 w-60 bg-white rounded-xl border border-gray-100 z-10"
            >
              <div class="p-2 space-y-0.5 max-h-64 overflow-y-auto">
                @for (assignee of assignees(); track assignee.id) {
                  <label
                    class="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      [checked]="filters().assigneeIds.includes(assignee.id)"
                      (change)="toggleAssignee(assignee.id)"
                      class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <div
                      class="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
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
                    <span class="text-sm font-medium text-gray-700 truncate">{{
                      assignee.display_name
                    }}</span>
                  </label>
                }
                @if (assignees().length === 0) {
                  <div class="px-3 py-6 text-sm text-gray-400 text-center">
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
            class="date-input px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
            placeholder="Start date"
          />
          <span class="text-gray-400 text-xs font-medium">to</span>
          <input
            type="date"
            [ngModel]="filters().dueDateEnd"
            (ngModelChange)="onDueDateEndChange($event)"
            class="date-input px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
            placeholder="End date"
          />
        </div>

        <!-- View Toggle -->
        <div class="view-toggle flex items-center border border-gray-200 rounded-lg overflow-hidden ml-auto p-0.5 bg-gray-100/80">
          <button
            (click)="viewModeChanged.emit('kanban')"
            class="view-toggle-btn px-3 py-1.5 text-sm rounded-md transition-all duration-200"
            [class.view-toggle-btn--active]="viewMode() === 'kanban'"
            [class.text-gray-500]="viewMode() !== 'kanban'"
            [class.hover:text-gray-700]="viewMode() !== 'kanban'"
            title="Kanban View"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
          </button>
          <button
            (click)="viewModeChanged.emit('list')"
            class="view-toggle-btn px-3 py-1.5 text-sm rounded-md transition-all duration-200"
            [class.view-toggle-btn--active]="viewMode() === 'list'"
            [class.text-gray-500]="viewMode() !== 'list'"
            [class.hover:text-gray-700]="viewMode() !== 'list'"
            title="List View"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
          <button
            (click)="viewModeChanged.emit('calendar')"
            class="view-toggle-btn px-3 py-1.5 text-sm rounded-md transition-all duration-200"
            [class.view-toggle-btn--active]="viewMode() === 'calendar'"
            [class.text-gray-500]="viewMode() !== 'calendar'"
            [class.hover:text-gray-700]="viewMode() !== 'calendar'"
            title="Calendar View"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            (click)="viewModeChanged.emit('gantt')"
            class="view-toggle-btn px-3 py-1.5 text-sm rounded-md transition-all duration-200"
            [class.view-toggle-btn--active]="viewMode() === 'gantt'"
            [class.text-gray-500]="viewMode() !== 'gantt'"
            [class.hover:text-gray-700]="viewMode() !== 'gantt'"
            title="Gantt Chart"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 6h10M4 12h14M4 18h8" />
            </svg>
          </button>
          <button
            (click)="viewModeChanged.emit('reports')"
            class="view-toggle-btn px-3 py-1.5 text-sm rounded-md transition-all duration-200"
            [class.view-toggle-btn--active]="viewMode() === 'reports'"
            [class.text-gray-500]="viewMode() !== 'reports'"
            [class.hover:text-gray-700]="viewMode() !== 'reports'"
            title="Reports"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </button>
          <button
            (click)="viewModeChanged.emit('time-report')"
            class="view-toggle-btn px-3 py-1.5 text-sm rounded-md transition-all duration-200"
            [class.view-toggle-btn--active]="viewMode() === 'time-report'"
            [class.text-gray-500]="viewMode() !== 'time-report'"
            [class.hover:text-gray-700]="viewMode() !== 'time-report'"
            title="Time Report"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>

        <!-- Clear Filters -->
        @if (activeFilterCount() > 0) {
          <button
            (click)="clearFilters()"
            class="clear-btn inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 border border-transparent hover:border-red-200"
          >
            <svg
              class="w-3.5 h-3.5"
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
            Clear filters ({{ activeFilterCount() }})
          </button>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        position: sticky;
        top: 0;
        z-index: 20;
      }

      .toolbar-wrapper {
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(12px) saturate(180%);
        -webkit-backdrop-filter: blur(12px) saturate(180%);
      }

      .search-input {
        background: rgba(249, 250, 251, 0.8);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
        transition: all 0.2s ease;
      }

      .search-input:focus {
        background: white;
        box-shadow: 0 1px 3px rgba(99, 102, 241, 0.1), 0 1px 2px rgba(0, 0, 0, 0.04);
      }

      .filter-btn {
        background: white;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
        transition: all 0.2s ease;
      }

      .filter-btn:hover {
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
        transform: translateY(-1px);
      }

      .filter-btn--active {
        box-shadow: 0 1px 3px rgba(99, 102, 241, 0.15);
      }

      .count-badge {
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        box-shadow: 0 1px 3px rgba(99, 102, 241, 0.3);
      }

      .filter-dropdown {
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08), 0 2px 10px rgba(0, 0, 0, 0.04);
        animation: dropdown-enter 0.15s ease-out;
      }

      @keyframes dropdown-enter {
        from {
          opacity: 0;
          transform: translateY(-4px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .date-input {
        background: rgba(249, 250, 251, 0.8);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
        transition: all 0.2s ease;
      }

      .date-input:focus {
        background: white;
      }

      .view-toggle {
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
      }

      .view-toggle-btn--active {
        background: linear-gradient(135deg, #6366f1, #4f46e5);
        color: white;
        box-shadow: 0 1px 3px rgba(99, 102, 241, 0.3);
      }

      .clear-btn {
        letter-spacing: 0.01em;
      }
    `,
  ],
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
