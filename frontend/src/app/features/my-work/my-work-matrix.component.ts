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
import { Router } from '@angular/router';
import {
  EisenhowerService,
  EisenhowerTask,
  EisenhowerQuadrant,
  EisenhowerMatrixResponse,
} from '../../core/services/eisenhower.service';

interface QuadrantConfig {
  key: EisenhowerQuadrant;
  title: string;
  subtitle: string;
  icon: string;
  accentVar: string;
  emptyHint: string;
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
  imports: [CdkDropList, CdkDrag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <div class="matrix-shell">
        <div class="matrix-grid">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="quadrant-skeleton">
              <div class="animate-pulse h-4 w-24 rounded" style="background: var(--muted)"></div>
              <div class="animate-pulse h-8 rounded mt-3" style="background: var(--muted)"></div>
              <div class="animate-pulse h-8 rounded mt-2" style="background: var(--muted)"></div>
            </div>
          }
        </div>
      </div>
    } @else {
      <div class="matrix-shell">
        <!-- Y-axis label -->
        <div class="y-axis-label">
          <span class="axis-label-text">IMPORTANT</span>
        </div>

        <div class="matrix-body">
          <!-- X-axis labels (top) -->
          <div class="x-axis-row">
            <div class="x-axis-cell">
              <span class="axis-label-text">URGENT</span>
            </div>
            <div class="x-axis-cell">
              <span class="axis-label-text">NOT URGENT</span>
            </div>
          </div>

          <!-- Matrix grid -->
          <div class="matrix-grid">
            @for (q of quadrants; track q.key) {
              <div
                class="quadrant"
                [attr.data-quadrant]="q.key"
                [class.drag-over]="dragOverQuadrant() === q.key"
              >
                <!-- Quadrant header -->
                <div class="quadrant-header">
                  <div class="quadrant-header-left">
                    <i [class]="'pi ' + q.icon + ' quadrant-icon'" [style.color]="'var(' + q.accentVar + ')'"></i>
                    <div>
                      <h3 class="quadrant-title">{{ q.title }}</h3>
                      <p class="quadrant-subtitle">{{ q.subtitle }}</p>
                    </div>
                  </div>
                  <span class="quadrant-count" [style.background]="'color-mix(in srgb, var(' + q.accentVar + ') 12%, transparent)'" [style.color]="'var(' + q.accentVar + ')'">
                    {{ tasksByQuadrant()[q.key].length }}
                  </span>
                </div>

                <!-- Task list -->
                <div
                  cdkDropList
                  [id]="'matrix-' + q.key"
                  [cdkDropListData]="tasksByQuadrant()[q.key]"
                  [cdkDropListConnectedTo]="allDropListIds"
                  (cdkDropListDropped)="onDrop($event, q.key)"
                  (cdkDropListEntered)="dragOverQuadrant.set(q.key)"
                  (cdkDropListExited)="dragOverQuadrant.set(null)"
                  class="quadrant-tasks"
                >
                  @for (task of tasksByQuadrant()[q.key]; track task.id) {
                    <div
                      cdkDrag
                      cdkDragPreviewClass="cdk-drag-preview-matrix"
                      class="task-row cursor-grab active:cursor-grabbing"
                      [class.task-landed]="landedTaskId() === task.id"
                      (click)="onTaskClick(task.id)"
                    >
                      <div class="task-row-accent" [style.background]="'var(' + q.accentVar + ')'"></div>
                      <div class="task-row-body">
                        <div class="task-row-main">
                          <span class="task-row-title">{{ task.title }}</span>
                          @if (task.assignees?.[0]) {
                            <span class="task-row-avatar" [title]="task.assignees[0].display_name">
                              {{ task.assignees[0].display_name.charAt(0).toUpperCase() }}
                            </span>
                          }
                        </div>
                        <div class="task-row-meta">
                          @if (task.board_name) {
                            <span class="task-row-project">{{ task.board_name }}</span>
                          }
                          @if (task.priority && task.priority !== 'none') {
                            <span class="task-row-priority" [attr.data-priority]="task.priority">
                              {{ task.priority }}
                            </span>
                          }
                          @if (formatDue(task.due_date); as due) {
                            <span class="task-row-due" [class.overdue]="isDueOverdue(task.due_date)">
                              <i class="pi pi-calendar text-[9px]"></i>
                              {{ due }}
                            </span>
                          }
                        </div>
                      </div>
                    </div>
                  } @empty {
                    <div class="quadrant-empty">
                      <p>{{ q.emptyHint }}</p>
                    </div>
                  }
                </div>
              </div>
            }
          </div>

          <!-- X-axis labels (bottom — Not Important side) -->
          <div class="x-axis-row bottom">
            <div class="x-axis-cell">
              <span class="axis-label-text axis-label-muted">URGENT</span>
            </div>
            <div class="x-axis-cell">
              <span class="axis-label-text axis-label-muted">NOT URGENT</span>
            </div>
          </div>
        </div>

        <!-- Y-axis label (right side — Not Important) -->
        <div class="y-axis-label right">
          <span class="axis-label-text axis-label-muted">NOT IMPORTANT</span>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }

    .matrix-shell {
      display: flex;
      align-items: stretch;
      gap: 0;
      min-height: 0;
      /* Fit all 4 quadrants in the viewport below the header/tabs area */
      height: calc(100vh - 240px);
      max-height: calc(100vh - 240px);
    }

    @media (max-width: 1023px) {
      .matrix-shell {
        height: auto;
        max-height: none;
      }
    }

    /* Y-axis labels (rotated text on left/right) */
    .y-axis-label {
      display: none;
      writing-mode: vertical-lr;
      align-items: center;
      justify-content: center;
      padding: 0 6px;
    }
    .y-axis-label.right { transform: rotate(180deg); }

    @media (min-width: 1024px) {
      .y-axis-label { display: flex; }
    }

    .axis-label-text {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.12em;
      color: var(--muted-foreground);
      opacity: 0.6;
      text-transform: uppercase;
      user-select: none;
    }
    .axis-label-muted { opacity: 0.35; }

    .matrix-body {
      flex: 1;
      min-width: 0;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    /* X-axis labels (horizontal across top/bottom) */
    .x-axis-row {
      display: none;
      padding: 0 0 6px;
    }
    .x-axis-row.bottom {
      padding: 6px 0 0;
    }

    @media (min-width: 1024px) {
      .x-axis-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
    }

    .x-axis-cell {
      display: flex;
      justify-content: center;
    }

    /* Matrix 2x2 grid */
    .matrix-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
      flex: 1;
      min-height: 0;
    }

    @media (min-width: 1024px) {
      .matrix-grid {
        grid-template-columns: 1fr 1fr;
        grid-template-rows: 1fr 1fr;
        min-height: 0;
      }
    }

    /* Individual quadrant */
    .quadrant {
      display: flex;
      flex-direction: column;
      border-radius: 10px;
      background: var(--card);
      border: 1px solid var(--border);
      overflow: hidden;
      min-height: 160px;
      transition: border-color 200ms ease, box-shadow 200ms ease;
    }

    @media (min-width: 1024px) {
      .quadrant {
        min-height: 0;
        overflow: hidden;
      }
    }

    .quadrant.drag-over {
      border-color: var(--primary);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 20%, transparent);
    }

    /* Quadrant-specific top accent stripe */
    .quadrant[data-quadrant="do_first"] { border-top: 3px solid var(--destructive); }
    .quadrant[data-quadrant="schedule"] { border-top: 3px solid var(--warning, #d97706); }
    .quadrant[data-quadrant="delegate"] { border-top: 3px solid var(--primary); }
    .quadrant[data-quadrant="eliminate"] { border-top: 3px solid var(--muted-foreground); }

    /* Quadrant header */
    .quadrant-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }

    .quadrant-header-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .quadrant-icon {
      font-size: 14px;
      flex-shrink: 0;
    }

    .quadrant-title {
      font-size: 13px;
      font-weight: 650;
      color: var(--card-foreground);
      line-height: 1.2;
    }

    .quadrant-subtitle {
      font-size: 10px;
      color: var(--muted-foreground);
      margin-top: 1px;
    }

    .quadrant-count {
      font-size: 11px;
      font-weight: 700;
      min-width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      flex-shrink: 0;
      font-variant-numeric: tabular-nums;
    }

    /* Task list area */
    .quadrant-tasks {
      flex: 1;
      overflow-y: auto;
      padding: 6px;
      min-height: 40px;
    }

    /* Compact task row */
    .task-row {
      display: flex;
      align-items: stretch;
      border-radius: 6px;
      background: var(--background);
      margin-bottom: 4px;
      overflow: hidden;
      transition: background 150ms ease, transform 150ms ease;
      cursor: pointer;
    }

    .task-row:hover {
      background: color-mix(in srgb, var(--foreground) 4%, var(--background));
    }

    .task-row:active {
      transform: scale(0.985);
    }

    .task-row-accent {
      width: 3px;
      flex-shrink: 0;
      border-radius: 3px 0 0 3px;
    }

    .task-row-body {
      flex: 1;
      min-width: 0;
      padding: 6px 10px;
    }

    .task-row-main {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .task-row-title {
      font-size: 12.5px;
      font-weight: 500;
      color: var(--card-foreground);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
      min-width: 0;
    }

    .task-row-avatar {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      font-weight: 700;
      flex-shrink: 0;
      background: color-mix(in srgb, var(--primary) 12%, var(--card));
      color: var(--primary);
    }

    .task-row-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 2px;
      flex-wrap: wrap;
    }

    .task-row-project {
      font-size: 10px;
      color: var(--muted-foreground);
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .task-row-priority {
      font-size: 9px;
      font-weight: 650;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 1px 5px;
      border-radius: 3px;
      line-height: 1.4;
    }

    .task-row-priority[data-priority="urgent"] {
      background: color-mix(in srgb, var(--destructive) 14%, transparent);
      color: var(--destructive);
    }
    .task-row-priority[data-priority="high"] {
      background: color-mix(in srgb, var(--warning, #d97706) 14%, transparent);
      color: var(--warning, #d97706);
    }
    .task-row-priority[data-priority="medium"] {
      background: color-mix(in srgb, var(--primary) 10%, transparent);
      color: var(--primary);
    }
    .task-row-priority[data-priority="low"] {
      background: var(--muted);
      color: var(--muted-foreground);
    }

    .task-row-due {
      font-size: 10px;
      color: var(--muted-foreground);
      display: flex;
      align-items: center;
      gap: 3px;
    }
    .task-row-due.overdue { color: var(--destructive); }

    /* Empty state */
    .quadrant-empty {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      min-height: 48px;
      padding: 12px;
    }
    .quadrant-empty p {
      font-size: 11px;
      color: var(--muted-foreground);
      text-align: center;
      opacity: 0.7;
    }

    /* Skeleton loading */
    .quadrant-skeleton {
      border-radius: 10px;
      background: var(--card);
      border: 1px solid var(--border);
      padding: 14px;
    }

    /* Landing animation */
    .task-landed {
      animation: matrix-land 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes matrix-land {
      0% { transform: scale(0.96); opacity: 0.7; }
      50% { transform: scale(1.015); }
      100% { transform: scale(1); opacity: 1; }
    }

    /* CDK drag placeholder */
    .cdk-drag-placeholder {
      background: color-mix(in srgb, var(--primary) 6%, var(--background));
      border: 1.5px dashed var(--border);
      border-radius: 6px;
      min-height: 36px;
      margin-bottom: 4px;
    }

    @media (prefers-reduced-motion: reduce) {
      .task-landed { animation: none; }
      .task-row { transition: none; }
    }
  `],
})
export class MyWorkMatrixComponent implements OnInit {
  private eisenhowerService = inject(EisenhowerService);
  private router = inject(Router);

  readonly loading = signal(false);
  readonly matrix = signal<EisenhowerMatrixResponse | null>(null);
  readonly dragOverQuadrant = signal<EisenhowerQuadrant | null>(null);
  readonly landedTaskId = signal<string | null>(null);

  readonly allDropListIds = [
    'matrix-do_first', 'matrix-schedule', 'matrix-delegate', 'matrix-eliminate',
  ];

  readonly quadrants: QuadrantConfig[] = [
    {
      key: 'do_first', title: 'Do First', subtitle: 'Urgent & Important',
      icon: 'pi-bolt', accentVar: '--destructive',
      emptyHint: 'No fires to put out',
    },
    {
      key: 'schedule', title: 'Schedule', subtitle: 'Not Urgent & Important',
      icon: 'pi-calendar', accentVar: '--warning, #d97706',
      emptyHint: 'Plan something meaningful',
    },
    {
      key: 'delegate', title: 'Delegate', subtitle: 'Urgent & Not Important',
      icon: 'pi-users', accentVar: '--primary',
      emptyHint: 'Nothing to hand off',
    },
    {
      key: 'eliminate', title: 'Eliminate', subtitle: 'Not Urgent & Not Important',
      icon: 'pi-trash', accentVar: '--muted-foreground',
      emptyHint: 'A clean conscience',
    },
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

  onTaskClick(taskId: string): void {
    this.router.navigate(['/task', taskId]);
  }

  formatDue(due: string | null | undefined): string {
    if (!due) return '';
    const dueDate = new Date(due);
    const now = new Date();
    const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / 86400000);
    if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays <= 7) return `In ${diffDays}d`;
    return dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  isDueOverdue(due: string | null | undefined): boolean {
    if (!due) return false;
    return new Date(due).getTime() < Date.now();
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
    setTimeout(() => this.landedTaskId.set(null), 350);

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
