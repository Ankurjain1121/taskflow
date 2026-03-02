import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Ripple } from 'primeng/ripple';
import {
  Notification,
  NotificationEventType,
} from '../../../core/services/notification.service';

interface EventTypeConfig {
  icon: string;
  color: string;
}

const EVENT_TYPE_ICONS: Record<NotificationEventType, EventTypeConfig> = {
  task_assigned: { icon: 'pi pi-user', color: 'text-blue-500' },
  task_due_soon: { icon: 'pi pi-clock', color: 'text-orange-500' },
  task_overdue: { icon: 'pi pi-exclamation-triangle', color: 'text-red-500' },
  task_commented: { icon: 'pi pi-comment', color: 'text-green-500' },
  task_completed: { icon: 'pi pi-check-circle', color: 'text-emerald-500' },
  mention_in_comment: { icon: 'pi pi-at', color: 'text-purple-500' },
  task_updated_watcher: { icon: 'pi pi-eye', color: 'text-indigo-500' },
  task_reminder: { icon: 'pi pi-bell', color: 'text-amber-500' },
};

const EVENT_TYPE_BG: Record<NotificationEventType, string> = {
  task_assigned: 'bg-blue-100 dark:bg-blue-900/30',
  task_due_soon: 'bg-orange-100 dark:bg-orange-900/30',
  task_overdue: 'bg-red-100 dark:bg-red-900/30',
  task_commented: 'bg-green-100 dark:bg-green-900/30',
  task_completed: 'bg-emerald-100 dark:bg-emerald-900/30',
  mention_in_comment: 'bg-purple-100 dark:bg-purple-900/30',
  task_updated_watcher: 'bg-indigo-100 dark:bg-indigo-900/30',
  task_reminder: 'bg-amber-100 dark:bg-amber-900/30',
};

@Component({
  selector: 'app-notification-item',
  standalone: true,
  imports: [CommonModule, Ripple],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="group relative">
      <div
        pRipple
        class="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-gray-100 dark:border-gray-700"
        [ngClass]="{
          'border-l-4 border-l-blue-500 bg-blue-50/70 dark:bg-blue-900/20 hover:bg-blue-50 dark:hover:bg-blue-900/30':
            !notification().is_read,
          'hover:bg-gray-50 dark:hover:bg-gray-800': notification().is_read,
        }"
        (click)="onClick()"
      >
        <!-- Icon based on event type -->
        <div
          class="flex-shrink-0 mt-0.5 w-8 h-8 rounded-full flex items-center justify-center"
          [ngClass]="getIconBgClass()"
        >
          <i
            [class]="getIconConfig().icon + ' ' + getIconConfig().color"
            style="font-size: 1rem;"
          ></i>
        </div>

        <!-- Content -->
        <div class="flex-1 min-w-0">
          <p
            class="text-sm truncate"
            [ngClass]="{
              'font-semibold text-gray-900 dark:text-gray-100':
                !notification().is_read,
              'font-medium text-gray-700 dark:text-gray-300':
                notification().is_read,
            }"
          >
            {{ notification().title }}
          </p>
          <p
            class="text-sm line-clamp-2 mt-0.5"
            [ngClass]="{
              'text-gray-600 dark:text-gray-400': !notification().is_read,
              'text-gray-500 dark:text-gray-500': notification().is_read,
            }"
          >
            {{ notification().body }}
          </p>
          <div class="flex items-center gap-2 mt-1">
            <p class="text-xs text-gray-400 dark:text-gray-500">
              {{ getRelativeTime() }}
            </p>
            @if (notification().link_url) {
              <span class="text-xs text-blue-500 dark:text-blue-400"> View </span>
            }
          </div>
        </div>

        <!-- Unread indicator dot -->
        @if (!notification().is_read) {
          <div
            class="flex-shrink-0 w-2.5 h-2.5 bg-blue-500 rounded-full mt-2 shadow-sm"
          ></div>
        }
      </div>
      <!-- Dismiss button (hover reveal) -->
      <button
        class="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity
               w-5 h-5 rounded-full flex items-center justify-center z-10
               hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        (click)="onDismiss($event)"
        title="Dismiss"
        aria-label="Dismiss notification"
      >
        <i class="pi pi-times" style="font-size: 0.6rem;"></i>
      </button>
    </div>
  `,
  styles: [
    `
      .line-clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
    `,
  ],
})
export class NotificationItemComponent {
  notification = input.required<Notification>();
  notificationClick = output<Notification>();
  dismiss = output<string>();

  getIconConfig(): EventTypeConfig {
    return (
      EVENT_TYPE_ICONS[this.notification().event_type] || {
        icon: 'pi pi-bell',
        color: 'text-gray-500',
      }
    );
  }

  getIconBgClass(): string {
    return (
      EVENT_TYPE_BG[this.notification().event_type] ||
      'bg-gray-100 dark:bg-gray-800'
    );
  }

  getRelativeTime(): string {
    const now = new Date();
    const created = new Date(this.notification().created_at);
    const diffMs = now.getTime() - created.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) {
      return 'Just now';
    } else if (diffMinutes === 1) {
      return '1 min ago';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} min ago`;
    } else if (diffHours === 1) {
      return '1 hour ago';
    } else if (diffHours < 24) {
      return `${diffHours} hours ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return created.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year:
          created.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }
  }

  onClick(): void {
    this.notificationClick.emit(this.notification());
  }

  onDismiss(event: Event): void {
    event.stopPropagation();
    this.dismiss.emit(this.notification().id);
  }
}
