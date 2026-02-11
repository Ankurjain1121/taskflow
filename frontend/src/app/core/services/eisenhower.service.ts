import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type EisenhowerQuadrant = 'do_first' | 'schedule' | 'delegate' | 'eliminate';

export interface EisenhowerTask {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  due_date: string | null;
  board_id: string;
  board_name: string;
  column_id: string;
  column_name: string;
  position: string;
  is_done: boolean;
  eisenhower_urgency: boolean | null;
  eisenhower_importance: boolean | null;
  quadrant: EisenhowerQuadrant;
  created_at: string;
  updated_at: string;
}

export interface EisenhowerMatrixResponse {
  do_first: EisenhowerTask[];
  schedule: EisenhowerTask[];
  delegate: EisenhowerTask[];
  eliminate: EisenhowerTask[];
}

export interface UpdateEisenhowerRequest {
  urgency: boolean | null;
  importance: boolean | null;
}

export interface ResetEisenhowerResponse {
  tasks_reset: number;
}

@Injectable({
  providedIn: 'root',
})
export class EisenhowerService {
  private readonly apiUrl = '/api/eisenhower';

  constructor(private http: HttpClient) {}

  /**
   * Get Eisenhower Matrix with all tasks grouped by quadrants
   */
  getMatrix(): Observable<EisenhowerMatrixResponse> {
    return this.http.get<EisenhowerMatrixResponse>(this.apiUrl);
  }

  /**
   * Update manual overrides for a task
   * Set to null to use auto-computation
   */
  updateTaskOverride(
    taskId: string,
    urgency: boolean | null,
    importance: boolean | null
  ): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/tasks/${taskId}`, {
      urgency,
      importance,
    });
  }

  /**
   * Reset all manual overrides to auto-compute
   */
  resetAllOverrides(): Observable<ResetEisenhowerResponse> {
    return this.http.put<ResetEisenhowerResponse>(`${this.apiUrl}/reset`, {});
  }
}
