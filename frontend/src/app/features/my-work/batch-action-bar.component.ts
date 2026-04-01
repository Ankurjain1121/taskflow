import {
  Component,
  input,
  output,
  signal,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

interface BatchUpdate {
  task_id: string;
  priority?: string;
  due_date?: string | null;
  status_id?: string;
}

interface BatchResult {
  updated: number;
  failed: { task_id: string; reason: string }[];
}

@Component({
  selector: 'app-batch-action-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (selectedIds().length > 0) {
      <div
        class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg md:max-w-lg w-[calc(100%-2rem)]"
        style="background: var(--card); border: 1px solid var(--border)"
      >
        <span class="text-sm font-semibold" style="color: var(--foreground)">
          {{ selectedIds().length }} selected
        </span>

        <div class="flex items-center gap-2 ml-auto">
          <!-- Priority -->
          <select
            (change)="onPriorityChange($event)"
            class="text-xs px-2 py-1.5 rounded-md"
            style="background: var(--background); border: 1px solid var(--border); color: var(--foreground)"
          >
            <option value="" disabled selected>Priority</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <!-- Due date -->
          <input
            type="date"
            (change)="onDueDateChange($event)"
            class="text-xs px-2 py-1.5 rounded-md"
            style="background: var(--background); border: 1px solid var(--border); color: var(--foreground)"
          />

          <!-- Complete -->
          <button
            (click)="onComplete()"
            class="text-xs px-3 py-1.5 rounded-md font-medium transition-colors"
            style="background: var(--success); color: var(--primary-foreground)"
            [disabled]="processing()"
          >
            Complete
          </button>

          <!-- Clear selection -->
          <button
            (click)="cleared.emit()"
            class="text-xs px-2 py-1.5 rounded-md"
            style="color: var(--muted-foreground)"
          >
            Cancel
          </button>
        </div>
      </div>
    }
  `,
})
export class BatchActionBarComponent {
  private http = inject(HttpClient);

  readonly selectedIds = input.required<string[]>();
  readonly cleared = output<void>();
  readonly updated = output<void>();
  readonly processing = signal(false);

  async onPriorityChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    if (!value) return;
    const updates: BatchUpdate[] = this.selectedIds().map((id) => ({
      task_id: id,
      priority: value,
    }));
    await this.executeBatch(updates);
    (event.target as HTMLSelectElement).value = '';
  }

  async onDueDateChange(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    if (!value) return;
    const updates: BatchUpdate[] = this.selectedIds().map((id) => ({
      task_id: id,
      due_date: new Date(value).toISOString(),
    }));
    await this.executeBatch(updates);
  }

  async onComplete() {
    // Setting status_id to mark as done requires knowledge of each task's done status.
    // For now, we set due_date to null as a "snooze" / complete action placeholder.
    // A full implementation would resolve done-status per project.
    const updates: BatchUpdate[] = this.selectedIds().map((id) => ({
      task_id: id,
      due_date: null,
    }));
    await this.executeBatch(updates);
  }

  private async executeBatch(updates: BatchUpdate[]) {
    this.processing.set(true);
    try {
      await firstValueFrom(
        this.http.post<BatchResult>('/api/my-tasks/batch', { updates }),
      );
      this.updated.emit();
    } catch {
      // batch failed silently for now
    } finally {
      this.processing.set(false);
    }
  }
}
