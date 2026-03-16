import {
  Component,
  signal,
  inject,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { ProgressSpinner } from 'primeng/progressspinner';
import { Dialog } from 'primeng/dialog';
import { Tabs, TabList, Tab } from 'primeng/tabs';
import { AdminService, TrashItem } from '../../../core/services/admin.service';

@Component({
  selector: 'app-admin-trash',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    Tooltip,
    ProgressSpinner,
    Dialog,
    Tabs,
    TabList,
    Tab,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-[var(--secondary)]">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <!-- Header -->
        <div class="mb-6 flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-[var(--card-foreground)]">
              Trash
            </h1>
            <p class="text-sm text-[var(--muted-foreground)] mt-1">
              Manage deleted items across all workspaces
            </p>
          </div>

          @if (items().length > 0) {
            <p-button
              severity="danger"
              (onClick)="onEmptyTrash()"
              [disabled]="loading()"
              icon="pi pi-trash"
              label="Empty Trash"
            />
          }
        </div>

        <!-- Tabs Filter -->
        <div class="bg-[var(--card)] rounded-lg shadow mb-6">
          <p-tabs
            [value]="selectedTabValue()"
            (valueChange)="onTabChange($event)"
          >
            <p-tablist>
              <p-tab value="all">All Items</p-tab>
              <p-tab value="task">Tasks</p-tab>
              <p-tab value="board">Projects</p-tab>
              <p-tab value="workspace">Workspaces</p-tab>
            </p-tablist>
          </p-tabs>
        </div>

        <!-- Loading State -->
        @if (loading() && items().length === 0) {
          <div class="flex items-center justify-center py-12">
            <p-progressSpinner
              [style]="{ width: '40px', height: '40px' }"
              strokeWidth="4"
            />
          </div>
        }

        <!-- Error State -->
        @if (error()) {
          <div
            class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3 mb-6"
          >
            <svg
              class="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clip-rule="evenodd"
              />
            </svg>
            <div>
              <p class="text-sm font-medium text-red-800 dark:text-red-300">{{ error() }}</p>
              <button
                (click)="loadTrashItems()"
                class="text-sm text-red-600 dark:text-red-400 hover:text-red-800 underline mt-1"
              >
                Try again
              </button>
            </div>
          </div>
        }

        <!-- Empty State -->
        @if (!loading() && !error() && items().length === 0) {
          <div class="bg-[var(--card)] rounded-lg shadow p-12 text-center">
            <div
              class="w-16 h-16 mx-auto bg-[var(--secondary)] rounded-full flex items-center justify-center mb-4"
            >
              <svg
                class="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </div>
            <h3 class="text-sm font-medium text-[var(--card-foreground)]">
              Trash is empty
            </h3>
            <p class="mt-1 text-sm text-[var(--muted-foreground)]">
              Deleted items will appear here for 30 days before being
              permanently removed.
            </p>
          </div>
        }

        <!-- Trash Items Table -->
        @if (!loading() && items().length > 0) {
          <div class="bg-[var(--card)] rounded-lg shadow overflow-hidden">
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-[var(--border)]">
                <thead class="bg-[var(--secondary)]">
                  <tr>
                    <th
                      class="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                    >
                      Type
                    </th>
                    <th
                      class="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                    >
                      Name
                    </th>
                    <th
                      class="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                    >
                      Deleted By
                    </th>
                    <th
                      class="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                    >
                      Deleted At
                    </th>
                    <th
                      class="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                    >
                      Expires In
                    </th>
                    <th
                      class="px-6 py-3 text-right text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody class="bg-[var(--card)] divide-y divide-[var(--border)]">
                  @for (item of items(); track item.id) {
                    <tr class="hover:bg-[var(--secondary)]">
                      <!-- Type -->
                      <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center gap-2">
                          <div [class]="getEntityIconClass(item.entity_type)">
                            <i
                              [class]="
                                'pi ' +
                                getEntityPrimeIcon(item.entity_type) +
                                ' text-sm'
                              "
                            ></i>
                          </div>
                          <span
                            class="text-sm font-medium text-[var(--card-foreground)]"
                          >
                            {{ formatEntityType(item.entity_type) }}
                          </span>
                        </div>
                      </td>

                      <!-- Name -->
                      <td class="px-6 py-4">
                        <p
                          class="text-sm font-medium text-[var(--card-foreground)] line-clamp-1"
                        >
                          {{ item.name }}
                        </p>
                      </td>

                      <!-- Deleted By -->
                      <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center gap-2">
                          <div
                            class="w-6 h-6 rounded-full bg-[var(--secondary)] flex items-center justify-center text-xs font-medium text-[var(--muted-foreground)] overflow-hidden"
                          >
                            @if (item.deleted_by.avatar_url) {
                              <img
                                [src]="item.deleted_by.avatar_url"
                                [alt]="item.deleted_by.display_name"
                                class="w-full h-full object-cover"
                              />
                            } @else {
                              {{ getInitials(item.deleted_by.display_name) }}
                            }
                          </div>
                          <span class="text-sm text-[var(--card-foreground)]">
                            {{ item.deleted_by.display_name }}
                          </span>
                        </div>
                      </td>

                      <!-- Deleted At -->
                      <td
                        class="px-6 py-4 whitespace-nowrap text-sm text-[var(--muted-foreground)]"
                      >
                        <span
                          [pTooltip]="formatAbsoluteDate(item.deleted_at)"
                          class="cursor-help"
                        >
                          {{ formatRelativeDate(item.deleted_at) }}
                        </span>
                      </td>

                      <!-- Expires In -->
                      <td class="px-6 py-4 whitespace-nowrap">
                        <span [class]="getExpiryBadgeClass(item.expires_at)">
                          {{ formatExpiresIn(item.expires_at) }}
                        </span>
                      </td>

                      <!-- Actions -->
                      <td class="px-6 py-4 whitespace-nowrap text-right">
                        <div class="flex items-center justify-end gap-2">
                          <p-button
                            [outlined]="true"
                            size="small"
                            (onClick)="onRestoreItem(item)"
                            [disabled]="processingItem() === item.id"
                            [loading]="
                              processingItem() === item.id &&
                              processingAction() === 'restore'
                            "
                            label="Restore"
                          />
                          <p-button
                            [outlined]="true"
                            severity="danger"
                            size="small"
                            (onClick)="onDeleteForever(item)"
                            [disabled]="processingItem() === item.id"
                            [loading]="
                              processingItem() === item.id &&
                              processingAction() === 'delete'
                            "
                            label="Delete Forever"
                          />
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <!-- Load More -->
            @if (nextCursor()) {
              <div
                class="px-6 py-4 border-t border-[var(--border)] flex justify-center"
              >
                <p-button
                  [outlined]="true"
                  (onClick)="loadMore()"
                  [disabled]="loadingMore()"
                  [loading]="loadingMore()"
                  label="Load More"
                />
              </div>
            }
          </div>
        }
      </div>
    </div>

    <!-- Confirm Delete Forever Dialog -->
    <p-dialog
      [(visible)]="showDeleteDialog"
      [modal]="true"
      [style]="{ width: '400px' }"
      header="Delete Forever"
    >
      <div class="flex items-start gap-3">
        <svg
          class="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <p class="text-[var(--muted-foreground)]">
          Are you sure you want to permanently delete "{{
            itemToDelete()?.name
          }}"? This action cannot be undone.
        </p>
      </div>
      <ng-template pTemplate="footer">
        <p-button
          label="Cancel"
          [text]="true"
          (onClick)="showDeleteDialog = false"
        />
        <p-button
          label="Delete Forever"
          severity="danger"
          (onClick)="confirmDeleteForever()"
        />
      </ng-template>
    </p-dialog>

    <!-- Confirm Empty Trash Dialog -->
    <p-dialog
      [(visible)]="showEmptyTrashDialog"
      [modal]="true"
      [style]="{ width: '400px' }"
      header="Empty Trash"
    >
      <div class="flex items-start gap-3">
        <svg
          class="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <p class="text-[var(--muted-foreground)]">
          Are you sure you want to permanently delete ALL items in the trash?
          This action cannot be undone.
        </p>
      </div>
      <ng-template pTemplate="footer">
        <p-button
          label="Cancel"
          [text]="true"
          (onClick)="showEmptyTrashDialog = false"
        />
        <p-button
          label="Empty Trash"
          severity="danger"
          (onClick)="confirmEmptyTrash()"
        />
      </ng-template>
    </p-dialog>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .line-clamp-1 {
        display: -webkit-box;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
    `,
  ],
})
export class AdminTrashComponent implements OnInit, OnDestroy {
  private adminService = inject(AdminService);
  private destroy$ = new Subject<void>();

  // State
  loading = signal(true);
  loadingMore = signal(false);
  error = signal<string | null>(null);
  items = signal<TrashItem[]>([]);
  nextCursor = signal<string | null>(null);
  processingItem = signal<string | null>(null);
  processingAction = signal<'restore' | 'delete' | null>(null);

  // Dialogs
  showDeleteDialog = false;
  showEmptyTrashDialog = false;
  itemToDelete = signal<TrashItem | null>(null);

  // Filters
  selectedTabValue = signal<string>('all');
  private entityTypeFilter: string | undefined;

  ngOnInit(): void {
    this.loadTrashItems();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onTabChange(value: string | number): void {
    const strValue = String(value);
    this.selectedTabValue.set(strValue);
    this.entityTypeFilter = strValue === 'all' ? undefined : strValue;
    this.loadTrashItems();
  }

  loadTrashItems(): void {
    this.loading.set(true);
    this.error.set(null);

    this.adminService
      .getTrashItems({
        entity_type: this.entityTypeFilter,
        page_size: 25,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.items.set(response.items);
          this.nextCursor.set(response.next_cursor);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Failed to load trash items. Please try again.');
          this.loading.set(false);
        },
      });
  }

  loadMore(): void {
    if (!this.nextCursor() || this.loadingMore()) return;

    this.loadingMore.set(true);

    this.adminService
      .getTrashItems({
        entity_type: this.entityTypeFilter,
        cursor: this.nextCursor()!,
        page_size: 25,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.items.update((current) => [...current, ...response.items]);
          this.nextCursor.set(response.next_cursor);
          this.loadingMore.set(false);
        },
        error: () => {
          this.loadingMore.set(false);
        },
      });
  }

  onRestoreItem(item: TrashItem): void {
    this.processingItem.set(item.id);
    this.processingAction.set('restore');

    this.adminService
      .restoreItem(item.entity_type, item.entity_id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.items.update((current) =>
            current.filter((i) => i.id !== item.id),
          );
          this.processingItem.set(null);
          this.processingAction.set(null);
        },
        error: () => {
          this.processingItem.set(null);
          this.processingAction.set(null);
        },
      });
  }

  onDeleteForever(item: TrashItem): void {
    this.itemToDelete.set(item);
    this.showDeleteDialog = true;
  }

  confirmDeleteForever(): void {
    const item = this.itemToDelete();
    if (!item) return;
    this.showDeleteDialog = false;
    this.permanentlyDeleteItem(item);
  }

  private permanentlyDeleteItem(item: TrashItem): void {
    this.processingItem.set(item.id);
    this.processingAction.set('delete');

    this.adminService
      .permanentlyDelete(item.entity_type, item.entity_id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.items.update((current) =>
            current.filter((i) => i.id !== item.id),
          );
          this.processingItem.set(null);
          this.processingAction.set(null);
        },
        error: () => {
          this.processingItem.set(null);
          this.processingAction.set(null);
        },
      });
  }

  onEmptyTrash(): void {
    this.showEmptyTrashDialog = true;
  }

  confirmEmptyTrash(): void {
    this.showEmptyTrashDialog = false;
    this.emptyAllTrash();
  }

  private emptyAllTrash(): void {
    this.loading.set(true);

    this.adminService
      .emptyTrash()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.items.set([]);
          this.nextCursor.set(null);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        },
      });
  }

  // Formatting helpers
  getInitials(name: string): string {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  formatEntityType(entityType: string): string {
    if (entityType === 'board') return 'Project';
    return entityType.charAt(0).toUpperCase() + entityType.slice(1);
  }

  getEntityPrimeIcon(entityType: string): string {
    const icons: Record<string, string> = {
      task: 'pi-check-circle',
      board: 'pi-th-large',
      workspace: 'pi-building',
    };
    return icons[entityType] || 'pi-file';
  }

  getEntityIconClass(entityType: string): string {
    const baseClasses = 'w-8 h-8 rounded flex items-center justify-center';

    const typeColors: Record<string, string> = {
      task: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
      board: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
      workspace: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    };

    return `${baseClasses} ${typeColors[entityType] || 'bg-[var(--secondary)] text-[var(--muted-foreground)]'}`;
  }

  formatRelativeDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }

  formatAbsoluteDate(dateString: string): string {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatExpiresIn(expiresAt: string): string {
    const expires = new Date(expiresAt);
    const now = new Date();
    const diffMs = expires.getTime() - now.getTime();

    if (diffMs <= 0) return 'Expired';

    const diffDays = Math.ceil(diffMs / 86400000);
    const diffHours = Math.ceil(diffMs / 3600000);

    if (diffDays > 1) return `${diffDays} days`;
    if (diffHours > 1) return `${diffHours} hours`;
    return 'Less than an hour';
  }

  getExpiryBadgeClass(expiresAt: string): string {
    const baseClasses =
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';

    const expires = new Date(expiresAt);
    const now = new Date();
    const diffMs = expires.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / 86400000);

    if (diffDays <= 0) return `${baseClasses} bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300`;
    if (diffDays <= 3) return `${baseClasses} bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300`;
    if (diffDays <= 7) return `${baseClasses} bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300`;
    return `${baseClasses} bg-[var(--secondary)] text-[var(--card-foreground)]`;
  }
}
