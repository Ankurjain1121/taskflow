import {
  Component,
  computed,
  input,
  output,
  signal,
  viewChild,
  ViewChild,
  ElementRef,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  CdkDrag,
  CdkDragPreview,
  CdkDragPlaceholder,
} from '@angular/cdk/drag-drop';
import { Menu } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { Tooltip } from 'primeng/tooltip';
import { Task } from '../../../core/services/task.service';
import { Column } from '../../../core/services/board.service';
import { CardFields, DEFAULT_CARD_FIELDS } from '../board-view/board-state.service';
import { TaskLockInfo } from '../../../core/services/presence.service';
import {
  CardQuickEditService,
  QuickEditField,
} from '../board-view/card-quick-edit/card-quick-edit.service';
import { PriorityBadgeComponent } from '../../../shared/components/priority-badge/priority-badge.component';
import {
  getPriorityColor,
  getPriorityLabel,
  getDueDateColor,
  isOverdue,
  isToday,
  PRIORITY_FLAG_COLORS,
} from '../../../shared/utils/task-colors';

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [CommonModule, CdkDrag, CdkDragPreview, CdkDragPlaceholder, Menu, Tooltip, PriorityBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      cdkDrag
      [cdkDragData]="task()"
      [cdkDragDisabled]="isEditingTitle()"
      (click)="onCardClick($event)"
      (contextmenu)="onRightClick($event)"
      class="task-card rounded-lg border border-[var(--border)] cursor-grab group relative overflow-hidden"
      [attr.data-task-id]="task().id"
      [style.border-top]="'3px solid ' + getBorderColor()"
      [class.task-card--urgent]="task().priority === 'urgent'"
      [class.task-card--high]="task().priority === 'high'"
      [class.task-card--medium]="task().priority === 'medium'"
      [class.task-card--low]="task().priority === 'low'"
      [class.ring-2]="isFocused() || isSelected() || lockedBy()"
      [class.ring-ring]="isFocused()"
      [class.ring-primary]="isSelected()"
      [class.ring-amber-400]="lockedBy() && !isFocused() && !isSelected()"
      [class.shadow-lg]="isFocused()"
    >
      <!-- Selection Checkbox -->
      <div
        class="absolute top-1 left-1 z-20 transition-opacity"
        [class.opacity-0]="!isSelected()"
        [class.opacity-100]="isSelected()"
        [ngClass]="{ 'group-hover:opacity-100': !isSelected() }"
      >
        <button
          (click)="onSelectToggle($event)"
          class="w-5 h-5 rounded border flex items-center justify-center"
          [class.bg-primary]="isSelected()"
          [class.border-primary]="isSelected()"
          [style.border-color]="!isSelected() ? 'var(--border)' : ''"
          [style.background]="!isSelected() ? 'var(--card)' : ''"
        >
          @if (isSelected()) {
            <svg
              class="w-3 h-3 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              stroke-width="3"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          }
        </button>
      </div>

      <!-- Lock Indicator -->
      @if (lockedBy()) {
        <div
          class="absolute top-1 right-1 z-10 flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 rounded text-[10px] font-medium text-amber-700"
          [pTooltip]="lockedBy()!.user_name + ' is editing'"
          tooltipPosition="top"
        >
          <i class="pi pi-lock text-[10px]"></i>
        </div>
      }

      <!-- Celebration Overlay -->
      @if (isCelebrating()) {
        <div
          class="absolute inset-0 bg-[var(--status-green-bg)] flex items-center justify-center z-10 rounded-lg"
        >
          <div class="animate-celebrate-check">
            <svg
              class="w-10 h-10 text-emerald-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              stroke-width="2.5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>
      }

      <!-- Hover Quick-Actions -->
      <div
        class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-20 flex items-center gap-0.5"
      >
        <!-- Priority edit button -->
        <button
          class="w-6 h-6 rounded bg-[var(--card)]/90 shadow-sm flex items-center justify-center hover:bg-[var(--muted)] btn-snappy"
          (click)="openQuickEdit($event, 'priority')"
          title="Set priority"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 1v10M2 1h7l-2 3 2 3H2"
              [attr.stroke]="getPriorityFlagColor()"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>

        <!-- Assignee edit button -->
        <button
          class="w-6 h-6 rounded bg-[var(--card)]/90 shadow-sm flex items-center justify-center hover:bg-[var(--muted)] btn-snappy text-[var(--muted-foreground)]"
          (click)="openQuickEdit($event, 'assignee')"
          title="Set assignees"
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
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </button>

        <!-- Due date edit button -->
        <button
          class="w-6 h-6 rounded bg-[var(--card)]/90 shadow-sm flex items-center justify-center hover:bg-[var(--muted)] btn-snappy text-[var(--muted-foreground)]"
          (click)="openQuickEdit($event, 'due-date')"
          title="Set due date"
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
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </button>

        <!-- Labels edit button -->
        <button
          class="w-6 h-6 rounded bg-[var(--card)]/90 shadow-sm flex items-center justify-center hover:bg-[var(--muted)] btn-snappy text-[var(--muted-foreground)]"
          (click)="openQuickEdit($event, 'label')"
          title="Set labels"
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
              d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
            />
          </svg>
        </button>

        <!-- Three-dot menu button -->
        <button
          class="w-6 h-6 rounded bg-[var(--card)]/90 shadow-sm flex items-center justify-center hover:bg-[var(--muted)] text-[var(--muted-foreground)] btn-snappy"
          (click)="onMenuToggle($event)"
        >
          <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path
              d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"
            />
          </svg>
        </button>
        <p-menu
          #cardMenu
          [model]="contextMenuItems"
          [popup]="true"
          appendTo="body"
        />
      </div>

      @if (density() === 'compact') {
        <!-- Compact card: title + metadata row -->
        <div class="px-2.5 py-2">
          <h4
            class="text-xs font-medium text-[var(--card-foreground)] line-clamp-1 leading-tight"
          >
            {{ task().title }}
          </h4>
          <!-- Priority dot + due date + assignees -->
          <div class="flex items-center justify-between mt-1">
            <div class="flex items-center gap-1.5">
              @if (cardFields().showPriority) {
                <span
                  class="w-2 h-2 rounded-full flex-shrink-0"
                  [style.background-color]="getPriorityFlagColor()"
                ></span>
              }
              @if (task().due_date && cardFields().showDueDate) {
                <span
                  class="text-[9px] font-medium"
                  [ngClass]="dueDateColors.class"
                >
                  {{ formatDueDate(task().due_date!) }}
                </span>
              }
            </div>
            @if (task().assignees && task().assignees!.length > 0 && cardFields().showAssignees) {
              <div class="flex -space-x-1">
                @for (
                  assignee of task().assignees!.slice(0, 2);
                  track assignee.id;
                  let i = $index
                ) {
                  <div
                    class="w-5 h-5 rounded-full ring-1 ring-[var(--card)] flex items-center justify-center text-[8px] font-bold text-white"
                    [title]="assignee.display_name"
                    [style.background]="
                      assignee.avatar_url ? 'transparent' : getAvatarGradient(i)
                    "
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
                }
                @if (task().assignees!.length > 2) {
                  <div
                    class="w-5 h-5 rounded-full ring-1 ring-[var(--card)] bg-[var(--secondary)] flex items-center justify-center text-[8px] font-bold text-[var(--muted-foreground)]"
                  >
                    +{{ task().assignees!.length - 2 }}
                  </div>
                }
              </div>
            }
          </div>
        </div>
      } @else if (density() === 'expanded') {
        <!-- Expanded card: all labels, 2-line description, all assignees -->

        <!-- All Labels (no cap) -->
        @if (task().labels && task().labels!.length > 0 && cardFields().showLabels) {
          <div class="flex flex-wrap gap-1 px-3 pt-3">
            @for (label of task().labels!; track label.id) {
              <span
                class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                [style.background-color]="label.color"
                [style.text-shadow]="'1px 1px 0 rgba(0,0,0,0.2)'"
              >
                {{ label.name }}
              </span>
            }
          </div>
        }

        <div
          class="p-4"
          [class.pt-2]="task().labels && task().labels!.length > 0"
        >
          <!-- Blocked Indicator -->
          @if (isBlocked()) {
            <div
              class="flex items-center gap-1.5 mb-2.5 px-2 py-1 bg-[var(--status-red-bg)] rounded-lg text-xs font-semibold text-[var(--status-red-text)] border border-[var(--status-red-border)]"
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
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              Blocked
            </div>
          }

          <!-- Short ID -->
          @if (task().task_number && boardPrefix() && cardFields().showTaskId) {
            <span
              class="text-[10px] font-medium text-[var(--muted-foreground)] mb-1 inline-block"
            >
              {{ boardPrefix() }}-{{ task().task_number }}
            </span>
          }

          <!-- Title -->
          @if (!isEditingTitle()) {
            <div class="flex items-start gap-1.5 group/title mb-2.5">
              <h4
                class="text-sm font-semibold text-[var(--card-foreground)] line-clamp-2 leading-snug tracking-tight flex-1 min-w-0"
              >{{ task().title }}</h4>
              <button
                (click)="onTitleEditStart($event)"
                class="flex-shrink-0 mt-0.5 opacity-0 group-hover/title:opacity-100 transition-opacity duration-150 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                title="Edit title"
                aria-label="Edit task title"
              >
                <i class="pi pi-pencil text-xs"></i>
              </button>
            </div>
          }
          @if (isEditingTitle()) {
            <input
              #titleInput
              type="text"
              [value]="editTitleValue()"
              (input)="onTitleInput($event)"
              (blur)="onTitleSave()"
              (keydown.enter)="onTitleSave()"
              (keydown.escape)="onTitleCancel()"
              (click)="$event.stopPropagation()"
              maxlength="200"
              aria-label="Edit task title"
              class="w-full text-sm font-semibold mb-2.5
                     bg-[var(--card)] text-[var(--card-foreground)]
                     border border-[var(--border)] rounded-md px-2 py-1
                     focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-0
                     transition-shadow duration-150"
            />
          }

          <!-- Description preview (2 lines in expanded mode) -->
          @if (task().description && task().description!.trim() && cardFields().showDescription) {
            <p class="text-[11px] text-[var(--muted-foreground)] line-clamp-2 leading-snug mb-2.5 -mt-1">
              {{ task().description }}
            </p>
          }

          <!-- Running Timer Indicator -->
          @if (hasRunningTimer()) {
            <div
              class="flex items-center gap-1.5 mb-2.5 px-2 py-1 bg-[var(--status-green-bg)] rounded-lg text-xs font-semibold text-[var(--status-green-text)] border border-[var(--status-green-border)]"
            >
              <span
                class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"
              ></span>
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
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Timer running
            </div>
          }

          <!-- Bottom Row -->
          <div
            class="flex items-center justify-between mt-3 pt-2.5 border-t border-[var(--border)]"
          >
            <div class="flex items-center gap-2">
              <!-- Priority Badge -->
              @if (cardFields().showPriority) {
                <app-priority-badge [priority]="task().priority" />
              }

              <!-- Due Date -->
              @if (task().due_date && cardFields().showDueDate) {
                <span
                  [class]="
                    'flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded ' +
                    dueDateColors.class +
                    ' ' +
                    dueDateColors.chipClass
                  "
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
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  {{ formatDueDate(task().due_date!) }}
                </span>
              }

              <!-- Subtask Progress Bar -->
              @if (subtaskProgress() && subtaskProgress()!.total > 0 && cardFields().showSubtaskProgress) {
                <div class="flex items-center gap-1.5">
                  <div class="w-12 h-1 rounded-full bg-[var(--border)] overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all duration-300"
                      [class.bg-emerald-500]="subtaskProgress()!.completed === subtaskProgress()!.total"
                      [style.background]="subtaskProgress()!.completed !== subtaskProgress()!.total ? 'var(--primary)' : null"
                      [style.width.%]="(subtaskProgress()!.completed / subtaskProgress()!.total) * 100"
                    ></div>
                  </div>
                  <span
                    class="text-[11px] font-medium"
                    [class.text-emerald-600]="subtaskProgress()!.completed === subtaskProgress()!.total"
                    [class.text-gray-400]="subtaskProgress()!.completed !== subtaskProgress()!.total"
                  >
                    {{ subtaskProgress()!.completed }}/{{ subtaskProgress()!.total }}
                  </span>
                </div>
              }

              <!-- Comment Count -->
              @if (task().comment_count && task().comment_count! > 0 && cardFields().showComments) {
                <span
                  class="flex items-center gap-1 text-[11px] font-medium text-[var(--muted-foreground)]"
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
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                  {{ task().comment_count }}
                </span>
              }

              <!-- Attachment Count -->
              @if (task().attachment_count && task().attachment_count! > 0 && cardFields().showAttachments) {
                <span
                  class="flex items-center gap-1 text-[11px] font-medium text-[var(--muted-foreground)]"
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
                      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                    />
                  </svg>
                  {{ task().attachment_count }}
                </span>
              }
            </div>

            <!-- All Assignees (no cap in expanded mode) -->
            <div class="flex items-center">
              @if (task().assignees && task().assignees!.length > 0 && cardFields().showAssignees) {
                <div class="flex -space-x-2">
                  @for (
                    assignee of task().assignees!;
                    track assignee.id;
                    let i = $index
                  ) {
                    <div
                      class="assignee-avatar w-7 h-7 rounded-full ring-2 ring-[var(--card)] flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                      [title]="assignee.display_name"
                      [style.z-index]="task().assignees!.length - i"
                      [style.background]="
                        assignee.avatar_url
                          ? 'transparent'
                          : getAvatarGradient(i)
                      "
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
                  }
                </div>
              }
            </div>
          </div>

          <!-- Days-in-Column Indicator -->
          @if (daysInColumn() > 0 && cardFields().showDaysInColumn) {
            <div class="flex items-center gap-0.5 px-4 pb-3">
              @for (d of dotsArray(); track $index) {
                <span class="w-1.5 h-1.5 rounded-full"
                  [class.bg-white]="daysInColumn() < 4"
                  [class.opacity-30]="daysInColumn() < 4"
                  [class.bg-amber-400]="daysInColumn() >= 4 && daysInColumn() < 8"
                  [class.bg-red-500]="daysInColumn() >= 8"
                ></span>
              }
              @if (daysInColumn() >= 8) {
                <span class="text-[10px] text-red-400 ml-0.5">{{ daysInColumn() }}d</span>
              }
            </div>
          }
        </div>
      } @else {
        <!-- Normal card: full layout -->

        <!-- Labels (capped at 2 + overflow pill) -->
        @if (task().labels && task().labels!.length > 0 && cardFields().showLabels) {
          <div class="flex flex-wrap gap-1 px-3 pt-3">
            @for (label of task().labels!.slice(0, 2); track label.id) {
              <span
                class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                [style.background-color]="label.color"
                [style.text-shadow]="'1px 1px 0 rgba(0,0,0,0.2)'"
              >
                {{ label.name }}
              </span>
            }
            @if (task().labels!.length > 2) {
              <span
                class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--secondary)] text-[var(--muted-foreground)]"
                [pTooltip]="getOverflowLabelsTooltip()"
                tooltipPosition="top"
              >
                +{{ task().labels!.length - 2 }}
              </span>
            }
          </div>
        }

        <div
          class="p-3.5"
          [class.pt-2]="task().labels && task().labels!.length > 0"
        >
          <!-- Blocked Indicator -->
          @if (isBlocked()) {
            <div
              class="flex items-center gap-1.5 mb-2.5 px-2 py-1 bg-[var(--status-red-bg)] rounded-lg text-xs font-semibold text-[var(--status-red-text)] border border-[var(--status-red-border)]"
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
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              Blocked
            </div>
          }

          <!-- Short ID -->
          @if (task().task_number && boardPrefix() && cardFields().showTaskId) {
            <span
              class="text-[10px] font-medium text-[var(--muted-foreground)] mb-1 inline-block"
            >
              {{ boardPrefix() }}-{{ task().task_number }}
            </span>
          }

          <!-- Title -->
          @if (!isEditingTitle()) {
            <div class="flex items-start gap-1.5 group/title mb-2.5">
              <h4
                class="text-sm font-semibold text-[var(--card-foreground)] line-clamp-2 leading-snug tracking-tight flex-1 min-w-0"
              >{{ task().title }}</h4>
              <button
                (click)="onTitleEditStart($event)"
                class="flex-shrink-0 mt-0.5 opacity-0 group-hover/title:opacity-100 transition-opacity duration-150 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                title="Edit title"
                aria-label="Edit task title"
              >
                <i class="pi pi-pencil text-xs"></i>
              </button>
            </div>
          }
          @if (isEditingTitle()) {
            <input
              #titleInput
              type="text"
              [value]="editTitleValue()"
              (input)="onTitleInput($event)"
              (blur)="onTitleSave()"
              (keydown.enter)="onTitleSave()"
              (keydown.escape)="onTitleCancel()"
              (click)="$event.stopPropagation()"
              maxlength="200"
              aria-label="Edit task title"
              class="w-full text-sm font-semibold mb-2.5
                     bg-[var(--card)] text-[var(--card-foreground)]
                     border border-[var(--border)] rounded-md px-2 py-1
                     focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-0
                     transition-shadow duration-150"
            />
          }

          <!-- Description preview (1 line, only when non-empty) -->
          @if (task().description && task().description!.trim() && cardFields().showDescription) {
            <p class="text-[11px] text-[var(--muted-foreground)] line-clamp-1 leading-snug mb-2.5 -mt-1">
              {{ task().description }}
            </p>
          }

          <!-- Running Timer Indicator -->
          @if (hasRunningTimer()) {
            <div
              class="flex items-center gap-1.5 mb-2.5 px-2 py-1 bg-[var(--status-green-bg)] rounded-lg text-xs font-semibold text-[var(--status-green-text)] border border-[var(--status-green-border)]"
            >
              <span
                class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"
              ></span>
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
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Timer running
            </div>
          }

          <!-- Bottom Row -->
          <div
            class="flex items-center justify-between mt-3 pt-2.5 border-t border-[var(--border)]"
          >
            <div class="flex items-center gap-2">
              <!-- Priority Badge -->
              @if (cardFields().showPriority) {
                <app-priority-badge [priority]="task().priority" />
              }

              <!-- Due Date -->
              @if (task().due_date && cardFields().showDueDate) {
                <span
                  [class]="
                    'flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded ' +
                    dueDateColors.class +
                    ' ' +
                    dueDateColors.chipClass
                  "
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
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  {{ formatDueDate(task().due_date!) }}
                </span>
              }

              <!-- Subtask Progress Bar -->
              @if (subtaskProgress() && subtaskProgress()!.total > 0 && cardFields().showSubtaskProgress) {
                <div class="flex items-center gap-1.5">
                  <div class="w-12 h-1 rounded-full bg-[var(--border)] overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all duration-300"
                      [class.bg-emerald-500]="subtaskProgress()!.completed === subtaskProgress()!.total"
                      [style.background]="subtaskProgress()!.completed !== subtaskProgress()!.total ? 'var(--primary)' : null"
                      [style.width.%]="(subtaskProgress()!.completed / subtaskProgress()!.total) * 100"
                    ></div>
                  </div>
                  <span
                    class="text-[11px] font-medium"
                    [class.text-emerald-600]="subtaskProgress()!.completed === subtaskProgress()!.total"
                    [class.text-gray-400]="subtaskProgress()!.completed !== subtaskProgress()!.total"
                  >
                    {{ subtaskProgress()!.completed }}/{{ subtaskProgress()!.total }}
                  </span>
                </div>
              }

              <!-- Comment Count -->
              @if (task().comment_count && task().comment_count! > 0 && cardFields().showComments) {
                <span
                  class="flex items-center gap-1 text-[11px] font-medium text-[var(--muted-foreground)]"
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
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                  {{ task().comment_count }}
                </span>
              }

              <!-- Attachment Count -->
              @if (task().attachment_count && task().attachment_count! > 0 && cardFields().showAttachments) {
                <span
                  class="flex items-center gap-1 text-[11px] font-medium text-[var(--muted-foreground)]"
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
                      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                    />
                  </svg>
                  {{ task().attachment_count }}
                </span>
              }
            </div>

            <!-- Assignees -->
            <div class="flex items-center">
              @if (task().assignees && task().assignees!.length > 0 && cardFields().showAssignees) {
                <div class="flex -space-x-2">
                  @for (
                    assignee of task().assignees!.slice(0, 3);
                    track assignee.id;
                    let i = $index
                  ) {
                    <div
                      class="assignee-avatar w-7 h-7 rounded-full ring-2 ring-[var(--card)] flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                      [title]="assignee.display_name"
                      [style.z-index]="3 - i"
                      [style.background]="
                        assignee.avatar_url
                          ? 'transparent'
                          : getAvatarGradient(i)
                      "
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
                  }
                  @if (task().assignees!.length > 3) {
                    <div
                      class="w-7 h-7 rounded-full ring-2 ring-[var(--card)] bg-[var(--secondary)] flex items-center justify-center text-[10px] font-bold text-[var(--muted-foreground)] shadow-sm"
                      [style.z-index]="0"
                    >
                      +{{ task().assignees!.length - 3 }}
                    </div>
                  }
                </div>
              }
            </div>
          </div>

          <!-- Days-in-Column Indicator -->
          @if (daysInColumn() > 0 && cardFields().showDaysInColumn) {
            <div class="flex items-center gap-0.5 mt-1.5">
              @for (d of dotsArray(); track $index) {
                <span class="w-1.5 h-1.5 rounded-full"
                  [class.bg-white]="daysInColumn() < 4"
                  [class.opacity-30]="daysInColumn() < 4"
                  [class.bg-amber-400]="daysInColumn() >= 4 && daysInColumn() < 8"
                  [class.bg-red-500]="daysInColumn() >= 8"
                ></span>
              }
              @if (daysInColumn() >= 8) {
                <span class="text-[10px] text-red-400 ml-0.5">{{ daysInColumn() }}d</span>
              }
            </div>
          }
        </div>
      }

      <!-- Drag Preview -->
      <div
        *cdkDragPreview
        class="drag-preview rounded-xl shadow-2xl p-4 w-64 border border-[var(--border)]"
      >
        <div class="flex items-center gap-2 mb-1">
          <span
            class="w-2 h-2 rounded-full"
            [style.background-color]="getBorderColor()"
          ></span>
          <span
            class="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]"
          >
            {{ priorityLabel }}
          </span>
        </div>
        <h4
          class="text-sm font-semibold text-[var(--card-foreground)] line-clamp-2 leading-snug"
        >
          {{ task().title }}
        </h4>
      </div>

      <!-- Drag Placeholder -->
      <div
        *cdkDragPlaceholder
        class="bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] rounded-lg border-2 border-dashed border-[color-mix(in_srgb,var(--primary)_30%,transparent)]"
        style="height: 80px"
      ></div>
    </div>
  `,
  styles: [
    `
      .line-clamp-1 {
        display: -webkit-box;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .line-clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .task-card {
        background: var(--card, #ffffff);
        box-shadow: 0 1px 0
          color-mix(in srgb, var(--foreground) 12%, transparent);
        transition: background 0.15s ease;
      }

      .task-card:hover {
        background: var(--muted);
      }

      /* CDK drag-drop transitions */
      :host {
        display: block;
      }

      :host.cdk-drag-animating {
        transition: transform 200ms cubic-bezier(0, 0, 0.2, 1);
      }

      .cdk-drop-list-dragging .task-card {
        transition: transform 200ms cubic-bezier(0, 0, 0.2, 1);
      }

      .task-card--urgent {
        background: linear-gradient(
          135deg,
          rgba(239, 68, 68, 0.03) 0%,
          var(--card, #ffffff) 60%
        );
      }

      .task-card--high {
        background: linear-gradient(
          135deg,
          rgba(249, 115, 22, 0.03) 0%,
          var(--card, #ffffff) 60%
        );
      }

      .task-card--medium {
        background: linear-gradient(
          135deg,
          rgba(234, 179, 8, 0.02) 0%,
          var(--card, #ffffff) 60%
        );
      }

      .task-card--low {
        background: linear-gradient(
          135deg,
          rgba(59, 130, 246, 0.02) 0%,
          var(--card, #ffffff) 60%
        );
      }

      .assignee-avatar {
        transition: transform 0.15s ease;
      }

      .task-card:hover .assignee-avatar {
        transform: translateX(0);
      }

      .drag-preview {
        background: color-mix(in srgb, var(--card) 92%, transparent);
        backdrop-filter: blur(12px) saturate(180%);
        -webkit-backdrop-filter: blur(12px) saturate(180%);
      }
    `,
  ],
})
export class TaskCardComponent {
  private readonly quickEditService = inject(CardQuickEditService, {
    optional: true,
  });

  task = input.required<Task>();
  isBlocked = input<boolean>(false);
  isCelebrating = input<boolean>(false);
  isFocused = input<boolean>(false);
  isSelected = input<boolean>(false);
  subtaskProgress = input<{ completed: number; total: number } | null>(null);
  hasRunningTimer = input<boolean>(false);
  columns = input<Column[]>([]);
  boardPrefix = input<string | null>(null);
  density = input<'compact' | 'normal' | 'expanded'>('normal');
  lockedBy = input<TaskLockInfo | null>(null);
  cardFields = input<CardFields>(DEFAULT_CARD_FIELDS);

  readonly daysInColumn = computed(() => {
    const entered = this.task().column_entered_at;
    if (!entered) return 0;
    return Math.floor((Date.now() - new Date(entered).getTime()) / 86_400_000);
  });

  readonly dotsArray = computed(() => Array(Math.min(this.daysInColumn(), 7)).fill(0));

  taskClicked = output<Task>();
  selectionToggled = output<string>();
  priorityChanged = output<{ taskId: string; priority: string }>();
  titleChanged = output<{ taskId: string; title: string }>();
  columnMoveRequested = output<{ taskId: string; columnId: string }>();
  duplicateRequested = output<string>();
  deleteRequested = output<string>();

  isEditingTitle = signal(false);
  editTitleValue = signal('');
  titleInput = viewChild<ElementRef>('titleInput');
  private isSaving = false;

  @ViewChild('cardMenu') cardMenu!: Menu;

  contextMenuItems: MenuItem[] = [];

  get priorityColors() {
    return getPriorityColor(this.task().priority);
  }

  get priorityLabel(): string {
    return getPriorityLabel(this.task().priority);
  }

  get dueDateColors(): { class: string; chipClass: string } {
    return getDueDateColor(this.task().due_date);
  }

  getBorderColor(): string {
    const colors: Record<string, string> = {
      urgent: '#ef4444',
      high: '#f97316',
      medium: '#eab308',
      low: '#3b82f6',
    };
    return colors[this.task().priority] || '#9ca3af';
  }

  getPriorityFlagColor(): string {
    return PRIORITY_FLAG_COLORS[this.task().priority] || '#9ca3af';
  }

  formatDueDate(date: string): string {
    const dueDate = new Date(date);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (isToday(date)) {
      return 'Today';
    }

    if (
      dueDate.getDate() === tomorrow.getDate() &&
      dueDate.getMonth() === tomorrow.getMonth() &&
      dueDate.getFullYear() === tomorrow.getFullYear()
    ) {
      return 'Tomorrow';
    }

    if (isOverdue(date)) {
      return 'Overdue';
    }

    return dueDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getOverflowLabelsTooltip(): string {
    const labels = this.task().labels;
    if (!labels || labels.length <= 2) return '';
    return labels.slice(2).map((l) => l.name).join(', ');
  }

  getAvatarGradient(index: number): string {
    const gradients = [
      'linear-gradient(135deg, #6366f1, #8b5cf6)',
      'linear-gradient(135deg, #3b82f6, #06b6d4)',
      'linear-gradient(135deg, #f59e0b, #ef4444)',
      'linear-gradient(135deg, #10b981, #14b8a6)',
    ];
    return gradients[index % gradients.length];
  }

  onCardClick(event: MouseEvent): void {
    // Only emit if not dragging
    if ((event.target as HTMLElement).closest('.cdk-drag-preview')) {
      return;
    }

    // Ctrl/Cmd+click for bulk selection
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      this.selectionToggled.emit(this.task().id);
      return;
    }

    this.taskClicked.emit(this.task());
  }

  onSelectToggle(event: Event): void {
    event.stopPropagation();
    this.selectionToggled.emit(this.task().id);
  }

  onRightClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.buildContextMenu();
    this.cardMenu.toggle(event);
  }

  onMenuToggle(event: Event): void {
    event.stopPropagation();
    this.buildContextMenu();
    this.cardMenu.toggle(event);
  }

  private readonly priorityOrder: string[] = [
    'low',
    'medium',
    'high',
    'urgent',
  ];

  openQuickEdit(event: Event, field: QuickEditField): void {
    if (!this.quickEditService) return;
    event.stopPropagation();
    this.quickEditService.open(event.currentTarget as HTMLElement, field, this.task());
  }

  onPriorityCycle(event: Event): void {
    event.stopPropagation();
    const currentPriority = this.task().priority;
    const currentIndex = this.priorityOrder.indexOf(currentPriority);
    const nextIndex = (currentIndex + 1) % this.priorityOrder.length;
    this.priorityChanged.emit({
      taskId: this.task().id,
      priority: this.priorityOrder[nextIndex],
    });
  }

  onTitleEditStart(event: MouseEvent): void {
    event.stopPropagation();
    this.isSaving = false;
    this.editTitleValue.set(this.task().title);
    this.isEditingTitle.set(true);
    setTimeout(() => {
      const el = this.titleInput()?.nativeElement as HTMLInputElement | undefined;
      el?.select();
    }, 0);
  }

  onTitleInput(event: Event): void {
    this.editTitleValue.set((event.target as HTMLInputElement).value);
  }

  onTitleSave(): void {
    if (this.isSaving) return;
    const newTitle = this.editTitleValue().trim();
    if (!newTitle) {
      this.onTitleCancel();
      return;
    }
    if (newTitle !== this.task().title) {
      this.isSaving = true;
      this.titleChanged.emit({ taskId: this.task().id, title: newTitle });
    }
    this.isEditingTitle.set(false);
  }

  onTitleCancel(): void {
    this.isSaving = false;
    this.isEditingTitle.set(false);
  }

  private buildContextMenu(): void {
    const priorities = [
      { label: 'Urgent', value: 'urgent', color: '#ef4444' },
      { label: 'High', value: 'high', color: '#f97316' },
      { label: 'Medium', value: 'medium', color: '#facc15' },
      { label: 'Low', value: 'low', color: '#60a5fa' },
    ];

    this.contextMenuItems = [
      {
        label: 'Set Priority',
        icon: 'pi pi-flag',
        items: priorities.map((p) => ({
          label: p.label,
          command: () =>
            this.priorityChanged.emit({
              taskId: this.task().id,
              priority: p.value,
            }),
        })),
      },
      {
        label: 'Move to Column',
        icon: 'pi pi-arrow-right',
        items: this.columns()
          .filter((col) => col.id !== this.task().column_id)
          .map((col) => ({
            label: col.name,
            command: () =>
              this.columnMoveRequested.emit({
                taskId: this.task().id,
                columnId: col.id,
              }),
          })),
      },
      {
        label: 'Duplicate',
        icon: 'pi pi-copy',
        command: () => this.duplicateRequested.emit(this.task().id),
      },
      {
        label: 'Copy Link',
        icon: 'pi pi-link',
        command: () => {
          const url = `${window.location.origin}/task/${this.task().id}`;
          navigator.clipboard.writeText(url);
        },
      },
      { separator: true },
      {
        label: 'Delete',
        icon: 'pi pi-trash',
        styleClass: 'text-red-500',
        command: () => this.deleteRequested.emit(this.task().id),
      },
    ];
  }
}
