import {
  Component,
  input,
  output,
  signal,
  computed,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { DatePicker } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { Tooltip } from 'primeng/tooltip';
import {
  Task,
  TaskPriority,
  Assignee,
  Label,
} from '../../../core/services/task.service';
import { MemberSearchResult } from '../../../core/services/workspace.service';
import { Milestone } from '../../../core/services/milestone.service';
import { PRIORITY_COLORS } from '../../../shared/constants/priority-colors';

@Component({
  selector: 'app-task-detail-metadata',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Select,
    DatePicker,
    InputTextModule,
    Tooltip,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (task(); as t) {
      <div class="space-y-4">
        <!-- Priority & Due Date row -->
        <div class="grid grid-cols-2 gap-4">
          <!-- Priority -->
          <div>
            <label
              class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
              >Priority</label
            >
            <p-select
              [ngModel]="t.priority"
              (ngModelChange)="priorityChanged.emit($event)"
              [options]="prioritySelectOptions"
              optionLabel="label"
              optionValue="value"
              styleClass="w-full"
            >
              <ng-template #selectedItem let-selected>
                <div class="flex items-center gap-2" *ngIf="selected">
                  <span
                    class="w-2.5 h-2.5 rounded-full"
                    [style.background-color]="selected.color"
                  ></span>
                  {{ selected.label }}
                </div>
              </ng-template>
              <ng-template #item let-priority>
                <div class="flex items-center gap-2">
                  <span
                    class="w-2.5 h-2.5 rounded-full"
                    [style.background-color]="priority.color"
                  ></span>
                  {{ priority.label }}
                </div>
              </ng-template>
            </p-select>
          </div>

          <!-- Due Date -->
          <div>
            <label
              class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
              >Due Date</label
            >
            <p-datePicker
              [ngModel]="dueDateValue()"
              (ngModelChange)="onDueDatePickerChange($event)"
              dateFormat="yy-mm-dd"
              [showIcon]="true"
              [showClear]="true"
              styleClass="w-full"
              placeholder="No due date"
            />
          </div>
        </div>

        <!-- Assignees -->
        <div>
          <label
            class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
            >Assignees</label
          >
          <div class="flex flex-wrap gap-2 py-1">
            @if (t.assignees && t.assignees.length > 0) {
              @for (assignee of t.assignees; track assignee.id) {
                <div
                  class="inline-flex items-center gap-1 px-2 py-1 bg-[var(--secondary)] rounded-full text-sm"
                >
                  <div
                    class="w-5 h-5 rounded-full bg-[var(--secondary)] flex items-center justify-center text-xs"
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
                    (click)="unassignRequested.emit(assignee)"
                    class="ml-1 text-gray-400 hover:text-[var(--foreground)]"
                  >
                    <i class="pi pi-times text-xs"></i>
                  </button>
                </div>
              }
            }
            <button
              (click)="toggleAssigneeSearch()"
              class="inline-flex items-center gap-1 px-2 py-1 text-sm text-primary hover:bg-primary/10 rounded-full"
            >
              <i class="pi pi-plus text-xs"></i>
              Add
            </button>
          </div>

          <!-- Assignee Search Dropdown -->
          @if (showAssigneeSearch()) {
            <div
              class="mt-2 bg-[var(--card)] border border-[var(--border)] rounded-md shadow-lg"
            >
              <input
                pInputText
                type="text"
                [ngModel]="assigneeSearchQuery()"
                (ngModelChange)="onAssigneeSearchInput($event)"
                placeholder="Search members..."
                class="w-full border-0 border-b border-[var(--border)]"
              />
              <div class="max-h-48 overflow-y-auto p-2">
                @for (member of searchResults(); track member.id) {
                  <button
                    (click)="onAssign(member)"
                    class="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-[var(--muted)] rounded"
                  >
                    <div
                      class="w-6 h-6 rounded-full bg-[var(--secondary)] flex items-center justify-center text-xs"
                    >
                      {{ getInitials(member.name || '') }}
                    </div>
                    <span>{{ member.name || member.email }}</span>
                  </button>
                }
                @if (searchResults().length === 0 && assigneeSearchQuery()) {
                  <div
                    class="px-2 py-4 text-sm text-[var(--muted-foreground)] text-center"
                  >
                    No members found
                  </div>
                }
              </div>
            </div>
          }
        </div>

        <!-- Labels -->
        <div>
          <label
            class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
            >Labels</label
          >
          <div class="flex flex-wrap gap-1.5 items-center">
            @if (t.labels && t.labels.length > 0) {
              @for (label of t.labels; track label.id) {
                <span
                  class="inline-flex items-center gap-1 px-2.5 py-1 rounded text-sm font-medium"
                  [style.background-color]="label.color + '20'"
                  [style.color]="label.color"
                >
                  {{ label.name }}
                  <button
                    (click)="labelRemoved.emit(label.id)"
                    class="hover:opacity-70"
                  >
                    <i class="pi pi-times text-xs"></i>
                  </button>
                </span>
              }
            }
            @if (filteredLabels().length > 0) {
              <p-select
                [ngModel]="null"
                [options]="filteredLabels()"
                optionLabel="name"
                optionValue="id"
                placeholder="+ Add"
                [filter]="true"
                filterPlaceholder="Search labels..."
                [showClear]="false"
                (onChange)="onLabelSelected($event)"
                styleClass="w-32"
                size="small"
              >
                <ng-template #item let-label>
                  <div class="flex items-center gap-2">
                    <span
                      class="w-3 h-3 rounded-full flex-shrink-0"
                      [style.background-color]="label.color"
                    ></span>
                    <span>{{ label.name }}</span>
                  </div>
                </ng-template>
              </p-select>
            } @else if (!t.labels || t.labels.length === 0) {
              <span class="text-sm text-gray-400">No labels</span>
            }
          </div>
        </div>

        <!-- Milestone -->
        <div>
          <label
            class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
            >Milestone</label
          >
          <div class="flex items-center gap-2 mb-2">
            @if (selectedMilestone(); as ms) {
              <span
                class="w-3 h-3 rounded-full flex-shrink-0"
                [style.background-color]="ms.color"
              ></span>
              <span class="text-sm text-[var(--card-foreground)]">{{
                ms.name
              }}</span>
              <button
                (click)="milestoneChanged.emit('')"
                class="ml-auto p-1 text-gray-400 hover:text-[var(--foreground)] rounded"
                pTooltip="Remove milestone"
              >
                <i class="pi pi-times text-xs"></i>
              </button>
            } @else {
              <span class="text-sm text-gray-400">None</span>
            }
          </div>
          <p-select
            [ngModel]="task()?.milestone_id || ''"
            (ngModelChange)="milestoneChanged.emit($event)"
            [options]="milestoneSelectOptions()"
            optionLabel="name"
            optionValue="id"
            placeholder="No milestone"
            [showClear]="true"
            styleClass="w-full"
          />
        </div>
      </div>
    }
  `,
})
export class TaskDetailMetadataComponent {
  task = input.required<Task | null>();
  milestones = input<Milestone[]>([]);
  selectedMilestone = input<Milestone | null>(null);
  availableLabels = input<Label[]>([]);

  priorityChanged = output<TaskPriority>();
  dueDateChanged = output<string>();
  assigneeSearchChanged = output<string>();
  assignRequested = output<MemberSearchResult>();
  unassignRequested = output<Assignee>();
  labelAdded = output<string>();
  labelRemoved = output<string>();
  milestoneChanged = output<string>();

  showAssigneeSearch = signal(false);
  assigneeSearchQuery = signal('');
  searchResults = input<MemberSearchResult[]>([]);

  prioritySelectOptions = [
    { value: 'urgent', label: 'Urgent', color: PRIORITY_COLORS['urgent'] },
    { value: 'high', label: 'High', color: PRIORITY_COLORS['high'] },
    { value: 'medium', label: 'Medium', color: PRIORITY_COLORS['medium'] },
    { value: 'low', label: 'Low', color: PRIORITY_COLORS['low'] },
  ];

  dueDateValue = computed(() => {
    const d = this.task()?.due_date;
    return d ? new Date(d) : null;
  });

  filteredLabels = computed(() => {
    const task = this.task();
    const available = this.availableLabels();
    if (!task) return available;
    const assignedIds = new Set((task.labels || []).map((l) => l.id));
    return available.filter((l) => !assignedIds.has(l.id));
  });

  milestoneSelectOptions = computed(() => {
    return this.milestones().map((ms) => ({
      id: ms.id,
      name: ms.name,
      color: ms.color,
    }));
  });

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  toggleAssigneeSearch(): void {
    this.showAssigneeSearch.update((v) => !v);
    if (!this.showAssigneeSearch()) {
      this.assigneeSearchQuery.set('');
    }
  }

  onAssigneeSearchInput(query: string): void {
    this.assigneeSearchQuery.set(query);
    this.assigneeSearchChanged.emit(query);
  }

  onAssign(member: MemberSearchResult): void {
    this.assignRequested.emit(member);
    this.toggleAssigneeSearch();
  }

  onLabelSelected(event: { value: string }): void {
    if (event.value) {
      this.labelAdded.emit(event.value);
    }
  }

  onDueDatePickerChange(date: Date | null): void {
    this.dueDateChanged.emit(date ? date.toISOString().split('T')[0] : '');
  }
}
