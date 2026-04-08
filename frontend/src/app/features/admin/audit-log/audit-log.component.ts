import {
  Component,
  signal,
  inject,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { InputTextModule } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { DatePicker } from 'primeng/datepicker';
import { ButtonModule } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { ProgressSpinner } from 'primeng/progressspinner';
import {
  AdminService,
  AuditLogEntry,
  AuditLogParams,
} from '../../../core/services/admin.service';

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    InputTextModule,
    Select,
    DatePicker,
    ButtonModule,
    Tooltip,
    ProgressSpinner,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-[var(--secondary)]">
      <div class="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <!-- Header -->
        <div class="mb-6">
          <h1 class="text-2xl font-bold text-[var(--card-foreground)]">
            Audit Log
          </h1>
          <p class="text-sm text-[var(--muted-foreground)] mt-1">
            Track all system activities and user actions
          </p>
        </div>

        <!-- Filters -->
        <div class="bg-[var(--card)] rounded-lg shadow mb-6 p-4">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <!-- Search -->
            <div class="flex flex-col gap-2">
              <label
                for="search"
                class="text-sm font-medium text-[var(--foreground)]"
                >Search</label
              >
              <div class="p-inputgroup">
                <span class="p-inputgroup-addon"
                  ><i class="pi pi-search"></i
                ></span>
                <input
                  pInputText
                  id="search"
                  [(ngModel)]="searchQuery"
                  (ngModelChange)="onSearchChange($event)"
                  placeholder="Search activities..."
                  class="w-full"
                />
              </div>
            </div>

            <!-- Action Filter -->
            <div class="flex flex-col gap-2">
              <label
                for="action"
                class="text-sm font-medium text-[var(--foreground)]"
                >Action</label
              >
              <p-select
                id="action"
                [options]="actionOptions()"
                [(ngModel)]="selectedAction"
                (ngModelChange)="loadAuditLog()"
                optionLabel="label"
                optionValue="value"
                placeholder="All Actions"
                [showClear]="true"
                styleClass="w-full"
              />
            </div>

            <!-- Entity Type Filter -->
            <div class="flex flex-col gap-2">
              <label
                for="entityType"
                class="text-sm font-medium text-[var(--foreground)]"
                >Entity Type</label
              >
              <p-select
                id="entityType"
                [options]="entityTypeOptions"
                [(ngModel)]="selectedEntityType"
                (ngModelChange)="loadAuditLog()"
                optionLabel="label"
                optionValue="value"
                placeholder="All Types"
                [showClear]="true"
                styleClass="w-full"
              />
            </div>

            <!-- Date From -->
            <div class="flex flex-col gap-2">
              <label
                for="dateFrom"
                class="text-sm font-medium text-[var(--foreground)]"
                >From Date</label
              >
              <p-datepicker
                id="dateFrom"
                [(ngModel)]="dateFrom"
                (ngModelChange)="loadAuditLog()"
                [showIcon]="true"
                dateFormat="mm/dd/yy"
                placeholder="Select date"
                styleClass="w-full"
              />
            </div>

            <!-- Date To -->
            <div class="flex flex-col gap-2">
              <label
                for="dateTo"
                class="text-sm font-medium text-[var(--foreground)]"
                >To Date</label
              >
              <p-datepicker
                id="dateTo"
                [(ngModel)]="dateTo"
                (ngModelChange)="loadAuditLog()"
                [showIcon]="true"
                dateFormat="mm/dd/yy"
                placeholder="Select date"
                styleClass="w-full"
              />
            </div>
          </div>

          <!-- Clear Filters -->
          @if (hasActiveFilters()) {
            <div class="mt-4 flex justify-end">
              <p-button
                label="Clear Filters"
                [text]="true"
                (onClick)="clearFilters()"
              />
            </div>
          }
        </div>

        <!-- Loading State -->
        @if (loading() && entries().length === 0) {
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
            class="bg-[color-mix(in_srgb,var(--destructive)_10%,transparent)] border border-[color-mix(in_srgb,var(--destructive)_30%,transparent)] rounded-lg p-4 flex items-center gap-3 mb-6"
          >
            <svg
              class="w-5 h-5 text-[var(--destructive)]"
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
              <p class="text-sm font-medium text-[var(--destructive)]">{{ error() }}</p>
              <button
                (click)="loadAuditLog()"
                class="text-sm text-[var(--destructive)] hover:underline mt-1"
              >
                Try again
              </button>
            </div>
          </div>
        }

        <!-- Empty State -->
        @if (!loading() && !error() && entries().length === 0) {
          <div class="bg-[var(--card)] rounded-lg shadow p-12 text-center">
            <svg
              class="mx-auto h-12 w-12 text-[var(--muted-foreground)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 class="mt-2 text-sm font-medium text-[var(--card-foreground)]">
              No audit entries
            </h3>
            <p class="mt-1 text-sm text-[var(--muted-foreground)]">
              No activities match your current filters.
            </p>
          </div>
        }

        <!-- Audit Table -->
        @if (entries().length > 0) {
          <div class="bg-[var(--card)] rounded-lg shadow overflow-hidden">
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-[var(--border)]">
                <thead class="bg-[var(--secondary)]">
                  <tr>
                    <th
                      class="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                    >
                      Timestamp
                    </th>
                    <th
                      class="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                    >
                      User
                    </th>
                    <th
                      class="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                    >
                      Action
                    </th>
                    <th
                      class="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                    >
                      Entity
                    </th>
                    <th
                      class="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                    >
                      IP Address
                    </th>
                    <th
                      class="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                    >
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody class="bg-[var(--card)] divide-y divide-[var(--border)]">
                  @for (entry of entries(); track entry.id) {
                    <tr class="hover:bg-[var(--muted)]">
                      <!-- Timestamp -->
                      <td
                        class="px-6 py-4 whitespace-nowrap text-sm text-[var(--muted-foreground)]"
                      >
                        <span
                          [pTooltip]="formatAbsoluteDate(entry.created_at)"
                          class="cursor-help"
                        >
                          {{ formatRelativeDate(entry.created_at) }}
                        </span>
                      </td>

                      <!-- User -->
                      <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center gap-3">
                          <div
                            class="w-8 h-8 rounded-full bg-[var(--secondary)] flex items-center justify-center text-xs font-medium text-[var(--muted-foreground)] overflow-hidden"
                          >
                            @if (entry.actor.avatar_url) {
                              <img
                                [src]="entry.actor.avatar_url"
                                [alt]="entry.actor.display_name"
                                class="w-full h-full object-cover"
                              />
                            } @else {
                              {{ getInitials(entry.actor.display_name) }}
                            }
                          </div>
                          <div>
                            <p
                              class="text-sm font-medium text-[var(--card-foreground)]"
                            >
                              {{ entry.actor.display_name }}
                            </p>
                            <p class="text-xs text-[var(--muted-foreground)]">
                              {{ entry.actor.email }}
                            </p>
                          </div>
                        </div>
                      </td>

                      <!-- Action -->
                      <td class="px-6 py-4 whitespace-nowrap">
                        <span [class]="getActionBadgeClass(entry.action)">
                          {{ formatAction(entry.action) }}
                        </span>
                      </td>

                      <!-- Entity -->
                      <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center gap-2">
                          <span
                            [class]="getEntityTypeBadgeClass(entry.entity_type)"
                          >
                            {{ formatEntityType(entry.entity_type) }}
                          </span>
                          <span class="text-xs text-[var(--muted-foreground)] font-mono">
                            {{ entry.entity_id.slice(0, 8) }}...
                          </span>
                        </div>
                      </td>

                      <!-- IP Address -->
                      <td
                        class="px-6 py-4 whitespace-nowrap text-sm text-[var(--muted-foreground)] font-mono"
                      >
                        {{ entry.ip_address || '-' }}
                      </td>

                      <!-- Details -->
                      <td class="px-6 py-4">
                        @if (
                          entry.details && Object.keys(entry.details).length > 0
                        ) {
                          <button
                            class="p-1 rounded hover:bg-[var(--muted)] transition-colors"
                            (click)="toggleDetails(entry.id)"
                            [pTooltip]="
                              expandedDetails().has(entry.id)
                                ? 'Hide details'
                                : 'Show details'
                            "
                          >
                            <i
                              [class]="
                                expandedDetails().has(entry.id)
                                  ? 'pi pi-chevron-up'
                                  : 'pi pi-chevron-down'
                              "
                            ></i>
                          </button>
                        } @else {
                          <span class="text-[var(--muted-foreground)] text-sm">-</span>
                        }
                      </td>
                    </tr>

                    <!-- Expanded Details Row -->
                    @if (expandedDetails().has(entry.id) && entry.details) {
                      <tr class="bg-[var(--secondary)]">
                        <td colspan="6" class="px-6 py-4">
                          <pre
                            class="text-xs bg-[var(--secondary)] p-3 rounded overflow-x-auto max-w-full"
                            >{{ formatDetails(entry.details) }}</pre
                          >
                        </td>
                      </tr>
                    }
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
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class AuditLogComponent implements OnInit, OnDestroy {
  private adminService = inject(AdminService);
  private destroy$ = new Subject<void>();
  private searchSubject$ = new Subject<string>();

  // State
  loading = signal(true);
  loadingMore = signal(false);
  error = signal<string | null>(null);
  entries = signal<AuditLogEntry[]>([]);
  nextCursor = signal<string | null>(null);
  availableActions = signal<string[]>([]);
  expandedDetails = signal<Set<string>>(new Set());

  // Select options
  actionOptions = computed(() =>
    this.availableActions().map((action) => ({
      label: this.formatAction(action),
      value: action,
    })),
  );

  entityTypeOptions = [
    { label: 'Task', value: 'task' },
    { label: 'Project', value: 'board' },
    { label: 'Workspace', value: 'workspace' },
    { label: 'User', value: 'user' },
    { label: 'Comment', value: 'comment' },
  ];

  // Filters
  searchQuery = '';
  selectedAction: string | null = null;
  selectedEntityType: string | null = null;
  dateFrom: Date | null = null;
  dateTo: Date | null = null;

  // Helper for template
  Object = Object;

  ngOnInit(): void {
    this.loadAuditActions();
    this.loadAuditLog();

    // Debounced search
    this.searchSubject$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadAuditLog();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadAuditActions(): void {
    this.adminService
      .getAuditActions()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (actions) => {
          this.availableActions.set(actions);
        },
        error: () => {
          // silently fail - actions list is non-critical
        },
      });
  }

  loadAuditLog(): void {
    this.loading.set(true);
    this.error.set(null);

    const params = this.buildParams();

    this.adminService
      .getAuditLog(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.entries.set(response.items);
          this.nextCursor.set(response.next_cursor);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Failed to load audit log. Please try again.');
          this.loading.set(false);
        },
      });
  }

  loadMore(): void {
    if (!this.nextCursor() || this.loadingMore()) return;

    this.loadingMore.set(true);

    const params = this.buildParams();
    params.cursor = this.nextCursor()!;

    this.adminService
      .getAuditLog(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.entries.update((current) => [...current, ...response.items]);
          this.nextCursor.set(response.next_cursor);
          this.loadingMore.set(false);
        },
        error: () => {
          this.loadingMore.set(false);
        },
      });
  }

  onSearchChange(query: string): void {
    this.searchSubject$.next(query);
  }

  hasActiveFilters(): boolean {
    return !!(
      this.searchQuery ||
      this.selectedAction ||
      this.selectedEntityType ||
      this.dateFrom ||
      this.dateTo
    );
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedAction = null;
    this.selectedEntityType = null;
    this.dateFrom = null;
    this.dateTo = null;
    this.loadAuditLog();
  }

  toggleDetails(entryId: string): void {
    this.expandedDetails.update((current) => {
      const next = new Set(current);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  }

  private buildParams(): AuditLogParams {
    const params: AuditLogParams = {
      page_size: 25,
    };

    if (this.searchQuery) {
      params.search = this.searchQuery;
    }
    if (this.selectedAction) {
      params.action = this.selectedAction;
    }
    if (this.selectedEntityType) {
      params.entity_type = this.selectedEntityType;
    }
    if (this.dateFrom) {
      params.date_from = this.dateFrom.toISOString();
    }
    if (this.dateTo) {
      params.date_to = this.dateTo.toISOString();
    }

    return params;
  }

  // Formatting helpers
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
      second: '2-digit',
    });
  }

  formatAction(action: string): string {
    return action
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  formatEntityType(entityType: string): string {
    if (entityType === 'board') return 'Project';
    return entityType.charAt(0).toUpperCase() + entityType.slice(1);
  }

  formatDetails(details: Record<string, unknown>): string {
    return JSON.stringify(details, null, 2);
  }

  getInitials(name: string): string {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getActionBadgeClass(action: string): string {
    const baseClasses =
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';

    const actionColors: Record<string, string> = {
      created: 'bg-green-100 text-[var(--success)]',
      updated: 'bg-blue-100 text-[var(--primary)]',
      deleted: 'bg-[var(--destructive)]/10 text-[var(--destructive)]ed-800',
      restored: 'bg-[var(--primary)]/10 text-[var(--primary)]',
      moved: 'bg-yellow-100 text-yellow-800',
      assigned: 'bg-primary/10 text-primary',
      unassigned: 'bg-[var(--secondary)] text-[var(--muted-foreground)]',
      commented: 'bg-cyan-100 text-cyan-800',
      login: 'bg-emerald-100 text-emerald-800',
      logout: 'bg-orange-100 text-orange-800',
    };

    return `${baseClasses} ${actionColors[action] || 'bg-[var(--secondary)] text-[var(--muted-foreground)]'}`;
  }

  getEntityTypeBadgeClass(entityType: string): string {
    const baseClasses =
      'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium';

    const typeColors: Record<string, string> = {
      task: 'bg-blue-50 text-[var(--primary)] ring-1 ring-blue-600/20',
      board: 'bg-[var(--primary)]/10 text-[var(--primary)] ring-1 ring-[var(--primary)]/20',
      workspace: 'bg-green-50 text-[var(--success)] ring-1 ring-green-600/20',
      user: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20',
      comment: 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-600/20',
    };

    return `${baseClasses} ${typeColors[entityType] || 'bg-[var(--secondary)] text-[var(--foreground)] ring-1 ring-[var(--border)]'}`;
  }
}
