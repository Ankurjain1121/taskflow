import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/** Phase status — maps to milestones.status column (open | closed) */
export type PhaseStatus = 'open' | 'closed';

/** Phase flag — internal | external | critical */
export type PhaseFlag = 'internal' | 'external' | 'critical';

/**
 * A Milestone ("Phase" in the Zoho-inspired UI).
 * Returned from `GET /api/projects/:id/milestones` and related endpoints.
 */
export interface Milestone {
  id: string;
  name: string;
  description: string | null;
  due_date: string | null;
  start_date: string | null;
  color: string;
  /** Backend field is project_id; historical alias kept for readability */
  project_id?: string;
  board_id?: string;
  owner_id: string | null;
  owner_name: string | null;
  status: PhaseStatus;
  flag: PhaseFlag;
  total_tasks: number;
  completed_tasks: number;
  created_at: string;
  updated_at: string;
}

export interface CreateMilestoneRequest {
  name: string;
  description?: string;
  due_date?: string;
  start_date?: string;
  color?: string;
  owner_id?: string;
  flag?: PhaseFlag;
}

export interface UpdateMilestoneRequest {
  name?: string;
  description?: string;
  due_date?: string;
  start_date?: string;
  color?: string;
  owner_id?: string;
  flag?: PhaseFlag;
  status?: PhaseStatus;
}

@Injectable({ providedIn: 'root' })
export class MilestoneService {
  constructor(private http: HttpClient) {}

  list(boardId: string): Observable<Milestone[]> {
    return this.http.get<Milestone[]>(`/api/projects/${boardId}/milestones`);
  }

  get(id: string): Observable<Milestone> {
    return this.http.get<Milestone>(`/api/milestones/${id}`);
  }

  create(boardId: string, req: CreateMilestoneRequest): Observable<Milestone> {
    return this.http.post<Milestone>(`/api/projects/${boardId}/milestones`, req);
  }

  update(id: string, req: UpdateMilestoneRequest): Observable<Milestone> {
    return this.http.put<Milestone>(`/api/milestones/${id}`, req);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`/api/milestones/${id}`);
  }

  assignTask(taskId: string, milestoneId: string): Observable<void> {
    return this.http.post<void>(`/api/tasks/${taskId}/milestone`, {
      milestone_id: milestoneId,
    });
  }

  unassignTask(taskId: string): Observable<void> {
    return this.http.delete<void>(`/api/tasks/${taskId}/milestone`);
  }
}
