import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import {
  trigger,
  transition,
  style,
  animate,
} from '@angular/animations';
import { ToastService, ToastNotification } from './toast.service';
import { NotificationEventType } from '../../../core/services/notification.service';

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
  selector: 'app-toast-container',
  standalone: true,
  imports: [MatIconModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('toastAnim', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(100%)' }),
        animate(
          '300ms ease-out',
          style({ opacity: 1, transform: 'translateX(0)' })
        ),
      ]),
      transition(':leave', [
        animate(
          '200ms ease-in',
          style({ opacity: 0, transform: 'translateX(100%)' })
        ),
      ]),
    ]),
  ],
  template: `
    <div class="fixed bottom-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          @toastAnim
          class="pointer-events-auto w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden cursor-pointer"
          role="alert"
          (click)="onToastClick(toast)"
        >
          <div class="flex items-start gap-3 p-3">
            <!-- Event type icon -->
            <div class="flex-shrink-0 mt-0.5">
              <mat-icon [class]="getIconConfig(toast.event_type).color">
                {{ getIconConfig(toast.event_type).icon }}
              </mat-icon>
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {{ toast.title }}
              </p>
              <p class="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                {{ toast.body }}
              </p>
            </div>

            <!-- Close button -->
            <button
              mat-icon-button
              class="flex-shrink-0 -mt-1 -mr-1"
              aria-label="Dismiss notification"
              (click)="onDismiss($event, toast.id)"
            >
              <mat-icon class="text-gray-400 text-base">close</mat-icon>
            </button>
          </div>
        </div>
      }
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
export class ToastContainerComponent {
  readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  getIconConfig(eventType: NotificationEventType): EventTypeConfig {
    return (
      EVENT_TYPE_ICONS[eventType] || {
        icon: 'notifications',
        color: 'text-gray-500',
      }
    );
  }

  onToastClick(toast: ToastNotification): void {
    this.toastService.dismiss(toast.id);

    if (toast.link_url) {
      if (toast.link_url.startsWith('/')) {
        this.router.navigateByUrl(toast.link_url);
      } else {
        window.open(toast.link_url, '_blank');
      }
    }
  }

  onDismiss(event: MouseEvent, id: string): void {
    event.stopPropagation();
    this.toastService.dismiss(id);
  }
}
