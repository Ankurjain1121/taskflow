import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  phone_number: string | null;
  avatar_url: string | null;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpdateProfileRequest {
  name?: string;
  phoneNumber?: string | null;
  avatarUrl?: string | null;
}

export interface NotificationPreference {
  id: string;
  user_id: string;
  event_type: string;
  in_app: boolean;
  email: boolean;
  slack: boolean;
  whatsapp: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpdatePreferenceRequest {
  eventType: string;
  inApp: boolean;
  email: boolean;
  slack: boolean;
  whatsapp: boolean;
}

// Default preferences for all event types when no preference is set
export const DEFAULT_PREFERENCES: Record<string, Omit<NotificationPreference, 'id' | 'user_id' | 'created_at' | 'updated_at'>> = {
  task_assigned: { event_type: 'task_assigned', in_app: true, email: true, slack: false, whatsapp: false },
  task_due_soon: { event_type: 'task_due_soon', in_app: true, email: true, slack: false, whatsapp: false },
  task_overdue: { event_type: 'task_overdue', in_app: true, email: true, slack: false, whatsapp: false },
  task_commented: { event_type: 'task_commented', in_app: true, email: false, slack: false, whatsapp: false },
  task_completed: { event_type: 'task_completed', in_app: true, email: false, slack: false, whatsapp: false },
  mention_in_comment: { event_type: 'mention_in_comment', in_app: true, email: true, slack: false, whatsapp: false },
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
  task_assigned: 'Task Assigned',
  task_due_soon: 'Task Due Soon',
  task_overdue: 'Task Overdue',
  task_commented: 'Task Commented',
  task_completed: 'Task Completed',
  mention_in_comment: 'Mentioned in Comment',
};

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private readonly apiUrl = '/api/users/me';
  private readonly preferencesUrl = '/api/notification-preferences';

  private _profile = signal<UserProfile | null>(null);
  private _preferences = signal<NotificationPreference[]>([]);
  private _isLoading = signal<boolean>(false);

  readonly profile = this._profile.asReadonly();
  readonly preferences = this._preferences.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();

  constructor(private http: HttpClient) {}

  /**
   * Get the current user's profile
   */
  getProfile(): Observable<UserProfile> {
    this._isLoading.set(true);
    return this.http.get<UserProfile>(`${this.apiUrl}/profile`).pipe(
      tap((profile) => {
        this._profile.set(profile);
        this._isLoading.set(false);
      })
    );
  }

  /**
   * Update the current user's profile
   * @param data Profile data to update (name, phoneNumber in E.164 format, avatarUrl)
   */
  updateProfile(data: UpdateProfileRequest): Observable<UserProfile> {
    this._isLoading.set(true);
    return this.http.put<UserProfile>(`${this.apiUrl}/profile`, data).pipe(
      tap((profile) => {
        this._profile.set(profile);
        this._isLoading.set(false);
      })
    );
  }

  /**
   * Get notification preferences for the current user
   */
  getNotificationPreferences(): Observable<NotificationPreference[]> {
    return this.http.get<NotificationPreference[]>(this.preferencesUrl).pipe(
      tap((preferences) => this._preferences.set(preferences))
    );
  }

  /**
   * Update a notification preference
   */
  updateNotificationPreference(request: UpdatePreferenceRequest): Observable<NotificationPreference> {
    return this.http.put<NotificationPreference>(this.preferencesUrl, request).pipe(
      tap((updatedPref) => {
        this._preferences.update((prefs) => {
          const index = prefs.findIndex((p) => p.event_type === updatedPref.event_type);
          if (index >= 0) {
            const newPrefs = [...prefs];
            newPrefs[index] = updatedPref;
            return newPrefs;
          }
          return [...prefs, updatedPref];
        });
      })
    );
  }

  /**
   * Reset all notification preferences to defaults
   */
  resetNotificationPreferences(): Observable<void> {
    return this.http.delete<void>(this.preferencesUrl).pipe(
      tap(() => this._preferences.set([]))
    );
  }

  /**
   * Get the effective preference for an event type (with defaults applied)
   */
  getEffectivePreference(eventType: string): Omit<NotificationPreference, 'id' | 'user_id' | 'created_at' | 'updated_at'> {
    const prefs = this._preferences();
    const userPref = prefs.find((p) => p.event_type === eventType);
    if (userPref) {
      return {
        event_type: userPref.event_type,
        in_app: userPref.in_app,
        email: userPref.email,
        slack: userPref.slack,
        whatsapp: userPref.whatsapp,
      };
    }
    return DEFAULT_PREFERENCES[eventType] || {
      event_type: eventType,
      in_app: true,
      email: true,
      slack: false,
      whatsapp: false,
    };
  }
}
