import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Router } from '@angular/router';
import { of, throwError, Observable } from 'rxjs';

import { InboxComponent } from './inbox.component';
import {
  NotificationService,
  Notification,
  NotificationListResponse,
} from '../../core/services/notification.service';
import { signal } from '@angular/core';

// ---------- Helpers ----------

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    recipient_id: 'user-1',
    event_type: overrides.event_type ?? 'task_assigned',
    title: overrides.title ?? 'Test notification',
    body: overrides.body ?? 'Body text',
    link_url: overrides.link_url ?? null,
    is_read: overrides.is_read ?? false,
    created_at: overrides.created_at ?? new Date().toISOString(),
  };
}

function todayISO(): string {
  return new Date().toISOString();
}

function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString();
}

function lastWeekISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 5);
  return d.toISOString();
}

// ---------- Mock factory ----------

function createMockNotificationService() {
  const notificationsSignal = signal<Notification[]>([]);
  const unreadCountSignal = signal<number>(0);
  const isLoadingSignal = signal<boolean>(false);
  const hasMoreSignal = signal<boolean>(false);

  return {
    notifications: notificationsSignal.asReadonly(),
    unreadCount: unreadCountSignal.asReadonly(),
    isLoading: isLoadingSignal.asReadonly(),
    hasMore: hasMoreSignal.asReadonly(),
    listNotifications: vi.fn().mockReturnValue(of({
      items: [],
      nextCursor: null,
      unreadCount: 0,
    } satisfies NotificationListResponse)),
    markRead: vi.fn().mockReturnValue(of(undefined)),
    markAllRead: vi.fn().mockReturnValue(of(undefined)),
    loadMore: vi.fn().mockReturnValue(null),
    // Expose writeable signals for test manipulation
    _notifications: notificationsSignal,
    _unreadCount: unreadCountSignal,
    _isLoading: isLoadingSignal,
    _hasMore: hasMoreSignal,
  };
}

// ---------- Tests ----------

describe('InboxComponent', () => {
  let component: InboxComponent;
  let fixture: ComponentFixture<InboxComponent>;
  let mockNotificationService: ReturnType<typeof createMockNotificationService>;
  let mockRouter: { navigateByUrl: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockNotificationService = createMockNotificationService();
    mockRouter = { navigateByUrl: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [InboxComponent],
    })
      .overrideComponent(InboxComponent, {
        set: {
          providers: [
            { provide: NotificationService, useValue: mockNotificationService },
            { provide: Router, useValue: mockRouter },
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(InboxComponent);
    component = fixture.componentInstance;
  });

  // -------- Component Creation --------

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  // -------- Initial State --------

  describe('initial state', () => {
    it('should start with activeFilter set to "all"', () => {
      expect(component.activeFilter()).toBe('all');
    });

    it('should start with initialLoading true', () => {
      expect(component.initialLoading()).toBe(true);
    });

    it('should have 5 filter tabs', () => {
      expect(component.filterTabs).toHaveLength(5);
      expect(component.filterTabs.map((t) => t.key)).toEqual([
        'all',
        'assigned',
        'comments',
        'mentions',
        'due',
      ]);
    });

    it('should have 5 skeleton rows', () => {
      expect(component.skeletonRows).toEqual([1, 2, 3, 4, 5]);
    });

    it('should have empty filteredGroups when no notifications', () => {
      expect(component.filteredGroups()).toEqual([]);
    });
  });

  // -------- ngOnInit --------

  describe('ngOnInit', () => {
    it('should call listNotifications on init', () => {
      fixture.detectChanges(); // triggers ngOnInit
      expect(mockNotificationService.listNotifications).toHaveBeenCalledOnce();
    });

    it('should set initialLoading to false after successful load', () => {
      fixture.detectChanges();
      expect(component.initialLoading()).toBe(false);
    });

    it('should set initialLoading to false even on error', () => {
      mockNotificationService.listNotifications.mockReturnValue(
        throwError(() => new Error('Network error'))
      );
      fixture.detectChanges();
      expect(component.initialLoading()).toBe(false);
    });
  });

  // -------- Filter Switching --------

  describe('filter switching', () => {
    const todayNotifications: Notification[] = [
      makeNotification({ event_type: 'task_assigned', created_at: todayISO() }),
      makeNotification({ event_type: 'task_commented', created_at: todayISO() }),
      makeNotification({ event_type: 'mention_in_comment', created_at: todayISO() }),
      makeNotification({ event_type: 'task_due_soon', created_at: todayISO() }),
      makeNotification({ event_type: 'task_overdue', created_at: todayISO() }),
    ];

    beforeEach(() => {
      mockNotificationService._notifications.set(todayNotifications);
      fixture.detectChanges();
    });

    it('should show all notifications when filter is "all"', () => {
      component.activeFilter.set('all');
      const groups = component.filteredGroups();
      const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0);
      expect(totalItems).toBe(5);
    });

    it('should filter by "assigned" (task_assigned)', () => {
      component.activeFilter.set('assigned');
      const groups = component.filteredGroups();
      const allItems = groups.flatMap((g) => g.items);
      expect(allItems).toHaveLength(1);
      expect(allItems[0].event_type).toBe('task_assigned');
    });

    it('should filter by "comments" (task_commented)', () => {
      component.activeFilter.set('comments');
      const groups = component.filteredGroups();
      const allItems = groups.flatMap((g) => g.items);
      expect(allItems).toHaveLength(1);
      expect(allItems[0].event_type).toBe('task_commented');
    });

    it('should filter by "mentions" (mention_in_comment)', () => {
      component.activeFilter.set('mentions');
      const groups = component.filteredGroups();
      const allItems = groups.flatMap((g) => g.items);
      expect(allItems).toHaveLength(1);
      expect(allItems[0].event_type).toBe('mention_in_comment');
    });

    it('should filter by "due" (task_due_soon + task_overdue)', () => {
      component.activeFilter.set('due');
      const groups = component.filteredGroups();
      const allItems = groups.flatMap((g) => g.items);
      expect(allItems).toHaveLength(2);
      const eventTypes = allItems.map((n) => n.event_type);
      expect(eventTypes).toContain('task_due_soon');
      expect(eventTypes).toContain('task_overdue');
    });

    it('should return empty groups when filter matches nothing', () => {
      mockNotificationService._notifications.set([
        makeNotification({ event_type: 'task_completed', created_at: todayISO() }),
      ]);
      component.activeFilter.set('assigned');
      expect(component.filteredGroups()).toEqual([]);
    });
  });

  // -------- Time Grouping --------

  describe('time grouping', () => {
    it('should group notifications into Today, Yesterday, and Earlier', () => {
      mockNotificationService._notifications.set([
        makeNotification({ id: 'today-1', created_at: todayISO() }),
        makeNotification({ id: 'yesterday-1', created_at: yesterdayISO() }),
        makeNotification({ id: 'earlier-1', created_at: lastWeekISO() }),
      ]);
      fixture.detectChanges();

      const groups = component.filteredGroups();
      expect(groups).toHaveLength(3);
      expect(groups[0].label).toBe('Today');
      expect(groups[0].items).toHaveLength(1);
      expect(groups[1].label).toBe('Yesterday');
      expect(groups[1].items).toHaveLength(1);
      expect(groups[2].label).toBe('Earlier');
      expect(groups[2].items).toHaveLength(1);
    });

    it('should omit empty groups', () => {
      mockNotificationService._notifications.set([
        makeNotification({ created_at: todayISO() }),
      ]);
      fixture.detectChanges();

      const groups = component.filteredGroups();
      expect(groups).toHaveLength(1);
      expect(groups[0].label).toBe('Today');
    });

    it('should return empty array when no notifications', () => {
      mockNotificationService._notifications.set([]);
      fixture.detectChanges();
      expect(component.filteredGroups()).toEqual([]);
    });
  });

  // -------- Mark as Read --------

  describe('onNotificationClick', () => {
    it('should call markRead for unread notifications', () => {
      const notif = makeNotification({ id: 'n-1', is_read: false, link_url: null });
      component.onNotificationClick(notif);
      expect(mockNotificationService.markRead).toHaveBeenCalledWith('n-1');
    });

    it('should NOT call markRead for already-read notifications', () => {
      const notif = makeNotification({ id: 'n-2', is_read: true, link_url: null });
      component.onNotificationClick(notif);
      expect(mockNotificationService.markRead).not.toHaveBeenCalled();
    });

    it('should navigate when link_url is present', () => {
      const notif = makeNotification({
        is_read: true,
        link_url: '/projects/abc/board',
      });
      component.onNotificationClick(notif);
      expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/projects/abc/board');
    });

    it('should NOT navigate when link_url is null', () => {
      const notif = makeNotification({ is_read: true, link_url: null });
      component.onNotificationClick(notif);
      expect(mockRouter.navigateByUrl).not.toHaveBeenCalled();
    });

    it('should mark read AND navigate for unread notification with link', () => {
      const notif = makeNotification({
        id: 'n-3',
        is_read: false,
        link_url: '/tasks/123',
      });
      component.onNotificationClick(notif);
      expect(mockNotificationService.markRead).toHaveBeenCalledWith('n-3');
      expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/tasks/123');
    });
  });

  // -------- Mark All Read --------

  describe('markAllRead', () => {
    it('should call notificationService.markAllRead', () => {
      component.markAllRead();
      expect(mockNotificationService.markAllRead).toHaveBeenCalledOnce();
    });
  });

  // -------- Load More / Pagination --------

  describe('loadMore', () => {
    it('should call notificationService.loadMore', () => {
      component.loadMore();
      expect(mockNotificationService.loadMore).toHaveBeenCalledOnce();
    });

    it('should subscribe to the returned observable when non-null', () => {
      const subscribeSpy = vi.fn();
      mockNotificationService.loadMore.mockReturnValue({
        subscribe: subscribeSpy,
      });
      component.loadMore();
      expect(subscribeSpy).toHaveBeenCalled();
    });

    it('should handle null return from loadMore gracefully', () => {
      mockNotificationService.loadMore.mockReturnValue(null);
      expect(() => component.loadMore()).not.toThrow();
    });
  });

  // -------- getIcon --------

  describe('getIcon', () => {
    it('should return correct icon for task_assigned', () => {
      expect(component.getIcon('task_assigned')).toBe('pi pi-user-plus');
    });

    it('should return correct icon for task_commented', () => {
      expect(component.getIcon('task_commented')).toBe('pi pi-comment');
    });

    it('should return correct icon for mention_in_comment', () => {
      expect(component.getIcon('mention_in_comment')).toBe('pi pi-at');
    });

    it('should return correct icon for task_due_soon', () => {
      expect(component.getIcon('task_due_soon')).toBe('pi pi-clock');
    });

    it('should return correct icon for task_overdue', () => {
      expect(component.getIcon('task_overdue')).toBe('pi pi-exclamation-circle');
    });

    it('should return correct icon for task_completed', () => {
      expect(component.getIcon('task_completed')).toBe('pi pi-check-circle');
    });

    it('should return correct icon for task_updated_watcher', () => {
      expect(component.getIcon('task_updated_watcher')).toBe('pi pi-eye');
    });

    it('should return correct icon for task_reminder', () => {
      expect(component.getIcon('task_reminder')).toBe('pi pi-bell');
    });

    it('should return fallback icon for unknown event type', () => {
      expect(component.getIcon('unknown_type' as any)).toBe('pi pi-bell');
    });
  });

  // -------- relativeTime --------

  describe('relativeTime', () => {
    it('should return "Just now" for recent timestamps', () => {
      const now = new Date().toISOString();
      expect(component.relativeTime(now)).toBe('Just now');
    });

    it('should return minutes ago for < 60 minutes', () => {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60000).toISOString();
      expect(component.relativeTime(thirtyMinAgo)).toBe('30m ago');
    });

    it('should return hours ago for < 24 hours', () => {
      const fiveHoursAgo = new Date(Date.now() - 5 * 3600000).toISOString();
      expect(component.relativeTime(fiveHoursAgo)).toBe('5h ago');
    });

    it('should return "Yesterday" for 1 day ago', () => {
      const oneDayAgo = new Date(Date.now() - 24 * 3600000).toISOString();
      expect(component.relativeTime(oneDayAgo)).toBe('Yesterday');
    });

    it('should return days ago for 2-6 days', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600000).toISOString();
      expect(component.relativeTime(threeDaysAgo)).toBe('3d ago');
    });

    it('should return formatted date for 7+ days ago', () => {
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 3600000);
      const result = component.relativeTime(twoWeeksAgo.toISOString());
      expect(result).toBe(twoWeeksAgo.toLocaleDateString());
    });
  });

  // -------- Template Rendering --------

  describe('template rendering', () => {
    it('should show loading skeleton when initialLoading is true', async () => {
      // Prevent ngOnInit from resolving loading by making it never emit
      mockNotificationService.listNotifications.mockReturnValue(
        new Observable(() => {
          // Never emits - keeps initialLoading=true
        })
      );

      fixture.detectChanges(); // triggers ngOnInit but observable never completes

      expect(component.initialLoading()).toBe(true);
      const skeletons = fixture.nativeElement.querySelectorAll('.skeleton-line');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should show empty state when no notifications after loading', () => {
      fixture.detectChanges(); // triggers ngOnInit, sets initialLoading=false
      fixture.detectChanges(); // re-render with new state

      const emptyText = fixture.nativeElement.querySelector('p.text-xl');
      expect(emptyText?.textContent?.trim()).toBe('All caught up!');
    });

    it('should show "Mark all read" button when unread count > 0', () => {
      mockNotificationService._unreadCount.set(3);
      fixture.detectChanges();

      const btn = fixture.nativeElement.querySelector(
        'button[style*="color: var(--primary)"]'
      );
      expect(btn?.textContent?.trim()).toBe('Mark all read');
    });

    it('should NOT show "Mark all read" button when unread count is 0', () => {
      mockNotificationService._unreadCount.set(0);
      fixture.detectChanges();

      const buttons = Array.from(
        fixture.nativeElement.querySelectorAll('button')
      ) as HTMLElement[];
      const markAllBtn = buttons.find((b) =>
        b.textContent?.trim().includes('Mark all read')
      );
      expect(markAllBtn).toBeUndefined();
    });

    it('should render notification groups with group labels', () => {
      mockNotificationService._notifications.set([
        makeNotification({ created_at: todayISO() }),
        makeNotification({ created_at: lastWeekISO() }),
      ]);
      fixture.detectChanges(); // ngOnInit
      fixture.detectChanges(); // re-render

      const groupLabels = fixture.nativeElement.querySelectorAll('.group-label');
      expect(groupLabels.length).toBe(2);
      const labels = Array.from(groupLabels).map(
        (el: any) => el.textContent.trim()
      );
      expect(labels).toContain('Today');
      expect(labels).toContain('Earlier');
    });

    it('should render notification items', () => {
      mockNotificationService._notifications.set([
        makeNotification({ title: 'You were assigned a task', created_at: todayISO() }),
      ]);
      fixture.detectChanges();
      fixture.detectChanges();

      const items = fixture.nativeElement.querySelectorAll('.notif-item');
      expect(items.length).toBe(1);
    });

    it('should show unread dot for unread notifications', () => {
      mockNotificationService._notifications.set([
        makeNotification({ is_read: false, created_at: todayISO() }),
      ]);
      fixture.detectChanges();
      fixture.detectChanges();

      const dots = fixture.nativeElement.querySelectorAll('.unread-dot');
      expect(dots.length).toBe(1);
    });

    it('should NOT show unread dot for read notifications', () => {
      mockNotificationService._notifications.set([
        makeNotification({ is_read: true, created_at: todayISO() }),
      ]);
      fixture.detectChanges();
      fixture.detectChanges();

      const dots = fixture.nativeElement.querySelectorAll('.unread-dot');
      expect(dots.length).toBe(0);
    });

    it('should show "Load more" button when hasMore is true and not loading', () => {
      mockNotificationService._notifications.set([
        makeNotification({ created_at: todayISO() }),
      ]);
      mockNotificationService._hasMore.set(true);
      mockNotificationService._isLoading.set(false);
      fixture.detectChanges();
      fixture.detectChanges();

      const loadMoreBtn = fixture.nativeElement.querySelector('.load-more-btn');
      expect(loadMoreBtn?.textContent?.trim()).toBe('Load more');
    });

    it('should show "Loading..." text when loading more', () => {
      mockNotificationService._notifications.set([
        makeNotification({ created_at: todayISO() }),
      ]);
      mockNotificationService._hasMore.set(true);
      mockNotificationService._isLoading.set(true);
      fixture.detectChanges();
      fixture.detectChanges();

      const loadingText = fixture.nativeElement.querySelector(
        'span[style*="color: var(--muted-foreground)"]'
      );
      expect(loadingText?.textContent?.trim()).toBe('Loading...');
    });

    it('should render filter pills with correct active state', () => {
      fixture.detectChanges();

      const pills = fixture.nativeElement.querySelectorAll('.filter-pill');
      expect(pills.length).toBe(5);

      // First pill ("All") should be active by default
      expect(pills[0].classList.contains('active')).toBe(true);
      expect(pills[0].getAttribute('aria-pressed')).toBe('true');

      // Others should not be active
      expect(pills[1].classList.contains('active')).toBe(false);
    });
  });
});
