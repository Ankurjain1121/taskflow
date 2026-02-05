import { Component, OnInit, OnDestroy, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CdkScrollableModule } from '@angular/cdk/scrolling';
import { NotificationService, Notification } from '../../../core/services/notification.service';
import { NotificationItemComponent } from './notification-item.component';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatBadgeModule,
    MatMenuModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    CdkScrollableModule,
    NotificationItemComponent,
  ],
  template: `
    <button
      mat-icon-button
      [matMenuTriggerFor]="notificationMenu"
      (menuOpened)="onMenuOpened()"
      class="relative"
      aria-label="Notifications"
    >
      <mat-icon
        [matBadge]="notificationService.displayBadge()"
        [matBadgeHidden]="notificationService.unreadCount() === 0"
        matBadgeColor="warn"
        matBadgeSize="small"
      >
        notifications
      </mat-icon>
    </button>

    <mat-menu
      #notificationMenu="matMenu"
      class="notification-menu"
      [overlapTrigger]="false"
    >
      <div class="w-80 max-w-full" (click)="$event.stopPropagation()">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b">
          <h3 class="text-lg font-semibold text-gray-900">Notifications</h3>
          <button
            *ngIf="notificationService.unreadCount() > 0"
            mat-button
            color="primary"
            class="text-sm"
            (click)="markAllRead()"
          >
            Mark all read
          </button>
        </div>

        <!-- Notification list -->
        <div
          #scrollContainer
          class="max-h-96 overflow-y-auto"
          (scroll)="onScroll($event)"
        >
          <!-- Empty state -->
          <div
            *ngIf="notificationService.notifications().length === 0 && !isInitialLoading()"
            class="flex flex-col items-center justify-center py-8 px-4"
          >
            <mat-icon class="text-gray-300 text-5xl mb-2">notifications_none</mat-icon>
            <p class="text-gray-500 text-sm">No notifications yet</p>
          </div>

          <!-- Initial loading -->
          <div
            *ngIf="isInitialLoading()"
            class="flex items-center justify-center py-8"
          >
            <mat-spinner diameter="32"></mat-spinner>
          </div>

          <!-- Notification items -->
          <div *ngIf="!isInitialLoading()">
            <app-notification-item
              *ngFor="let notification of notificationService.notifications()"
              [notification]="notification"
              (notificationClick)="onNotificationClick($event)"
            ></app-notification-item>

            <!-- Load more spinner -->
            <div
              *ngIf="notificationService.isLoading()"
              class="flex items-center justify-center py-4"
            >
              <mat-spinner diameter="24"></mat-spinner>
            </div>

            <!-- End of list -->
            <div
              *ngIf="!notificationService.hasMore() && notificationService.notifications().length > 0"
              class="text-center py-3 text-gray-400 text-sm"
            >
              No more notifications
            </div>
          </div>
        </div>

        <!-- Footer -->
        <mat-divider></mat-divider>
        <div class="px-4 py-2">
          <button
            mat-button
            class="w-full text-sm"
            color="primary"
            (click)="goToSettings()"
          >
            Notification Settings
          </button>
        </div>
      </div>
    </mat-menu>
  `,
  styles: [
    `
      :host {
        display: inline-block;
      }

      ::ng-deep .notification-menu {
        max-width: none !important;
      }

      ::ng-deep .mat-mdc-menu-content {
        padding: 0 !important;
      }
    `,
  ],
})
export class NotificationBellComponent implements OnInit, OnDestroy {
  @ViewChild('scrollContainer') scrollContainer!: ElementRef<HTMLDivElement>;
  @ViewChild(MatMenuTrigger) menuTrigger!: MatMenuTrigger;

  isInitialLoading = signal(false);
  private hasLoadedInitial = false;

  constructor(
    public notificationService: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Start real-time updates when component initializes
    this.notificationService.startRealTimeUpdates();
  }

  ngOnDestroy(): void {
    this.notificationService.stopRealTimeUpdates();
  }

  onMenuOpened(): void {
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
      this.menuTrigger.closeMenu();
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

  goToSettings(): void {
    this.menuTrigger.closeMenu();
    this.router.navigate(['/settings/notifications']);
  }
}
