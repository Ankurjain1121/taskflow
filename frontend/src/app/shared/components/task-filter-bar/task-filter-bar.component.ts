import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { TaskFilters, TaskAssigneeInfo } from '../../types/task.types';
import { debounceTime, Subject } from 'rxjs';

@Component({
  selector: 'app-task-filter-bar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    Select,
    SelectButton,
  ],
  template: `
    <div
      class="flex items-center gap-2 p-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800"
    >
      <!-- Search input -->
      <div class="flex-1 max-w-xs">
        <span class="p-input-icon-left w-full">
          <i class="pi pi-search"></i>
          <input
            pInputText
            [ngModel]="searchText()"
            (ngModelChange)="onSearchChange($event)"
            placeholder="Search by title or description"
            class="w-full"
          />
        </span>
      </div>

      <!-- Priority filter -->
      <p-select
        [(ngModel)]="selectedPriority"
        [options]="priorityOptions"
        optionLabel="label"
        optionValue="value"
        placeholder="Priority"
        [showClear]="true"
        (onChange)="onFilterChange()"
        [style]="{ width: '140px' }"
      />

      <!-- Assignee filter -->
      @if (members().length > 0) {
        <p-select
          [(ngModel)]="selectedAssignee"
          [options]="assigneeOptions()"
          optionLabel="label"
          optionValue="value"
          placeholder="Assignee"
          [showClear]="true"
          (onChange)="onFilterChange()"
          [style]="{ width: '180px' }"
        />
      }

      <!-- Due date filters -->
      <p-selectButton
        [options]="dueDateOptions"
        [(ngModel)]="selectedDueDateFilter"
        (ngModelChange)="onDueDateFilterChange($event)"
        [allowEmpty]="true"
        optionLabel="label"
        optionValue="value"
        size="small"
      />

      <!-- Clear all button -->
      @if (hasActiveFilters()) {
        <p-button
          icon="pi pi-times"
          label="Clear All"
          [outlined]="true"
          severity="secondary"
          size="small"
          (onClick)="clearAll()"
        />
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class TaskFilterBarComponent {
  projectId = input.required<string>();
  members = input<TaskAssigneeInfo[]>([]);

  filtersChanged = output<TaskFilters>();

  searchText = signal('');
  selectedPriority = signal<string | null>(null);
  selectedAssignee = signal<string | null>(null);
  selectedDueDateFilter = signal<string | null>(null);

  priorityOptions = [
    { label: 'Urgent', value: 'urgent' },
    { label: 'High', value: 'high' },
    { label: 'Medium', value: 'medium' },
    { label: 'Low', value: 'low' },
  ];

  dueDateOptions = [
    { label: 'Overdue', value: 'overdue' },
    { label: 'Due Today', value: 'today' },
    { label: 'Due This Week', value: 'week' },
  ];

  assigneeOptions = () => {
    return this.members().map((m) => ({
      label: m.name,
      value: m.user_id,
    }));
  };

  private searchSubject = new Subject<string>();

  constructor() {
    // Debounce search input
    this.searchSubject.pipe(debounceTime(300)).subscribe((value) => {
      this.searchText.set(value);
      this.onFilterChange();
    });
  }

  onSearchChange(value: string): void {
    this.searchSubject.next(value);
  }

  onDueDateFilterChange(value: string | null): void {
    this.selectedDueDateFilter.set(value);
    this.onFilterChange();
  }

  onFilterChange(): void {
    const filters: TaskFilters = {};

    if (this.searchText()) {
      filters.search = this.searchText();
    }

    if (this.selectedPriority()) {
      filters.priority = this.selectedPriority()!;
    }

    if (this.selectedAssignee()) {
      filters.assignee_id = this.selectedAssignee()!;
    }

    // Handle due date filters
    const dueDateFilter = this.selectedDueDateFilter();
    if (dueDateFilter) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      switch (dueDateFilter) {
        case 'overdue':
          filters.due_before = today.toISOString();
          break;
        case 'today': {
          filters.due_after = today.toISOString();
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          filters.due_before = tomorrow.toISOString();
          break;
        }
        case 'week': {
          filters.due_after = today.toISOString();
          const nextWeek = new Date(today);
          nextWeek.setDate(nextWeek.getDate() + 7);
          filters.due_before = nextWeek.toISOString();
          break;
        }
      }
    }

    this.filtersChanged.emit(filters);
  }

  clearSearch(): void {
    this.searchText.set('');
    this.onFilterChange();
  }

  clearAll(): void {
    this.searchText.set('');
    this.selectedPriority.set(null);
    this.selectedAssignee.set(null);
    this.selectedDueDateFilter.set(null);
    this.onFilterChange();
  }

  hasActiveFilters(): boolean {
    return !!(
      this.searchText() ||
      this.selectedPriority() ||
      this.selectedAssignee() ||
      this.selectedDueDateFilter()
    );
  }
}
