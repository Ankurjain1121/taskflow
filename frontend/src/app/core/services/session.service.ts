import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface SessionInfo {
  id: string;
  ip_address: string;
  user_agent: string;
  device_name: string;
  last_active_at: string;
  created_at: string;
  is_current: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class SessionService {
  private readonly apiUrl = '/api/users/me/sessions';

  constructor(private http: HttpClient) {}

  listSessions(): Observable<SessionInfo[]> {
    return this.http.get<SessionInfo[]>(this.apiUrl);
  }

  revokeSession(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  revokeAllOtherSessions(): Observable<{ revoked_count: number }> {
    return this.http.delete<{ revoked_count: number }>(this.apiUrl);
  }
}
