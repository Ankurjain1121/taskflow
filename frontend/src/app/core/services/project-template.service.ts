import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  is_public: boolean;
  tenant_id: string;
  created_by_id: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectTemplateColumn {
  id: string;
  template_id: string;
  name: string;
  position: number;
  color: string;
  wip_limit: number | null;
  status_mapping: Record<string, unknown>;
}

export interface ProjectTemplateTask {
  id: string;
  template_id: string;
  column_index: number;
  title: string;
  description: string | null;
  priority: TaskPriority;
  position: number;
}

export interface TemplateWithDetails extends ProjectTemplate {
  columns: ProjectTemplateColumn[];
  tasks: ProjectTemplateTask[];
}

export interface CreateTemplateRequest {
  name: string;
  description?: string;
  category?: string;
}

export interface CreateBoardFromTemplateRequest {
  workspace_id: string;
  project_name: string;
}

export interface SaveAsTemplateRequest {
  name: string;
  description?: string;
  category?: string;
}

@Injectable({ providedIn: 'root' })
export class ProjectTemplateService {
  private readonly apiUrl = '/api';

  constructor(private http: HttpClient) {}

  listTemplates(): Observable<ProjectTemplate[]> {
    return this.http.get<ProjectTemplate[]>(`${this.apiUrl}/project-templates`);
  }

  getTemplate(templateId: string): Observable<TemplateWithDetails> {
    return this.http.get<TemplateWithDetails>(
      `${this.apiUrl}/project-templates/${templateId}`,
    );
  }

  createTemplate(request: CreateTemplateRequest): Observable<ProjectTemplate> {
    return this.http.post<ProjectTemplate>(
      `${this.apiUrl}/project-templates`,
      request,
    );
  }

  deleteTemplate(templateId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/project-templates/${templateId}`,
    );
  }

  createBoardFromTemplate(
    templateId: string,
    request: CreateBoardFromTemplateRequest,
  ): Observable<{ project_id: string }> {
    return this.http.post<{ project_id: string }>(
      `${this.apiUrl}/project-templates/${templateId}/create-board`,
      request,
    );
  }

  saveBoardAsTemplate(
    projectId: string,
    request: SaveAsTemplateRequest,
  ): Observable<ProjectTemplate> {
    return this.http.post<ProjectTemplate>(
      `${this.apiUrl}/projects/${projectId}/save-as-template`,
      request,
    );
  }
}
