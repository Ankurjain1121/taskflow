import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type DependencyType = 'blocks' | 'blocked_by' | 'related';

export interface TaskDependency {
  id: string;
  source_task_id: string;
  target_task_id: string;
  dependency_type: DependencyType;
  related_task_id: string;
  related_task_title: string;
  related_task_priority: string;
  related_task_column_name: string;
  is_blocked: boolean;
  created_at: string;
}

export interface BlockerInfo {
  task_id: string;
  title: string;
  is_resolved: boolean;
}

@Injectable({ providedIn: 'root' })
export class DependencyService {
  constructor(private http: HttpClient) {}

  listDependencies(taskId: string): Observable<TaskDependency[]> {
    return this.http.get<TaskDependency[]>(`/api/tasks/${taskId}/dependencies`);
  }

  createDependency(taskId: string, targetTaskId: string, type: DependencyType): Observable<TaskDependency> {
    return this.http.post<TaskDependency>(`/api/tasks/${taskId}/dependencies`, {
      target_task_id: targetTaskId,
      dependency_type: type,
    });
  }

  deleteDependency(depId: string): Observable<void> {
    return this.http.delete<void>(`/api/dependencies/${depId}`);
  }

  checkBlockers(taskId: string): Observable<BlockerInfo[]> {
    return this.http.get<BlockerInfo[]>(`/api/tasks/${taskId}/blockers`);
  }

  getBoardDependencies(boardId: string): Observable<TaskDependency[]> {
    return this.http.get<TaskDependency[]>(`/api/boards/${boardId}/dependencies`);
  }
}
