import {
  Component,
  inject,
  OnInit,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  FavoritesService,
  FavoriteItem,
} from '../../core/services/favorites.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-favorites',
  standalone: true,
  imports: [CommonModule, RouterLink, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-[var(--secondary)] dark:bg-gray-900">
      <header
        class="bg-[var(--card)] dark:bg-gray-800 shadow-sm border-b border-[var(--border)] dark:border-gray-700"
      >
        <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <h1
            class="text-2xl font-bold text-[var(--card-foreground)] dark:text-white"
          >
            Favorites
          </h1>
          <p
            class="text-[var(--muted-foreground)] dark:text-gray-400 mt-1 text-sm"
          >
            Quick access to your starred tasks and projects
          </p>
        </div>
      </header>

      <main class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        @if (loading()) {
          <div class="space-y-3">
            @for (i of [1, 2, 3, 4, 5]; track i) {
              <div
                class="bg-[var(--card)] dark:bg-gray-800 rounded-lg border border-[var(--border)] dark:border-gray-700 p-4"
              >
                <div class="flex items-center gap-3">
                  <div class="skeleton w-8 h-8 rounded"></div>
                  <div class="flex-1 space-y-2">
                    <div class="skeleton skeleton-text w-48"></div>
                    <div
                      class="skeleton skeleton-text w-24"
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
          <app-empty-state variant="favorites" />
        } @else {
          <!-- Group by type -->
          @if (taskItems().length > 0) {
            <div class="mb-8">
              <h2
                class="text-sm font-semibold text-[var(--muted-foreground)] dark:text-gray-400 uppercase tracking-wider mb-3"
              >
                Tasks ({{ taskItems().length }})
              </h2>
              <div class="space-y-2">
                @for (item of taskItems(); track item.id) {
                  <div
                    class="bg-[var(--card)] dark:bg-gray-800 rounded-lg border border-[var(--border)] dark:border-gray-700 p-4 flex items-center gap-3 hover:border-primary/30 transition-colors group"
                  >
                    <svg
                      class="w-5 h-5 text-primary flex-shrink-0"
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
                    <div class="flex-1 min-w-0">
                      @if (item.workspace_id && item.project_id) {
                        <a
                          [routerLink]="[
                            '/workspace',
                            item.workspace_id,
                            'project',
                            item.project_id,
                          ]"
                          class="text-sm font-medium text-[var(--card-foreground)] dark:text-white hover:text-primary truncate block"
                        >
                          {{ item.name }}
                        </a>
                      } @else {
                        <span
                          class="text-sm font-medium text-[var(--card-foreground)] dark:text-white truncate block"
                          >{{ item.name }}</span
                        >
                      }
                    </div>
                    <button
                      (click)="unfavorite(item)"
                      class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all p-1"
                      title="Remove from favorites"
                    >
                      <svg
                        class="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                        />
                      </svg>
                    </button>
                  </div>
                }
              </div>
            </div>
          }

          @if (boardItems().length > 0) {
            <div>
              <h2
                class="text-sm font-semibold text-[var(--muted-foreground)] dark:text-gray-400 uppercase tracking-wider mb-3"
              >
                Boards ({{ boardItems().length }})
              </h2>
              <div class="space-y-2">
                @for (item of boardItems(); track item.id) {
                  <div
                    class="bg-[var(--card)] dark:bg-gray-800 rounded-lg border border-[var(--border)] dark:border-gray-700 p-4 flex items-center gap-3 hover:border-primary/30 transition-colors group"
                  >
                    <svg
                      class="w-5 h-5 text-emerald-500 flex-shrink-0"
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
                    <div class="flex-1 min-w-0">
                      @if (item.workspace_id) {
                        <a
                          [routerLink]="[
                            '/workspace',
                            item.workspace_id,
                            'project',
                            item.entity_id,
                          ]"
                          class="text-sm font-medium text-[var(--card-foreground)] dark:text-white hover:text-primary truncate block"
                        >
                          {{ item.name }}
                        </a>
                      } @else {
                        <span
                          class="text-sm font-medium text-[var(--card-foreground)] dark:text-white truncate block"
                          >{{ item.name }}</span
                        >
                      }
                    </div>
                    <button
                      (click)="unfavorite(item)"
                      class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all p-1"
                      title="Remove from favorites"
                    >
                      <svg
                        class="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                        />
                      </svg>
                    </button>
                  </div>
                }
              </div>
            </div>
          }
        }
      </main>
    </div>
  `,
})
export class FavoritesComponent implements OnInit {
  private favoritesService = inject(FavoritesService);

  loading = signal(true);
  error = signal<string | null>(null);
  items = signal<FavoriteItem[]>([]);

  taskItems = signal<FavoriteItem[]>([]);
  boardItems = signal<FavoriteItem[]>([]);

  ngOnInit(): void {
    this.loadFavorites();
  }

  loadFavorites(): void {
    this.loading.set(true);
    this.error.set(null);

    this.favoritesService.list().subscribe({
      next: (items) => {
        this.items.set(items);
        this.taskItems.set(items.filter((i) => i.entity_type === 'task'));
        this.boardItems.set(items.filter((i) => i.entity_type === 'project'));
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load favorites. Please try again.');
        this.loading.set(false);
      },
    });
  }

  unfavorite(item: FavoriteItem): void {
    this.favoritesService.remove(item.entity_type, item.entity_id).subscribe({
      next: () => {
        const updated = this.items().filter((i) => i.id !== item.id);
        this.items.set(updated);
        this.taskItems.set(updated.filter((i) => i.entity_type === 'task'));
        this.boardItems.set(updated.filter((i) => i.entity_type === 'project'));
      },
      error: () => {
        this.error.set('Failed to remove favorite. Please try again.');
      },
    });
  }
}
