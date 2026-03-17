import {
  Component,
  input,
  output,
  signal,
  computed,
  inject,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  viewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime, takeUntil } from 'rxjs';
import {
  TaskPriority,
  Assignee,
  Label,
} from '../../../core/services/task.service';
import {
  FilterPresetsService,
  FilterPreset,
} from '../../../core/services/filter-presets.service';
import { AuthService } from '../../../core/services/auth.service';
import { GroupByMode } from '../project-view/swimlane.types';
import { CardFields } from '../project-view/project-state.service';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelect } from 'primeng/multiselect';
import { DatePicker } from 'primeng/datepicker';
import { SelectButton } from 'primeng/selectbutton';
import { ButtonModule } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { Tooltip } from 'primeng/tooltip';
import { CardFieldsPopoverComponent } from './card-fields-popover.component';
import { SavePresetDialogComponent } from './save-preset-dialog.component';
import { PRIORITY_COLORS } from '../../../shared/constants/priority-colors';

export type ViewMode =
  | 'kanban'
  | 'list'
  | 'calendar'
  | 'gantt'
  | 'reports'
  | 'time-report'
  | 'activity';

export interface TaskFilters {
  search: string;
  priorities: TaskPriority[];
  assigneeIds: string[];
  dueDateStart: string | null;
  dueDateEnd: string | null;
  labelIds: string[];
  overdue: boolean;
}

const DEFAULT_FILTERS: TaskFilters = {
  search: '',
  priorities: [],
  assigneeIds: [],
  dueDateStart: null,
  dueDateEnd: null,
  labelIds: [],
  overdue: false,
};

@Component({
  selector: 'app-project-toolbar',
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
    Menu,
    Tooltip,
    CardFieldsPopoverComponent,
    SavePresetDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar-wrapper border-b border-[var(--border)]">
      <!-- Row 1: Always visible — Search + Quick Filters + View Toggle -->
      <div class="flex items-center gap-2 px-5 py-2">
        <!-- Search Input -->
        <p-iconfield class="flex-1 min-w-[160px] max-w-sm">
          <p-inputicon styleClass="pi pi-search" />
          <input
            #searchInput
            pInputText
            type="text"
            [ngModel]="searchTerm()"
            (ngModelChange)="onSearchChange($event)"
            placeholder="Search tasks..."
            class="w-full"
          />
        </p-iconfield>

        <!-- Quick Filter Chips -->
        <div class="flex items-center gap-1.5">
          <button
            (click)="toggleMyTasks()"
            [class]="
              isMyTasksActive()
                ? 'quick-chip quick-chip--active'
                : 'quick-chip'
            "
          >
            My Tasks
          </button>
          <button
            (click)="toggleOverdue()"
            [class]="
              isOverdueActive()
                ? 'quick-chip quick-chip--danger'
                : 'quick-chip'
            "
          >
            Overdue
          </button>
          <button
            (click)="toggleHighPriority()"
            [class]="
              isHighPriorityActive()
                ? 'quick-chip quick-chip--active'
                : 'quick-chip'
            "
          >
            High Priority
          </button>
          <button
            (click)="toggleDueThisWeek()"
            [class]="
              isDueThisWeekActive()
                ? 'quick-chip quick-chip--active'
                : 'quick-chip'
            "
          >
            Due This Week
          </button>
          @if (anyQuickFilterActive()) {
            <button
              (click)="clearQuickFilters()"
              class="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] underline ml-1"
              pTooltip="Clear filters (C)"
              tooltipPosition="bottom"
            >
              Clear
            </button>
          }
        </div>

        <!-- Spacer -->
        <div class="flex-1"></div>

        <!-- Filters Toggle Button -->
        <button
          (click)="filtersExpanded.set(!filtersExpanded())"
          [class]="
            filtersExpanded() || activeAdvancedFilterCount() > 0
              ? 'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--primary)] text-[var(--primary)] bg-[var(--primary)]/5 transition-colors'
              : 'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)] transition-colors'
          "
        >
          <i class="pi pi-filter text-xs"></i>
          Filters
          @if (activeAdvancedFilterCount() > 0) {
            <span
              class="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-[var(--primary)] text-white"
            >
              {{ activeAdvancedFilterCount() }}
            </span>
          }
        </button>

        <!-- Kanban-only controls -->
        @if (viewMode() === 'kanban') {
          <!-- Density Toggle -->
          <div
            class="flex items-center gap-0.5 border border-[var(--border)] rounded-md p-0.5"
          >
            <button
              (click)="densityChanged.emit('compact')"
              [class]="density() === 'compact' ? 'density-btn density-btn--active' : 'density-btn'"
              pTooltip="Compact (D)" tooltipPosition="bottom"
            >
              <i class="pi pi-minus text-xs"></i>
            </button>
            <button
              (click)="densityChanged.emit('normal')"
              [class]="density() === 'normal' ? 'density-btn density-btn--active' : 'density-btn'"
              pTooltip="Normal (D)" tooltipPosition="bottom"
            >
              <i class="pi pi-bars text-xs"></i>
            </button>
            <button
              (click)="densityChanged.emit('expanded')"
              [class]="density() === 'expanded' ? 'density-btn density-btn--active' : 'density-btn'"
              pTooltip="Expanded (D)" tooltipPosition="bottom"
            >
              <i class="pi pi-th-large text-xs"></i>
            </button>
          </div>

          <!-- Fields -->
          <app-card-fields-popover
            [cardFields]="cardFields()"
            (cardFieldChanged)="cardFieldChanged.emit($event)"
            (cardFieldsReset)="cardFieldsReset.emit()"
          />

          <!-- Group By -->
          <div class="flex items-center">
            @if (groupBy() !== 'none') {
              <button
                class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-l-md border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors"
                (click)="groupByMenu.toggle($event)"
              >
                <i class="pi pi-table text-xs"></i>
                {{ groupByLabel() }}
              </button>
              <button
                class="flex items-center px-1.5 py-1.5 text-xs font-medium rounded-r-md border border-l-0 border-[var(--primary)] text-[var(--primary)] hover:bg-red-50 hover:border-red-400 hover:text-red-500 transition-colors"
                (click)="groupByChanged.emit('none')"
                title="Clear grouping"
              >
                <i class="pi pi-times text-xs"></i>
              </button>
            } @else {
              <button
                class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)] transition-colors"
                (click)="groupByMenu.toggle($event)"
                pTooltip="Group By (G)" tooltipPosition="bottom"
              >
                <i class="pi pi-table text-xs"></i>
                Group
              </button>
            }
            <p-menu #groupByMenu [popup]="true" [model]="groupByMenuItems()" />
          </div>
        }

        <!-- View Toggle -->
        <p-selectButton
          [options]="viewModeOptions"
          [ngModel]="viewMode()"
          (ngModelChange)="viewModeChanged.emit($event)"
          optionLabel="icon"
          optionValue="value"
        >
          <ng-template #item let-item>
            <i [class]="item.icon" [title]="item.tooltip"></i>
          </ng-template>
        </p-selectButton>
      </div>

      <!-- Row 2: Collapsible advanced filters -->
      @if (filtersExpanded()) {
        <div
          class="flex items-center gap-3 px-5 py-2.5 border-t border-[var(--border)] bg-[var(--muted)]/30"
        >
          <p-multiSelect
            [options]="prioritySelectOptions"
            [(ngModel)]="selectedPriorities"
            (ngModelChange)="onPriorityFilterChange($event)"
            placeholder="Priority"
            optionLabel="label"
            optionValue="value"
            [showHeader]="false"
            [style]="{ 'min-width': '9rem' }"
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

          <p-multiSelect
            [options]="assignees()"
            [(ngModel)]="selectedAssignees"
            (ngModelChange)="onAssigneeFilterChange($event)"
            placeholder="Assignee"
            optionLabel="display_name"
            optionValue="id"
            [showHeader]="false"
            [style]="{ 'min-width': '9rem' }"
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

          @if (labels().length > 0) {
            <p-multiSelect
              [options]="labels()"
              [(ngModel)]="selectedLabels"
              (ngModelChange)="onLabelFilterChange($event)"
              placeholder="Labels"
              optionLabel="name"
              optionValue="id"
              [showHeader]="false"
              [style]="{ 'min-width': '9rem' }"
              styleClass="w-auto"
            >
              <ng-template #item let-label>
                <div class="flex items-center gap-2">
                  <span
                    class="w-2.5 h-2.5 rounded-full"
                    [style.background-color]="label.color"
                  ></span>
                  <span>{{ label.name }}</span>
                </div>
              </ng-template>
            </p-multiSelect>
          }

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
            <span class="text-[var(--muted-foreground)] text-xs font-medium">to</span>
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

          <!-- Filter Presets -->
          @if (boardId()) {
            <app-save-preset-dialog
              [boardId]="boardId()"
              [filters]="filters()"
              [activeFilterCount]="activeFilterCount()"
              [presets]="presets()"
              (presetLoaded)="loadPreset($event)"
              (presetsReloaded)="loadPresets()"
            />
          }

          <div class="flex-1"></div>

          @if (activeFilterCount() > 0) {
            <button
              (click)="clearFilters()"
              class="text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            >
              Clear all ({{ activeFilterCount() }})
            </button>
          }
        </div>
      }
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

      .quick-chip {
        padding: 2px 10px;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 500;
        border: 1px solid var(--border);
        color: var(--muted-foreground);
        transition: all 150ms;
        white-space: nowrap;
      }
      .quick-chip:hover {
        background: var(--secondary);
      }
      .quick-chip--active {
        background: var(--primary);
        color: var(--primary-foreground);
        border-color: var(--primary);
      }
      .quick-chip--danger {
        background: #ef4444;
        color: white;
        border-color: #ef4444;
      }

      .density-btn {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--muted-foreground);
        transition: all 150ms;
      }
      .density-btn:hover {
        color: var(--foreground);
        background: var(--secondary);
      }
      .density-btn--active {
        background: var(--primary);
        color: var(--primary-foreground);
      }
    `,
  ],
})
export class ProjectToolbarComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private filterPresetsService = inject(FilterPresetsService);
  private authService = inject(AuthService);
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  boardId = input<string>('');
  assignees = input<Assignee[]>([]);
  labels = input<Label[]>([]);
  viewMode = input<ViewMode>('kanban');
  density = input<'compact' | 'normal' | 'expanded'>('normal');
  groupBy = input<GroupByMode>('none');
  cardFields = input<CardFields>({
    showPriority: true,
    showDueDate: true,
    showAssignees: true,
    showLabels: true,
    showSubtaskProgress: true,
    showComments: true,
    showAttachments: true,
    showTaskId: true,
    showDescription: true,
    showDaysInColumn: true,
  });

  filtersChanged = output<TaskFilters>();
  viewModeChanged = output<ViewMode>();
  densityChanged = output<'compact' | 'normal' | 'expanded'>();
  groupByChanged = output<GroupByMode>();
  cardFieldChanged = output<{ key: keyof CardFields; value: boolean }>();
  cardFieldsReset = output<void>();

  searchTerm = signal('');
  filters = signal<TaskFilters>({ ...DEFAULT_FILTERS });
  presets = signal<FilterPreset[]>([]);
  filtersExpanded = signal(false);
  searchInputRef = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  selectedPriorities: string[] = [];
  selectedAssignees: string[] = [];
  selectedLabels: string[] = [];
  dueDateStartValue: Date | null = null;
  dueDateEndValue: Date | null = null;

  prioritySelectOptions = [
    { value: 'urgent', label: 'Urgent', color: PRIORITY_COLORS['urgent'] },
    { value: 'high', label: 'High', color: PRIORITY_COLORS['high'] },
    { value: 'medium', label: 'Medium', color: PRIORITY_COLORS['medium'] },
    { value: 'low', label: 'Low', color: PRIORITY_COLORS['low'] },
  ];

  // Quick filter computed signals
  readonly isMyTasksActive = computed(() => {
    const userId = this.authService.currentUser()?.id;
    if (!userId) return false;
    const f = this.filters();
    return f.assigneeIds.length === 1 && f.assigneeIds[0] === userId;
  });

  readonly isDueThisWeekActive = computed(() => {
    const f = this.filters();
    if (!f.dueDateStart || !f.dueDateEnd) return false;
    const { start, end } = this.getCurrentWeekRange();
    return f.dueDateStart === start && f.dueDateEnd === end;
  });

  readonly isHighPriorityActive = computed(() => {
    const f = this.filters();
    return (
      f.priorities.length === 2 &&
      f.priorities.includes('high') &&
      f.priorities.includes('urgent')
    );
  });

  readonly isOverdueActive = computed(() => this.filters().overdue);

  readonly anyQuickFilterActive = computed(
    () =>
      this.isMyTasksActive() ||
      this.isDueThisWeekActive() ||
      this.isHighPriorityActive() ||
      this.isOverdueActive(),
  );

  readonly activeAdvancedFilterCount = computed(() => {
    const f = this.filters();
    let count = 0;
    if (f.priorities.length) count++;
    if (f.assigneeIds.length && !this.isMyTasksActive()) count++;
    if (f.dueDateStart || f.dueDateEnd) {
      if (!this.isDueThisWeekActive()) count++;
    }
    if (f.labelIds.length) count++;
    return count;
  });

  groupByLabel(): string {
    const map: Record<GroupByMode, string> = {
      none: 'None',
      assignee: 'Assignee',
      priority: 'Priority',
      label: 'Label',
    };
    return map[this.groupBy()];
  }

  groupByMenuItems(): { label: string; icon?: string; command: () => void }[] {
    const current = this.groupBy();
    return [
      {
        label: 'None',
        icon: current === 'none' ? 'pi pi-check' : '',
        command: () => this.groupByChanged.emit('none'),
      },
      {
        label: 'Assignee',
        icon: current === 'assignee' ? 'pi pi-check' : '',
        command: () => this.groupByChanged.emit('assignee'),
      },
      {
        label: 'Priority',
        icon: current === 'priority' ? 'pi pi-check' : '',
        command: () => this.groupByChanged.emit('priority'),
      },
      {
        label: 'Label',
        icon: current === 'label' ? 'pi pi-check' : '',
        command: () => this.groupByChanged.emit('label'),
      },
    ];
  }

  viewModeOptions = [
    {
      value: 'kanban',
      icon: 'pi pi-objects-column',
      tooltip: 'Kanban view (1)',
    },
    { value: 'list', icon: 'pi pi-list', tooltip: 'List view (2)' },
    { value: 'calendar', icon: 'pi pi-calendar', tooltip: 'Calendar view (3)' },
    { value: 'gantt', icon: 'pi pi-align-left', tooltip: 'Gantt chart (4)' },
    { value: 'reports', icon: 'pi pi-chart-bar', tooltip: 'Reports view (5)' },
    { value: 'time-report', icon: 'pi pi-clock', tooltip: 'Time report (6)' },
    { value: 'activity', icon: 'pi pi-history', tooltip: 'Activity feed (7)' },
  ];

  ngOnInit(): void {
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
          overdue: params['overdue'] === 'true',
        };
        this.searchTerm.set(filters.search);
        this.filters.set(filters);
        this.selectedPriorities = filters.priorities;
        this.selectedAssignees = filters.assigneeIds;
        this.selectedLabels = filters.labelIds;
        this.dueDateStartValue = filters.dueDateStart
          ? new Date(filters.dueDateStart)
          : null;
        this.dueDateEndValue = filters.dueDateEnd
          ? new Date(filters.dueDateEnd)
          : null;
      });

    this.searchSubject
      .pipe(debounceTime(300), takeUntil(this.destroy$))
      .subscribe((term) => {
        this.updateFilter('search', term);
      });

    this.loadPresets();
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
    if (f.overdue) count++;
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

  onLabelFilterChange(labelIds: string[]): void {
    this.updateFilter('labelIds', labelIds);
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
    this.selectedLabels = [];
    this.dueDateStartValue = null;
    this.dueDateEndValue = null;
    this.filters.set({ ...DEFAULT_FILTERS });
    this.persistFilters(DEFAULT_FILTERS);
    this.filtersChanged.emit(DEFAULT_FILTERS);
  }

  loadPresets(): void {
    const id = this.boardId();
    if (!id) return;
    this.filterPresetsService
      .list(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe((presets) => this.presets.set(presets));
  }

  loadPreset(preset: FilterPreset): void {
    const f = preset.filters as unknown as TaskFilters;
    this.searchTerm.set(f.search || '');
    this.selectedPriorities = f.priorities || [];
    this.selectedAssignees = f.assigneeIds || [];
    this.selectedLabels = f.labelIds || [];
    this.dueDateStartValue = f.dueDateStart ? new Date(f.dueDateStart) : null;
    this.dueDateEndValue = f.dueDateEnd ? new Date(f.dueDateEnd) : null;
    this.filters.set({ ...DEFAULT_FILTERS, ...f });
    this.persistFilters(this.filters());
    this.filtersChanged.emit(this.filters());
  }

  toggleMyTasks(): void {
    const userId = this.authService.currentUser()?.id;
    if (!userId) return;

    if (this.isMyTasksActive()) {
      this.selectedAssignees = [];
      this.updateFilter('assigneeIds', []);
    } else {
      this.selectedAssignees = [userId];
      this.updateFilter('assigneeIds', [userId]);
    }
  }

  toggleDueThisWeek(): void {
    if (this.isDueThisWeekActive()) {
      this.dueDateStartValue = null;
      this.dueDateEndValue = null;
      this.updateFilter('dueDateStart', null);
      this.updateFilter('dueDateEnd', null);
    } else {
      const { start, end } = this.getCurrentWeekRange();
      this.dueDateStartValue = new Date(start);
      this.dueDateEndValue = new Date(end);
      this.updateFilter('dueDateStart', start);
      this.updateFilter('dueDateEnd', end);
    }
  }

  toggleHighPriority(): void {
    if (this.isHighPriorityActive()) {
      this.selectedPriorities = [];
      this.updateFilter('priorities', []);
    } else {
      this.selectedPriorities = ['high', 'urgent'];
      this.updateFilter('priorities', ['high', 'urgent']);
    }
  }

  toggleOverdue(): void {
    this.updateFilter('overdue', !this.filters().overdue);
  }

  clearQuickFilters(): void {
    this.selectedPriorities = [];
    this.selectedAssignees = [];
    this.dueDateStartValue = null;
    this.dueDateEndValue = null;
    const updated: TaskFilters = {
      ...this.filters(),
      priorities: [],
      assigneeIds: [],
      dueDateStart: null,
      dueDateEnd: null,
      overdue: false,
    };
    this.filters.set(updated);
    this.persistFilters(updated);
    this.filtersChanged.emit(updated);
  }

  focusSearchInput(): void {
    this.searchInputRef()?.nativeElement.focus();
  }

  private getCurrentWeekRange(): { start: string; end: string } {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return {
      start: monday.toISOString().split('T')[0],
      end: sunday.toISOString().split('T')[0],
    };
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
      overdue: filters.overdue ? 'true' : null,
    };

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}
