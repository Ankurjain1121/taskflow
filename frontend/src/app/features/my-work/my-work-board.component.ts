import {
  Component,
  signal,
  computed,
  inject,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  CdkDropList,
  CdkDrag,
  CdkDragDrop,
  transferArrayItem,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { Router } from '@angular/router';
import {
  MyWorkBoardService,
  PersonalBoardItem,
  PersonalBoardResponse,
} from '../../core/services/my-work-board.service';
import { UnifiedTaskCardComponent } from '../../shared/components/task-card/task-card.component';
import { TaskCardData } from '../../shared/components/task-card/task-card-data';

type BoardColumn = 'backlog' | 'today' | 'in_progress' | 'done';

interface ColumnConfig {
  key: BoardColumn;
  title: string;
  color: string;
}

@Component({
  selector: 'app-my-work-board',
  standalone: true,
  imports: [CdkDropList, CdkDrag, UnifiedTaskCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        @for (i of [1, 2, 3, 4]; track i) {
          <div class="rounded-lg p-4" style="background: var(--card); border: 1px solid var(--border)">
            <div class="animate-pulse h-5 w-20 rounded mb-4" style="background: var(--muted)"></div>
            <div class="space-y-2">
              @for (j of [1, 2, 3]; track j) {
                <div class="animate-pulse h-20 rounded" style="background: var(--muted)"></div>
              }
            </div>
          </div>
        }
      </div>
    } @else {
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        @for (col of columns; track col.key) {
          <div class="rounded-lg min-h-[12rem]" style="background: var(--card); border: 1px solid var(--border)">
            <!-- Column header -->
            <div class="px-4 py-3 flex items-center gap-2" style="border-bottom: 1px solid var(--border)">
              <span class="w-2 h-2 rounded-full flex-shrink-0" [style.background]="col.color"></span>
              <h3 class="text-sm font-semibold" style="color: var(--foreground)">{{ col.title }}</h3>
              <span
                class="ml-auto text-xs font-medium px-1.5 py-0.5 rounded-full"
                style="background: var(--muted); color: var(--muted-foreground)"
              >{{ columnTasks()[col.key].length }}</span>
            </div>

            <!-- Drop zone -->
            <div
              cdkDropList
              [id]="'board-' + col.key"
              [cdkDropListData]="columnTasks()[col.key]"
              [cdkDropListConnectedTo]="allDropListIds"
              (cdkDropListDropped)="onDrop($event, col.key)"
              (cdkDropListEntered)="dragOverColumn.set(col.key)"
              (cdkDropListExited)="dragOverColumn.set(null)"
              class="p-3 space-y-2 min-h-[6rem] max-h-[calc(100vh-20rem)] overflow-y-auto"
              [class.drag-target-glow]="dragOverColumn() === col.key"
            >
              @for (item of columnTasks()[col.key]; track item.task_id) {
                <div cdkDrag cdkDragPreviewClass="cdk-drag-preview-board" class="cursor-grab active:cursor-grabbing">
                  <app-unified-task-card
                    [task]="toCard(item)"
                    [variant]="'board'"
                    [class.board-task-landed]="landedTaskId() === item.task_id"
                    (clicked)="onTaskClick($event)"
                  />
                </div>
              } @empty {
                <div class="text-center py-8" style="color: var(--muted-foreground)">
                  <p class="text-xs">Drop tasks here</p>
                </div>
              }
            </div>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .board-task-landed {
      animation: board-land 350ms cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes board-land {
      0% { transform: scale(0.95); opacity: 0.7; }
      50% { transform: scale(1.02); }
      100% { transform: scale(1); opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
      .board-task-landed { animation: none; }
    }
  `],
})
export class MyWorkBoardComponent implements OnInit {
  private boardService = inject(MyWorkBoardService);
  private router = inject(Router);

  readonly loading = signal(false);
  readonly board = signal<PersonalBoardResponse | null>(null);
  readonly dragOverColumn = signal<BoardColumn | null>(null);
  readonly landedTaskId = signal<string | null>(null);

  readonly allDropListIds = ['board-backlog', 'board-today', 'board-in_progress', 'board-done'];

  readonly columns: ColumnConfig[] = [
    { key: 'backlog', title: 'Backlog', color: 'var(--muted-foreground)' },
    { key: 'today', title: 'Today', color: 'var(--status-blue-text, #3b82f6)' },
    { key: 'in_progress', title: 'In Progress', color: 'var(--status-amber-text, #f59e0b)' },
    { key: 'done', title: 'Done', color: 'var(--success, #22c55e)' },
  ];

  readonly columnTasks = computed(() => {
    const b = this.board();
    return {
      backlog: b?.backlog ?? [],
      today: b?.today ?? [],
      in_progress: b?.in_progress ?? [],
      done: b?.done ?? [],
    };
  });

  ngOnInit() {
    this.loadBoard();
  }

  onTaskClick(taskId: string): void {
    this.router.navigate(['/task', taskId]);
  }

  toCard(item: PersonalBoardItem): TaskCardData {
    return {
      id: item.task_id,
      title: item.task_title,
      priority: item.task_priority || 'none',
      due_date: item.task_due_date,
      status: item.status_name,
      project_name: item.project_name,
    };
  }

  onDrop(event: CdkDragDrop<PersonalBoardItem[]>, targetColumn: BoardColumn) {
    this.dragOverColumn.set(null);

    const currentBoard = this.board();
    if (!currentBoard) return;

    const updated = { ...currentBoard };
    const sameContainer = event.previousContainer === event.container;

    if (sameContainer) {
      const list = [...updated[targetColumn]];
      moveItemInArray(list, event.previousIndex, event.currentIndex);
      updated[targetColumn] = list;
      this.board.set(updated);

      const movedItem = list[event.currentIndex];
      this.boardService.moveTask(movedItem.task_id, targetColumn, event.currentIndex).subscribe({
        error: () => this.board.set(currentBoard),
      });
      return;
    }

    const sourceColumn = event.previousContainer.id.replace('board-', '') as BoardColumn;
    const sourceList = [...updated[sourceColumn]];
    const targetList = [...updated[targetColumn]];

    transferArrayItem(sourceList, targetList, event.previousIndex, event.currentIndex);

    updated[sourceColumn] = sourceList;
    updated[targetColumn] = targetList;
    this.board.set(updated);

    const movedItem = targetList[event.currentIndex];
    this.landedTaskId.set(movedItem.task_id);
    setTimeout(() => this.landedTaskId.set(null), 400);

    this.boardService.moveTask(movedItem.task_id, targetColumn, event.currentIndex).subscribe({
      error: () => this.board.set(currentBoard),
    });
  }

  private async loadBoard() {
    this.loading.set(true);
    try {
      const result = await firstValueFrom(this.boardService.getBoard());
      this.board.set(result ?? null);
    } catch {
      // empty state
    } finally {
      this.loading.set(false);
    }
  }
}
