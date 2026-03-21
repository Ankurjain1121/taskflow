import {
  Component,
  input,
  output,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Popover } from 'primeng/popover';
import { CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import {
  Task,
  TaskPriority,
  Label,
  Assignee,
} from '../../../core/services/task.service';
import {
  Column,
  ProjectMember,
} from '../../../core/services/project.service';
import { WorkspaceLabel } from '../../../core/services/workspace.service';
import { PriorityPickerComponent } from '../project-view/card-quick-edit/pickers/priority-picker.component';
import { AssigneePickerComponent } from '../project-view/card-quick-edit/pickers/assignee-picker.component';
import { DueDatePickerComponent } from '../project-view/card-quick-edit/pickers/due-date-picker.component';
import { LabelPickerComponent } from '../project-view/card-quick-edit/pickers/label-picker.component';
import { PRIORITY_COLORS } from '../../../shared/constants/priority-colors';

@Component({
  selector: 'app-subtask-row',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Popover,
    CdkDrag,
    CdkDragHandle,
    PriorityPickerComponent,
    AssigneePickerComponent,
    DueDatePickerComponent,
    LabelPickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      cdkDrag
      class="group flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-[var(--muted)] transition-colors"
    >
      <!-- Drag placeholder -->
      <div
        class="border-2 border-dashed border-[var(--border)] rounded-md px-2 py-1.5"
        *cdkDragPlaceholder
      ></div>

      <!-- Drag handle -->
      <div
        cdkDragHandle
        class="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-opacity shrink-0"
      >
        <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="18" r="1.5" />
        </svg>
      </div>

      <!-- Status chip -->
      <button
        class="shrink-0 px-2 py-0.5 text-xs rounded-md font-medium cursor-pointer transition-colors whitespace-nowrap"
        [style.background]="statusChipBg()"
        [style.color]="statusChipColor()"
        role="button"
        aria-haspopup="listbox"
        aria-label="Change status"
        (click)="statusPopover.toggle($event)"
      >
        {{ statusName() }}
      </button>
      <p-popover #statusPopover>
        <div class="w-48 max-h-56 overflow-y-auto p-1">
          @for (col of boardColumns(); track col.id) {
            <button
              class="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors hover:bg-[var(--muted)]"
              [class.bg-[var(--muted)]]="col.id === child().status_id"
              [class.font-medium]="col.id === child().status_id"
              (click)="onStatusSelect(col.id); statusPopover.hide()"
            >
              <span
                class="w-2.5 h-2.5 rounded-full shrink-0"
                [style.background]="col.color || 'var(--muted-foreground)'"
              ></span>
              {{ col.name }}
            </button>
          }
        </div>
      </p-popover>

      <!-- Priority dot -->
      <button
        class="shrink-0 w-2.5 h-2.5 rounded-full cursor-pointer"
        [style.background]="priorityDotColor()"
        role="button"
        [attr.aria-label]="'Change priority: ' + child().priority"
        [title]="child().priority | titlecase"
        (click)="priorityPopover.toggle($event)"
      ></button>
      <p-popover #priorityPopover>
        <div class="w-48">
          <app-priority-picker
            [currentPriority]="child().priority ?? null"
            (prioritySelected)="onPrioritySelect($event); priorityPopover.hide()"
          />
        </div>
      </p-popover>

      <!-- Title -->
      @if (editingTitle()) {
        <input
          type="text"
          [ngModel]="editTitleValue()"
          (ngModelChange)="editTitleValue.set($event)"
          (blur)="saveTitle()"
          (keydown.enter)="$any($event.target).blur()"
          (keydown.escape)="cancelTitleEdit()"
          class="flex-1 text-sm border-0 focus:ring-0 px-0 py-0 bg-transparent text-[var(--foreground)] min-w-0"
        />
      } @else {
        <span
          (click)="navigate.emit(child().id)"
          class="flex-1 text-sm hover:text-primary truncate cursor-pointer min-w-0"
          [class.line-through]="isDone()"
          [style.color]="isDone() ? 'var(--muted-foreground)' : 'var(--foreground)'"
        >
          {{ child().title }}
        </span>
        <!-- Edit pencil icon -->
        <button
          class="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-opacity"
          title="Edit title"
          (click)="startTitleEdit(); $event.stopPropagation()"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      }

      <!-- Label chips -->
      <div class="shrink-0 flex items-center gap-0.5">
        @for (label of childLabels(); track label.id) {
          <span
            class="px-1.5 py-0.5 text-[10px] rounded font-medium"
            [style.background]="label.color + '33'"
            [style.color]="label.color"
          >
            {{ label.name }}
          </span>
        }
        <button
          class="opacity-0 group-hover:opacity-100 w-4 h-4 rounded-full border border-dashed border-[var(--muted-foreground)] flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-all"
          title="Add label"
          (click)="labelPopover.toggle($event)"
        >
          <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
      <p-popover #labelPopover>
        <div class="w-56">
          <app-label-picker
            [labels]="workspaceLabelsAsLabels()"
            [selectedIds]="childLabelIds()"
            (labelsChanged)="onLabelsChange($event); labelPopover.hide()"
          />
        </div>
      </p-popover>

      <!-- Assignee avatars -->
      <div class="shrink-0 flex items-center">
        @for (a of childAssignees(); track a.id; let i = $index) {
          @if (i < 3) {
            <span
              class="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-medium flex items-center justify-center"
              [class.-ml-1]="i > 0"
              [title]="a.display_name"
            >
              {{ getInitials(a.display_name) }}
            </span>
          }
        }
        <button
          class="opacity-0 group-hover:opacity-100 w-4 h-4 rounded-full border border-dashed border-[var(--muted-foreground)] flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-all"
          [class.-ml-1]="childAssignees().length > 0"
          title="Assign member"
          (click)="assigneePopover.toggle($event)"
        >
          <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
      <p-popover #assigneePopover>
        <div class="w-56">
          <app-assignee-picker
            [members]="projectMembers()"
            [selectedIds]="childAssigneeIds()"
            (assigneesChanged)="onAssigneesChange($event); assigneePopover.hide()"
          />
        </div>
      </p-popover>

      <!-- Due date -->
      @if (child().due_date && !isDone()) {
        <button
          class="shrink-0 text-xs whitespace-nowrap cursor-pointer"
          [class]="getDueDateClass(child().due_date!)"
          (click)="dueDatePopover.toggle($event)"
        >
          {{ formatDueDate(child().due_date!) }}
        </button>
      } @else if (!isDone()) {
        <button
          class="opacity-0 group-hover:opacity-100 shrink-0 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] whitespace-nowrap cursor-pointer"
          (click)="dueDatePopover.toggle($event)"
        >
          Set date
        </button>
      }
      <p-popover #dueDatePopover>
        <div class="w-72">
          <app-due-date-picker
            [currentDate]="child().due_date"
            (dateSelected)="onDueDateSelect($event); dueDatePopover.hide()"
          />
        </div>
      </p-popover>

      <!-- Delete button -->
      <button
        (click)="onDelete(); $event.stopPropagation()"
        class="opacity-0 group-hover:opacity-100 p-1 text-[var(--muted-foreground)] hover:text-red-500 transition-all shrink-0"
        title="Delete subtask"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  `,
  styles: [
    `
      @reference "tailwindcss";
      :host {
        display: block;
      }
      .cdk-drag-preview {
        @apply shadow-md rounded-md bg-[var(--card)] px-2 py-1.5;
      }
    `,
  ],
})
export class SubtaskRowComponent {
  child = input.required<Task>();
  boardColumns = input<Column[]>([]);
  projectMembers = input<ProjectMember[]>([]);
  workspaceLabels = input<WorkspaceLabel[]>([]);

  statusChanged = output<{ childId: string; statusId: string }>();
  priorityChanged = output<{ childId: string; priority: TaskPriority | null }>();
  assigneesChanged = output<{ childId: string; assigneeIds: string[] }>();
  dueDateChanged = output<{ childId: string; dueDate: string | null }>();
  titleChanged = output<{ childId: string; title: string }>();
  labelsChanged = output<{ childId: string; labelIds: string[] }>();
  deleted = output<string>();
  navigate = output<string>();

  editingTitle = signal(false);
  editTitleValue = signal('');

  childAssignees = computed<Assignee[]>(() => this.child().assignees ?? []);
  childAssigneeIds = computed(() => this.childAssignees().map(a => a.id));
  childLabels = computed<Label[]>(() => this.child().labels ?? []);
  childLabelIds = computed(() => this.childLabels().map(l => l.id));

  statusName = computed(() => {
    const cols = this.boardColumns();
    const statusId = this.child().status_id;
    const col = cols.find(c => c.id === statusId);
    return col?.name ?? 'Unknown';
  });

  statusChipBg = computed(() => {
    const cols = this.boardColumns();
    const statusId = this.child().status_id;
    const col = cols.find(c => c.id === statusId);
    const color = col?.color || '888888';
    // 15% opacity background
    return color + '26';
  });

  statusChipColor = computed(() => {
    const cols = this.boardColumns();
    const statusId = this.child().status_id;
    const col = cols.find(c => c.id === statusId);
    return col?.color || 'var(--foreground)';
  });

  priorityDotColor = computed(() => {
    const p = this.child().priority;
    return PRIORITY_COLORS[p] || PRIORITY_COLORS['none'];
  });

  workspaceLabelsAsLabels = computed<Label[]>(() =>
    this.workspaceLabels().map(wl => ({
      id: wl.id,
      workspace_id: wl.workspace_id,
      name: wl.name,
      color: wl.color,
      created_at: '',
    })),
  );

  isDone(): boolean {
    const cols = this.boardColumns();
    const statusId = this.child().status_id;
    const col = cols.find(c => c.id === statusId);
    return col?.status_mapping?.done === true;
  }

  onStatusSelect(statusId: string): void {
    this.statusChanged.emit({ childId: this.child().id, statusId });
  }

  onPrioritySelect(priority: TaskPriority | null): void {
    this.priorityChanged.emit({ childId: this.child().id, priority });
  }

  onAssigneesChange(assigneeIds: string[]): void {
    this.assigneesChanged.emit({ childId: this.child().id, assigneeIds });
  }

  onLabelsChange(labelIds: string[]): void {
    this.labelsChanged.emit({ childId: this.child().id, labelIds });
  }

  onDueDateSelect(dueDate: string | null): void {
    this.dueDateChanged.emit({ childId: this.child().id, dueDate });
  }

  startTitleEdit(): void {
    this.editTitleValue.set(this.child().title);
    this.editingTitle.set(true);
  }

  saveTitle(): void {
    const newTitle = this.editTitleValue().trim();
    this.editingTitle.set(false);
    if (newTitle && newTitle !== this.child().title) {
      this.titleChanged.emit({ childId: this.child().id, title: newTitle });
    }
  }

  cancelTitleEdit(): void {
    this.editingTitle.set(false);
  }

  onDelete(): void {
    if (!confirm('Delete this subtask?')) return;
    this.deleted.emit(this.child().id);
  }

  getInitials(name: string): string {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  formatDueDate(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);
    const diffTime = dateOnly.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  getDueDateClass(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);
    const diffTime = dateOnly.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'text-red-600 dark:text-red-400 font-medium';
    if (diffDays === 0) return 'text-amber-600 dark:text-amber-400 font-medium';
    return 'text-[var(--muted-foreground)]';
  }
}
