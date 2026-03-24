import {
  Component,
  inject,
  OnInit,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ArchiveService,
  ArchiveItem,
} from '../../core/services/archive.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-archive',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-[var(--secondary)]">
      <header
        class="bg-[var(--card)] shadow-sm border-b border-[var(--border)]"
      >
        <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <h1
            class="text-2xl font-bold text-[var(--card-foreground)] dark:text-white"
          >
            Archive
          </h1>
          <p
            class="text-[var(--muted-foreground)] dark:text-gray-400 mt-1 text-sm"
          >
            Deleted items are kept for 30 days before permanent removal
          </p>
        </div>
      </header>

      <main class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <!-- Filter tabs -->
        <div class="flex gap-2 mb-6">
          <button
            (click)="setFilter(null)"
            [class]="filterBtnClass(null)"
            class="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors"
          >
            All
          </button>
          <button
            (click)="setFilter('task')"
            [class]="filterBtnClass('task')"
            class="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors"
          >
            Tasks
          </button>
          <button
            (click)="setFilter('board')"
            [class]="filterBtnClass('board')"
            class="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors"
          >
            Boards
          </button>
        </div>

        @if (loading()) {
          <div class="space-y-3">
            @for (i of [1, 2, 3]; track i) {
              <div
                class="bg-[var(--card)] rounded-lg border border-[var(--border)] p-4"
              >
                <div class="flex items-center gap-3">
                  <div class="skeleton w-8 h-8 rounded"></div>
                  <div class="flex-1 space-y-2">
                    <div class="skeleton skeleton-text w-48"></div>
                    <div
                      class="skeleton skeleton-text w-32"
                      style="height: 0.625rem"
                    ></div>
                  </div>
                </div>
              </div>
            }
          </div>
        } @else if (error()) {
          <div
            class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-400"
          >
            {{ error() }}
          </div>
        } @else if (items().length === 0) {
          <div class="text-center py-16">
            <svg
              class="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            <h3
              class="mt-4 text-lg font-medium text-[var(--card-foreground)] dark:text-white"
            >
              Archive is empty
            </h3>
            <p
              class="mt-2 text-sm text-[var(--muted-foreground)] dark:text-gray-400"
            >
              Deleted tasks and boards will appear here.
            </p>
          </div>
        } @else {
          <div class="space-y-2">
            @for (item of items(); track item.entity_id) {
              <div
                class="bg-[var(--card)] rounded-lg border border-[var(--border)] p-4 flex items-center gap-3"
              >
                <!-- Entity type icon -->
                @if (item.entity_type === 'task') {
                  <svg
                    class="w-5 h-5 text-gray-400 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                } @else {
                  <svg
                    class="w-5 h-5 text-gray-400 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7"
                    />
                  </svg>
                }

                <div class="flex-1 min-w-0">
                  <p
                    class="text-sm font-medium text-[var(--card-foreground)] dark:text-white truncate"
                  >
                    {{ item.name }}
                  </p>
                  <p
                    class="text-xs text-[var(--muted-foreground)] dark:text-gray-400"
                  >
                    {{ item.entity_type | titlecase }} &middot; Deleted
                    {{ formatDate(item.deleted_at) }} &middot;
                    <span
                      [class]="item.days_remaining <= 7 ? 'text-red-500' : ''"
                    >
                      {{ item.days_remaining }} days remaining
                    </span>
                  </p>
                </div>

                <div class="flex items-center gap-2">
                  <button
                    (click)="restore(item)"
                    [disabled]="restoring() === item.entity_id"
                    class="text-xs font-medium px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                  >
                    @if (restoring() === item.entity_id) {
                      Restoring...
                    } @else {
                      Restore
                    }
                  </button>
                  @if (isAdmin()) {
                    <button
                      (click)="permanentlyDelete(item)"
                      [disabled]="deleting() === item.entity_id"
                      class="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
                    >
                      @if (deleting() === item.entity_id) {
                        Deleting...
                      } @else {
                        Delete
                      }
                    </button>
                  }
                </div>
              </div>
            }
          </div>

          @if (nextCursor()) {
            <div class="mt-6 text-center">
              <button
                (click)="loadMore()"
                [disabled]="loadingMore()"
                class="px-4 py-2 text-sm font-medium text-primary hover:text-primary disabled:opacity-50"
              >
                @if (loadingMore()) {
                  Loading...
                } @else {
                  Load more
                }
              </button>
            </div>
          }
        }
      </main>
    </div>
  `,
})
export class ArchiveComponent implements OnInit {
  private archiveService = inject(ArchiveService);
  private authService = inject(AuthService);

  loading = signal(true);
  loadingMore = signal(false);
  error = signal<string | null>(null);
  items = signal<ArchiveItem[]>([]);
  nextCursor = signal<string | null>(null);
  activeFilter = signal<string | null>(null);
  restoring = signal<string | null>(null);
  deleting = signal<string | null>(null);

  ngOnInit(): void {
    this.loadArchive();
  }

  isAdmin(): boolean {
    const role = this.authService.currentUser()?.role;
    return role === 'admin' || role === 'super_admin';
  }

  setFilter(filter: string | null): void {
    this.activeFilter.set(filter);
    this.loadArchive();
  }

  filterBtnClass(filter: string | null): string {
    const active = this.activeFilter() === filter;
    return active
      ? 'bg-primary/10 text-primary'
      : 'bg-[var(--card)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]';
  }

  loadArchive(): void {
    this.loading.set(true);
    this.error.set(null);

    this.archiveService
      .list({
        entity_type: this.activeFilter() ?? undefined,
      })
      .subscribe({
        next: (result) => {
          this.items.set(result.items);
          this.nextCursor.set(result.next_cursor);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Failed to load archive. Please try again.');
          this.loading.set(false);
        },
      });
  }

  loadMore(): void {
    const cursor = this.nextCursor();
    if (!cursor) return;

    this.loadingMore.set(true);

    this.archiveService
      .list({
        entity_type: this.activeFilter() ?? undefined,
        cursor,
      })
      .subscribe({
        next: (result) => {
          this.items.set([...this.items(), ...result.items]);
          this.nextCursor.set(result.next_cursor);
          this.loadingMore.set(false);
        },
        error: () => {
          this.loadingMore.set(false);
        },
      });
  }

  restore(item: ArchiveItem): void {
    this.restoring.set(item.entity_id);

    this.archiveService.restore(item.entity_type, item.entity_id).subscribe({
      next: () => {
        this.items.set(
          this.items().filter((i) => i.entity_id !== item.entity_id),
        );
        this.restoring.set(null);
      },
      error: () => {
        this.error.set('Failed to restore item. Please try again.');
        this.restoring.set(null);
      },
    });
  }

  permanentlyDelete(item: ArchiveItem): void {
    if (!confirm(`Permanently delete "${item.name}"? This cannot be undone.`))
      return;

    this.deleting.set(item.entity_id);

    this.archiveService
      .permanentlyDelete(item.entity_type, item.entity_id)
      .subscribe({
        next: () => {
          this.items.set(
            this.items().filter((i) => i.entity_id !== item.entity_id),
          );
          this.deleting.set(null);
        },
        error: () => {
          this.error.set('Failed to delete item. Please try again.');
          this.deleting.set(null);
        },
      });
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  }
}
