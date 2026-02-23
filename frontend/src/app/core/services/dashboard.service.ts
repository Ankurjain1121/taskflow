import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';

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

interface CacheEntry<T> {
  observable: Observable<T>;
  timestamp: number;
}

const CACHE_TTL_MS = 30_000;

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private readonly apiUrl = '/api/dashboard';
  private cache = new Map<string, CacheEntry<unknown>>();

  constructor(private http: HttpClient) {}

  /** Invalidate all cached dashboard data. */
  invalidateCache(): void {
    this.cache.clear();
  }

  private getCached<T>(
    key: string,
    factory: () => Observable<T>,
  ): Observable<T> {
    const existing = this.cache.get(key) as CacheEntry<T> | undefined;
    if (existing && Date.now() - existing.timestamp < CACHE_TTL_MS) {
      return existing.observable;
    }
    const obs = factory().pipe(shareReplay({ bufferSize: 1, refCount: true }));
    this.cache.set(key, { observable: obs, timestamp: Date.now() });
    return obs;
  }

  private buildParams(
    workspaceId?: string,
    extra?: Record<string, string>,
  ): HttpParams {
    let params = new HttpParams();
    if (workspaceId) {
      params = params.set('workspace_id', workspaceId);
    }
    if (extra) {
      for (const [key, value] of Object.entries(extra)) {
        params = params.set(key, value);
      }
    }
    return params;
  }

  getStats(workspaceId?: string): Observable<DashboardStats> {
    return this.getCached(`stats:${workspaceId ?? ''}`, () =>
      this.http.get<DashboardStats>(`${this.apiUrl}/stats`, {
        params: this.buildParams(workspaceId),
      }),
    );
  }

  getRecentActivity(
    limit: number = 10,
    workspaceId?: string,
  ): Observable<DashboardActivityEntry[]> {
    return this.http.get<DashboardActivityEntry[]>(
      `${this.apiUrl}/recent-activity`,
      { params: this.buildParams(workspaceId, { limit: limit.toString() }) },
    );
  }

  getTasksByStatus(workspaceId?: string): Observable<TasksByStatus[]> {
    return this.getCached(`tasks-by-status:${workspaceId ?? ''}`, () =>
      this.http.get<TasksByStatus[]>(`${this.apiUrl}/tasks-by-status`, {
        params: this.buildParams(workspaceId),
      }),
    );
  }

  getTasksByPriority(workspaceId?: string): Observable<TasksByPriority[]> {
    return this.getCached(`tasks-by-priority:${workspaceId ?? ''}`, () =>
      this.http.get<TasksByPriority[]>(`${this.apiUrl}/tasks-by-priority`, {
        params: this.buildParams(workspaceId),
      }),
    );
  }

  getOverdueTasks(
    limit: number = 10,
    workspaceId?: string,
  ): Observable<OverdueTask[]> {
    return this.http.get<OverdueTask[]>(`${this.apiUrl}/overdue-tasks`, {
      params: this.buildParams(workspaceId, { limit: limit.toString() }),
    });
  }

  getCompletionTrend(
    days: number = 30,
    workspaceId?: string,
  ): Observable<CompletionTrendPoint[]> {
    return this.http.get<CompletionTrendPoint[]>(
      `${this.apiUrl}/completion-trend`,
      { params: this.buildParams(workspaceId, { days: days.toString() }) },
    );
  }

  getUpcomingDeadlines(
    days: number = 14,
    workspaceId?: string,
  ): Observable<UpcomingDeadline[]> {
    return this.http.get<UpcomingDeadline[]>(
      `${this.apiUrl}/upcoming-deadlines`,
      { params: this.buildParams(workspaceId, { days: days.toString() }) },
    );
  }

  getMyTasks(workspaceId?: string): Observable<MyTask[]> {
    return this.http.get<MyTask[]>(`${this.apiUrl}/my-tasks`, {
      params: this.buildParams(workspaceId),
    });
  }
}

export interface MyTask {
  id: string;
  title: string;
  priority: string;
  due_date: string | null;
  board_id: string;
  board_name: string;
  column_name: string;
  is_done: boolean;
}
