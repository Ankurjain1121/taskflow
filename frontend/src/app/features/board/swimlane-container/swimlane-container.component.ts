import {
  Component,
  input,
  output,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDropListGroup } from '@angular/cdk/drag-drop';
import { Task } from '../../../core/services/task.service';
import { Column } from '../../../core/services/board.service';
import {
  SwimlaneGroup,
  SwimlaneState,
  SwimlaneTaskMoveEvent,
  GroupByMode,
} from '../board-view/swimlane.types';
import { SwimlaneRowComponent } from '../swimlane-row/swimlane-row.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import {
  CardFields,
  DEFAULT_CARD_FIELDS,
} from '../board-view/board-state.service';
import { makeCellId } from '../board-view/swimlane-utils';

@Component({
  selector: 'app-swimlane-container',
  standalone: true,
  imports: [
    CommonModule,
    CdkDropListGroup,
    SwimlaneRowComponent,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div cdkDropListGroup class="flex flex-col min-h-full">
      <!-- Sticky Column Header Row -->
      <div
        class="flex min-w-max sticky top-0 z-20 bg-[var(--card)] border-b-2 border-[var(--border)]"
      >
        <!-- Label column spacer -->
        <div
          class="w-40 flex-shrink-0 border-r border-[var(--border)] px-2 py-2"
        >
          <span
            class="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide"
          >
            {{ groupByLabel() }}
          </span>
        </div>
        <!-- Column headers -->
        @for (col of columns(); track col.id) {
          <div
            class="w-[272px] flex-shrink-0 border-r border-[var(--border)] px-3 py-2 flex items-center gap-2"
          >
            @if (col.icon) {
              <span class="text-sm leading-none">{{ col.icon }}</span>
            }
            <span class="text-sm font-medium text-[var(--foreground)]">{{
              col.name
            }}</span>
            <span
              class="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-[var(--secondary)] text-[var(--foreground)]"
            >
              {{ columnTaskCount(col.id) }}
            </span>
          </div>
        }
      </div>

      <!-- Swimlane Rows -->
      @for (group of swimlaneGroups(); track group.key) {
        <app-swimlane-row
          [swimlaneGroup]="group"
          [columns]="columns()"
          [tasksPerColumn]="swimlaneState()[group.key] ?? {}"
          [connectedListIds]="allCellIds()"
          [celebratingTaskId]="celebratingTaskId()"
          [focusedTaskId]="focusedTaskId()"
          [selectedTaskIds]="selectedTaskIds()"
          [allColumns]="allColumns()"
          [boardPrefix]="boardPrefix()"
          [density]="density()"
          [cardFields]="cardFields()"
          [groupBy]="groupBy()"
          (taskMoved)="taskMoved.emit($event)"
          (taskClicked)="taskClicked.emit($event)"
          (addTaskClicked)="addTaskClicked.emit($event)"
          (selectionToggled)="selectionToggled.emit($event)"
          (priorityChanged)="priorityChanged.emit($event)"
          (titleChanged)="titleChanged.emit($event)"
          (columnMoveRequested)="columnMoveRequested.emit($event)"
          (duplicateRequested)="duplicateRequested.emit($event)"
          (deleteRequested)="deleteRequested.emit($event)"
          (collapseChanged)="swimlaneToggled.emit($event)"
        />
      }

      <!-- Empty state -->
      @if (swimlaneGroups().length === 0) {
        <app-empty-state
          variant="column"
          size="compact"
          title="No tasks to group"
          description="Create tasks or adjust your group-by setting."
        />
      }
    </div>
  `,
})
export class SwimlaneContainerComponent {
  swimlaneGroups = input.required<SwimlaneGroup[]>();
  swimlaneState = input.required<SwimlaneState>();
  columns = input.required<Column[]>();
  boardPrefix = input<string | null>(null);
  density = input<'compact' | 'normal' | 'expanded'>('normal');
  cardFields = input<CardFields>(DEFAULT_CARD_FIELDS);
  celebratingTaskId = input<string | null>(null);
  focusedTaskId = input<string | null>(null);
  selectedTaskIds = input<string[]>([]);
  allColumns = input<Column[]>([]);
  groupBy = input<GroupByMode>('none');
  collapsedSwimlaneIds = input<Set<string>>(new Set());

  taskMoved = output<SwimlaneTaskMoveEvent>();
  taskClicked = output<Task>();
  addTaskClicked = output<string>();
  selectionToggled = output<string>();
  priorityChanged = output<{ taskId: string; priority: string }>();
  titleChanged = output<{ taskId: string; title: string }>();
  columnMoveRequested = output<{ taskId: string; columnId: string }>();
  duplicateRequested = output<string>();
  deleteRequested = output<string>();
  swimlaneToggled = output<string>();

  /** All cell IDs across every group × every column — enables cross-row DnD */
  readonly allCellIds = computed(() => {
    const groups = this.swimlaneGroups();
    const cols = this.columns();
    return groups.flatMap((g) => cols.map((col) => makeCellId(col.id, g.key)));
  });

  /** Total tasks in each column across all swimlane rows */
  readonly columnTaskCount = (colId: string): number => {
    const state = this.swimlaneState();
    return Object.values(state).reduce(
      (sum, colMap) => sum + (colMap[colId]?.length ?? 0),
      0,
    );
  };

  readonly groupByLabel = computed(() => {
    const map: Record<GroupByMode, string> = {
      none: '',
      assignee: 'Assignee',
      priority: 'Priority',
      label: 'Label',
    };
    return map[this.groupBy()];
  });
}
