import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface HolderSummary {
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  assigned_at: string;
}

export interface Position {
  id: string;
  name: string;
  description: string | null;
  project_id: string;
  fallback_position_id: string | null;
  fallback_position_name: string | null;
  tenant_id: string;
  created_by_id: string;
  created_at: string;
  updated_at: string;
  holders: HolderSummary[];
  recurring_task_count: number;
}

export interface CreatePositionRequest {
  name: string;
  description?: string;
  fallback_position_id?: string;
}

export interface UpdatePositionRequest {
  name?: string;
  description?: string;
  fallback_position_id?: string | null;
}

@Injectable({ providedIn: 'root' })
export class PositionService {
  private readonly apiUrl = '/api';

  constructor(private http: HttpClient) {}

  listPositions(projectId: string): Observable<Position[]> {
    return this.http.get<Position[]>(
      `${this.apiUrl}/projects/${projectId}/positions`,
    );
  }

  createPosition(
    projectId: string,
    req: CreatePositionRequest,
  ): Observable<Position> {
    return this.http.post<Position>(
      `${this.apiUrl}/projects/${projectId}/positions`,
      req,
    );
  }

  getPosition(id: string): Observable<Position> {
    return this.http.get<Position>(`${this.apiUrl}/positions/${id}`);
  }

  updatePosition(id: string, req: UpdatePositionRequest): Observable<Position> {
    return this.http.put<Position>(`${this.apiUrl}/positions/${id}`, req);
  }

  deletePosition(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/positions/${id}`);
  }

  addHolder(positionId: string, userId: string): Observable<void> {
    return this.http.post<void>(
      `${this.apiUrl}/positions/${positionId}/holders`,
      { user_id: userId },
    );
  }

  removeHolder(positionId: string, userId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/positions/${positionId}/holders/${userId}`,
    );
  }

  getPositionRecurringTasks(positionId: string): Observable<unknown[]> {
    return this.http.get<unknown[]>(
      `${this.apiUrl}/positions/${positionId}/recurring-tasks`,
    );
  }
}
