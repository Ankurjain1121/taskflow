import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UserPreferences {
  timezone: string;
  date_format: string;
  default_board_view: string;
  sidebar_density: string;
  locale: string;
  language: string;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  digest_frequency: string;
}

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
}
