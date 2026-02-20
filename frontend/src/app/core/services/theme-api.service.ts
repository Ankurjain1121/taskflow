import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Theme, ThemeListResponse } from '../../shared/types/theme.types';

@Injectable({
  providedIn: 'root'
})
export class ThemeApiService {
  private readonly baseUrl = '/api/themes';

  constructor(private http: HttpClient) {}

  /**
   * List all active themes, optionally filtered by is_dark
   */
  listThemes(isDark?: boolean): Observable<ThemeListResponse> {
    let params = new HttpParams();
    if (isDark !== undefined) {
      params = params.set('is_dark', isDark.toString());
    }
    return this.http.get<ThemeListResponse>(this.baseUrl, { params });
  }

  /**
   * Get a single theme by slug
   */
  getTheme(slug: string): Observable<Theme> {
    return this.http.get<Theme>(`${this.baseUrl}/${slug}`);
  }
}
