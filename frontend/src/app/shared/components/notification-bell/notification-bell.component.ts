import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  signal,
  computed,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { BadgeModule } from 'primeng/badge';
import { Popover, PopoverModule } from 'primeng/popover';
import { DividerModule } from 'primeng/divider';
import { ProgressSpinner } from 'primeng/progressspinner';
import { SelectButton } from 'primeng/selectbutton';
import { Tooltip } from 'primeng/tooltip';
import { FormsModule } from '@angular/forms';
import {
  NotificationService,
  Notification,
  NotificationEventType,
} from '../../../core/services/notification.service';
import { NotificationSoundService } from '../../../core/services/notification-sound.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationItemComponent } from './notification-item.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';

type NotificationTab =
  | 'all'
  | 'assignments'
  | 'comments'
  | 'mentions'
  | 'deadlines';

const TAB_EVENT_TYPES: Record<
  Exclude<NotificationTab, 'all'>,
  NotificationEventType[]
> = {
  assignments: ['task_assigned', 'task_completed'],
  comments: ['task_commented'],
  mentions: ['mention_in_comment'],
  deadlines: ['task_due_soon', 'task_overdue'],
};

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonModule,
    BadgeModule,
    PopoverModule,
    DividerModule,
    ProgressSpinner,
    SelectButton,
    Tooltip,
    FormsModule,
    NotificationItemComponent,
    EmptyStateComponent,
  ],
  template: `
    <!-- Bell button with badge -->
    <p-button
      icon="pi pi-bell"
      [text]="true"
      [rounded]="true"
      severity="secondary"
      [badge]="
        notificationService.unreadCount() > 0
          ? notificationService.displayBadge()
          : undefined
      "
      badgeSeverity="danger"
      aria-label="Notifications"
      (onClick)="onBellClick($event)"
    />

    <!-- Notification popover -->
    <p-popover #notifPopover [style]="{ width: '22rem' }">
      <div (click)="$event.stopPropagation()">
        <!-- Header -->
        <div
          class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700"
        >
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Notifications
          </h3>
          <div class="flex items-center gap-1">
            <p-button
              [icon]="
                soundService.soundEnabled()
                  ? 'pi pi-volume-up'
                  : 'pi pi-volume-off'
              "
              [text]="true"
              [rounded]="true"
              severity="secondary"
              size="small"
              [pTooltip]="
                soundService.soundEnabled()
                  ? 'Mute notifications'
                  : 'Unmute notifications'
              "
              (onClick)="toggleSound()"
            />
            @if (notificationService.unreadCount() > 0) {
              <p-button
                label="Mark all read"
                [text]="true"
                size="small"
                (onClick)="markAllRead()"
              />
            }
          </div>
        </div>

        <!-- Filter tabs -->
        <div
          class="px-3 py-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto"
        >
          <p-selectButton
            [options]="tabOptions"
            [(ngModel)]="activeTabValue"
            (ngModelChange)="onTabChange($event)"
            [allowEmpty]="false"
            optionLabel="label"
            optionValue="value"
            size="small"
          />
        </div>

        <!-- Notification list -->
        <div
          #scrollContainer
          class="max-h-96 overflow-y-auto"
          (scroll)="onScroll($event)"
        >
          <!-- Empty state -->
          @if (filteredNotifications().length === 0 && !isInitialLoading()) {
            <app-empty-state
              variant="notifications"
              size="compact"
              [title]="
                activeTab() === 'all'
                  ? ''
                  : 'No ' + activeTab() + ' notifications'
              "
            />
          }

          <!-- Initial loading -->
          @if (isInitialLoading()) {
            <div class="flex items-center justify-center py-8">
              <p-progressSpinner
                [style]="{ width: '32px', height: '32px' }"
                strokeWidth="4"
              />
            </div>
          }

          <!-- Notification items grouped by time -->
          @if (!isInitialLoading()) {
            <div>
              <!-- Today section -->
              @if (todayNotifications().length > 0) {
                <div
                  class="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-gray-800"
                >
                  Today
                </div>
                @for (
                  notification of todayNotifications();
                  track notification.id
                ) {
                  <app-notification-item
                    [notification]="notification"
                    (notificationClick)="onNotificationClick($event)"
                    (dismiss)="onDismissNotification($event)"
                  />
                }
              }

              <!-- Earlier section -->
              @if (earlierNotifications().length > 0) {
                <div
                  class="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-gray-800"
                >
                  Earlier
                </div>
                @for (
                  notification of earlierNotifications();
                  track notification.id
                ) {
                  <app-notification-item
                    [notification]="notification"
                    (notificationClick)="onNotificationClick($event)"
                    (dismiss)="onDismissNotification($event)"
                  />
                }
              }

              <!-- Load more spinner -->
              @if (notificationService.isLoading()) {
                <div class="flex items-center justify-center py-4">
                  <p-progressSpinner
                    [style]="{ width: '24px', height: '24px' }"
                    strokeWidth="4"
                  />
                </div>
              }

              <!-- End of list -->
              @if (
                !notificationService.hasMore() &&
                filteredNotifications().length > 0
              ) {
                <div
                  class="text-center py-3 text-gray-400 dark:text-gray-500 text-sm"
                >
                  No more notifications
                </div>
              }
            </div>
          }
        </div>

        <!-- Footer -->
        <p-divider />
        <div class="px-4 py-2">
          <p-button
            label="Notification Settings"
            [text]="true"
            styleClass="w-full"
            size="small"
            (onClick)="goToSettings()"
          />
        </div>
      </div>
    </p-popover>
  `,
  styles: [
    `
      :host {
        display: inline-block;
      }
    `,
  ],
})
export class NotificationBellComponent implements OnInit, OnDestroy {
  @ViewChild('scrollContainer') scrollContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('notifPopover') notifPopover!: Popover;

  activeTab = signal<NotificationTab>('all');
  activeTabValue: NotificationTab = 'all';
  isInitialLoading = signal(false);
  private hasLoadedInitial = false;

  tabOptions = [
    { label: 'All', value: 'all' as NotificationTab },
    { label: 'Assignments', value: 'assignments' as NotificationTab },
    { label: 'Comments', value: 'comments' as NotificationTab },
    { label: 'Mentions', value: 'mentions' as NotificationTab },
    { label: 'Deadlines', value: 'deadlines' as NotificationTab },
  ];

  filteredNotifications = computed(() => {
    const tab = this.activeTab();
    const notifications = this.notificationService.notifications();
    if (tab === 'all') {
      return notifications;
    }
    const allowedTypes = TAB_EVENT_TYPES[tab];
    return notifications.filter((n) => allowedTypes.includes(n.event_type));
  });

  todayNotifications = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.filteredNotifications().filter(
      (n) => new Date(n.created_at) >= today,
    );
  });

  earlierNotifications = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.filteredNotifications().filter(
      (n) => new Date(n.created_at) < today,
    );
  });

  private authService = inject(AuthService);

  constructor(
    public notificationService: NotificationService,
    public soundService: NotificationSoundService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    // Only start real-time updates when authenticated
    if (this.authService.isAuthenticated()) {
      this.notificationService.startRealTimeUpdates();
    }
  }

  ngOnDestroy(): void {
    this.notificationService.stopRealTimeUpdates();
  }

  onBellClick(event: Event): void {
    this.notifPopover.toggle(event);
    if (!this.hasLoadedInitial) {
      this.loadInitialNotifications();
    }
  }

  private loadInitialNotifications(): void {
    this.isInitialLoading.set(true);
    this.notificationService.listNotifications().subscribe({
      next: () => {
        this.isInitialLoading.set(false);
        this.hasLoadedInitial = true;
      },
      error: () => {
        this.isInitialLoading.set(false);
      },
    });
  }

  onScroll(event: Event): void {
    const element = event.target as HTMLDivElement;
    const threshold = 100; // pixels from bottom

    if (
      element.scrollHeight - element.scrollTop - element.clientHeight <
      threshold
    ) {
      this.loadMore();
    }
  }

  private loadMore(): void {
    const observable = this.notificationService.loadMore();
    if (observable) {
      observable.subscribe();
    }
  }

  onNotificationClick(notification: Notification): void {
    // Mark as read
    if (!notification.is_read) {
      this.notificationService.markRead(notification.id).subscribe();
    }

    // Navigate to link if provided
    if (notification.link_url) {
      this.notifPopover.hide();
      // Handle both internal and external links
      if (notification.link_url.startsWith('/')) {
        this.router.navigateByUrl(notification.link_url);
      } else {
        window.open(notification.link_url, '_blank');
      }
    }
  }

  markAllRead(): void {
    this.notificationService.markAllRead().subscribe();
  }

  onTabChange(tab: NotificationTab): void {
    if (tab) {
      this.activeTab.set(tab);
    }
  }

  toggleSound(): void {
    this.soundService.toggleSound();
  }

  goToSettings(): void {
    this.notifPopover.hide();
    this.router.navigate(['/settings/notifications']);
  }

  onDismissNotification(id: string): void {
    this.notificationService.dismissNotification(id).subscribe({
      error: () => {
        // Reload notifications on error to restore state
        this.notificationService.listNotifications().subscribe();
      },
    });
  }
}
