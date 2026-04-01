import {
  Component,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  OnInit,
} from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import {
  NotificationService,
  Notification,
} from '../../core/services/notification.service';
import type { NotificationEventType } from '../../core/services/notification.types';

type FilterTab = 'all' | 'assigned' | 'comments' | 'mentions' | 'due';

interface FilterOption {
  readonly key: FilterTab;
  readonly label: string;
}

interface NotificationGroup {
  readonly label: string;
  readonly items: Notification[];
}

@Component({
  selector: 'app-inbox',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  styles: [
    `
      :host {
        display: block;
        min-height: 100%;
      }
      .inbox-container {
        background: var(--card);
        border: 1px solid var(--border);
      }
      .filter-pill {
        border: 1px solid var(--border);
        color: var(--muted-foreground);
        background: transparent;
        transition: all 0.15s ease;
      }
      .filter-pill:hover {
        background: var(--muted);
        color: var(--foreground);
      }
      .filter-pill.active {
        background: var(--primary);
        color: var(--primary-foreground);
        border-color: var(--primary);
      }
      .notif-item {
        border-bottom: 1px solid var(--border);
        transition: background 0.12s ease;
        cursor: pointer;
      }
      .notif-item:hover {
        background: var(--muted);
      }
      .notif-item.unread {
        background: color-mix(in srgb, var(--primary) 4%, var(--card));
      }
      .notif-item.unread:hover {
        background: color-mix(in srgb, var(--primary) 8%, var(--card));
      }
      .unread-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--primary);
        flex-shrink: 0;
      }
      .group-label {
        color: var(--muted-foreground);
        background: var(--background);
        border-bottom: 1px solid var(--border);
      }
      .load-more-btn {
        color: var(--primary);
        transition: opacity 0.15s ease;
      }
      .load-more-btn:hover {
        opacity: 0.8;
      }
      .skeleton-line {
        background: var(--muted);
        border-radius: 4px;
        animation: pulse 1.5s ease-in-out infinite;
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `,
  ],
  template: `
    <div class="max-w-3xl mx-auto px-4 py-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-2xl font-bold" style="color: var(--foreground)">
          Inbox
        </h1>
        @if (notificationService.unreadCount() > 0) {
          <button
            class="text-sm font-medium px-3 py-1.5 rounded-md transition-colors"
            style="color: var(--primary)"
            (click)="markAllRead()"
          >
            Mark all read
          </button>
        }
      </div>

      <!-- Filter tabs -->
      <div class="flex gap-2 mb-4 flex-wrap">
        @for (tab of filterTabs; track tab.key) {
          <button
            class="filter-pill px-3 py-1.5 rounded-full text-sm font-medium"
            [class.active]="activeFilter() === tab.key"
            [attr.aria-pressed]="activeFilter() === tab.key"
            (click)="activeFilter.set(tab.key)"
          >
            {{ tab.label }}
          </button>
        }
      </div>

      <!-- Content -->
      <div class="inbox-container rounded-lg overflow-hidden">
        @if (initialLoading()) {
          <!-- Loading skeleton -->
          @for (i of skeletonRows; track i) {
            <div class="flex items-center gap-3 px-4 py-3.5" style="border-bottom: 1px solid var(--border)">
              <div class="skeleton-line w-2 h-2 rounded-full flex-shrink-0"></div>
              <div class="skeleton-line w-5 h-5 rounded flex-shrink-0"></div>
              <div class="flex-1 space-y-1.5">
                <div class="skeleton-line h-4 w-3/4"></div>
                <div class="skeleton-line h-3 w-1/3"></div>
              </div>
            </div>
          }
        } @else if (filteredGroups().length === 0) {
          <!-- Empty state -->
          <div class="flex flex-col items-center justify-center py-16 px-4">
            <div
              class="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style="background: color-mix(in srgb, var(--success) 12%, var(--card))"
            >
              <i class="pi pi-check-circle text-2xl" style="color: var(--success)"></i>
            </div>
            <p class="text-xl font-semibold mb-1" style="color: var(--foreground)">
              All caught up!
            </p>
            <p class="text-sm" style="color: var(--muted-foreground)">
              You're all caught up — nothing needs your attention right now.
            </p>
          </div>
        } @else {
          <!-- Grouped notifications -->
          @for (group of filteredGroups(); track group.label) {
            <div class="group-label px-4 py-2 text-xs font-semibold uppercase tracking-wider">
              {{ group.label }}
            </div>
            @for (notif of group.items; track notif.id) {
              <div
                class="notif-item flex items-start gap-3 px-4 py-3"
                [class.unread]="!notif.is_read"
                (click)="onNotificationClick(notif)"
              >
                <div class="mt-1.5 w-2 flex-shrink-0 flex justify-center">
                  @if (!notif.is_read) {
                    <div class="unread-dot"></div>
                  }
                </div>
                <div
                  class="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                  style="background: var(--muted)"
                >
                  <i
                    [class]="getIcon(notif.event_type)"
                    style="font-size: 0.85rem; color: var(--muted-foreground)"
                  ></i>
                </div>
                <div class="flex-1 min-w-0">
                  <p
                    class="text-sm leading-snug"
                    [style.color]="notif.is_read ? 'var(--muted-foreground)' : 'var(--foreground)'"
                    [style.font-weight]="notif.is_read ? '400' : '500'"
                  >
                    {{ notif.title }}
                  </p>
                  @if (notif.body) {
                    <p
                      class="text-xs mt-0.5 truncate"
                      style="color: var(--muted-foreground)"
                    >
                      {{ notif.body }}
                    </p>
                  }
                  <p class="text-xs mt-1" style="color: var(--muted-foreground); opacity: 0.7">
                    {{ relativeTime(notif.created_at) }}
                  </p>
                </div>
              </div>
            }
          }

          <!-- Load more -->
          @if (notificationService.hasMore()) {
            <div class="flex justify-center py-3" style="border-top: 1px solid var(--border)">
              @if (notificationService.isLoading()) {
                <span class="text-sm" style="color: var(--muted-foreground)">Loading...</span>
              } @else {
                <button class="load-more-btn text-sm font-medium py-1" (click)="loadMore()">
                  Load more
                </button>
              }
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class InboxComponent implements OnInit {
  readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);

  readonly activeFilter = signal<FilterTab>('all');
  readonly initialLoading = signal(true);
  readonly skeletonRows = [1, 2, 3, 4, 5];

  readonly filterTabs: readonly FilterOption[] = [
    { key: 'all', label: 'All' },
    { key: 'assigned', label: 'Assigned' },
    { key: 'comments', label: 'Comments' },
    { key: 'mentions', label: 'Mentions' },
    { key: 'due', label: 'Due' },
  ] as const;

  private readonly filterMap: Record<FilterTab, NotificationEventType[]> = {
    all: [],
    assigned: ['task_assigned'],
    comments: ['task_commented'],
    mentions: ['mention_in_comment'],
    due: ['task_due_soon', 'task_overdue'],
  };

  readonly filteredGroups = computed<NotificationGroup[]>(() => {
    const all = this.notificationService.notifications();
    const filterTypes = this.filterMap[this.activeFilter()];
    const filtered =
      filterTypes.length === 0
        ? all
        : all.filter((n) => filterTypes.includes(n.event_type));

    if (filtered.length === 0) return [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);

    const today: Notification[] = [];
    const yesterday: Notification[] = [];
    const earlier: Notification[] = [];

    for (const n of filtered) {
      const d = new Date(n.created_at);
      if (d >= todayStart) {
        today.push(n);
      } else if (d >= yesterdayStart) {
        yesterday.push(n);
      } else {
        earlier.push(n);
      }
    }

    const groups: NotificationGroup[] = [];
    if (today.length > 0) groups.push({ label: 'Today', items: today });
    if (yesterday.length > 0) groups.push({ label: 'Yesterday', items: yesterday });
    if (earlier.length > 0) groups.push({ label: 'Earlier', items: earlier });
    return groups;
  });

  ngOnInit(): void {
    this.notificationService.listNotifications().subscribe({
      next: () => this.initialLoading.set(false),
      error: () => this.initialLoading.set(false),
    });
  }

  onNotificationClick(notif: Notification): void {
    if (!notif.is_read) {
      this.notificationService.markRead(notif.id).subscribe();
    }
    if (notif.link_url) {
      this.router.navigateByUrl(notif.link_url);
    }
  }

  markAllRead(): void {
    this.notificationService.markAllRead().subscribe();
  }

  loadMore(): void {
    this.notificationService.loadMore()?.subscribe();
  }

  getIcon(eventType: NotificationEventType): string {
    const icons: Record<string, string> = {
      task_assigned: 'pi pi-user-plus',
      task_commented: 'pi pi-comment',
      mention_in_comment: 'pi pi-at',
      task_due_soon: 'pi pi-clock',
      task_overdue: 'pi pi-exclamation-circle',
      task_completed: 'pi pi-check-circle',
      task_updated_watcher: 'pi pi-eye',
      task_reminder: 'pi pi-bell',
    };
    return icons[eventType] ?? 'pi pi-bell';
  }

  relativeTime(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(dateStr).toLocaleDateString();
  }
}
