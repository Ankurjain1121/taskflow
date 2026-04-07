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
  task_assigned: { icon: 'pi pi-user', color: 'text-[var(--primary)]' },
  task_due_soon: { icon: 'pi pi-clock', color: 'text-[var(--accent-warm)]' },
  task_overdue: { icon: 'pi pi-exclamation-triangle', color: 'text-[var(--destructive)]' },
  task_commented: { icon: 'pi pi-comment', color: 'text-[var(--success)]' },
  task_completed: { icon: 'pi pi-check-circle', color: 'text-[var(--success)]' },
  mention_in_comment: { icon: 'pi pi-at', color: 'text-[var(--primary)]' },
  task_updated_watcher: { icon: 'pi pi-eye', color: 'text-[var(--muted-foreground)]' },
  task_reminder: { icon: 'pi pi-bell', color: 'text-[var(--accent-warm)]' },
};

const EVENT_TYPE_BG: Record<NotificationEventType, string> = {
  task_assigned: 'bg-[color-mix(in_srgb,var(--primary)_12%,var(--card))]',
  task_due_soon: 'bg-[color-mix(in_srgb,var(--accent-warm)_12%,var(--card))]',
  task_overdue: 'bg-[color-mix(in_srgb,var(--destructive)_12%,var(--card))]',
  task_commented: 'bg-[color-mix(in_srgb,var(--success)_12%,var(--card))]',
  task_completed: 'bg-[color-mix(in_srgb,var(--success)_12%,var(--card))]',
  mention_in_comment: 'bg-[color-mix(in_srgb,var(--primary)_12%,var(--card))]',
  task_updated_watcher: 'bg-[color-mix(in_srgb,var(--muted-foreground)_12%,var(--card))]',
  task_reminder: 'bg-[color-mix(in_srgb,var(--accent-warm)_12%,var(--card))]',
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
        class="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-[var(--border)]"
        [ngClass]="{
          'border-l-4 border-l-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_6%,var(--card))] hover:bg-[color-mix(in_srgb,var(--primary)_10%,var(--card))]':
            !notification().is_read,
          'hover:bg-[var(--muted)]': notification().is_read,
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
              'font-semibold': !notification().is_read,
              'font-medium': notification().is_read,
            }"
            [style.color]="notification().is_read ? 'var(--muted-foreground)' : 'var(--foreground)'"
          >
            {{ notification().title }}
          </p>
          <p
            class="text-sm line-clamp-2 mt-0.5"
            style="color: var(--muted-foreground)"
          >
            {{ notification().body }}
          </p>
          <div class="flex items-center gap-2 mt-1">
            <p class="text-xs" style="color: var(--muted-foreground)">
              {{ getRelativeTime() }}
            </p>
            @if (notification().link_url) {
              <span class="text-xs" style="color: var(--primary)">
                View
              </span>
            }
          </div>
        </div>

        <!-- Unread indicator dot -->
        @if (!notification().is_read) {
          <div
            class="flex-shrink-0 w-2.5 h-2.5 rounded-full mt-2 shadow-sm"
            style="background: var(--primary)"
          ></div>
        }
      </div>
      <!-- Dismiss button (hover reveal) -->
      <button
        class="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity
               w-5 h-5 rounded-full flex items-center justify-center z-10
               hover:bg-[var(--muted)]"
        style="color: var(--muted-foreground)"
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
        color: 'text-[var(--muted-foreground)]',
      }
    );
  }

  getIconBgClass(): string {
    return (
      EVENT_TYPE_BG[this.notification().event_type] ||
      'bg-[var(--muted)]'
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
