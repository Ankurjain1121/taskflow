import {
  Component,
  input,
  signal,
  inject,
  OnInit,
  DestroyRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WorkspaceService } from '../../../core/services/workspace.service';

interface TrashItem {
  entity_type: string;
  entity_id: string;
  name: string;
  deleted_at: string;
  deleted_by_name: string | null;
  days_remaining: number;
}

@Component({
  selector: 'app-trash',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="py-6 space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-[var(--foreground)]">Trash</h3>
          <p class="text-sm text-[var(--muted-foreground)] mt-1">
            Items are automatically deleted after 30 days.
          </p>
        </div>
      </div>

      <!-- Filter -->
      <div class="flex gap-3">
        <select
          [(ngModel)]="typeFilter"
          (ngModelChange)="loadTrash()"
          class="px-3 py-2 text-sm border border-[var(--border)] rounded-md bg-[var(--background)] text-[var(--foreground)]"
        >
          <option value="">All types</option>
          <option value="board">Projects</option>
          <option value="task">Tasks</option>
        </select>
      </div>

      @if (loading()) {
        <div class="flex justify-center py-8">
          <svg
            class="animate-spin h-6 w-6 text-[var(--muted-foreground)]"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            ></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </div>
      } @else if (items().length === 0) {
        <div class="text-center py-8 text-[var(--muted-foreground)]">
          <i class="pi pi-trash text-3xl mb-2 block opacity-40"></i>
          <p class="text-sm">Trash is empty.</p>
        </div>
      } @else {
        <div class="space-y-2">
          @for (item of items(); track item.entity_id) {
            <div
              class="widget-card px-4 py-3 flex items-center justify-between"
            >
              <div class="flex items-center gap-3 min-w-0">
                <div
                  class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  [class]="
                    item.entity_type === 'board'
                      ? 'bg-[var(--primary)]/10'
                      : 'bg-[var(--success)]/10'
                  "
                >
                  <i
                    [class]="
                      item.entity_type === 'board'
                        ? 'pi pi-objects-column text-[var(--primary)]'
                        : 'pi pi-check-square text-[var(--success)]'
                    "
                    style="font-size: 0.875rem"
                  ></i>
                </div>
                <div class="min-w-0">
                  <p
                    class="text-sm font-medium text-[var(--foreground)] truncate"
                  >
                    {{ item.name }}
                  </p>
                  <p class="text-xs text-[var(--muted-foreground)]">
                    {{ item.entity_type | titlecase }} --
                    {{ item.days_remaining }} days left
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-2 flex-shrink-0">
                <button
                  (click)="restoreItem(item)"
                  [disabled]="restoring()"
                  class="px-3 py-1.5 text-xs font-medium text-[var(--primary)] border border-[var(--primary)] rounded-md hover:bg-[var(--primary)]/10 disabled:opacity-50"
                >
                  Restore
                </button>
                <button
                  (click)="deleteItem(item)"
                  [disabled]="deleting()"
                  class="px-3 py-1.5 text-xs font-medium text-[var(--destructive)] border border-red-500/30 rounded-md hover:bg-red-500/10 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          }
        </div>

        @if (nextCursor()) {
          <div class="flex justify-center pt-4">
            <button
              (click)="loadMore()"
              [disabled]="loadingMore()"
              class="px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] border border-[var(--border)] rounded-md hover:bg-[var(--muted)] disabled:opacity-50"
            >
              {{ loadingMore() ? 'Loading...' : 'Load more' }}
            </button>
          </div>
        }
      }
    </div>
  `,
})
export class TrashComponent implements OnInit {
  private workspaceService = inject(WorkspaceService);
  private destroyRef = inject(DestroyRef);

  workspaceId = input.required<string>();

  items = signal<TrashItem[]>([]);
  loading = signal(true);
  loadingMore = signal(false);
  restoring = signal(false);
  deleting = signal(false);
  nextCursor = signal<string | null>(null);

  typeFilter = '';

  ngOnInit(): void {
    this.loadTrash();
  }

  loadTrash(): void {
    this.loading.set(true);
    this.workspaceService
      .listTrash(this.workspaceId(), {
        page_size: 20,
        entity_type: this.typeFilter || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.items.set(result.items as unknown as TrashItem[]);
          this.nextCursor.set(result.next_cursor);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        },
      });
  }

  loadMore(): void {
    const cursor = this.nextCursor();
    if (!cursor) return;

    this.loadingMore.set(true);
    this.workspaceService
      .listTrash(this.workspaceId(), {
        cursor,
        page_size: 20,
        entity_type: this.typeFilter || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.items.update((prev) => [
            ...prev,
            ...(result.items as unknown as TrashItem[]),
          ]);
          this.nextCursor.set(result.next_cursor);
          this.loadingMore.set(false);
        },
        error: () => {
          this.loadingMore.set(false);
        },
      });
  }

  restoreItem(item: TrashItem): void {
    this.restoring.set(true);
    this.workspaceService
      .restoreTrashItem(this.workspaceId(), item.entity_type, item.entity_id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.items.update((list) =>
            list.filter((i) => i.entity_id !== item.entity_id),
          );
          this.restoring.set(false);
        },
        error: () => {
          this.restoring.set(false);
        },
      });
  }

  deleteItem(item: TrashItem): void {
    this.deleting.set(true);
    this.workspaceService
      .deleteTrashItem(this.workspaceId(), item.entity_type, item.entity_id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.items.update((list) =>
            list.filter((i) => i.entity_id !== item.entity_id),
          );
          this.deleting.set(false);
        },
        error: () => {
          this.deleting.set(false);
        },
      });
  }
}
