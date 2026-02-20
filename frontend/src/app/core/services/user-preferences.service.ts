import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UserPreferences {
  // Existing fields
  timezone: string;
  date_format: string;
  default_board_view: string;
  sidebar_density: string;
  locale: string;
  language: string;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  digest_frequency: string;
  // New theme fields
  light_theme_slug?: string;
  dark_theme_slug?: string;
  accent_color?: string;
  color_mode?: string;
}

export type ThemePreferenceUpdate = Partial<Pick<UserPreferences, 
  | 'light_theme_slug' 
  | 'dark_theme_slug' 
  | 'accent_color' 
  | 'color_mode'
>>;

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
