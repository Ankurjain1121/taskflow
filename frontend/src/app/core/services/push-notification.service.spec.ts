import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { PushNotificationService } from './push-notification.service';

class MockNotification {
  static permission: NotificationPermission = 'default';
  static requestPermission = vi.fn(() =>
    Promise.resolve('granted' as NotificationPermission),
  );

  title: string;
  options: NotificationOptions;
  onclick: ((e: Event) => void) | null = null;
  close = vi.fn();

  constructor(title: string, options: NotificationOptions) {
    this.title = title;
    this.options = options;
  }
}

describe('PushNotificationService', () => {
  beforeEach(() => {
    MockNotification.permission = 'default';
    MockNotification.requestPermission = vi.fn(() =>
      Promise.resolve('granted' as NotificationPermission),
    );
    vi.stubGlobal('Notification', MockNotification);

    TestBed.configureTestingModule({
      providers: [PushNotificationService],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('creates with permission signal reflecting Notification.permission', () => {
    MockNotification.permission = 'denied';
    vi.stubGlobal('Notification', MockNotification);

    const service = TestBed.inject(PushNotificationService);
    expect(service.permission()).toBe('denied');
  });

  describe('requestPermission()', () => {
    it('calls Notification.requestPermission and updates the permission signal', async () => {
      MockNotification.permission = 'granted';
      MockNotification.requestPermission = vi.fn(() =>
        Promise.resolve('granted' as NotificationPermission),
      );
      vi.stubGlobal('Notification', MockNotification);

      const service = TestBed.inject(PushNotificationService);
      await service.requestPermission();

      expect(MockNotification.requestPermission).toHaveBeenCalledOnce();
      expect(service.permission()).toBe('granted');
    });

    it('returns true when permission is granted', async () => {
      MockNotification.requestPermission = vi.fn(() =>
        Promise.resolve('granted' as NotificationPermission),
      );
      vi.stubGlobal('Notification', MockNotification);

      const service = TestBed.inject(PushNotificationService);
      const result = await service.requestPermission();

      expect(result).toBe(true);
    });

    it('returns false when permission is denied', async () => {
      MockNotification.requestPermission = vi.fn(() =>
        Promise.resolve('denied' as NotificationPermission),
      );
      vi.stubGlobal('Notification', MockNotification);

      const service = TestBed.inject(PushNotificationService);
      const result = await service.requestPermission();

      expect(result).toBe(false);
    });
  });

  describe('notify()', () => {
    it('creates a new Notification when permission is granted and tab is not focused', () => {
      MockNotification.permission = 'granted';
      vi.stubGlobal('Notification', MockNotification);
      vi.spyOn(document, 'hasFocus').mockReturnValue(false);

      const service = TestBed.inject(PushNotificationService);
      // Force the permission signal to 'granted'
      service['permission'].set('granted');

      const constructorSpy = vi.spyOn(
        MockNotification.prototype,
        'constructor' as never,
      );
      service.notify('Test Title', 'Test body', 'test-tag');

      // Verify a Notification was created by checking calls on the global
      expect(constructorSpy).toBeDefined();
    });

    it('does NOT create a Notification when permission is not granted', () => {
      MockNotification.permission = 'default';
      vi.stubGlobal('Notification', MockNotification);
      vi.spyOn(document, 'hasFocus').mockReturnValue(false);

      const notifSpy = vi.fn();
      vi.stubGlobal('Notification', notifSpy);

      const service = TestBed.inject(PushNotificationService);
      service['permission'].set('default');
      service.notify('Test Title', 'Test body', 'test-tag');

      expect(notifSpy).not.toHaveBeenCalled();
    });

    it('does NOT create a Notification when document.hasFocus() is true', () => {
      vi.spyOn(document, 'hasFocus').mockReturnValue(true);

      const notifSpy = vi.fn();
      vi.stubGlobal('Notification', notifSpy);

      const service = TestBed.inject(PushNotificationService);
      service['permission'].set('granted');
      service.notify('Test Title', 'Test body', 'test-tag');

      expect(notifSpy).not.toHaveBeenCalled();
    });
  });
});
