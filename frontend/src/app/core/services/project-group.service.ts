import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/** Project group — a named collection of projects within a workspace. */
export interface ProjectGroup {
  id: string;
  workspace_id: string;
  tenant_id: string;
  name: string;
  color: string;
  position: string;
  description: string | null;
  created_by_id: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectGroupWithCount extends ProjectGroup {
  project_count: number;
}

export interface CreateProjectGroupRequest {
  name: string;
  color?: string;
  description?: string | null;
}

export interface UpdateProjectGroupRequest {
  name?: string;
  color?: string;
  description?: string | null;
}

@Injectable({ providedIn: 'root' })
export class ProjectGroupService {
  private readonly http = inject(HttpClient);

  list(workspaceId: string): Observable<ProjectGroupWithCount[]> {
    return this.http.get<ProjectGroupWithCount[]>(
      `/api/workspaces/${workspaceId}/project-groups`,
    );
  }

  get(id: string): Observable<ProjectGroup> {
    return this.http.get<ProjectGroup>(`/api/project-groups/${id}`);
  }

  create(
    workspaceId: string,
    req: CreateProjectGroupRequest,
  ): Observable<ProjectGroup> {
    return this.http.post<ProjectGroup>(
      `/api/workspaces/${workspaceId}/project-groups`,
      req,
    );
  }

  update(id: string, req: UpdateProjectGroupRequest): Observable<ProjectGroup> {
    return this.http.put<ProjectGroup>(`/api/project-groups/${id}`, req);
  }

  delete(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`/api/project-groups/${id}`);
  }

  /** Attach a project to a group, or pass null to unassign. */
  assignProject(
    projectId: string,
    groupId: string | null,
  ): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(
      `/api/projects/${projectId}/group`,
      { group_id: groupId },
    );
  }
}
