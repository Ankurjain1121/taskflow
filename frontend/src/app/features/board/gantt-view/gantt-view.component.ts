import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CHART_PRIORITY_COLORS } from '../../../shared/utils/svg-charts';

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

@Component({
  selector: 'app-gantt-view',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col h-full bg-white">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-3 border-b border-gray-200">
        <h2 class="text-lg font-semibold text-gray-900">Gantt Chart</h2>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-500">Zoom:</span>
          <div class="flex rounded-lg border border-gray-200 overflow-hidden">
            @for (level of zoomLevels; track level) {
              <button
                (click)="zoom.set(level)"
                class="px-3 py-1 text-xs font-medium transition-colors capitalize"
                [class.bg-indigo-600]="zoom() === level"
                [class.text-white]="zoom() === level"
                [class.text-gray-600]="zoom() !== level"
                [class.hover:bg-gray-50]="zoom() !== level"
              >{{ level }}</button>
            }
          </div>
        </div>
      </div>

      @if (tasks().length === 0) {
        <div class="flex items-center justify-center flex-1 text-gray-400 text-sm">
          No tasks with dates to display. Set start/due dates on tasks to see them here.
        </div>
      } @else {
        <!-- Gantt Body -->
        <div class="flex flex-1 overflow-hidden">
          <!-- Left Panel: Task List -->
          <div class="w-64 flex-shrink-0 border-r border-gray-200 overflow-y-auto">
            <!-- Header -->
            <div class="h-10 border-b border-gray-200 flex items-center px-3">
              <span class="text-xs font-medium text-gray-500 uppercase tracking-wide">Task</span>
            </div>
            <!-- Task rows -->
            @for (task of sortedTasks(); track task.id) {
              <div
                class="h-10 border-b border-gray-100 flex items-center px-3 gap-2 hover:bg-gray-50 cursor-pointer"
                (click)="onTaskClick(task)"
              >
                <div
                  class="w-2 h-2 rounded-full flex-shrink-0"
                  [style.background-color]="getColor(task.priority)"
                ></div>
                <span
                  class="text-xs text-gray-700 truncate"
                  [class.line-through]="task.is_done"
                  [class.text-gray-400]="task.is_done"
                >{{ task.title }}</span>
              </div>
            }
          </div>

          <!-- Right Panel: Timeline -->
          <div class="flex-1 overflow-x-auto overflow-y-auto" #timelineContainer>
            <div [style.width.px]="timelineWidth()" class="relative">
              <!-- Date headers -->
              <div class="h-10 border-b border-gray-200 flex sticky top-0 bg-white z-10">
                @for (header of dateHeaders(); track header.label) {
                  <div
                    class="flex-shrink-0 border-r border-gray-100 flex items-center justify-center"
                    [style.width.px]="header.width"
                  >
                    <span class="text-[10px] text-gray-500">{{ header.label }}</span>
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
                    [attr.x1]="todayX()" y1="0"
                    [attr.x2]="todayX()" [attr.y2]="sortedTasks().length * 40"
                    stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4,4" opacity="0.6"
                  />
                }

                <!-- Row grid lines -->
                @for (task of sortedTasks(); track task.id; let i = $index) {
                  <line
                    x1="0" [attr.y1]="i * 40 + 40"
                    [attr.x2]="timelineWidth()" [attr.y2]="i * 40 + 40"
                    stroke="#f3f4f6" stroke-width="1"
                  />
                }

                <!-- Task bars -->
                @for (bar of ganttBars(); track bar.task.id) {
                  <g class="cursor-pointer" (click)="onTaskClick(bar.task)">
                    <rect
                      [attr.x]="bar.x"
                      [attr.y]="bar.y + 10"
                      [attr.width]="Math.max(bar.width, 8)"
                      height="20"
                      [attr.fill]="bar.color"
                      [attr.opacity]="bar.task.is_done ? 0.4 : 0.85"
                      rx="4" ry="4"
                    />
                    <!-- Task title on bar -->
                    @if (bar.width > 60) {
                      <text
                        [attr.x]="bar.x + 6"
                        [attr.y]="bar.y + 24"
                        fill="white" font-size="10" font-weight="500"
                      >{{ bar.task.title | slice:0:Math.floor(bar.width / 6) }}</text>
                    }
                  </g>
                }

                <!-- Dependency arrows -->
                @for (arrow of dependencyArrows(); track arrow.path) {
                  <path
                    [attr.d]="arrow.path"
                    fill="none" stroke="#94a3b8" stroke-width="1.5"
                    marker-end="url(#arrowhead)"
                  />
                }

                <!-- Arrow marker definition -->
                <defs>
                  <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
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
export class GanttViewComponent implements OnInit {
  tasks = input<GanttTask[]>([]);
  dependencies = input<GanttDependency[]>([]);
  taskClicked = output<string>();

  zoom = signal<ZoomLevel>('week');
  zoomLevels: ZoomLevel[] = ['day', 'week', 'month'];

  Math = Math;

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
    if (tasks.length === 0) return { start: new Date(), end: new Date(), days: 30 };

    let minDate = new Date();
    let maxDate = new Date();
    let first = true;

    for (const t of tasks) {
      const start = t.start_date ? new Date(t.start_date) : t.due_date ? new Date(t.due_date) : null;
      const end = t.due_date ? new Date(t.due_date) : t.start_date ? new Date(t.start_date) : null;
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

    const days = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
    return { start: minDate, end: maxDate, days: Math.max(days, 30) };
  });

  timelineWidth = computed(() => {
    return this.timelineRange().days * this.dayWidth() + 20;
  });

  todayX = computed(() => {
    const range = this.timelineRange();
    const today = new Date();
    const daysDiff = (today.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24);
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
          label: monthStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
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
      const start = task.start_date ? new Date(task.start_date) : task.due_date ? new Date(task.due_date) : range.start;
      const end = task.due_date ? new Date(task.due_date) : task.start_date ? new Date(task.start_date) : range.start;

      const startDays = (start.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24);
      const duration = Math.max((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24), 1);

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

  ngOnInit(): void {}

  onTaskClick(task: GanttTask): void {
    this.taskClicked.emit(task.id);
  }

  getColor(priority: string): string {
    return CHART_PRIORITY_COLORS[priority] || '#6b7280';
  }
}
