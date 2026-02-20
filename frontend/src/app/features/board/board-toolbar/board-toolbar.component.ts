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
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelect } from 'primeng/multiselect';
import { DatePicker } from 'primeng/datepicker';
import { SelectButton } from 'primeng/selectbutton';
import { ButtonModule } from 'primeng/button';

export type ViewMode =
  | 'kanban'
  | 'list'
  | 'calendar'
  | 'gantt'
  | 'reports'
  | 'time-report';

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
  imports: [
    CommonModule,
    FormsModule,
    IconField,
    InputIcon,
    InputTextModule,
    MultiSelect,
    DatePicker,
    SelectButton,
    ButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar-wrapper border-b border-[var(--border)] px-5 py-3">
      <div class="flex items-center gap-3 flex-wrap">
        <!-- Search Input -->
        <p-iconfield class="flex-1 min-w-[200px] max-w-md">
          <p-inputicon styleClass="pi pi-search" />
          <input
            pInputText
            type="text"
            [ngModel]="searchTerm()"
            (ngModelChange)="onSearchChange($event)"
            placeholder="Search tasks..."
            class="w-full"
          />
        </p-iconfield>

        <!-- Priority Filter -->
        <p-multiSelect
          [options]="prioritySelectOptions"
          [(ngModel)]="selectedPriorities"
          (ngModelChange)="onPriorityFilterChange($event)"
          placeholder="Priority"
          optionLabel="label"
          optionValue="value"
          [showHeader]="false"
          [style]="{ 'min-width': '10rem' }"
          styleClass="w-auto"
        >
          <ng-template #item let-priority>
            <div class="flex items-center gap-2">
              <span
                class="w-2.5 h-2.5 rounded-full"
                [style.background-color]="priority.color"
              ></span>
              <span>{{ priority.label }}</span>
            </div>
          </ng-template>
        </p-multiSelect>

        <!-- Assignee Filter -->
        <p-multiSelect
          [options]="assignees()"
          [(ngModel)]="selectedAssignees"
          (ngModelChange)="onAssigneeFilterChange($event)"
          placeholder="Assignee"
          optionLabel="display_name"
          optionValue="id"
          [showHeader]="false"
          [style]="{ 'min-width': '10rem' }"
          styleClass="w-auto"
        >
          <ng-template #item let-assignee>
            <div class="flex items-center gap-2">
              <div
                class="w-6 h-6 rounded-full bg-[var(--primary)] flex items-center justify-center text-[10px] font-bold text-white"
              >
                {{ getInitials(assignee.display_name) }}
              </div>
              <span>{{ assignee.display_name }}</span>
            </div>
          </ng-template>
        </p-multiSelect>

        <!-- Due Date Range -->
        <div class="flex items-center gap-2">
          <p-datePicker
            [(ngModel)]="dueDateStartValue"
            (ngModelChange)="onDueDateStartPickerChange($event)"
            placeholder="Start date"
            dateFormat="yy-mm-dd"
            [showIcon]="true"
            [showClear]="true"
            styleClass="w-auto"
            inputStyleClass="text-sm py-2"
          />
          <span class="text-[var(--muted-foreground)] text-xs font-medium"
            >to</span
          >
          <p-datePicker
            [(ngModel)]="dueDateEndValue"
            (ngModelChange)="onDueDateEndPickerChange($event)"
            placeholder="End date"
            dateFormat="yy-mm-dd"
            [showIcon]="true"
            [showClear]="true"
            styleClass="w-auto"
            inputStyleClass="text-sm py-2"
          />
        </div>

        <!-- View Toggle -->
        <p-selectButton
          [options]="viewModeOptions"
          [ngModel]="viewMode()"
          (ngModelChange)="viewModeChanged.emit($event)"
          optionLabel="icon"
          optionValue="value"
          class="ml-auto"
        >
          <ng-template #item let-item>
            <i [class]="item.icon" [title]="item.tooltip"></i>
          </ng-template>
        </p-selectButton>

        <!-- Clear Filters -->
        @if (activeFilterCount() > 0) {
          <p-button
            [label]="'Clear filters (' + activeFilterCount() + ')'"
            icon="pi pi-times"
            severity="secondary"
            [text]="true"
            size="small"
            (onClick)="clearFilters()"
          />
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
        background: color-mix(in srgb, var(--card) 85%, transparent);
        backdrop-filter: blur(12px) saturate(180%);
        -webkit-backdrop-filter: blur(12px) saturate(180%);
      }
    `,
  ],
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

  priorityOptions: TaskPriority[] = ['urgent', 'high', 'medium', 'low'];

  prioritySelectOptions = [
    { value: 'urgent', label: 'Urgent', color: '#ef4444' },
    { value: 'high', label: 'High', color: '#f97316' },
    { value: 'medium', label: 'Medium', color: '#facc15' },
    { value: 'low', label: 'Low', color: '#60a5fa' },
  ];
  selectedPriorities: string[] = [];
  selectedAssignees: string[] = [];
  dueDateStartValue: Date | null = null;
  dueDateEndValue: Date | null = null;

  viewModeOptions = [
    { value: 'kanban', icon: 'pi pi-objects-column', tooltip: 'Kanban View' },
    { value: 'list', icon: 'pi pi-list', tooltip: 'List View' },
    { value: 'calendar', icon: 'pi pi-calendar', tooltip: 'Calendar View' },
    { value: 'gantt', icon: 'pi pi-align-left', tooltip: 'Gantt Chart' },
    { value: 'reports', icon: 'pi pi-chart-bar', tooltip: 'Reports' },
    { value: 'time-report', icon: 'pi pi-clock', tooltip: 'Time Report' },
  ];

  ngOnInit(): void {
    // Load filters from URL query params
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
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
        this.selectedPriorities = filters.priorities;
        this.selectedAssignees = filters.assigneeIds;
        this.dueDateStartValue = filters.dueDateStart
          ? new Date(filters.dueDateStart)
          : null;
        this.dueDateEndValue = filters.dueDateEnd
          ? new Date(filters.dueDateEnd)
          : null;
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

  onPriorityFilterChange(priorities: string[]): void {
    this.updateFilter('priorities', priorities as TaskPriority[]);
  }

  onAssigneeFilterChange(assigneeIds: string[]): void {
    this.updateFilter('assigneeIds', assigneeIds);
  }

  onDueDateStartPickerChange(date: Date | null): void {
    this.updateFilter(
      'dueDateStart',
      date ? date.toISOString().split('T')[0] : null,
    );
  }

  onDueDateEndPickerChange(date: Date | null): void {
    this.updateFilter(
      'dueDateEnd',
      date ? date.toISOString().split('T')[0] : null,
    );
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.selectedPriorities = [];
    this.selectedAssignees = [];
    this.dueDateStartValue = null;
    this.dueDateEndValue = null;
    this.filters.set({ ...DEFAULT_FILTERS });
    this.persistFilters(DEFAULT_FILTERS);
    this.filtersChanged.emit(DEFAULT_FILTERS);
  }

  private updateFilter<K extends keyof TaskFilters>(
    key: K,
    value: TaskFilters[K],
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
