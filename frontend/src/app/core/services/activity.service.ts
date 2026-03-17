import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export type ActivityAction =
  | 'created'
  | 'updated'
  | 'moved'
  | 'assigned'
  | 'unassigned'
  | 'commented'
  | 'attached'
  | 'status_changed'
  | 'priority_changed'
  | 'deleted';

export interface ActivityLogEntry {
  id: string;
  action: ActivityAction;
  entity_type: string;
  entity_id: string;
  user_id: string;
  metadata: Record<string, unknown> | null;
  tenant_id: string;
  created_at: string;
  actor: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  };
}

export interface ActivityListResponse {
  items: ActivityLogEntry[];
  nextCursor: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class ActivityService {
  private readonly apiUrl = '/api';

  constructor(private http: HttpClient) {}

  listByTask(
    taskId: string,
    cursor?: string,
    limit?: number,
  ): Observable<ActivityListResponse> {
    let params = new HttpParams();

    if (cursor) {
      params = params.set('cursor', cursor);
    }

    if (limit) {
      params = params.set('limit', limit.toString());
    }

    return this.http.get<ActivityListResponse>(
      `${this.apiUrl}/tasks/${taskId}/activity`,
      { params },
    );
  }

  listByProject(
    boardId: string,
    cursor?: string,
    limit?: number,
  ): Observable<ActivityListResponse> {
    let params = new HttpParams();

    if (cursor) {
      params = params.set('cursor', cursor);
    }

    if (limit) {
      params = params.set('limit', limit.toString());
    }

    return this.http.get<ActivityListResponse>(
      `${this.apiUrl}/projects/${boardId}/activity`,
      { params },
    );
  }
}
