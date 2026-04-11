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

/**
 * Single entry in the task Status Timeline. Mirrors
 * `StatusTimelineEntry` from `backend/crates/db/src/queries/activity_log.rs`.
 *
 * `from_status_*` is null for the very first transition into a status (e.g.
 * when the task was created). Colors are null when the named status has
 * since been renamed or deleted from the project.
 */
export interface StatusTimelineEntry {
  id: string;
  task_id: string;
  actor_id: string;
  actor_name: string | null;
  actor_avatar_url: string | null;
  from_status_name: string | null;
  from_status_color: string | null;
  to_status_name: string | null;
  to_status_color: string | null;
  created_at: string;
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

  /**
   * Fetch the chronological status transition history for a task.
   * Returns an empty array if no status changes have been recorded.
   */
  getStatusTimeline(taskId: string): Observable<StatusTimelineEntry[]> {
    return this.http.get<StatusTimelineEntry[]>(
      `${this.apiUrl}/tasks/${taskId}/status-timeline`,
    );
  }
}
