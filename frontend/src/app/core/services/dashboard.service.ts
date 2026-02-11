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

export interface TasksByStatus {
  status: string;
  count: number;
  color: string | null;
}

export interface TasksByPriority {
  priority: string;
  count: number;
}

export interface OverdueTask {
  id: string;
  title: string;
  due_date: string;
  priority: string;
  board_id: string;
  board_name: string;
  days_overdue: number;
}

export interface CompletionTrendPoint {
  date: string;
  completed: number;
}

export interface UpcomingDeadline {
  id: string;
  title: string;
  due_date: string;
  priority: string;
  board_id: string;
  board_name: string;
  days_until_due: number;
}

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private readonly apiUrl = '/api/dashboard';

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

  getTasksByStatus(): Observable<TasksByStatus[]> {
    return this.http.get<TasksByStatus[]>(`${this.apiUrl}/tasks-by-status`);
  }

  getTasksByPriority(): Observable<TasksByPriority[]> {
    return this.http.get<TasksByPriority[]>(`${this.apiUrl}/tasks-by-priority`);
  }

  getOverdueTasks(limit: number = 10): Observable<OverdueTask[]> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<OverdueTask[]>(
      `${this.apiUrl}/overdue-tasks`,
      { params }
    );
  }

  getCompletionTrend(days: number = 30): Observable<CompletionTrendPoint[]> {
    const params = new HttpParams().set('days', days.toString());
    return this.http.get<CompletionTrendPoint[]>(
      `${this.apiUrl}/completion-trend`,
      { params }
    );
  }

  getUpcomingDeadlines(days: number = 14): Observable<UpcomingDeadline[]> {
    const params = new HttpParams().set('days', days.toString());
    return this.http.get<UpcomingDeadline[]>(
      `${this.apiUrl}/upcoming-deadlines`,
      { params }
    );
  }
}
