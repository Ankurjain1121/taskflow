import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface DashboardStats {
  total_tasks: number;
  overdue: number;
  completed_this_week: number;
  due_today: number;
}

export interface DashboardActivityEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor_name: string;
  actor_avatar_url: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private readonly apiUrl = '/api/v1/dashboard';

  constructor(private http: HttpClient) {}

  getStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${this.apiUrl}/stats`);
  }

  getRecentActivity(limit: number = 10): Observable<DashboardActivityEntry[]> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<DashboardActivityEntry[]>(
      `${this.apiUrl}/recent-activity`,
      { params }
    );
  }
}
