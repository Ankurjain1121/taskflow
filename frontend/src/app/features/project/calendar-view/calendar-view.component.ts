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
import { TaskService } from '../../../core/services/task.service';
import {
  PRIORITY_COLORS,
  getPriorityLabel,
} from '../../../shared/utils/task-colors';

export interface CalendarTask {
  id: string;
  title: string;
  priority: string;
  due_date: string;
  start_date: string | null;
  /** @deprecated use status_id */
  column_id?: string;
  /** @deprecated use status_name */
  column_name?: string;
  status_id?: string | null;
  status_name?: string | null;
  is_done: boolean;
  milestone_id: string | null;
}

interface CalendarCell {
  date: Date;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  tasks: CalendarTask[];
}

@Component({
  selector: 'app-calendar-view',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col h-full bg-[var(--card)]">
      <!-- Calendar Header -->
      <div
        class="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]"
      >
        <div class="flex items-center gap-4">
          <h2 class="text-lg font-semibold text-[var(--card-foreground)]">
            {{ monthYearLabel() }}
          </h2>
          <div class="flex items-center gap-1">
            <button
              (click)="previousMonth()"
              class="p-1.5 rounded-lg hover:bg-[var(--muted)] text-[var(--muted-foreground)]"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <button
              (click)="goToToday()"
              class="px-3 py-1 text-xs font-medium text-primary rounded-lg hover:bg-primary/10"
            >
              Today
            </button>
            <button
              (click)="nextMonth()"
              class="p-1.5 rounded-lg hover:bg-[var(--muted)] text-[var(--muted-foreground)]"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        </div>
        <!-- View toggle -->
        <div
          class="flex rounded-lg border border-[var(--border)] overflow-hidden"
        >
          <button
            (click)="calendarView.set('month')"
            class="px-3 py-1 text-xs font-medium transition-colors"
            [class.bg-primary]="calendarView() === 'month'"
            [class.text-white]="calendarView() === 'month'"
            [class.text-[var(--muted-foreground)]]="calendarView() !== 'month'"
            [class.hover:bg-[var(--muted)]]="calendarView() !== 'month'"
          >
            Month
          </button>
          <button
            (click)="calendarView.set('week')"
            class="px-3 py-1 text-xs font-medium transition-colors border-l border-[var(--border)]"
            [class.bg-primary]="calendarView() === 'week'"
            [class.text-white]="calendarView() === 'week'"
            [class.text-[var(--muted-foreground)]]="calendarView() !== 'week'"
            [class.hover:bg-[var(--muted)]]="calendarView() !== 'week'"
          >
            Week
          </button>
          <button
            (click)="calendarView.set('day')"
            class="px-3 py-1 text-xs font-medium transition-colors border-l border-[var(--border)]"
            [class.bg-primary]="calendarView() === 'day'"
            [class.text-white]="calendarView() === 'day'"
            [class.text-[var(--muted-foreground)]]="calendarView() !== 'day'"
            [class.hover:bg-[var(--muted)]]="calendarView() !== 'day'"
          >
            Day
          </button>
        </div>
      </div>

      @if (calendarView() !== 'day') {
        <!-- Weekday Headers -->
        <div class="grid grid-cols-7 border-b border-[var(--border)]">
          @for (day of weekDays; track day) {
            <div
              class="py-2 text-center text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
            >
              {{ day }}
            </div>
          }
        </div>

        <!-- Calendar Grid -->
        <div
          class="grid grid-cols-7 flex-1 border-b border-[var(--border)]"
          style="grid-auto-rows: 1fr;"
        >
          @for (cell of calendarCells(); track cell.date.getTime()) {
            <div
              class="border-r border-b border-[var(--border)] p-1 min-h-[100px] overflow-hidden transition-colors"
              [class.bg-[var(--secondary)]]="!cell.isCurrentMonth"
              [style.background]="
                cell.isToday
                  ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
                  : ''
              "
              (dragover)="onDragOver($event)"
              (drop)="onDrop($event, cell.date)"
            >
              <!-- Day number -->
              <div class="flex items-center justify-between mb-1 px-1">
                <span
                  class="text-xs font-medium"
                  [class.text-[var(--muted-foreground)]]="!cell.isCurrentMonth"
                  [class.text-primary]="cell.isToday && cell.isCurrentMonth"
                  [class.text-[var(--foreground)]]="
                    !cell.isToday && cell.isCurrentMonth
                  "
                >
                  {{ cell.dayNumber }}
                </span>
                @if (cell.tasks.length > 3) {
                  <span class="text-[10px] text-[var(--muted-foreground)]"
                    >+{{ cell.tasks.length - 3 }}</span
                  >
                }
              </div>

              <!-- Task blocks (max 3 visible) -->
              @for (task of cell.tasks.slice(0, 3); track task.id) {
                <div
                  class="text-[11px] leading-tight px-1.5 py-0.5 rounded mb-0.5 cursor-pointer truncate border-l-2 transition-colors hover:opacity-80"
                  [style.border-left-color]="getTaskBorderColor(task.priority)"
                  [class.bg-[var(--success)]/10]="task.is_done"
                  [class.text-[var(--success)]]="task.is_done"
                  [class.line-through]="task.is_done"
                  [class.bg-[var(--secondary)]]="!task.is_done"
                  [class.text-[var(--foreground)]]="!task.is_done"
                  draggable="true"
                  (dragstart)="onDragStart($event, task)"
                  (click)="onTaskClick(task)"
                >
                  {{ task.title }}
                </div>
              }
            </div>
          }
        </div>
      } @else {
        <!-- Day View: 24-hour vertical timeline -->
        <div class="flex-1 overflow-y-auto border-b border-[var(--border)]">
          <div class="relative" style="height: 1440px;">
            @for (hour of hours; track hour) {
              <div
                class="absolute left-0 right-0 border-b border-[var(--border)]"
                [style.top.px]="hour * 60"
                [style.height.px]="60"
              >
                <span
                  class="absolute left-2 top-0 -translate-y-1/2 text-[10px] font-medium text-[var(--muted-foreground)] bg-[var(--card)] px-1"
                >
                  {{ formatHour(hour) }}
                </span>
              </div>
            }
            <!-- Task blocks positioned by time -->
            @for (task of dayTasks(); track task.id) {
              <div
                class="absolute left-16 right-4 px-2 py-1 rounded cursor-pointer border-l-2 transition-colors hover:opacity-80"
                [style.top.px]="getDayTaskTop(task)"
                [style.height.px]="40"
                [style.border-left-color]="getTaskBorderColor(task.priority)"
                [class.bg-[var(--success)]/10]="task.is_done"
                [class.text-[var(--success)]]="task.is_done"
                [class.line-through]="task.is_done"
                [class.bg-[var(--secondary)]]="!task.is_done"
                [class.text-[var(--foreground)]]="!task.is_done"
                draggable="true"
                (dragstart)="onDragStart($event, task)"
                (click)="onTaskClick(task)"
              >
                <div class="text-xs font-medium truncate">{{ task.title }}</div>
                <div class="text-[10px] text-[var(--muted-foreground)]">
                  {{ formatTaskTime(task) }}
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class CalendarViewComponent implements OnInit {
  boardId = input.required<string>();
  taskClicked = output<string>();

  private taskService = inject(TaskService);

  calendarView = signal<'month' | 'week' | 'day'>('month');
  currentDate = signal(new Date());
  tasks = signal<CalendarTask[]>([]);
  loading = signal(false);
  draggedTask: CalendarTask | null = null;

  weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  hours = Array.from({ length: 24 }, (_, i) => i);

  monthYearLabel = computed(() => {
    const d = this.currentDate();
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  });

  calendarCells = computed((): CalendarCell[] => {
    const current = this.currentDate();
    const tasks = this.tasks();
    const view = this.calendarView();

    if (view === 'week') {
      return this.generateWeekCells(current, tasks);
    }
    return this.generateMonthCells(current, tasks);
  });

  dayTasks = computed((): CalendarTask[] => {
    const current = this.currentDate();
    const dateStr = this.toDateString(current);
    return this.tasks().filter(
      (t) => this.toDateString(new Date(t.due_date)) === dateStr,
    );
  });

  ngOnInit(): void {
    this.loadTasks();
  }

  loadTasks(): void {
    const current = this.currentDate();
    const year = current.getFullYear();
    const month = current.getMonth();

    // Load a wider range to cover calendar edges
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month + 2, 0);

    this.loading.set(true);
    this.taskService
      .listCalendarTasks(this.boardId(), start.toISOString(), end.toISOString())
      .subscribe({
        next: (tasks) => {
          this.tasks.set(tasks);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  previousMonth(): void {
    const d = this.currentDate();
    this.currentDate.set(new Date(d.getFullYear(), d.getMonth() - 1, 1));
    this.loadTasks();
  }

  nextMonth(): void {
    const d = this.currentDate();
    this.currentDate.set(new Date(d.getFullYear(), d.getMonth() + 1, 1));
    this.loadTasks();
  }

  goToToday(): void {
    this.currentDate.set(new Date());
    this.loadTasks();
  }

  getTaskBorderColor(priority: string): string {
    const colors: Record<string, string> = {
      urgent: '#ef4444',
      high: '#f97316',
      medium: '#eab308',
      low: '#22c55e',
    };
    return colors[priority] || '#6b7280';
  }

  formatHour(hour: number): string {
    if (hour === 0) return '12 AM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return '12 PM';
    return `${hour - 12} PM`;
  }

  getDayTaskTop(task: CalendarTask): number {
    const d = new Date(task.due_date);
    return d.getHours() * 60 + d.getMinutes();
  }

  formatTaskTime(task: CalendarTask): string {
    const d = new Date(task.due_date);
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  onTaskClick(task: CalendarTask): void {
    this.taskClicked.emit(task.id);
  }

  onDragStart(event: DragEvent, task: CalendarTask): void {
    this.draggedTask = task;
    event.dataTransfer?.setData('text/plain', task.id);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(event: DragEvent, date: Date): void {
    event.preventDefault();
    if (!this.draggedTask) return;

    const taskId = this.draggedTask.id;
    const newDueDate = date.toISOString();
    const snapshot = [...this.tasks()];

    // Optimistic: update due_date locally
    this.tasks.update((tasks) =>
      tasks.map((t) => (t.id === taskId ? { ...t, due_date: newDueDate } : t)),
    );
    this.draggedTask = null;

    this.taskService.updateTask(taskId, { due_date: newDueDate }).subscribe({
      error: () => this.tasks.set(snapshot),
    });
  }

  private generateMonthCells(
    current: Date,
    tasks: CalendarTask[],
  ): CalendarCell[] {
    const year = current.getFullYear();
    const month = current.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const today = new Date();

    const cells: CalendarCell[] = [];

    // Fill in days from previous month
    const startDayOfWeek = firstDay.getDay();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      cells.push(this.createCell(date, false, today, tasks));
    }

    // Current month days
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      cells.push(this.createCell(date, true, today, tasks));
    }

    // Fill remaining cells to complete last week
    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const date = new Date(year, month + 1, i);
        cells.push(this.createCell(date, false, today, tasks));
      }
    }

    return cells;
  }

  private generateWeekCells(
    current: Date,
    tasks: CalendarTask[],
  ): CalendarCell[] {
    const today = new Date();
    const dayOfWeek = current.getDay();
    const startOfWeek = new Date(current);
    startOfWeek.setDate(current.getDate() - dayOfWeek);

    const cells: CalendarCell[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      cells.push(this.createCell(date, true, today, tasks));
    }
    return cells;
  }

  private createCell(
    date: Date,
    isCurrentMonth: boolean,
    today: Date,
    tasks: CalendarTask[],
  ): CalendarCell {
    const dateStr = this.toDateString(date);
    const cellTasks = tasks.filter((t) => {
      const taskDate = this.toDateString(new Date(t.due_date));
      return taskDate === dateStr;
    });

    return {
      date,
      dayNumber: date.getDate(),
      isCurrentMonth,
      isToday:
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear(),
      tasks: cellTasks,
    };
  }

  private toDateString(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
