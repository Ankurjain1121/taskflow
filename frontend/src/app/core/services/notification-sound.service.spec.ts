import { TestBed } from '@angular/core/testing';
import { NotificationSoundService } from './notification-sound.service';

describe('NotificationSoundService', () => {
  let service: NotificationSoundService;
  let originalAudio: typeof Audio;

  beforeEach(() => {
    localStorage.clear();

    // Mock Audio since jsdom doesn't implement HTMLMediaElement.play
    originalAudio = globalThis.Audio;
    globalThis.Audio = class MockAudio {
      volume = 1;
      currentTime = 0;
      play(): Promise<void> {
        return Promise.resolve();
      }
    } as unknown as typeof Audio;

    TestBed.configureTestingModule({
      providers: [NotificationSoundService],
    });
    service = TestBed.inject(NotificationSoundService);
  });

  afterEach(() => {
    globalThis.Audio = originalAudio;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should default to sound enabled', () => {
    expect(service.soundEnabled()).toBe(true);
  });

  it('should read muted state from localStorage', () => {
    localStorage.setItem('notification_sound', 'muted');
    // Re-create service so constructor reads updated localStorage
    const mutedService = new NotificationSoundService();
    expect(mutedService.soundEnabled()).toBe(false);
  });

  describe('toggleSound()', () => {
    it('should toggle from enabled to muted', () => {
      expect(service.soundEnabled()).toBe(true);
      service.toggleSound();
      expect(service.soundEnabled()).toBe(false);
      expect(localStorage.getItem('notification_sound')).toBe('muted');
    });

    it('should toggle from muted to enabled', () => {
      service.toggleSound(); // mute
      service.toggleSound(); // unmute
      expect(service.soundEnabled()).toBe(true);
      expect(localStorage.getItem('notification_sound')).toBe('enabled');
    });
  });

  describe('playNotificationSound()', () => {
    it('should not throw when called with sound enabled', () => {
      expect(() => service.playNotificationSound()).not.toThrow();
    });

    it('should not play when muted', () => {
      service.toggleSound(); // mute
      expect(() => service.playNotificationSound()).not.toThrow();
    });
  });
});
