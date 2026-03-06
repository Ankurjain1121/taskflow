import {
  Component,
  input,
  signal,
  inject,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  WorkspaceService,
  AuditLogEntry,
} from '../../../core/services/workspace.service';

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="py-6 space-y-4">
      <div>
        <h3 class="text-lg font-semibold text-[var(--foreground)]">
          Audit Log
        </h3>
        <p class="text-sm text-[var(--muted-foreground)] mt-1">
          Activity history across this workspace.
        </p>
      </div>

      <!-- Filters -->
      <div class="flex flex-wrap gap-3">
        <select
          [(ngModel)]="actionFilter"
          (ngModelChange)="loadLog()"
          class="px-3 py-2 text-sm border border-[var(--border)] rounded-md bg-[var(--background)] text-[var(--foreground)]"
        >
          <option value="">All actions</option>
          @for (a of actions(); track a) {
            <option [value]="a">{{ formatAction(a) }}</option>
          }
        </select>
        <select
          [(ngModel)]="entityFilter"
          (ngModelChange)="loadLog()"
          class="px-3 py-2 text-sm border border-[var(--border)] rounded-md bg-[var(--background)] text-[var(--foreground)]"
        >
          <option value="">All types</option>
          <option value="task">Task</option>
          <option value="board">Board</option>
          <option value="workspace">Workspace</option>
        </select>
      </div>

      <!-- Log entries -->
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
      } @else if (entries().length === 0) {
        <div class="text-center py-8 text-[var(--muted-foreground)]">
          <i class="pi pi-history text-3xl mb-2 block opacity-40"></i>
          <p class="text-sm">No activity found.</p>
        </div>
      } @else {
        <div class="space-y-0">
          @for (entry of entries(); track entry.id) {
            <div
              class="flex items-start gap-3 py-3 border-b border-[var(--border)] last:border-0"
            >
              <div
                class="mt-1 w-8 h-8 rounded-full bg-[var(--muted)] flex items-center justify-center flex-shrink-0 text-xs font-bold text-[var(--muted-foreground)]"
              >
                {{ getInitials(entry.user_name) }}
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm text-[var(--foreground)]">
                  <span class="font-medium">{{ entry.user_name }}</span>
                  {{ describeAction(entry) }}
                </p>
                @if (entry.metadata) {
                  <p
                    class="text-xs text-[var(--muted-foreground)] mt-0.5 truncate"
                  >
                    {{ summarizeMetadata(entry.metadata) }}
                  </p>
                }
              </div>
              <span
                class="text-xs text-[var(--muted-foreground)] whitespace-nowrap flex-shrink-0"
              >
                {{ formatTimeAgo(entry.created_at) }}
              </span>
            </div>
          }
        </div>

        <!-- Load more -->
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
export class AuditLogComponent implements OnInit {
  private workspaceService = inject(WorkspaceService);

  workspaceId = input.required<string>();

  entries = signal<AuditLogEntry[]>([]);
  actions = signal<string[]>([]);
  loading = signal(true);
  loadingMore = signal(false);
  nextCursor = signal<string | null>(null);

  actionFilter = '';
  entityFilter = '';

  ngOnInit(): void {
    this.loadLog();
    this.loadActions();
  }

  loadLog(): void {
    this.loading.set(true);
    this.workspaceService
      .listAuditLog(this.workspaceId(), {
        page_size: 25,
        action: this.actionFilter || undefined,
        entity_type: this.entityFilter || undefined,
      })
      .subscribe({
        next: (result) => {
          this.entries.set(result.items);
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
      .listAuditLog(this.workspaceId(), {
        cursor,
        page_size: 25,
        action: this.actionFilter || undefined,
        entity_type: this.entityFilter || undefined,
      })
      .subscribe({
        next: (result) => {
          this.entries.update((prev) => [...prev, ...result.items]);
          this.nextCursor.set(result.next_cursor);
          this.loadingMore.set(false);
        },
        error: () => {
          this.loadingMore.set(false);
        },
      });
  }

  private loadActions(): void {
    this.workspaceService.listAuditActions(this.workspaceId()).subscribe({
      next: (result) => this.actions.set(result.actions),
    });
  }

  formatAction(action: string): string {
    return action.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  }

  describeAction(entry: AuditLogEntry): string {
    const action = this.formatAction(entry.action).toLowerCase();
    return `${action} a ${entry.entity_type}`;
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }

  summarizeMetadata(metadata: Record<string, unknown>): string {
    const keys = Object.keys(metadata);
    if (keys.length === 0) return '';
    const parts = keys
      .slice(0, 3)
      .map((k) => `${k}: ${String(metadata[k])}`)
      .join(', ');
    return parts;
  }

  formatTimeAgo(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }
}
