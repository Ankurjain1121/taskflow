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
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AdminService, TrashItem } from '../../../core/services/admin.service';
import { AdminConfirmDialogComponent } from '../shared/confirm-dialog.component';

@Component({
  selector: 'app-admin-trash',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatTabsModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatDialogModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-gray-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <!-- Header -->
        <div class="mb-6 flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">Trash</h1>
            <p class="text-sm text-gray-500 mt-1">
              Manage deleted items across all workspaces
            </p>
          </div>

          @if (items().length > 0) {
            <button
              mat-flat-button
              color="warn"
              (click)="onEmptyTrash()"
              [disabled]="loading()"
            >
              <mat-icon>delete_forever</mat-icon>
              Empty Trash
            </button>
          }
        </div>

        <!-- Tabs Filter -->
        <div class="bg-white rounded-lg shadow mb-6">
          <mat-tab-group
            [(selectedIndex)]="selectedTabIndex"
            (selectedTabChange)="onTabChange($event.index)"
            class="trash-tabs"
          >
            <mat-tab label="All Items"></mat-tab>
            <mat-tab label="Tasks"></mat-tab>
            <mat-tab label="Boards"></mat-tab>
            <mat-tab label="Workspaces"></mat-tab>
          </mat-tab-group>
        </div>

        <!-- Loading State -->
        @if (loading() && items().length === 0) {
          <div class="flex items-center justify-center py-12">
            <mat-spinner diameter="40"></mat-spinner>
          </div>
        }

        <!-- Error State -->
        @if (error()) {
          <div class="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 mb-6">
            <svg class="w-5 h-5 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clip-rule="evenodd" />
            </svg>
            <div>
              <p class="text-sm font-medium text-red-800">{{ error() }}</p>
              <button
                (click)="loadTrashItems()"
                class="text-sm text-red-600 hover:text-red-800 underline mt-1"
              >
                Try again
              </button>
            </div>
          </div>
        }

        <!-- Empty State -->
        @if (!loading() && !error() && items().length === 0) {
          <div class="bg-white rounded-lg shadow p-12 text-center">
            <div class="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 class="text-sm font-medium text-gray-900">Trash is empty</h3>
            <p class="mt-1 text-sm text-gray-500">
              Deleted items will appear here for 30 days before being permanently removed.
            </p>
          </div>
        }

        <!-- Trash Items Table -->
        @if (!loading() && items().length > 0) {
          <div class="bg-white rounded-lg shadow overflow-hidden">
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Deleted By
                    </th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Deleted At
                    </th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Expires In
                    </th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  @for (item of items(); track item.id) {
                    <tr class="hover:bg-gray-50">
                      <!-- Type -->
                      <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center gap-2">
                          <div [class]="getEntityIconClass(item.entity_type)">
                            <mat-icon class="text-sm">{{ getEntityIcon(item.entity_type) }}</mat-icon>
                          </div>
                          <span class="text-sm font-medium text-gray-900">
                            {{ formatEntityType(item.entity_type) }}
                          </span>
                        </div>
                      </td>

                      <!-- Name -->
                      <td class="px-6 py-4">
                        <p class="text-sm font-medium text-gray-900 line-clamp-1">
                          {{ item.name }}
                        </p>
                      </td>

                      <!-- Deleted By -->
                      <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center gap-2">
                          <div class="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600 overflow-hidden">
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
                          <span class="text-sm text-gray-900">
                            {{ item.deleted_by.display_name }}
                          </span>
                        </div>
                      </td>

                      <!-- Deleted At -->
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span
                          [matTooltip]="formatAbsoluteDate(item.deleted_at)"
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
                          <button
                            mat-stroked-button
                            color="primary"
                            (click)="onRestoreItem(item)"
                            [disabled]="processingItem() === item.id"
                            class="text-sm"
                          >
                            @if (processingItem() === item.id && processingAction() === 'restore') {
                              <mat-spinner diameter="16" class="inline-block mr-1"></mat-spinner>
                            }
                            Restore
                          </button>
                          <button
                            mat-stroked-button
                            color="warn"
                            (click)="onDeleteForever(item)"
                            [disabled]="processingItem() === item.id"
                            class="text-sm"
                          >
                            @if (processingItem() === item.id && processingAction() === 'delete') {
                              <mat-spinner diameter="16" class="inline-block mr-1"></mat-spinner>
                            }
                            Delete Forever
                          </button>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <!-- Load More -->
            @if (nextCursor()) {
              <div class="px-6 py-4 border-t border-gray-200 flex justify-center">
                <button
                  mat-stroked-button
                  color="primary"
                  (click)="loadMore()"
                  [disabled]="loadingMore()"
                >
                  @if (loadingMore()) {
                    <mat-spinner diameter="20" class="inline-block mr-2"></mat-spinner>
                  }
                  Load More
                </button>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .trash-tabs ::ng-deep .mat-mdc-tab-header {
      padding: 0 16px;
    }

    .line-clamp-1 {
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `],
})
export class AdminTrashComponent implements OnInit, OnDestroy {
  private adminService = inject(AdminService);
  private dialog = inject(MatDialog);
  private destroy$ = new Subject<void>();

  // State
  loading = signal(true);
  loadingMore = signal(false);
  error = signal<string | null>(null);
  items = signal<TrashItem[]>([]);
  nextCursor = signal<string | null>(null);
  processingItem = signal<string | null>(null);
  processingAction = signal<'restore' | 'delete' | null>(null);

  // Filters
  selectedTabIndex = 0;
  private entityTypeFilter: string | undefined;

  ngOnInit(): void {
    this.loadTrashItems();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onTabChange(index: number): void {
    const entityTypes = ['', 'task', 'board', 'workspace'];
    this.entityTypeFilter = entityTypes[index] || undefined;
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
        error: (err) => {
          console.error('Failed to load trash items:', err);
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
        error: (err) => {
          console.error('Failed to load more items:', err);
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
          this.items.update((current) => current.filter((i) => i.id !== item.id));
          this.processingItem.set(null);
          this.processingAction.set(null);
        },
        error: (err) => {
          console.error('Failed to restore item:', err);
          this.processingItem.set(null);
          this.processingAction.set(null);
        },
      });
  }

  onDeleteForever(item: TrashItem): void {
    const dialogRef = this.dialog.open(AdminConfirmDialogComponent, {
      data: {
        title: 'Delete Forever',
        message: `Are you sure you want to permanently delete "${item.name}"? This action cannot be undone.`,
        confirmText: 'Delete Forever',
        cancelText: 'Cancel',
        isDestructive: true,
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.permanentlyDeleteItem(item);
      }
    });
  }

  private permanentlyDeleteItem(item: TrashItem): void {
    this.processingItem.set(item.id);
    this.processingAction.set('delete');

    this.adminService
      .permanentlyDelete(item.entity_type, item.entity_id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.items.update((current) => current.filter((i) => i.id !== item.id));
          this.processingItem.set(null);
          this.processingAction.set(null);
        },
        error: (err) => {
          console.error('Failed to permanently delete item:', err);
          this.processingItem.set(null);
          this.processingAction.set(null);
        },
      });
  }

  onEmptyTrash(): void {
    const dialogRef = this.dialog.open(AdminConfirmDialogComponent, {
      data: {
        title: 'Empty Trash',
        message: 'Are you sure you want to permanently delete ALL items in the trash? This action cannot be undone.',
        confirmText: 'Empty Trash',
        cancelText: 'Cancel',
        isDestructive: true,
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.emptyAllTrash();
      }
    });
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
        error: (err) => {
          console.error('Failed to empty trash:', err);
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
    return entityType.charAt(0).toUpperCase() + entityType.slice(1);
  }

  getEntityIcon(entityType: string): string {
    const icons: Record<string, string> = {
      task: 'check_circle',
      board: 'dashboard',
      workspace: 'workspaces',
    };
    return icons[entityType] || 'article';
  }

  getEntityIconClass(entityType: string): string {
    const baseClasses = 'w-8 h-8 rounded flex items-center justify-center';

    const typeColors: Record<string, string> = {
      task: 'bg-blue-100 text-blue-600',
      board: 'bg-purple-100 text-purple-600',
      workspace: 'bg-green-100 text-green-600',
    };

    return `${baseClasses} ${typeColors[entityType] || 'bg-gray-100 text-gray-600'}`;
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
    const baseClasses = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';

    const expires = new Date(expiresAt);
    const now = new Date();
    const diffMs = expires.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / 86400000);

    if (diffDays <= 0) return `${baseClasses} bg-red-100 text-red-800`;
    if (diffDays <= 3) return `${baseClasses} bg-orange-100 text-orange-800`;
    if (diffDays <= 7) return `${baseClasses} bg-yellow-100 text-yellow-800`;
    return `${baseClasses} bg-gray-100 text-gray-800`;
  }
}
