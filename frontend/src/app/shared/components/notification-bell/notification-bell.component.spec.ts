import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { NotificationBellComponent } from './notification-bell.component';
import { NotificationService } from '../../../core/services/notification.service';
import { NotificationSoundService } from '../../../core/services/notification-sound.service';

describe('NotificationBellComponent', () => {
  let component: NotificationBellComponent;
  let fixture: ComponentFixture<NotificationBellComponent>;
  let mockNotificationService: any;
  let mockSoundService: any;
  let mockRouter: any;

  beforeEach(async () => {
    mockNotificationService = {
      unreadCount: signal(3),
      displayBadge: signal('3'),
      notifications: signal([]),
      isLoading: signal(false),
      hasMore: signal(true),
      startRealTimeUpdates: vi.fn(),
      stopRealTimeUpdates: vi.fn(),
      listNotifications: vi.fn().mockReturnValue(of([])),
      markRead: vi.fn().mockReturnValue(of(void 0)),
      markAllRead: vi.fn().mockReturnValue(of(void 0)),
      loadMore: vi.fn().mockReturnValue(null),
    };

    mockSoundService = {
      soundEnabled: signal(true),
      toggleSound: vi.fn(),
    };

    mockRouter = {
      navigate: vi.fn(),
      navigateByUrl: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [NotificationBellComponent],
      providers: [
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: NotificationSoundService, useValue: mockSoundService },
        { provide: Router, useValue: mockRouter },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationBellComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start real-time updates on init', () => {
    component.ngOnInit();
    expect(mockNotificationService.startRealTimeUpdates).toHaveBeenCalled();
  });

  it('should stop real-time updates on destroy', () => {
    component.ngOnDestroy();
    expect(mockNotificationService.stopRealTimeUpdates).toHaveBeenCalled();
  });

  it('should filter notifications by tab', () => {
    mockNotificationService.notifications.set([
      { id: '1', event_type: 'task_assigned', created_at: new Date().toISOString() },
      { id: '2', event_type: 'task_commented', created_at: new Date().toISOString() },
      { id: '3', event_type: 'task_due_soon', created_at: new Date().toISOString() },
    ]);

    component.activeTab.set('all');
    expect(component.filteredNotifications().length).toBe(3);

    component.activeTab.set('assignments');
    expect(component.filteredNotifications().length).toBe(1);

    component.activeTab.set('comments');
    expect(component.filteredNotifications().length).toBe(1);

    component.activeTab.set('deadlines');
    expect(component.filteredNotifications().length).toBe(1);
  });

  it('should split notifications into today and earlier', () => {
    const today = new Date().toISOString();
    const yesterday = new Date(Date.now() - 86400000).toISOString();

    mockNotificationService.notifications.set([
      { id: '1', event_type: 'task_assigned', created_at: today },
      { id: '2', event_type: 'task_assigned', created_at: yesterday },
    ]);

    component.activeTab.set('all');
    expect(component.todayNotifications().length).toBe(1);
    expect(component.earlierNotifications().length).toBe(1);
  });

  it('should mark all as read', () => {
    component.markAllRead();
    expect(mockNotificationService.markAllRead).toHaveBeenCalled();
  });

  it('should toggle sound', () => {
    component.toggleSound();
    expect(mockSoundService.toggleSound).toHaveBeenCalled();
  });

  it('should change active tab', () => {
    component.onTabChange('comments');
    expect(component.activeTab()).toBe('comments');
  });

  it('should not change tab if null is passed', () => {
    component.activeTab.set('all');
    component.onTabChange(null as any);
    expect(component.activeTab()).toBe('all');
  });

  it('should navigate to settings on goToSettings', () => {
    // Mock the popover
    component.notifPopover = { hide: vi.fn() } as any;
    component.goToSettings();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/settings/notifications']);
  });

  it('should handle notification click with internal link', () => {
    component.notifPopover = { hide: vi.fn() } as any;
    const notification = {
      id: 'n-1',
      is_read: false,
      link_url: '/workspace/ws-1/board/b-1',
    } as any;
    component.onNotificationClick(notification);
    expect(mockNotificationService.markRead).toHaveBeenCalledWith('n-1');
    expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/workspace/ws-1/board/b-1');
  });

  it('should not mark as read if already read', () => {
    component.notifPopover = { hide: vi.fn() } as any;
    const notification = {
      id: 'n-1',
      is_read: true,
      link_url: '/workspace/ws-1',
    } as any;
    component.onNotificationClick(notification);
    expect(mockNotificationService.markRead).not.toHaveBeenCalled();
  });
});
