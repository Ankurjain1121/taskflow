import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { Notification, NotificationEventType } from '../../../core/services/notification.service';

interface EventTypeConfig {
  icon: string;
  color: string;
}

const EVENT_TYPE_ICONS: Record<NotificationEventType, EventTypeConfig> = {
  task_assigned: { icon: 'assignment_ind', color: 'text-blue-500' },
  task_due_soon: { icon: 'schedule', color: 'text-orange-500' },
  task_overdue: { icon: 'warning', color: 'text-red-500' },
  task_commented: { icon: 'comment', color: 'text-green-500' },
  task_completed: { icon: 'check_circle', color: 'text-emerald-500' },
  mention_in_comment: { icon: 'alternate_email', color: 'text-purple-500' },
};

@Component({
  selector: 'app-notification-item',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatRippleModule],
  template: `
    <div
      matRipple
      class="flex items-start gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors"
      [class.border-l-4]="!notification.is_read"
      [class.border-l-blue-500]="!notification.is_read"
      [class.bg-blue-50]="!notification.is_read"
      (click)="onClick()"
    >
      <!-- Icon based on event type -->
      <div class="flex-shrink-0 mt-0.5">
        <mat-icon [class]="getIconConfig().color">
          {{ getIconConfig().icon }}
        </mat-icon>
      </div>

      <!-- Content -->
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-gray-900 truncate">
          {{ notification.title }}
        </p>
        <p class="text-sm text-gray-500 line-clamp-2">
          {{ notification.body }}
        </p>
        <p class="text-xs text-gray-400 mt-1">
          {{ getRelativeTime() }}
        </p>
      </div>

      <!-- Unread indicator dot -->
      <div
        *ngIf="!notification.is_read"
        class="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"
      ></div>
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
  @Input({ required: true }) notification!: Notification;
  @Output() notificationClick = new EventEmitter<Notification>();

  getIconConfig(): EventTypeConfig {
    return (
      EVENT_TYPE_ICONS[this.notification.event_type] || {
        icon: 'notifications',
        color: 'text-gray-500',
      }
    );
  }

  getRelativeTime(): string {
    const now = new Date();
    const created = new Date(this.notification.created_at);
    const diffMs = now.getTime() - created.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return created.toLocaleDateString();
    }
  }

  onClick(): void {
    this.notificationClick.emit(this.notification);
  }
}
