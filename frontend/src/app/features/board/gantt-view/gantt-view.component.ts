import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  inject,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CHART_PRIORITY_COLORS } from '../../../shared/utils/svg-charts';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { TaskService } from '../../../core/services/task.service';

export interface GanttTask {
  id: string;
  title: string;
  priority: string;
  start_date: string | null;
  due_date: string | null;
  column_id: string;
  column_name: string;
  is_done: boolean;
  milestone_id: string | null;
}

export interface GanttDependency {
  id: string;
  source_task_id: string;
  target_task_id: string;
  dependency_type: string;
}

interface GanttBar {
  task: GanttTask;
  x: number;
  width: number;
  y: number;
  color: string;
}

interface GanttArrow {
  path: string;
}

type ZoomLevel = 'day' | 'week' | 'month';

interface DragState {
  taskId: string;
  originalX: number;
  currentX: number;
  y: number;
  width: number;
  startMouseX: number;
  bar: GanttBar;
}

@Component({
  selector: 'app-gantt-view',
  standalone: true,
  imports: [CommonModule, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col h-full bg-[var(--card)]">
      <!-- Header -->
      <div
        class="flex items-center justify-between px-6 py-3 border-b border-[var(--border)]"
      >
        <h2 class="text-lg font-semibold text-[var(--card-foreground)]">
          Gantt Chart
        </h2>
        <div class="flex items-center gap-2">
          <span class="text-xs text-[var(--muted-foreground)]">Zoom:</span>
          <div
            class="flex rounded-lg border border-[var(--border)] overflow-hidden"
          >
            @for (level of zoomLevels; track level) {
              <button
                (click)="zoom.set(level)"
                class="px-3 py-1 text-xs font-medium transition-colors capitalize"
                [class.bg-primary]="zoom() === level"
                [class.text-white]="zoom() === level"
                [class.text-[var(--muted-foreground)]]="zoom() !== level"
                [class.hover:bg-[var(--muted)]]="zoom() !== level"
              >
                {{ level }}
              </button>
            }
          </div>
        </div>
      </div>

      @if (tasks().length === 0) {
        <app-empty-state
          variant="generic"
          title="No tasks with dates"
          description="Set start or due dates on tasks to see them on the timeline."
        />
      } @else {
        <!-- Gantt Body -->
        <div class="flex flex-1 overflow-hidden">
          <!-- Left Panel: Task List -->
          <div
            class="w-64 flex-shrink-0 border-r border-[var(--border)] overflow-y-auto"
          >
            <!-- Header -->
            <div
              class="h-10 border-b border-[var(--border)] flex items-center px-3"
            >
              <span
                class="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide"
                >Task</span
              >
            </div>
            <!-- Task rows -->
            @for (task of sortedTasks(); track task.id) {
              <div
                class="h-10 border-b border-[var(--border)] flex items-center px-3 gap-2 hover:bg-[var(--muted)] cursor-pointer"
                (click)="onTaskClick(task)"
              >
                <div
                  class="w-2 h-2 rounded-full flex-shrink-0"
                  [style.background-color]="getColor(task.priority)"
                ></div>
                <span
                  class="text-xs text-[var(--foreground)] truncate"
                  [class.line-through]="task.is_done"
                  [class.text-gray-400]="task.is_done"
                  >{{ task.title }}</span
                >
              </div>
            }
          </div>

          <!-- Right Panel: Timeline -->
          <div
            class="flex-1 overflow-x-auto overflow-y-auto"
            #timelineContainer
          >
            <div [style.width.px]="timelineWidth()" class="relative">
              <!-- Date headers -->
              <div
                class="h-10 border-b border-[var(--border)] flex sticky top-0 bg-[var(--card)] z-10"
              >
                @for (header of dateHeaders(); track header.label) {
                  <div
                    class="flex-shrink-0 border-r border-[var(--border)] flex items-center justify-center"
                    [style.width.px]="header.width"
                  >
                    <span class="text-[10px] text-[var(--muted-foreground)]">{{
                      header.label
                    }}</span>
                  </div>
                }
              </div>

              <!-- SVG timeline -->
              <svg
                [attr.width]="timelineWidth()"
                [attr.height]="sortedTasks().length * 40"
                class="block"
              >
                <!-- Today line -->
                @if (todayX() >= 0) {
                  <line
                    [attr.x1]="todayX()"
                    y1="0"
                    [attr.x2]="todayX()"
                    [attr.y2]="sortedTasks().length * 40"
                    stroke="#ef4444"
                    stroke-width="1.5"
                    stroke-dasharray="4,4"
                    opacity="0.6"
                  />
                }

                <!-- Row grid lines -->
                @for (task of sortedTasks(); track task.id; let i = $index) {
                  <line
                    x1="0"
                    [attr.y1]="i * 40 + 40"
                    [attr.x2]="timelineWidth()"
                    [attr.y2]="i * 40 + 40"
                    stroke="#f3f4f6"
                    stroke-width="1"
                  />
                }

                <!-- Task bars -->
                @for (bar of ganttBars(); track bar.task.id) {
                  <g
                    class="cursor-grab"
                    [class.cursor-grabbing]="dragState()?.taskId === bar.task.id"
                    (click)="onTaskClick(bar.task)"
                    (mousedown)="onBarMouseDown($event, bar)"
                  >
                    <rect
                      [attr.x]="dragState()?.taskId === bar.task.id ? dragState()!.currentX : bar.x"
                      [attr.y]="bar.y + 10"
                      [attr.width]="Math.max(bar.width, 8)"
                      height="20"
                      [attr.fill]="bar.color"
                      [attr.opacity]="dragState()?.taskId === bar.task.id ? 0.6 : bar.task.is_done ? 0.4 : 0.85"
                      rx="4"
                      ry="4"
                    />
                    <!-- Task title on bar -->
                    @if (bar.width > 60) {
                      <text
                        [attr.x]="(dragState()?.taskId === bar.task.id ? dragState()!.currentX : bar.x) + 6"
                        [attr.y]="bar.y + 24"
                        fill="white"
                        font-size="10"
                        font-weight="500"
                      >
                        {{
                          bar.task.title | slice: 0 : Math.floor(bar.width / 6)
                        }}
                      </text>
                    }
                  </g>
                }

                <!-- Ghost bar during drag -->
                @if (dragState(); as ds) {
                  <rect
                    [attr.x]="ds.originalX"
                    [attr.y]="ds.y + 10"
                    [attr.width]="ds.width"
                    height="20"
                    fill="none"
                    stroke="#94a3b8"
                    stroke-width="1"
                    stroke-dasharray="4,4"
                    rx="4"
                    ry="4"
                    opacity="0.5"
                  />
                }

                <!-- Dependency arrows -->
                @for (arrow of dependencyArrows(); track arrow.path) {
                  <path
                    [attr.d]="arrow.path"
                    fill="none"
                    stroke="#94a3b8"
                    stroke-width="1.5"
                    marker-end="url(#arrowhead)"
                  />
                }

                <!-- Arrow marker definition -->
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="8"
                    markerHeight="6"
                    refX="8"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
                  </marker>
                </defs>
              </svg>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class GanttViewComponent implements OnDestroy {
  tasks = input<GanttTask[]>([]);
  dependencies = input<GanttDependency[]>([]);
  taskClicked = output<string>();
  taskUpdated = output<{ id: string; start_date: string; due_date: string }>();

  private taskService = inject(TaskService);

  zoom = signal<ZoomLevel>('week');
  zoomLevels: ZoomLevel[] = ['day', 'week', 'month'];
  dragState = signal<DragState | null>(null);

  Math = Math;

  // Bound listeners for cleanup
  private boundMouseMove = this.onMouseMove.bind(this);
  private boundMouseUp = this.onMouseUp.bind(this);

  sortedTasks = computed(() => {
    return [...this.tasks()].sort((a, b) => {
      const aDate = a.start_date || a.due_date || '';
      const bDate = b.start_date || b.due_date || '';
      return aDate.localeCompare(bDate);
    });
  });

  private dayWidth = computed(() => {
    const z = this.zoom();
    return z === 'day' ? 40 : z === 'week' ? 16 : 4;
  });

  private timelineRange = computed(() => {
    const tasks = this.sortedTasks();
    if (tasks.length === 0)
      return { start: new Date(), end: new Date(), days: 30 };

    let minDate = new Date();
    let maxDate = new Date();
    let first = true;

    for (const t of tasks) {
      const start = t.start_date
        ? new Date(t.start_date)
        : t.due_date
          ? new Date(t.due_date)
          : null;
      const end = t.due_date
        ? new Date(t.due_date)
        : t.start_date
          ? new Date(t.start_date)
          : null;
      if (!start || !end) continue;

      if (first) {
        minDate = new Date(start);
        maxDate = new Date(end);
        first = false;
      } else {
        if (start < minDate) minDate = new Date(start);
        if (end > maxDate) maxDate = new Date(end);
      }
    }

    // Add padding
    minDate.setDate(minDate.getDate() - 7);
    maxDate.setDate(maxDate.getDate() + 14);

    const days = Math.ceil(
      (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    return { start: minDate, end: maxDate, days: Math.max(days, 30) };
  });

  timelineWidth = computed(() => {
    return this.timelineRange().days * this.dayWidth() + 20;
  });

  todayX = computed(() => {
    const range = this.timelineRange();
    const today = new Date();
    const daysDiff =
      (today.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff * this.dayWidth();
  });

  dateHeaders = computed(() => {
    const range = this.timelineRange();
    const dw = this.dayWidth();
    const z = this.zoom();
    const headers: { label: string; width: number }[] = [];

    if (z === 'day') {
      // Show each day
      for (let i = 0; i < range.days; i++) {
        const d = new Date(range.start);
        d.setDate(d.getDate() + i);
        headers.push({ label: `${d.getDate()}`, width: dw });
      }
    } else if (z === 'week') {
      // Show weeks
      const d = new Date(range.start);
      while (d < range.end) {
        const weekStart = new Date(d);
        const weekEnd = new Date(d);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const label = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        headers.push({ label, width: 7 * dw });
        d.setDate(d.getDate() + 7);
      }
    } else {
      // Show months
      const d = new Date(range.start);
      while (d < range.end) {
        const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const daysInMonth = monthEnd.getDate();
        headers.push({
          label: monthStart.toLocaleDateString('en-US', {
            month: 'short',
            year: '2-digit',
          }),
          width: daysInMonth * dw,
        });
        d.setMonth(d.getMonth() + 1);
        d.setDate(1);
      }
    }

    return headers;
  });

  ganttBars = computed((): GanttBar[] => {
    const tasks = this.sortedTasks();
    const range = this.timelineRange();
    const dw = this.dayWidth();

    return tasks.map((task, index) => {
      const start = task.start_date
        ? new Date(task.start_date)
        : task.due_date
          ? new Date(task.due_date)
          : range.start;
      const end = task.due_date
        ? new Date(task.due_date)
        : task.start_date
          ? new Date(task.start_date)
          : range.start;

      const startDays =
        (start.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24);
      const duration = Math.max(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
        1,
      );

      return {
        task,
        x: startDays * dw,
        width: duration * dw,
        y: index * 40,
        color: CHART_PRIORITY_COLORS[task.priority] || '#6366f1',
      };
    });
  });

  dependencyArrows = computed((): GanttArrow[] => {
    const deps = this.dependencies();
    const bars = this.ganttBars();
    const barMap = new Map(bars.map((b) => [b.task.id, b]));

    return deps
      .filter((d) => d.dependency_type === 'blocks')
      .map((dep) => {
        const source = barMap.get(dep.source_task_id);
        const target = barMap.get(dep.target_task_id);
        if (!source || !target) return null;

        const x1 = source.x + source.width;
        const y1 = source.y + 20;
        const x2 = target.x;
        const y2 = target.y + 20;

        // Bezier curve from source end to target start
        const midX = (x1 + x2) / 2;
        const path = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
        return { path };
      })
      .filter((a): a is GanttArrow => a !== null);
  });

  onTaskClick(task: GanttTask): void {
    // Don't emit click if we just finished dragging
    if (!this.dragState()) {
      this.taskClicked.emit(task.id);
    }
  }

  getColor(priority: string): string {
    return CHART_PRIORITY_COLORS[priority] || '#6b7280';
  }

  // ── Drag-to-reschedule ──────────────────────────────────────────
  //
  //  mousedown on bar → track mouse → mouseup → compute new dates
  //  Uses optimistic update with rollback on API error.
  //
  //  COORDINATE MATH:
  //    pixelOffset = mouseX - startMouseX
  //    dayOffset   = round(pixelOffset / dayWidth)
  //    newDate     = oldDate + dayOffset days

  onBarMouseDown(event: MouseEvent, bar: GanttBar): void {
    event.preventDefault();
    event.stopPropagation();

    this.dragState.set({
      taskId: bar.task.id,
      originalX: bar.x,
      currentX: bar.x,
      y: bar.y,
      width: bar.width,
      startMouseX: event.clientX,
      bar,
    });

    document.addEventListener('mousemove', this.boundMouseMove);
    document.addEventListener('mouseup', this.boundMouseUp);
  }

  private onMouseMove(event: MouseEvent): void {
    const ds = this.dragState();
    if (!ds) return;

    const deltaX = event.clientX - ds.startMouseX;
    this.dragState.set({ ...ds, currentX: ds.originalX + deltaX });
  }

  private onMouseUp(event: MouseEvent): void {
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('mouseup', this.boundMouseUp);

    const ds = this.dragState();
    if (!ds) return;

    const deltaX = ds.currentX - ds.originalX;
    const dw = this.dayWidth();
    const dayOffset = Math.round(deltaX / dw);

    // Clear drag state
    this.dragState.set(null);

    // Skip if no meaningful movement (< 1 day)
    if (dayOffset === 0) return;

    // Compute new dates
    const task = ds.bar.task;
    const newStartDate = task.start_date
      ? this.addDays(task.start_date, dayOffset)
      : null;
    const newDueDate = task.due_date
      ? this.addDays(task.due_date, dayOffset)
      : null;

    if (!newStartDate && !newDueDate) return;

    // Build update payload
    const update: Record<string, string> = {};
    if (newStartDate) update['start_date'] = newStartDate;
    if (newDueDate) update['due_date'] = newDueDate;

    // Emit for parent component awareness
    this.taskUpdated.emit({
      id: task.id,
      start_date: newStartDate || task.start_date || '',
      due_date: newDueDate || task.due_date || '',
    });

    // API call with optimistic update (parent handles actual data refresh)
    this.taskService.updateTask(task.id, update).subscribe({
      error: () => {
        // Rollback: emit original dates
        this.taskUpdated.emit({
          id: task.id,
          start_date: task.start_date || '',
          due_date: task.due_date || '',
        });
      },
    });
  }

  private addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString();
  }

  ngOnDestroy(): void {
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('mouseup', this.boundMouseUp);
  }
}
