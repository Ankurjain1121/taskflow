import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { DOCUMENT } from '@angular/common';
import { Subject } from 'rxjs';
import {
  NotificationService,
  Notification,
  NotificationListResponse,
  UnreadCountResponse,
} from './notification.service';
import { WebSocketService, WebSocketMessage } from './websocket.service';
import { AuthService } from './auth.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { NotificationSoundService } from './notification-sound.service';

const MOCK_NOTIFICATION: Notification = {
  id: 'notif-1',
  recipient_id: 'user-1',
  event_type: 'task_assigned',
  title: 'Task assigned',
  body: 'You were assigned to "Build feature"',
  link_url: '/boards/board-1/tasks/task-1',
  is_read: false,
  created_at: '2026-02-18T10:00:00Z',
};

const MOCK_NOTIFICATION_READ: Notification = {
  ...MOCK_NOTIFICATION,
  id: 'notif-2',
  is_read: true,
};

const MOCK_LIST_RESPONSE: NotificationListResponse = {
  items: [MOCK_NOTIFICATION, MOCK_NOTIFICATION_READ],
  nextCursor: 'cursor-abc',
  unreadCount: 3,
};

const MOCK_UNREAD_COUNT: UnreadCountResponse = {
  count: 5,
};

describe('NotificationService', () => {
  let service: NotificationService;
  let httpMock: HttpTestingController;
  let wsMessages$: Subject<WebSocketMessage>;
  let mockWsService: {
    messages$: Subject<WebSocketMessage>;
    connect: ReturnType<typeof vi.fn>;
  };
  let mockAuthService: {
    isAuthenticated: ReturnType<typeof vi.fn>;
    currentUser: ReturnType<typeof vi.fn>;
  };
  let mockToastService: { show: ReturnType<typeof vi.fn> };
  let mockSoundService: { playNotificationSound: ReturnType<typeof vi.fn> };
  let mockDocument: { hidden: boolean };

  beforeEach(() => {
    wsMessages$ = new Subject<WebSocketMessage>();

    mockWsService = {
      messages$: wsMessages$,
      connect: vi.fn(),
    };

    mockAuthService = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      currentUser: vi.fn().mockReturnValue({ id: 'user-1' }),
    };

    mockToastService = {
      show: vi.fn(),
    };

    mockSoundService = {
      playNotificationSound: vi.fn(),
    };

    mockDocument = { hidden: false };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        NotificationService,
        { provide: WebSocketService, useValue: mockWsService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: ToastService, useValue: mockToastService },
        { provide: NotificationSoundService, useValue: mockSoundService },
        { provide: DOCUMENT, useValue: mockDocument },
      ],
    });

    service = TestBed.inject(NotificationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    service.ngOnDestroy();
    httpMock.verify();
  });

  describe('initial state', () => {
    it('should have unreadCount of 0', () => {
      expect(service.unreadCount()).toBe(0);
    });

    it('should have empty notifications array', () => {
      expect(service.notifications()).toEqual([]);
    });

    it('should have isLoading false', () => {
      expect(service.isLoading()).toBe(false);
    });

    it('should have hasMore true', () => {
      expect(service.hasMore()).toBe(true);
    });

    it('should have empty displayBadge when unreadCount is 0', () => {
      expect(service.displayBadge()).toBe('');
    });
  });

  describe('listNotifications()', () => {
    it('should GET /api/notifications with limit=20', () => {
      service.listNotifications().subscribe();

      const req = httpMock.expectOne(
        (r) => r.url === '/api/notifications' && r.params.get('limit') === '20',
      );
      expect(req.request.method).toBe('GET');
      expect(req.request.params.has('cursor')).toBe(false);
      req.flush(MOCK_LIST_RESPONSE);
    });

    it('should replace notifications on initial load (no cursor)', () => {
      service.listNotifications().subscribe();

      const req = httpMock.expectOne((r) => r.url === '/api/notifications');
      req.flush(MOCK_LIST_RESPONSE);

      expect(service.notifications()).toEqual(MOCK_LIST_RESPONSE.items);
      expect(service.unreadCount()).toBe(3);
      expect(service.hasMore()).toBe(true);
    });

    it('should append notifications when cursor is provided', () => {
      // First load
      service.listNotifications().subscribe();
      const req1 = httpMock.expectOne((r) => r.url === '/api/notifications');
      req1.flush(MOCK_LIST_RESPONSE);

      const extraNotification: Notification = {
        ...MOCK_NOTIFICATION,
        id: 'notif-3',
      };
      const page2: NotificationListResponse = {
        items: [extraNotification],
        nextCursor: null,
        unreadCount: 3,
      };

      // Second load with cursor
      service.listNotifications('cursor-abc').subscribe();
      const req2 = httpMock.expectOne(
        (r) =>
          r.url === '/api/notifications' &&
          r.params.get('cursor') === 'cursor-abc',
      );
      req2.flush(page2);

      expect(service.notifications().length).toBe(3);
      expect(service.hasMore()).toBe(false);
    });

    it('should set hasMore to false when nextCursor is null', () => {
      const noMoreResponse: NotificationListResponse = {
        items: [MOCK_NOTIFICATION],
        nextCursor: null,
        unreadCount: 1,
      };

      service.listNotifications().subscribe();
      const req = httpMock.expectOne((r) => r.url === '/api/notifications');
      req.flush(noMoreResponse);

      expect(service.hasMore()).toBe(false);
    });
  });

  describe('getUnreadCount()', () => {
    it('should GET /api/notifications/unread-count', () => {
      service.getUnreadCount().subscribe((res) => {
        expect(res).toEqual(MOCK_UNREAD_COUNT);
      });

      const req = httpMock.expectOne('/api/notifications/unread-count');
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_UNREAD_COUNT);
    });
  });

  describe('markRead()', () => {
    it('should PUT /api/notifications/:id/read', () => {
      service.markRead('notif-1').subscribe();

      const req = httpMock.expectOne('/api/notifications/notif-1/read');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({});
      req.flush(null);
    });

    it('should update the notification to is_read=true in local state', () => {
      // Load notifications first
      service.listNotifications().subscribe();
      const listReq = httpMock.expectOne((r) => r.url === '/api/notifications');
      listReq.flush(MOCK_LIST_RESPONSE);

      expect(
        service.notifications().find((n) => n.id === 'notif-1')?.is_read,
      ).toBe(false);

      // Mark as read
      service.markRead('notif-1').subscribe();
      const readReq = httpMock.expectOne('/api/notifications/notif-1/read');
      readReq.flush(null);

      expect(
        service.notifications().find((n) => n.id === 'notif-1')?.is_read,
      ).toBe(true);
    });

    it('should decrement unreadCount by 1', () => {
      // Load notifications to set unreadCount
      service.listNotifications().subscribe();
      const listReq = httpMock.expectOne((r) => r.url === '/api/notifications');
      listReq.flush(MOCK_LIST_RESPONSE);

      expect(service.unreadCount()).toBe(3);

      service.markRead('notif-1').subscribe();
      const readReq = httpMock.expectOne('/api/notifications/notif-1/read');
      readReq.flush(null);

      expect(service.unreadCount()).toBe(2);
    });

    it('should not let unreadCount go below 0', () => {
      // unreadCount starts at 0
      service.markRead('notif-1').subscribe();
      const req = httpMock.expectOne('/api/notifications/notif-1/read');
      req.flush(null);

      expect(service.unreadCount()).toBe(0);
    });
  });

  describe('markAllRead()', () => {
    it('should PUT /api/notifications/read-all', () => {
      service.markAllRead().subscribe();

      const req = httpMock.expectOne('/api/notifications/read-all');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({});
      req.flush(null);
    });

    it('should set all notifications to is_read=true', () => {
      // Load notifications first
      service.listNotifications().subscribe();
      const listReq = httpMock.expectOne((r) => r.url === '/api/notifications');
      listReq.flush(MOCK_LIST_RESPONSE);

      service.markAllRead().subscribe();
      const readReq = httpMock.expectOne('/api/notifications/read-all');
      readReq.flush(null);

      const allRead = service.notifications().every((n) => n.is_read);
      expect(allRead).toBe(true);
    });

    it('should set unreadCount to 0', () => {
      // Load notifications to set unreadCount=3
      service.listNotifications().subscribe();
      const listReq = httpMock.expectOne((r) => r.url === '/api/notifications');
      listReq.flush(MOCK_LIST_RESPONSE);

      expect(service.unreadCount()).toBe(3);

      service.markAllRead().subscribe();
      const readReq = httpMock.expectOne('/api/notifications/read-all');
      readReq.flush(null);

      expect(service.unreadCount()).toBe(0);
    });
  });

  describe('loadMore()', () => {
    it('should return null when no nextCursor', () => {
      // No notifications loaded yet, _nextCursor is null
      const result = service.loadMore();
      expect(result).toBeNull();
    });

    it('should return null when already loading', () => {
      // Load first page to set a cursor
      service.listNotifications().subscribe();
      const listReq = httpMock.expectOne((r) => r.url === '/api/notifications');
      listReq.flush(MOCK_LIST_RESPONSE);

      // Start loadMore
      const obs1 = service.loadMore();
      expect(obs1).not.toBeNull();
      obs1!.subscribe();

      // Try loadMore again while still loading - should return null
      const obs2 = service.loadMore();
      expect(obs2).toBeNull();

      // Flush the pending request
      const moreReq = httpMock.expectOne(
        (r) =>
          r.url === '/api/notifications' &&
          r.params.get('cursor') === 'cursor-abc',
      );
      moreReq.flush({
        items: [],
        nextCursor: null,
        unreadCount: 3,
      });
    });
  });

  describe('reset()', () => {
    it('should clear all state', () => {
      // Load some state first
      service.listNotifications().subscribe();
      const listReq = httpMock.expectOne((r) => r.url === '/api/notifications');
      listReq.flush(MOCK_LIST_RESPONSE);

      expect(service.notifications().length).toBeGreaterThan(0);
      expect(service.unreadCount()).toBeGreaterThan(0);

      service.reset();

      expect(service.notifications()).toEqual([]);
      expect(service.unreadCount()).toBe(0);
      expect(service.hasMore()).toBe(true);
    });
  });

  describe('displayBadge', () => {
    it('should return empty string when unreadCount is 0', () => {
      expect(service.displayBadge()).toBe('');
    });

    it('should return count as string when between 1 and 99', () => {
      service.listNotifications().subscribe();
      const req = httpMock.expectOne((r) => r.url === '/api/notifications');
      req.flush({ items: [], nextCursor: null, unreadCount: 42 });

      expect(service.displayBadge()).toBe('42');
    });

    it('should return "99+" when count exceeds 99', () => {
      service.listNotifications().subscribe();
      const req = httpMock.expectOne((r) => r.url === '/api/notifications');
      req.flush({ items: [], nextCursor: null, unreadCount: 150 });

      expect(service.displayBadge()).toBe('99+');
    });
  });

  describe('startRealTimeUpdates()', () => {
    it('should connect WebSocket', () => {
      service.startRealTimeUpdates();

      // Flush all unread-count requests (initial + polling startWith(0))
      const reqs = httpMock.match('/api/notifications/unread-count');
      reqs.forEach((r) => r.flush({ count: 2 }));

      expect(mockWsService.connect).toHaveBeenCalled();
    });

    it('should update unreadCount from fetchUnreadCount', () => {
      service.startRealTimeUpdates();

      const reqs = httpMock.match('/api/notifications/unread-count');
      reqs.forEach((r) => r.flush({ count: 7 }));

      expect(service.unreadCount()).toBe(7);
    });

    it('should prepend new notification from WebSocket message', () => {
      service.startRealTimeUpdates();

      // Flush initial + polling fetchUnreadCount calls
      const reqs = httpMock.match('/api/notifications/unread-count');
      reqs.forEach((r) => r.flush({ count: 0 }));

      // Emit a WebSocket notification
      wsMessages$.next({
        type: 'notification:new',
        payload: MOCK_NOTIFICATION,
      });

      expect(service.notifications().length).toBe(1);
      expect(service.notifications()[0].id).toBe('notif-1');
      expect(service.unreadCount()).toBe(1);
    });

    it('should show toast and play sound when page is visible', () => {
      mockDocument.hidden = false;

      service.startRealTimeUpdates();

      const reqs = httpMock.match('/api/notifications/unread-count');
      reqs.forEach((r) => r.flush({ count: 0 }));

      wsMessages$.next({
        type: 'notification:new',
        payload: MOCK_NOTIFICATION,
      });

      expect(mockToastService.show).toHaveBeenCalledWith({
        id: MOCK_NOTIFICATION.id,
        event_type: MOCK_NOTIFICATION.event_type,
        title: MOCK_NOTIFICATION.title,
        body: MOCK_NOTIFICATION.body,
        link_url: MOCK_NOTIFICATION.link_url,
      });
      expect(mockSoundService.playNotificationSound).toHaveBeenCalled();
    });

    it('should not show toast or play sound when page is hidden', () => {
      mockDocument.hidden = true;

      service.startRealTimeUpdates();

      const reqs = httpMock.match('/api/notifications/unread-count');
      reqs.forEach((r) => r.flush({ count: 0 }));

      wsMessages$.next({
        type: 'notification:new',
        payload: MOCK_NOTIFICATION,
      });

      expect(mockToastService.show).not.toHaveBeenCalled();
      expect(mockSoundService.playNotificationSound).not.toHaveBeenCalled();
    });

    it('should ignore non-notification WebSocket messages', () => {
      service.startRealTimeUpdates();

      const reqs = httpMock.match('/api/notifications/unread-count');
      reqs.forEach((r) => r.flush({ count: 0 }));

      wsMessages$.next({
        type: 'task:updated',
        payload: { id: 'task-1' },
      });

      expect(service.notifications().length).toBe(0);
      expect(service.unreadCount()).toBe(0);
    });
  });

  describe('stopRealTimeUpdates()', () => {
    it('should clean up subscriptions without error', () => {
      service.startRealTimeUpdates();

      const reqs = httpMock.match('/api/notifications/unread-count');
      reqs.forEach((r) => r.flush({ count: 0 }));

      expect(() => service.stopRealTimeUpdates()).not.toThrow();
    });

    it('should be safe to call when not started', () => {
      expect(() => service.stopRealTimeUpdates()).not.toThrow();
    });
  });

  describe('ngOnDestroy()', () => {
    it('should call stopRealTimeUpdates', () => {
      const stopSpy = vi.spyOn(service, 'stopRealTimeUpdates');
      service.ngOnDestroy();
      expect(stopSpy).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should propagate HTTP errors on listNotifications', () => {
      let error: any;
      service.listNotifications().subscribe({
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne((r) => r.url === '/api/notifications');
      req.flush('Server Error', {
        status: 500,
        statusText: 'Internal Server Error',
      });

      expect(error).toBeTruthy();
      expect(error.status).toBe(500);
    });

    it('should propagate HTTP errors on markRead', () => {
      let error: any;
      service.markRead('notif-1').subscribe({
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne('/api/notifications/notif-1/read');
      req.flush('Not Found', { status: 404, statusText: 'Not Found' });

      expect(error).toBeTruthy();
      expect(error.status).toBe(404);
    });
  });
});
