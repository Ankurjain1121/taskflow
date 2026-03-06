import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Milestone {
  id: string;
  name: string;
  description: string | null;
  due_date: string | null;
  color: string;
  board_id: string;
  total_tasks: number;
  completed_tasks: number;
  created_at: string;
  updated_at: string;
}

export interface CreateMilestoneRequest {
  name: string;
  description?: string;
  due_date?: string;
  color?: string;
}

export interface UpdateMilestoneRequest {
  name?: string;
  description?: string;
  due_date?: string;
  color?: string;
}

@Injectable({ providedIn: 'root' })
export class MilestoneService {
  constructor(private http: HttpClient) {}

  list(boardId: string): Observable<Milestone[]> {
    return this.http.get<Milestone[]>(`/api/boards/${boardId}/milestones`);
  }

  get(id: string): Observable<Milestone> {
    return this.http.get<Milestone>(`/api/milestones/${id}`);
  }

  create(boardId: string, req: CreateMilestoneRequest): Observable<Milestone> {
    return this.http.post<Milestone>(`/api/boards/${boardId}/milestones`, req);
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
