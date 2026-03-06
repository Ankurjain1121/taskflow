import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { EisenhowerTask } from '../../../core/services/eisenhower.service';

export interface DelegateMember {
  id: string;
  name: string;
  avatar_url?: string | null;
}

@Component({
  selector: 'app-eisenhower-task-card',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="group relative bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 hover:shadow-sm transition-shadow"
    >
      <div class="flex items-start justify-between">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5">
            <h3
              class="text-sm font-medium text-[var(--card-foreground)] truncate cursor-pointer hover:underline"
              [routerLink]="['/task', task().id]"
            >
              {{ task().title }}
            </h3>
            @if (
              task().eisenhower_urgency !== null ||
              task().eisenhower_importance !== null
            ) {
              <span
                class="shrink-0 w-2 h-2 rounded-full bg-[var(--primary)]"
                title="Manual override active"
              ></span>
            }
          </div>
          <div class="flex items-center gap-2 mt-1">
            <a
              [routerLink]="['/board', task().project_id]"
              class="text-xs text-[var(--muted-foreground)] hover:text-primary hover:underline"
              (click)="$event.stopPropagation()"
            >
              {{ task().project_name }}
            </a>
            @if (task().due_date) {
              <span class="text-xs text-[var(--muted-foreground)]">&bull;</span>
              <span
                class="text-xs"
                [class]="
                  isOverdue(task().due_date!)
                    ? 'text-[var(--destructive)] font-medium'
                    : 'text-[var(--muted-foreground)]'
                "
              >
                Due {{ formatDueDate(task().due_date!) }}
              </span>
            }
          </div>
        </div>

        <!-- Priority badge (clickable dropdown) -->
        <div class="relative ml-2">
          <button
            (click)="togglePriorityDropdown(); $event.stopPropagation()"
            class="px-2 py-0.5 text-xs font-medium rounded cursor-pointer"
            [class]="getPriorityClass(task().priority)"
            title="Change priority"
          >
            {{ task().priority }}
          </button>

          @if (showPriorityDropdown()) {
            <div
              class="absolute right-0 top-full mt-1 z-10 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg py-1 min-w-[100px]"
            >
              @for (p of priorities; track p) {
                <button
                  (click)="onPriorityChange(p); $event.stopPropagation()"
                  class="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--muted)] transition-colors"
                  [class.font-semibold]="
                    p.toLowerCase() === task().priority.toLowerCase()
                  "
                >
                  <span
                    class="inline-block w-2 h-2 rounded-full mr-2"
                    [class]="getPriorityDotClass(p)"
                  ></span>
                  {{ p }}
                </button>
              }
            </div>
          }
        </div>
      </div>

      <!-- Hover toolbar -->
      <div
        class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5"
      >
        <a
          [routerLink]="['/board', task().project_id]"
          class="p-1 text-[var(--muted-foreground)] hover:text-primary rounded"
          title="Go to board"
          (click)="$event.stopPropagation()"
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
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
      </div>

      <!-- Delegate quadrant: assignee picker -->
      @if (quadrant() === 'delegate') {
        <div class="mt-2 pt-2 border-t border-[var(--border)]">
          @if (task().assignees && task().assignees.length > 0) {
            <div class="flex items-center gap-1.5 mb-1.5">
              @for (assignee of task().assignees; track assignee.id) {
                <div
                  class="flex items-center gap-1"
                  [title]="assignee.display_name"
                >
                  <div
                    class="w-5 h-5 rounded-full bg-[color-mix(in_srgb,var(--primary)_20%,var(--card))] flex items-center justify-center text-[8px] font-bold text-[var(--primary)]"
                  >
                    {{ assignee.display_name?.charAt(0)?.toUpperCase() }}
                  </div>
                  <span class="text-xs text-[var(--muted-foreground)]">{{
                    assignee.display_name
                  }}</span>
                </div>
              }
            </div>
          }
          @if (members().length > 0) {
            <p-select
              [options]="members()"
              [ngModel]="selectedAssigneeId()"
              (ngModelChange)="onAssigneeSelect($event)"
              optionLabel="name"
              optionValue="id"
              placeholder="Delegate to..."
              [showClear]="false"
              styleClass="w-full eisenhower-delegate-select"
              size="small"
              appendTo="body"
              (click)="$event.stopPropagation()"
            >
              <ng-template #selectedItem let-selected>
                <div class="flex items-center gap-2" *ngIf="selected">
                  <div
                    class="w-5 h-5 rounded-full bg-[color-mix(in_srgb,var(--primary)_20%,var(--card))] flex items-center justify-center text-[8px] font-bold text-[var(--primary)]"
                  >
                    {{ selected.name?.charAt(0)?.toUpperCase() }}
                  </div>
                  <span class="text-sm">{{ selected.name }}</span>
                </div>
              </ng-template>
              <ng-template #item let-member>
                <div class="flex items-center gap-2">
                  <div
                    class="w-5 h-5 rounded-full bg-[color-mix(in_srgb,var(--primary)_20%,var(--card))] flex items-center justify-center text-[8px] font-bold text-[var(--primary)]"
                  >
                    {{ member.name?.charAt(0)?.toUpperCase() }}
                  </div>
                  <span class="text-sm">{{ member.name }}</span>
                </div>
              </ng-template>
            </p-select>
          }
        </div>
      }
    </div>
  `,
})
export class EisenhowerTaskCardComponent {
  task = input.required<EisenhowerTask>();
  quadrant = input<string>('');
  members = input<DelegateMember[]>([]);

  priorityChanged = output<{ taskId: string; priority: string }>();
  assigneeChanged = output<{ taskId: string; assigneeId: string }>();

  showPriorityDropdown = signal(false);
  selectedAssigneeId = signal<string | null>(null);

  priorities = ['Urgent', 'High', 'Medium', 'Low'];

  togglePriorityDropdown() {
    this.showPriorityDropdown.update((v) => !v);
  }

  onPriorityChange(priority: string) {
    this.showPriorityDropdown.set(false);
    if (priority.toLowerCase() !== this.task().priority.toLowerCase()) {
      this.priorityChanged.emit({
        taskId: this.task().id,
        priority: priority.toLowerCase(),
      });
    }
  }

  onAssigneeSelect(userId: string | null): void {
    if (userId) {
      this.selectedAssigneeId.set(userId);
      this.assigneeChanged.emit({
        taskId: this.task().id,
        assigneeId: userId,
      });
    }
  }

  formatDueDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays <= 7) return `in ${diffDays}d`;
    return date.toLocaleDateString();
  }

  isOverdue(dateStr: string): boolean {
    return new Date(dateStr) < new Date();
  }

  getPriorityClass(priority: string): string {
    switch (priority.toLowerCase()) {
      case 'urgent':
        return 'bg-[color-mix(in_srgb,var(--destructive)_15%,var(--card))] text-[var(--destructive)]';
      case 'high':
        return 'bg-[color-mix(in_srgb,var(--warning,#eab308)_15%,var(--card))] text-[color-mix(in_srgb,var(--warning,#eab308)_80%,var(--foreground))]';
      case 'medium':
        return 'bg-[color-mix(in_srgb,var(--primary)_15%,var(--card))] text-[color-mix(in_srgb,var(--primary)_80%,var(--foreground))]';
      case 'low':
        return 'bg-[var(--muted)] text-[var(--muted-foreground)]';
      default:
        return 'bg-[var(--muted)] text-[var(--muted-foreground)]';
    }
  }

  getPriorityDotClass(priority: string): string {
    switch (priority.toLowerCase()) {
      case 'urgent':
        return 'bg-[var(--destructive)]';
      case 'high':
        return 'bg-[var(--warning,#eab308)]';
      case 'medium':
        return 'bg-[var(--primary)]';
      case 'low':
        return 'bg-[var(--muted-foreground)]';
      default:
        return 'bg-[var(--muted-foreground)]';
    }
  }
}
