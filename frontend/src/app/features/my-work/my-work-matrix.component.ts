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
} from '@angular/cdk/drag-drop';
import {
  EisenhowerService,
  EisenhowerTask,
  EisenhowerQuadrant,
  EisenhowerMatrixResponse,
} from '../../core/services/eisenhower.service';
import { UnifiedTaskCardComponent } from '../../shared/components/task-card/task-card.component';
import { TaskCardData } from '../../shared/components/task-card/task-card-data';

interface QuadrantConfig {
  key: EisenhowerQuadrant;
  title: string;
  subtitle: string;
  colorClass: string;
}

const QUADRANT_MAP: Record<EisenhowerQuadrant, { urgency: boolean; importance: boolean }> = {
  do_first: { urgency: true, importance: true },
  schedule: { urgency: false, importance: true },
  delegate: { urgency: true, importance: false },
  eliminate: { urgency: false, importance: false },
};

@Component({
  selector: 'app-my-work-matrix',
  standalone: true,
  imports: [CdkDropList, CdkDrag, UnifiedTaskCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        @for (i of [1, 2, 3, 4]; track i) {
          <div class="rounded-lg p-5" style="background: var(--card); border: 1px solid var(--border)">
            <div class="animate-pulse h-5 w-28 rounded mb-4" style="background: var(--muted)"></div>
            <div class="space-y-2">
              @for (j of [1, 2]; track j) {
                <div class="animate-pulse h-20 rounded" style="background: var(--muted)"></div>
              }
            </div>
          </div>
        }
      </div>
    } @else {
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        @for (q of quadrants; track q.key) {
          <div
            class="rounded-lg border-2 p-5 transition-all"
            [style.border-color]="quadrantBorderColor(q.key)"
            [style.background]="quadrantBgColor(q.key)"
          >
            <div class="mb-3 pb-3" style="border-bottom: 1px solid var(--border)">
              <h2 class="text-base font-semibold" style="color: var(--card-foreground)">{{ q.title }}</h2>
              <p class="text-xs mt-0.5" style="color: var(--muted-foreground)">{{ q.subtitle }}</p>
              <span class="text-xs font-medium mt-1 inline-block" style="color: var(--muted-foreground)">
                {{ tasksByQuadrant()[q.key].length }} tasks
              </span>
            </div>

            <div
              cdkDropList
              [id]="'matrix-' + q.key"
              [cdkDropListData]="tasksByQuadrant()[q.key]"
              [cdkDropListConnectedTo]="allDropListIds"
              (cdkDropListDropped)="onDrop($event, q.key)"
              (cdkDropListEntered)="dragOverQuadrant.set(q.key)"
              (cdkDropListExited)="dragOverQuadrant.set(null)"
              class="space-y-2 min-h-[3rem] max-h-80 overflow-y-auto"
              [class.drag-target-glow]="dragOverQuadrant() === q.key"
            >
              @for (task of tasksByQuadrant()[q.key]; track task.id) {
                <div cdkDrag cdkDragPreviewClass="cdk-drag-preview-matrix" class="cursor-grab active:cursor-grabbing">
                  <app-unified-task-card
                    [task]="toCard(task)"
                    [variant]="'board'"
                    [class.matrix-task-landed]="landedTaskId() === task.id"
                  />
                </div>
              } @empty {
                <div class="text-center py-6" style="color: var(--muted-foreground)">
                  <p class="text-sm">No tasks</p>
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
    .matrix-task-landed {
      animation: matrix-land 350ms cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes matrix-land {
      0% { transform: scale(0.95); opacity: 0.7; }
      50% { transform: scale(1.02); }
      100% { transform: scale(1); opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
      .matrix-task-landed { animation: none; }
    }
  `],
})
export class MyWorkMatrixComponent implements OnInit {
  private eisenhowerService = inject(EisenhowerService);

  readonly loading = signal(false);
  readonly matrix = signal<EisenhowerMatrixResponse | null>(null);
  readonly dragOverQuadrant = signal<EisenhowerQuadrant | null>(null);
  readonly landedTaskId = signal<string | null>(null);

  readonly allDropListIds = [
    'matrix-do_first', 'matrix-schedule', 'matrix-delegate', 'matrix-eliminate',
  ];

  readonly quadrants: QuadrantConfig[] = [
    { key: 'do_first', title: 'Do First', subtitle: 'Urgent & Important', colorClass: 'destructive' },
    { key: 'schedule', title: 'Schedule', subtitle: 'Not Urgent & Important', colorClass: 'warning' },
    { key: 'delegate', title: 'Delegate', subtitle: 'Urgent & Not Important', colorClass: 'primary' },
    { key: 'eliminate', title: 'Eliminate', subtitle: 'Not Urgent & Not Important', colorClass: 'muted' },
  ];

  readonly tasksByQuadrant = computed(() => {
    const m = this.matrix();
    return {
      do_first: m?.do_first ?? [],
      schedule: m?.schedule ?? [],
      delegate: m?.delegate ?? [],
      eliminate: m?.eliminate ?? [],
    };
  });

  ngOnInit() {
    this.loadMatrix();
  }

  quadrantBorderColor(key: EisenhowerQuadrant): string {
    const map: Record<EisenhowerQuadrant, string> = {
      do_first: 'color-mix(in srgb, var(--destructive) 30%, var(--border))',
      schedule: 'color-mix(in srgb, var(--warning, #eab308) 30%, var(--border))',
      delegate: 'color-mix(in srgb, var(--primary) 30%, var(--border))',
      eliminate: 'var(--border)',
    };
    return map[key];
  }

  quadrantBgColor(key: EisenhowerQuadrant): string {
    const map: Record<EisenhowerQuadrant, string> = {
      do_first: 'color-mix(in srgb, var(--destructive) 6%, var(--card))',
      schedule: 'color-mix(in srgb, var(--warning, #eab308) 6%, var(--card))',
      delegate: 'color-mix(in srgb, var(--primary) 6%, var(--card))',
      eliminate: 'var(--muted)',
    };
    return map[key];
  }

  toCard(task: EisenhowerTask): TaskCardData {
    return {
      id: task.id,
      title: task.title,
      priority: (task.priority as TaskCardData['priority']) || 'none',
      due_date: task.due_date,
      status: task.column_name,
      project_name: task.board_name,
      assignee: task.assignees?.[0]
        ? { id: task.assignees[0].id, name: task.assignees[0].display_name }
        : null,
    };
  }

  onDrop(event: CdkDragDrop<EisenhowerTask[]>, targetQuadrant: EisenhowerQuadrant) {
    this.dragOverQuadrant.set(null);

    if (event.previousContainer === event.container) return;

    const task = event.previousContainer.data[event.previousIndex];
    const currentMatrix = this.matrix();
    if (!currentMatrix) return;

    const sourceId = event.previousContainer.id.replace('matrix-', '') as EisenhowerQuadrant;
    const updated = { ...currentMatrix };
    const sourceList = [...updated[sourceId]];
    const targetList = [...updated[targetQuadrant]];

    transferArrayItem(sourceList, targetList, event.previousIndex, event.currentIndex);

    updated[sourceId] = sourceList;
    updated[targetQuadrant] = targetList;
    this.matrix.set(updated);

    this.landedTaskId.set(task.id);
    setTimeout(() => this.landedTaskId.set(null), 400);

    const { urgency, importance } = QUADRANT_MAP[targetQuadrant];
    this.eisenhowerService.updateTaskOverride(task.id, urgency, importance).subscribe({
      error: () => this.matrix.set(currentMatrix),
    });
  }

  private async loadMatrix() {
    this.loading.set(true);
    try {
      const result = await firstValueFrom(this.eisenhowerService.getMatrix());
      this.matrix.set(result ?? null);
    } catch {
      // empty state
    } finally {
      this.loading.set(false);
    }
  }
}
