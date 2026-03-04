import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'notification_sound';

// A short, pleasant notification ping sound encoded as a base64 WAV
// This is a synthesized 440Hz sine wave beep lasting ~150ms with fade-out
const NOTIFICATION_SOUND_BASE64 =
  'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVoG' +
  'AACAgoWIi42PkZOVl5ialpiWlJKQjo2LiYeFg4GAfn17enl4d3Z2dnd4eXp7fX+BgoSGiIqM' +
  'jpCSlJaYmZqbm5uamZiWlJKQjoyKiIaEgoB+fHp5d3Z1dHR0dHV2d3l6fH6AgoSGiIqMjpCS' +
  'lJaYmZqbm5uamZiWlJKQjoyKiIaEgoB+fHp5d3Z1dHR0dHV2d3l6fH6AgoSGiIqMjpCSlJaY' +
  'mZqbm5uamZiWlJKQjoyKiIaEgoB+fHp5d3Z1dHR0dHV2d3l6fH6AgoSGiIqMjpCSlJaYmZqb' +
  'm5uamZiWlJKQjoyKiIaEgoB+fHp5d3Z1dHR0dHV2d3l6fH6AgoSGiIqMjpCSlJaYmZqbm5ua' +
  'mZiWlJKQjoyKiIaEgoB+fHp5d3Z1dHR0dHV2d3l6fH5/gYOFh4mLjY+RkpSWl5mampmZmJeW' +
  'lJORj42LiYeEgoCAf359fHt6enl5eXl5ent8fX5/gYKEhoeJi4yOj5GSlJWXmJmamZiYl5aU' +
  'k5GPjoyKiIaEg4GAfn59fHt7enp5eXl5ent7fH5/gIKDhYeIioyOj5GSlJWXmJmamZiYl5aU' +
  'k5GPjoyKiIaEg4GAf359fHt7enp5eXl5ent7fH1/gIKDhYeIioyNj5CSlJWWmJiZmZiXlpWU' +
  'kpCOjYuJh4WEgoGAf359fHt7enp6eXl5ent7fH1+gIGDhIaHiYuMjpCRk5SVlpeYmZmYl5aV' +
  'lJKRj42MiomHhYSCgYB/fn18e3t7e3p6e3t7fH1+f4CCg4WHiIqLjY6QkZOUlZeYmJmZmJeW' +
  'lZSTkZCOjYuKiIeGhIOCgYB/fn5+fn5+fn5+fn5/gIGBgoOEhYaHiImKi4yNjo+QkJGRkZGR' +
  'kZCQj4+OjYyLioqIh4aFhIOCgYGAgIB/f39/f39/f4CAgIGBgoKDhIWFhoaHiImJiouLjIyN' +
  'jY2NjY2NjIyLi4qKiYiIh4aGhYSEg4ODgoKCgoKCgoKCgoKCgoODg4OEhIWFhYaGh4eIiImJ' +
  'iYqKioqKioqKiomJiYiIh4eGhoaFhYSEhIODg4KCgoKCgoKCgoKCg4ODg4SEhIWFhYaGhoeH' +
  'iIiIiYmJiYmJiYmJiIiIiIeHh4aGhoWFhYSEhISDg4ODg4ODg4ODg4ODhISEhISFhYWFhYaG' +
  'hoeHh4eIiIiIiIiIiIiIh4eHh4eGhoaGhYWFhYWEhISEhISEhISEhISEhISEhYWFhYWFhYaG' +
  'hoaGh4eHh4eHiIiIiIeHh4eHh4eHhoaGhoaGhYWFhYWFhYWFhYWFhYWFhYWFhYaGhoaGhoaG' +
  'hoaGh4eHh4eHh4eHh4eHh4eHh4eGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaG' +
  'h4eHh4eHh4eHh4eHh4eHh4eGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGh4eH' +
  'h4eHh4eHh4eHh4eHh4eHhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoeGh4eHh4eH' +
  'h4eHh4eHh4eHh4eHh4eHh4aGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGh4eHh4eHh4eHh4eH' +
  'h4eHh4eHh4eHh4eHh4eHh4eHh4eHhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaHh4eHh4eHh4eH' +
  'h4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHhoaGhoaGhoaGhoaGh4eHh4eHh4eHh4eH' +
  'h4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eH' +
  'h4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eH' +
  'h4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eH';

@Injectable({
  providedIn: 'root',
})
export class NotificationSoundService {
  private notificationSound: HTMLAudioElement | null = null;

  readonly soundEnabled = signal<boolean>(
    localStorage.getItem(STORAGE_KEY) !== 'muted',
  );

  constructor() {
    try {
      this.notificationSound = new Audio(NOTIFICATION_SOUND_BASE64);
      this.notificationSound.volume = 0.5;
    } catch {
      // Audio not supported in this environment
      this.notificationSound = null;
    }
  }

  /**
   * Play a short notification ping sound.
   * Respects the mute setting and silently handles autoplay restrictions.
   */
  playNotificationSound(): void {
    if (this.soundEnabled() && this.notificationSound) {
      this.notificationSound.currentTime = 0;
      this.notificationSound.play().catch(() => {
        // Silently ignore autoplay restrictions
      });
    }
  }

  /**
   * Toggle sound on/off and persist preference to localStorage.
   */
  toggleSound(): void {
    const enabled = !this.soundEnabled();
    this.soundEnabled.set(enabled);
    localStorage.setItem(STORAGE_KEY, enabled ? 'enabled' : 'muted');
  }
}
