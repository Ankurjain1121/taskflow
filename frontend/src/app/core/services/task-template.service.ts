import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TaskTemplate {
  id: string;
  name: string;
  description: string | null;
  scope: string;
  board_id: string | null;
  tenant_id: string;
  created_by_id: string;
  task_title: string;
  task_description: string | null;
  task_priority: string | null;
  task_estimated_hours: number | null;
  created_at: string;
  updated_at: string;
}

export interface TaskTemplateSubtask {
  id: string;
  template_id: string;
  title: string;
  position: number;
}

export interface TaskTemplateCustomField {
  id: string;
  template_id: string;
  field_id: string;
  value: string | null;
}

export interface TaskTemplateWithDetails extends TaskTemplate {
  subtasks: TaskTemplateSubtask[];
  label_ids: string[];
  custom_fields: TaskTemplateCustomField[];
}

export interface CreateTaskTemplateRequest {
  name: string;
  description?: string;
  scope?: 'personal' | 'board' | 'workspace';
  board_id?: string;
  task_title: string;
  task_description?: string;
  task_priority?: string;
  task_estimated_hours?: number;
  subtasks?: string[];
  label_ids?: string[];
  custom_fields?: { field_id: string; value?: string }[];
}

export interface UpdateTaskTemplateRequest {
  name?: string;
  description?: string;
  task_title?: string;
  task_description?: string;
  task_priority?: string;
  task_estimated_hours?: number;
}

export interface SaveAsTemplateRequest {
  name: string;
  scope?: string;
}

export interface CreateFromTemplateRequest {
  board_id: string;
  column_id: string;
}

@Injectable({ providedIn: 'root' })
export class TaskTemplateService {
  constructor(private http: HttpClient) {}

  list(scope?: string, boardId?: string): Observable<TaskTemplate[]> {
    let params = new HttpParams();
    if (scope) {
      params = params.set('scope', scope);
    }
    if (boardId) {
      params = params.set('board_id', boardId);
    }
    return this.http.get<TaskTemplate[]>('/api/task-templates', { params });
  }

  get(id: string): Observable<TaskTemplateWithDetails> {
    return this.http.get<TaskTemplateWithDetails>(`/api/task-templates/${id}`);
  }

  create(req: CreateTaskTemplateRequest): Observable<TaskTemplate> {
    return this.http.post<TaskTemplate>('/api/task-templates', req);
  }

  update(id: string, req: UpdateTaskTemplateRequest): Observable<TaskTemplate> {
    return this.http.put<TaskTemplate>(`/api/task-templates/${id}`, req);
  }

  delete(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`/api/task-templates/${id}`);
  }

  saveTaskAsTemplate(
    taskId: string,
    req: SaveAsTemplateRequest,
  ): Observable<TaskTemplate> {
    return this.http.post<TaskTemplate>(
      `/api/tasks/${taskId}/save-as-template`,
      req,
    );
  }

  createTaskFromTemplate(
    templateId: string,
    req: CreateFromTemplateRequest,
  ): Observable<{ task_id: string }> {
    return this.http.post<{ task_id: string }>(
      `/api/task-templates/${templateId}/create-task`,
      req,
    );
  }
}
