import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UserPreferences {
  // Existing fields
  timezone: string;
  date_format: string;
  default_project_view: string;
  sidebar_density: string;
  locale: string;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  digest_frequency: string;
  // Theme fields (match backend JSON field names)
  accent_color?: string;
  color_mode?: string;
  dark_theme?: string;
}

export type ThemePreferenceUpdate = Partial<
  Pick<
    UserPreferences,
    'accent_color' | 'color_mode' | 'dark_theme'
  >
>;

@Injectable({
  providedIn: 'root',
})
export class UserPreferencesService {
  private readonly apiUrl = '/api/users/me/preferences';

  constructor(private http: HttpClient) {}

  getPreferences(): Observable<UserPreferences> {
    return this.http.get<UserPreferences>(this.apiUrl);
  }

  updatePreferences(
    prefs: Partial<UserPreferences>,
  ): Observable<UserPreferences> {
    return this.http.put<UserPreferences>(this.apiUrl, prefs);
  }

  updateThemePreferences(
    prefs: ThemePreferenceUpdate,
  ): Observable<UserPreferences> {
    return this.http.put<UserPreferences>(this.apiUrl, prefs);
  }
}
