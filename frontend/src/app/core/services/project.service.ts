import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Project, ProjectColumn, ProjectMemberInfo, CreateProjectRequest, UpdateProjectRequest } from '../../shared/types/project.types';

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private api = inject(ApiService);

  listByWorkspace(workspaceId: string) {
    return this.api.get<Project[]>(`/workspaces/${workspaceId}/projects`);
  }

  getById(id: string) {
    return this.api.get<Project>(`/projects/${id}`);
  }

  create(workspaceId: string, data: CreateProjectRequest) {
    return this.api.post<Project>(`/workspaces/${workspaceId}/projects`, data);
  }

  update(id: string, data: Partial<UpdateProjectRequest>) {
    return this.api.put<Project>(`/projects/${id}`, data);
  }

  delete(id: string) {
    return this.api.delete(`/projects/${id}`);
  }

  archive(id: string) {
    return this.api.patch<Project>(`/projects/${id}/archive`, {});
  }

  // Columns
  listColumns(projectId: string) {
    return this.api.get<ProjectColumn[]>(`/projects/${projectId}/columns`);
  }

  addColumn(projectId: string, data: { name: string; color?: string; status_mapping?: Record<string, boolean> }) {
    return this.api.post<ProjectColumn>(`/projects/${projectId}/columns`, data);
  }

  renameColumn(columnId: string, name: string) {
    return this.api.put<ProjectColumn>(`/columns/${columnId}/rename`, { name });
  }

  reorderColumn(columnId: string, afterId: string | null, beforeId: string | null) {
    return this.api.put(`/columns/${columnId}/reorder`, { after_id: afterId, before_id: beforeId });
  }

  updateStatusMapping(columnId: string, statusMapping: Record<string, boolean>) {
    return this.api.put(`/columns/${columnId}/status-mapping`, { status_mapping: statusMapping });
  }

  deleteColumn(columnId: string) {
    return this.api.delete(`/columns/${columnId}`);
  }

  // Members
  listMembers(projectId: string) {
    return this.api.get<ProjectMemberInfo[]>(`/projects/${projectId}/members`);
  }

  addMember(projectId: string, userId: string, role: string) {
    return this.api.post(`/projects/${projectId}/members`, { user_id: userId, role });
  }

  removeMember(projectId: string, userId: string) {
    return this.api.delete(`/projects/${projectId}/members/${userId}`);
  }
}
