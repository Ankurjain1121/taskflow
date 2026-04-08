import {
  Component,
  input,
  signal,
  effect,
  inject,
  Injector,
  OnInit,
  OnDestroy,
  untracked,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { Subject, takeUntil } from 'rxjs';

import {
  ActivityService,
  ActivityAction,
} from '../../../core/services/activity.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

/** Flat activity entry matching backend ActivityLogWithActor serialization */
interface ProjectActivityEntry {
  id: string;
  action: ActivityAction;
  entity_type: string;
  entity_id: string;
  user_id: string;
  metadata: Record<string, unknown> | null;
  tenant_id: string;
  created_at: string;
  actor_name: string;
  actor_avatar_url: string | null;
}

interface ProjectActivityResponse {
  items: ProjectActivityEntry[];
  next_cursor: string | null;
}

@Component({
  selector: 'app-activity-feed',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ButtonModule,
    ProgressSpinnerModule,
    EmptyStateComponent,
  ],
  template: `
    <div class="relative p-4">
      @if (isLoading() && activities().length === 0) {
        <div class="flex items-center justify-center py-12">
          <p-progressSpinner
            [style]="{ width: '32px', height: '32px' }"
            strokeWidth="4"
          />
          <span class="ml-3 text-[var(--muted-foreground)]"
            >Loading activity...</span
          >
        </div>
      } @else if (activities().length === 0) {
        <app-empty-state variant="activity" size="compact" />
      } @else {
        <div class="relative">
          <!-- Vertical timeline line -->
          <div
            class="absolute left-5 top-0 bottom-0 w-0.5 bg-[var(--border)]"
            aria-hidden="true"
          ></div>

          <div class="space-y-4">
            @for (activity of activities(); track activity.id) {
              <div class="relative flex items-start gap-3 pl-0">
                <!-- Icon circle -->
                <div class="relative z-10 flex-shrink-0">
                  <div
                    class="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium border-2 border-[var(--card)] shadow-sm"
                    [ngClass]="getActionBgClass(activity.action)"
                  >
                    <i [ngClass]="'pi ' + getActionIcon(activity.action)"></i>
                  </div>
                </div>

                <!-- Content -->
                <div class="flex-1 min-w-0 pt-1">
                  <div class="text-sm leading-relaxed">
                    <span class="font-semibold text-[var(--foreground)]">
                      {{ activity.actor_name }}
                    </span>
                    <span class="text-[var(--muted-foreground)]">
                      {{ describeAction(activity) }}
                    </span>
                  </div>
                  <div class="mt-0.5 text-xs text-[var(--muted-foreground)]">
                    {{ timeAgo(activity.created_at) }}
                  </div>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Load more -->
        @if (nextCursor()) {
          <div class="mt-6 text-center">
            <p-button
              [outlined]="true"
              (onClick)="loadMore()"
              [disabled]="isLoadingMore()"
              size="small"
            >
              @if (isLoadingMore()) {
                <p-progressSpinner
                  [style]="{ width: '16px', height: '16px' }"
                  strokeWidth="4"
                  styleClass="inline-block mr-2"
                />
                Loading...
              } @else {
                <i class="pi pi-chevron-down mr-1"></i>
                Load more activity
              }
            </p-button>
          </div>
        }
      }
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
export class ActivityFeedComponent implements OnInit, OnDestroy {
  private activityService = inject(ActivityService);
  private injector = inject(Injector);
  private destroy$ = new Subject<void>();

  boardId = input.required<string>();

  activities = signal<ProjectActivityEntry[]>([]);
  nextCursor = signal<string | null>(null);
  isLoading = signal(false);
  isLoadingMore = signal(false);

  ngOnInit(): void {
    effect(
      () => {
        const boardId = this.boardId();
        untracked(() => {
          if (boardId) {
            this.loadActivities();
          }
        });
      },
      { injector: this.injector },
    );
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadActivities(): void {
    this.isLoading.set(true);
    this.activities.set([]);
    this.nextCursor.set(null);

    this.activityService
      .listByProject(this.boardId(), undefined, 50)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const typed = response as unknown as ProjectActivityResponse;
          this.activities.set(typed.items);
          this.nextCursor.set(typed.next_cursor);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
        },
      });
  }

  loadMore(): void {
    const cursor = this.nextCursor();
    if (!cursor || this.isLoadingMore()) return;

    this.isLoadingMore.set(true);

    this.activityService
      .listByProject(this.boardId(), cursor, 50)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const typed = response as unknown as ProjectActivityResponse;
          this.activities.update((prev) => [...prev, ...typed.items]);
          this.nextCursor.set(typed.next_cursor);
          this.isLoadingMore.set(false);
        },
        error: () => {
          this.isLoadingMore.set(false);
        },
      });
  }

  describeAction(activity: ProjectActivityEntry): string {
    const meta = activity.metadata ?? {};
    const entityLabel = activity.entity_type === 'board' ? 'project' : activity.entity_type;

    switch (activity.action) {
      case 'created':
        return `created a ${entityLabel}`;
      case 'updated':
        return `updated a ${entityLabel}`;
      case 'moved': {
        const from = meta['from_column'] as string;
        const to = meta['to_column'] as string;
        if (from && to) {
          return `moved a task from "${from}" to "${to}"`;
        }
        return `moved a ${entityLabel}`;
      }
      case 'assigned': {
        const name = meta['assignee_name'] as string;
        return name ? `assigned ${name} to a task` : `assigned a task`;
      }
      case 'unassigned': {
        const name = meta['previous_assignee_name'] as string;
        return name ? `unassigned ${name} from a task` : `unassigned a task`;
      }
      case 'commented':
        return 'commented on a task';
      case 'attached': {
        const file = meta['file_name'] as string;
        return file ? `attached "${file}"` : 'attached a file';
      }
      case 'status_changed': {
        const from = meta['from_status'] as string;
        const to = meta['to_status'] as string;
        if (from && to) {
          return `changed status from "${from}" to "${to}"`;
        }
        return 'changed the status';
      }
      case 'priority_changed': {
        const from = meta['from_priority'] as string;
        const to = meta['to_priority'] as string;
        if (from && to) {
          return `changed priority from "${from}" to "${to}"`;
        }
        return 'changed the priority';
      }
      case 'deleted':
        return `deleted a ${entityLabel}`;
      default:
        return 'performed an action';
    }
  }

  getActionIcon(action: ActivityAction): string {
    switch (action) {
      case 'created':
        return 'pi-plus-circle';
      case 'updated':
        return 'pi-pencil';
      case 'moved':
        return 'pi-arrows-h';
      case 'assigned':
        return 'pi-user-plus';
      case 'unassigned':
        return 'pi-user-minus';
      case 'commented':
        return 'pi-comment';
      case 'attached':
        return 'pi-paperclip';
      case 'status_changed':
        return 'pi-sync';
      case 'priority_changed':
        return 'pi-flag';
      case 'deleted':
        return 'pi-trash';
      default:
        return 'pi-history';
    }
  }

  getActionBgClass(action: ActivityAction): string {
    switch (action) {
      case 'created':
        return 'bg-[var(--success)]';
      case 'updated':
        return 'bg-[var(--primary)]';
      case 'moved':
        return 'bg-[var(--primary)]';
      case 'assigned':
        return 'bg-primary';
      case 'unassigned':
        return 'bg-orange-500';
      case 'commented':
        return 'bg-cyan-500';
      case 'attached':
        return 'bg-teal-500';
      case 'status_changed':
        return 'bg-yellow-500';
      case 'priority_changed':
        return 'bg-[var(--destructive)]';
      case 'deleted':
        return 'bg-[var(--muted-foreground)]';
      default:
        return 'bg-[var(--muted-foreground)]';
    }
  }

  timeAgo(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'just now';
    } else if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        hour: 'numeric',
        minute: '2-digit',
      });
    }
  }
}
