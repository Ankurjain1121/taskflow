import {
  Component,
  computed,
  input,
  output,
  signal,
  ViewChild,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  CdkDrag,
  CdkDragPreview,
  CdkDragPlaceholder,
} from '@angular/cdk/drag-drop';
import { TieredMenu } from 'primeng/tieredmenu';
import { MenuItem } from 'primeng/api';
import { Tooltip } from 'primeng/tooltip';
import { Task } from '../../../core/services/task.service';
import { Column } from '../../../core/services/project.service';
import {
  CardFields,
  DEFAULT_CARD_FIELDS,
} from '../project-view/project-state.service';
import { TaskLockInfo } from '../../../core/services/presence.service';
import {
  CardQuickEditService,
  QuickEditField,
} from '../project-view/card-quick-edit/card-quick-edit.service';
import { PriorityBadgeComponent } from '../../../shared/components/priority-badge/priority-badge.component';
import {
  getPriorityColor,
  getPriorityLabel,
} from '../../../shared/utils/task-colors';
import {
  getBorderColor,
  getPriorityFlagColor,
  formatDueDate,
  getAvatarGradient,
  getInitials,
  getDueDateColors,
  getOverflowLabelsTooltip,
} from './task-card-colors.utils';
import { buildContextMenu } from './task-card-context-menu.utils';
import { TaskCardTitleEditComponent } from './task-card-title-edit.component';

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [
    CommonModule,
    CdkDrag,
    CdkDragPreview,
    CdkDragPlaceholder,
    TieredMenu,
    Tooltip,
    PriorityBadgeComponent,
    TaskCardTitleEditComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './task-card.component.html',
  styleUrl: './task-card.component.css',
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
  statusTransitions = input<Record<string, string[] | null>>({});
  boardPrefix = input<string | null>(null);
  density = input<'compact' | 'normal' | 'expanded'>('normal');
  lockedBy = input<TaskLockInfo | null>(null);
  cardFields = input<CardFields>(DEFAULT_CARD_FIELDS);
  stripeColor = input<string | null>(null);

  readonly daysInColumn = computed(() => 0);

  readonly dotsArray = computed(() =>
    Array(Math.min(this.daysInColumn(), 7)).fill(0),
  );

  taskClicked = output<Task>();
  selectionToggled = output<string>();
  priorityChanged = output<{ taskId: string; priority: string }>();
  titleChanged = output<{ taskId: string; title: string }>();
  columnMoveRequested = output<{ taskId: string; columnId: string }>();
  moveToProjectRequested = output<string>();
  duplicateRequested = output<string>();
  deleteRequested = output<string>();

  isEditingTitle = signal(false);

  @ViewChild('cardMenu') cardMenu!: TieredMenu;

  contextMenuItems: MenuItem[] = [];

  private readonly priorityOrder: string[] = [
    'low',
    'medium',
    'high',
    'urgent',
  ];

  get priorityColors() {
    return getPriorityColor(this.task().priority);
  }

  get priorityLabel(): string {
    return getPriorityLabel(this.task().priority);
  }

  get dueDateColors(): { class: string; chipClass: string } {
    return getDueDateColors(this.task().due_date);
  }

  getBorderColor(): string {
    return getBorderColor(this.task().priority);
  }

  getPriorityFlagColor(): string {
    return getPriorityFlagColor(this.task().priority);
  }

  formatDueDate(date: string): string {
    return formatDueDate(date);
  }

  getInitials(name: string): string {
    return getInitials(name);
  }

  getOverflowLabelsTooltip(): string {
    return getOverflowLabelsTooltip(this.task().labels);
  }

  getAvatarGradient(index: number): string {
    return getAvatarGradient(index);
  }

  onCardClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('.cdk-drag-preview')) {
      return;
    }

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
    this.rebuildContextMenu();
    this.cardMenu.toggle(event);
  }

  onMenuToggle(event: Event): void {
    event.stopPropagation();
    this.rebuildContextMenu();
    this.cardMenu.toggle(event);
  }

  openQuickEdit(event: Event, field: QuickEditField): void {
    if (!this.quickEditService) return;
    event.stopPropagation();
    this.quickEditService.open(
      event.currentTarget as HTMLElement,
      field,
      this.task(),
    );
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

  onTitleEditStart(): void {
    this.isEditingTitle.set(true);
  }

  onTitleEditEnd(): void {
    this.isEditingTitle.set(false);
  }

  onTitleChanged(event: { taskId: string; title: string }): void {
    this.titleChanged.emit(event);
  }

  private rebuildContextMenu(): void {
    this.contextMenuItems = buildContextMenu(
      this.task(),
      this.columns(),
      this.statusTransitions(),
      {
        onPriorityChanged: (taskId, priority) =>
          this.priorityChanged.emit({ taskId, priority }),
        onColumnMoveRequested: (taskId, columnId) =>
          this.columnMoveRequested.emit({ taskId, columnId }),
        onMoveToProjectRequested: (taskId) =>
          this.moveToProjectRequested.emit(taskId),
        onDuplicateRequested: (taskId) =>
          this.duplicateRequested.emit(taskId),
        onDeleteRequested: (taskId) =>
          this.deleteRequested.emit(taskId),
      },
    );
  }
}
