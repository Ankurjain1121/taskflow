import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotificationItemComponent } from './notification-item.component';
import { Notification } from '../../../core/services/notification.service';

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'notif-1',
    user_id: 'user-1',
    event_type: 'task_assigned',
    title: 'You were assigned a task',
    body: 'Task "Fix bug" was assigned to you',
    link_url: '/workspace/ws-1/board/b-1?task=t-1',
    is_read: false,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('NotificationItemComponent', () => {
  let component: NotificationItemComponent;
  let fixture: ComponentFixture<NotificationItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationItemComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationItemComponent);
    component = fixture.componentInstance;
    component.notification = makeNotification();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display notification title', () => {
    expect(fixture.nativeElement.textContent).toContain(
      'You were assigned a task',
    );
  });

  it('should display notification body', () => {
    expect(fixture.nativeElement.textContent).toContain('Fix bug');
  });

  it('should emit notificationClick on click', () => {
    const spy = vi.spyOn(component.notificationClick, 'emit');
    component.onClick();
    expect(spy).toHaveBeenCalledWith(component.notification);
  });

  it('should return correct icon config for task_assigned', () => {
    component.notification = makeNotification({ event_type: 'task_assigned' });
    const config = component.getIconConfig();
    expect(config.icon).toContain('pi-user');
  });

  it('should return correct icon config for task_overdue', () => {
    component.notification = makeNotification({ event_type: 'task_overdue' });
    const config = component.getIconConfig();
    expect(config.icon).toContain('pi-exclamation-triangle');
  });

  it('should return correct icon config for task_commented', () => {
    component.notification = makeNotification({ event_type: 'task_commented' });
    const config = component.getIconConfig();
    expect(config.icon).toContain('pi-comment');
  });

  it('should return correct icon config for mention_in_comment', () => {
    component.notification = makeNotification({
      event_type: 'mention_in_comment',
    });
    const config = component.getIconConfig();
    expect(config.icon).toContain('pi-at');
  });

  it('should return fallback icon for unknown event type', () => {
    component.notification = makeNotification({ event_type: 'unknown' as any });
    const config = component.getIconConfig();
    expect(config.icon).toContain('pi-bell');
  });

  it('should return fallback bg class for unknown event type', () => {
    component.notification = makeNotification({ event_type: 'unknown' as any });
    const bg = component.getIconBgClass();
    expect(bg).toContain('bg-gray-100');
  });

  it('should return "Just now" for recent notification', () => {
    component.notification = makeNotification({
      created_at: new Date().toISOString(),
    });
    expect(component.getRelativeTime()).toBe('Just now');
  });

  it('should return minutes ago', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
    component.notification = makeNotification({ created_at: fiveMinAgo });
    expect(component.getRelativeTime()).toBe('5 min ago');
  });

  it('should return "1 min ago" for 1 minute', () => {
    const oneMinAgo = new Date(Date.now() - 61000).toISOString();
    component.notification = makeNotification({ created_at: oneMinAgo });
    expect(component.getRelativeTime()).toBe('1 min ago');
  });

  it('should return hours ago', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();
    component.notification = makeNotification({ created_at: twoHoursAgo });
    expect(component.getRelativeTime()).toBe('2 hours ago');
  });

  it('should return "1 hour ago" for 1 hour', () => {
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    component.notification = makeNotification({ created_at: oneHourAgo });
    expect(component.getRelativeTime()).toBe('1 hour ago');
  });

  it('should return "Yesterday" for 1 day ago', () => {
    const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
    component.notification = makeNotification({ created_at: oneDayAgo });
    expect(component.getRelativeTime()).toBe('Yesterday');
  });

  it('should return days ago for dates within a week', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
    component.notification = makeNotification({ created_at: threeDaysAgo });
    expect(component.getRelativeTime()).toBe('3 days ago');
  });

  it('should return formatted date for old notifications', () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString();
    component.notification = makeNotification({ created_at: twoWeeksAgo });
    const result = component.getRelativeTime();
    // Should not contain 'ago' - it's a formatted date
    expect(result).not.toContain('ago');
  });
});
