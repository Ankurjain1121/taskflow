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
import {
  TaskPriority,
  Assignee,
  Label,
} from '../../../core/services/task.service';
import {
  FilterPresetsService,
  FilterPreset,
} from '../../../core/services/filter-presets.service';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelect } from 'primeng/multiselect';
import { DatePicker } from 'primeng/datepicker';
import { SelectButton } from 'primeng/selectbutton';
import { ButtonModule } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { Dialog } from 'primeng/dialog';

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
    Menu,
    Dialog,
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

        <!-- Label Filter -->
        @if (labels().length > 0) {
          <p-multiSelect
            [options]="labels()"
            [(ngModel)]="selectedLabels"
            (ngModelChange)="onLabelFilterChange($event)"
            placeholder="Labels"
            optionLabel="name"
            optionValue="id"
            [showHeader]="false"
            [style]="{ 'min-width': '10rem' }"
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

        <!-- Filter Presets -->
        @if (boardId()) {
          <div class="flex items-center gap-1">
            @if (presets().length > 0) {
              <p-button
                icon="pi pi-bookmark"
                severity="secondary"
                [text]="true"
                size="small"
                (onClick)="presetsMenu.toggle($event)"
                pTooltip="Load saved filter"
              />
              <p-menu #presetsMenu [popup]="true" [model]="presetMenuItems()" />
            }
            @if (activeFilterCount() > 0) {
              <p-button
                icon="pi pi-save"
                severity="secondary"
                [text]="true"
                size="small"
                (onClick)="showSavePresetDialog = true"
                pTooltip="Save current filters"
              />
            }
          </div>
        }

        <!-- Card Density Toggle -->
        <div class="flex items-center gap-1 ml-auto">
          <button
            (click)="densityChanged.emit('compact')"
            class="p-1.5 rounded transition-colors"
            [class.bg-primary]="density() === 'compact'"
            [class.text-primary-foreground]="density() === 'compact'"
            [class.text-muted-foreground]="density() !== 'compact'"
            [class.hover:bg-muted]="density() !== 'compact'"
            title="Compact view"
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
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <button
            (click)="densityChanged.emit('normal')"
            class="p-1.5 rounded transition-colors"
            [class.bg-primary]="density() === 'normal'"
            [class.text-primary-foreground]="density() === 'normal'"
            [class.text-muted-foreground]="density() !== 'normal'"
            [class.hover:bg-muted]="density() !== 'normal'"
            title="Normal view"
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
                d="M4 5h16a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zM4 14h16a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3a1 1 0 011-1z"
              />
            </svg>
          </button>
        </div>

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

    <!-- Save Preset Dialog -->
    <p-dialog
      header="Save Filter Preset"
      [(visible)]="showSavePresetDialog"
      [modal]="true"
      [style]="{ width: '400px' }"
    >
      <div class="flex flex-col gap-3">
        <label class="text-sm font-medium text-[var(--foreground)]">
          Preset name
        </label>
        <input
          pInputText
          [(ngModel)]="newPresetName"
          placeholder="e.g. My urgent tasks"
          class="w-full"
          (keydown.enter)="savePreset()"
        />
      </div>
      <ng-template #footer>
        <p-button
          label="Cancel"
          severity="secondary"
          [text]="true"
          (onClick)="showSavePresetDialog = false"
        />
        <p-button
          label="Save"
          icon="pi pi-check"
          (onClick)="savePreset()"
          [disabled]="!newPresetName.trim()"
        />
      </ng-template>
    </p-dialog>
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
  private filterPresetsService = inject(FilterPresetsService);
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  boardId = input<string>('');
  assignees = input<Assignee[]>([]);
  labels = input<Label[]>([]);
  viewMode = input<ViewMode>('kanban');
  density = input<'compact' | 'normal'>('normal');

  filtersChanged = output<TaskFilters>();
  viewModeChanged = output<ViewMode>();
  densityChanged = output<'compact' | 'normal'>();

  searchTerm = signal('');
  filters = signal<TaskFilters>({ ...DEFAULT_FILTERS });
  presets = signal<FilterPreset[]>([]);

  showSavePresetDialog = false;
  newPresetName = '';

  priorityOptions: TaskPriority[] = ['urgent', 'high', 'medium', 'low'];

  prioritySelectOptions = [
    { value: 'urgent', label: 'Urgent', color: '#ef4444' },
    { value: 'high', label: 'High', color: '#f97316' },
    { value: 'medium', label: 'Medium', color: '#facc15' },
    { value: 'low', label: 'Low', color: '#60a5fa' },
  ];
  selectedPriorities: string[] = [];
  selectedAssignees: string[] = [];
  selectedLabels: string[] = [];
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
        this.selectedLabels = filters.labelIds;
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

    // Load filter presets
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

  presetMenuItems(): { label: string; icon: string; command: () => void }[] {
    return this.presets().map((p) => ({
      label: p.name,
      icon: 'pi pi-bookmark',
      command: () => this.loadPreset(p),
    }));
  }

  loadPresets(): void {
    const id = this.boardId();
    if (!id) return;
    this.filterPresetsService
      .list(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe((presets) => this.presets.set(presets));
  }

  savePreset(): void {
    const name = this.newPresetName.trim();
    const id = this.boardId();
    if (!name || !id) return;

    this.filterPresetsService
      .create(id, {
        name,
        filters: this.filters() as unknown as Record<string, unknown>,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.showSavePresetDialog = false;
        this.newPresetName = '';
        this.loadPresets();
      });
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
