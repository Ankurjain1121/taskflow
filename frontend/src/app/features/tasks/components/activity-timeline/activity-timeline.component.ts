import {
  Component,
  input,
  signal,
  effect,
  inject,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { Subject, takeUntil } from 'rxjs';

import {
  ActivityService,
  ActivityLogEntry,
  ActivityAction,
} from '../../../../core/services/activity.service';

@Component({
  selector: 'app-activity-timeline',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
  ],
  template: `
    <div class="relative">
      @if (isLoading() && activities().length === 0) {
        <div class="flex items-center justify-center py-8">
          <mat-spinner diameter="32"></mat-spinner>
          <span class="ml-3 text-gray-500">Loading activity...</span>
        </div>
      } @else if (activities().length === 0) {
        <div class="text-center py-8 text-gray-500">
          <mat-icon class="text-4xl text-gray-300 mb-2">history</mat-icon>
          <p>No activity recorded yet.</p>
        </div>
      } @else {
        <!-- Timeline container -->
        <div class="relative">
          <!-- Vertical line -->
          <div
            class="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200"
            aria-hidden="true"
          ></div>

          <!-- Timeline items -->
          <div class="space-y-6">
            @for (activity of activities(); track activity.id) {
              <div class="relative flex items-start gap-4">
                <!-- Avatar / Icon -->
                <div class="relative z-10 flex-shrink-0">
                  @if (activity.actor.avatar_url) {
                    <img
                      [src]="activity.actor.avatar_url"
                      [alt]="activity.actor.display_name"
                      class="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
                    />
                  } @else {
                    <div
                      class="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium border-2 border-white shadow-sm"
                      [class]="getActionIconBgClass(activity.action)"
                    >
                      <mat-icon class="text-lg">{{ getActionIcon(activity.action) }}</mat-icon>
                    </div>
                  }
                </div>

                <!-- Content -->
                <div class="flex-1 min-w-0 pt-1.5">
                  <div class="text-sm">
                    <span class="font-medium text-gray-900">
                      {{ activity.actor.display_name }}
                    </span>
                    <span class="text-gray-600">
                      {{ getActionDescription(activity) }}
                    </span>
                  </div>
                  <div class="mt-0.5 text-xs text-gray-400">
                    {{ formatTimestamp(activity.created_at) }}
                  </div>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Show more button -->
        @if (nextCursor()) {
          <div class="mt-6 text-center">
            <button
              mat-stroked-button
              (click)="loadMore()"
              [disabled]="isLoadingMore()"
              class="text-sm"
            >
              @if (isLoadingMore()) {
                <mat-spinner diameter="16" class="inline-block mr-2"></mat-spinner>
                Loading...
              } @else {
                <mat-icon class="mr-1">expand_more</mat-icon>
                Show more activity
              }
            </button>
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
export class ActivityTimelineComponent implements OnDestroy {
  private activityService = inject(ActivityService);
  private destroy$ = new Subject<void>();

  taskId = input.required<string>();

  activities = signal<ActivityLogEntry[]>([]);
  nextCursor = signal<string | null>(null);
  isLoading = signal(false);
  isLoadingMore = signal(false);

  constructor() {
    // Load activities when taskId changes
    effect(() => {
      const taskId = this.taskId();
      if (taskId) {
        this.loadActivities();
      }
    });
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
      .listByTask(this.taskId(), undefined, 20)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.activities.set(response.items);
          this.nextCursor.set(response.nextCursor);
          this.isLoading.set(false);
        },
        error: (error) => {
          console.error('Failed to load activities:', error);
          this.isLoading.set(false);
        },
      });
  }

  loadMore(): void {
    const cursor = this.nextCursor();
    if (!cursor || this.isLoadingMore()) return;

    this.isLoadingMore.set(true);

    this.activityService
      .listByTask(this.taskId(), cursor, 20)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.activities.update((activities) => [...activities, ...response.items]);
          this.nextCursor.set(response.nextCursor);
          this.isLoadingMore.set(false);
        },
        error: (error) => {
          console.error('Failed to load more activities:', error);
          this.isLoadingMore.set(false);
        },
      });
  }

  getActionDescription(activity: ActivityLogEntry): string {
    const metadata = activity.metadata || {};

    switch (activity.action) {
      case 'created':
        return 'created this task';

      case 'updated':
        return 'updated this task';

      case 'moved':
        const fromColumn = metadata['from_column'] as string;
        const toColumn = metadata['to_column'] as string;
        if (fromColumn && toColumn) {
          return `moved from "${fromColumn}" to "${toColumn}"`;
        }
        return 'moved this task';

      case 'assigned':
        const assigneeName = metadata['assignee_name'] as string;
        if (assigneeName) {
          return `assigned to ${assigneeName}`;
        }
        return 'assigned this task';

      case 'unassigned':
        const prevAssigneeName = metadata['previous_assignee_name'] as string;
        if (prevAssigneeName) {
          return `unassigned ${prevAssigneeName}`;
        }
        return 'unassigned this task';

      case 'commented':
        return 'added a comment';

      case 'attached':
        const fileName = metadata['file_name'] as string;
        if (fileName) {
          return `attached "${fileName}"`;
        }
        return 'attached a file';

      case 'status_changed':
        const fromStatus = metadata['from_status'] as string;
        const toStatus = metadata['to_status'] as string;
        if (fromStatus && toStatus) {
          return `changed status from "${fromStatus}" to "${toStatus}"`;
        }
        return 'changed the status';

      case 'priority_changed':
        const fromPriority = metadata['from_priority'] as string;
        const toPriority = metadata['to_priority'] as string;
        if (fromPriority && toPriority) {
          return `changed priority from "${fromPriority}" to "${toPriority}"`;
        }
        return 'changed the priority';

      case 'deleted':
        return 'deleted this task';

      default:
        return 'performed an action';
    }
  }

  getActionIcon(action: ActivityAction): string {
    switch (action) {
      case 'created':
        return 'add_circle';
      case 'updated':
        return 'edit';
      case 'moved':
        return 'swap_horiz';
      case 'assigned':
        return 'person_add';
      case 'unassigned':
        return 'person_remove';
      case 'commented':
        return 'comment';
      case 'attached':
        return 'attach_file';
      case 'status_changed':
        return 'sync';
      case 'priority_changed':
        return 'flag';
      case 'deleted':
        return 'delete';
      default:
        return 'history';
    }
  }

  getActionIconBgClass(action: ActivityAction): string {
    switch (action) {
      case 'created':
        return 'bg-green-500';
      case 'updated':
        return 'bg-blue-500';
      case 'moved':
        return 'bg-purple-500';
      case 'assigned':
        return 'bg-indigo-500';
      case 'unassigned':
        return 'bg-orange-500';
      case 'commented':
        return 'bg-cyan-500';
      case 'attached':
        return 'bg-teal-500';
      case 'status_changed':
        return 'bg-yellow-500';
      case 'priority_changed':
        return 'bg-red-500';
      case 'deleted':
        return 'bg-gray-500';
      default:
        return 'bg-gray-400';
    }
  }

  formatTimestamp(timestamp: string): string {
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
