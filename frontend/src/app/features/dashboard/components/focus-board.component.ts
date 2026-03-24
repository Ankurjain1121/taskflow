import {
  Component,
  input,
  computed,
  signal,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FocusTaskCardComponent } from './focus-task-card.component';
import { FocusTask, SnoozedTasksMap } from '../dashboard.types';

const SNOOZE_STORAGE_KEY = 'taskbolt_snoozed_tasks';

@Component({
  selector: 'app-focus-board',
  standalone: true,
  imports: [FocusTaskCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visibleTasks().length > 0) {
      <div class="space-y-2">
        @for (task of visibleTasks().slice(0, 5); track task.id; let i = $index) {
          <div
            class="animate-fade-in-up"
            [style.animation-delay]="i * 0.04 + 's'"
          >
            <app-focus-task-card
              [task]="task"
              [selected]="selectedIndex() === i"
              (completed)="onTaskCompleted($event)"
              (snoozed)="onTaskSnoozed($event)"
            />
          </div>
        }
      </div>
    } @else {
      <!-- Empty state -->
      <div class="flex flex-col items-center justify-center py-8 gap-3">
        <svg
          width="48"
          height="48"
          viewBox="0 0 48 48"
          fill="none"
          style="color: var(--muted-foreground)"
          aria-hidden="true"
        >
          <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="1.5" opacity="0.3" />
          <path
            d="M16 24l5 5 11-11"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            opacity="0.5"
          />
        </svg>
        <p class="text-sm font-medium" style="color: var(--muted-foreground)">
          All clear! No urgent tasks right now.
        </p>
      </div>
    }
  `,
})
export class FocusBoardComponent {
  readonly tasks = input<FocusTask[]>([]);
  readonly selectedIndex = input(-1);

  readonly taskCompleted = output<string>();
  readonly taskSnoozed = output<string>();

  private snoozedIds = signal<Set<string>>(new Set());

  readonly visibleTasks = computed(() => {
    this.cleanExpiredSnoozes();
    const snoozed = this.snoozedIds();
    return this.tasks().filter((t) => !snoozed.has(t.id));
  });

  constructor() {
    this.loadSnoozedTasks();
  }

  onTaskCompleted(taskId: string): void {
    this.taskCompleted.emit(taskId);
  }

  onTaskSnoozed(taskId: string): void {
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const map = this.getSnoozedMap();
    const updated: SnoozedTasksMap = {
      ...map,
      [taskId]: { snoozedUntil: endOfDay.toISOString() },
    };
    this.saveSnoozedMap(updated);
    this.snoozedIds.update((ids) => {
      const next = new Set(ids);
      next.add(taskId);
      return next;
    });
    this.taskSnoozed.emit(taskId);
  }

  private loadSnoozedTasks(): void {
    const map = this.getSnoozedMap();
    const now = new Date();
    const activeIds = new Set<string>();
    for (const [id, entry] of Object.entries(map)) {
      if (new Date(entry.snoozedUntil) > now) {
        activeIds.add(id);
      }
    }
    this.snoozedIds.set(activeIds);
  }

  private cleanExpiredSnoozes(): void {
    const map = this.getSnoozedMap();
    const now = new Date();
    let changed = false;
    const cleaned: SnoozedTasksMap = {};
    for (const [id, entry] of Object.entries(map)) {
      if (new Date(entry.snoozedUntil) > now) {
        cleaned[id] = entry;
      } else {
        changed = true;
      }
    }
    if (changed) {
      this.saveSnoozedMap(cleaned);
    }
  }

  private getSnoozedMap(): SnoozedTasksMap {
    try {
      const raw = localStorage.getItem(SNOOZE_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as SnoozedTasksMap) : {};
    } catch {
      return {};
    }
  }

  private saveSnoozedMap(map: SnoozedTasksMap): void {
    try {
      localStorage.setItem(SNOOZE_STORAGE_KEY, JSON.stringify(map));
    } catch {
      // Storage full or unavailable
    }
  }
}
