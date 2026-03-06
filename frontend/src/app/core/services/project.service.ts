import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { CacheService } from './cache.service';

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  prefix?: string | null;
  background_color?: string | null;
  is_sample: boolean;
  position: string;
  created_at: string;
  updated_at: string;
}

export interface ColumnStatusMapping {
  done?: boolean;
  [key: string]: unknown;
}

export interface Column {
  id: string;
  project_id: string;
  name: string;
  position: string;
  color: string;
  status_mapping: ColumnStatusMapping | null;
  wip_limit: number | null;
  icon?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  template?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  background_color?: string | null;
}

export interface CreateColumnRequest {
  name: string;
  color?: string;
  status_mapping?: ColumnStatusMapping;
  wip_limit?: number;
}

export interface UpdateColumnRequest {
  name?: string;
  color?: string;
  status_mapping?: ColumnStatusMapping | null;
  wip_limit?: number | null;
}

export interface ReorderColumnRequest {
  new_index: number;
}

export interface ProjectMember {
  user_id: string;
  project_id: string;
  role: 'viewer' | 'editor' | 'owner';
  name?: string;
  email?: string;
  avatar_url?: string | null;
}

export interface InviteMemberRequest {
  email: string;
  role: 'viewer' | 'editor' | 'owner';
}

export interface UpdateMemberRoleRequest {
  role: 'viewer' | 'editor' | 'owner';
}

export interface DuplicateProjectRequest {
  name: string;
  include_tasks?: boolean;
}

export interface TaskWithBadges {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  due_date: string | null;
  column_id: string;
  position: string;
  group_id: string | null;
  milestone_id: string | null;
  created_by_id: string;
  created_at: string;
  updated_at: string;
  subtask_completed: number;
  subtask_total: number;
  has_running_timer: boolean;
  comment_count: number;
  column_entered_at: string;
  assignees: { id: string; display_name: string; avatar_url: string | null }[];
  labels: { id: string; name: string; color: string }[];
}

export interface ProjectMeta {
  total_task_count: number;
  current_limit: number;
  current_offset: number;
}

export interface ProjectFullResponse {
  project: Project & { columns: Column[] };
  tasks: TaskWithBadges[];
  members: ProjectMember[];
  meta: ProjectMeta;
}

@Injectable({
  providedIn: 'root',
})
export class ProjectService {
  private readonly apiUrl = '/api';
  private cache = inject(CacheService);

  constructor(private http: HttpClient) {}

  listProjects(workspaceId: string): Observable<Project[]> {
    return this.cache.get(
      `projects:${workspaceId}`,
      () =>
        this.http.get<Project[]>(
          `${this.apiUrl}/workspaces/${workspaceId}/projects`,
        ),
      120000, // 2 min TTL
    );
  }

  getProject(projectId: string): Observable<Project> {
    return this.cache.get(
      `project:${projectId}`,
      () => this.http.get<Project>(`${this.apiUrl}/projects/${projectId}`),
      120000, // 2 min TTL
    );
  }

  createProject(
    workspaceId: string,
    request: CreateProjectRequest,
  ): Observable<Project> {
    return this.http
      .post<Project>(`${this.apiUrl}/workspaces/${workspaceId}/projects`, request)
      .pipe(
        tap(() => {
          this.cache.invalidateKey(`projects:${workspaceId}`);
        }),
      );
  }

  updateProject(projectId: string, request: UpdateProjectRequest): Observable<Project> {
    return this.http
      .patch<Project>(`${this.apiUrl}/projects/${projectId}`, request)
      .pipe(
        tap(() => {
          this.cache.invalidateKey(`project:${projectId}`);
          this.cache.invalidate(`project-full:${projectId}:.*`);
          this.cache.invalidate(`projects:.*`);
        }),
      );
  }

  deleteProject(projectId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/projects/${projectId}`).pipe(
      tap(() => {
        this.cache.invalidateKey(`project:${projectId}`);
        this.cache.invalidate(`project-full:${projectId}:.*`);
        this.cache.invalidate(`projects:.*`);
      }),
    );
  }

  listColumns(projectId: string): Observable<Column[]> {
    return this.cache.get(
      `columns:${projectId}`,
      () => this.http.get<Column[]>(`${this.apiUrl}/projects/${projectId}/columns`),
      120000, // 2 min TTL
    );
  }

  createColumn(
    projectId: string,
    request: CreateColumnRequest,
  ): Observable<Column> {
    return this.http
      .post<Column>(`${this.apiUrl}/projects/${projectId}/columns`, request)
      .pipe(
        tap(() => {
          this.cache.invalidateKey(`columns:${projectId}`);
          this.cache.invalidate(`project-full:${projectId}:.*`);
        }),
      );
  }

  updateColumn(
    columnId: string,
    request: UpdateColumnRequest,
  ): Observable<Column> {
    return this.http
      .patch<Column>(`${this.apiUrl}/columns/${columnId}`, request)
      .pipe(
        tap((column) => {
          this.cache.invalidateKey(`columns:${column.project_id}`);
          this.cache.invalidate(`project-full:${column.project_id}:.*`);
        }),
      );
  }

  reorderColumn(
    columnId: string,
    request: ReorderColumnRequest,
  ): Observable<Column> {
    return this.http
      .put<Column>(`${this.apiUrl}/columns/${columnId}/position`, request)
      .pipe(
        tap((column) => {
          this.cache.invalidateKey(`columns:${column.project_id}`);
          this.cache.invalidate(`project-full:${column.project_id}:.*`);
        }),
      );
  }

  renameColumn(columnId: string, name: string): Observable<Column> {
    return this.http
      .put<Column>(`${this.apiUrl}/columns/${columnId}/name`, { name })
      .pipe(
        tap((column) => {
          this.cache.invalidateKey(`columns:${column.project_id}`);
          this.cache.invalidate(`project-full:${column.project_id}:.*`);
        }),
      );
  }

  updateColumnWipLimit(
    columnId: string,
    wipLimit: number | null,
  ): Observable<Column> {
    return this.http
      .put<Column>(`${this.apiUrl}/columns/${columnId}/wip-limit`, {
        wip_limit: wipLimit,
      })
      .pipe(
        tap((column) => {
          this.cache.invalidateKey(`columns:${column.project_id}`);
          this.cache.invalidate(`project-full:${column.project_id}:.*`);
        }),
      );
  }

  updateColumnIcon(columnId: string, icon: string | null): Observable<Column> {
    return this.http
      .put<Column>(`${this.apiUrl}/columns/${columnId}/icon`, { icon })
      .pipe(
        tap((column) => {
          this.cache.invalidateKey(`columns:${column.project_id}`);
          this.cache.invalidate(`project-full:${column.project_id}:.*`);
        }),
      );
  }

  deleteColumn(columnId: string): Observable<void> {
    // Note: We need to get project_id before deleting, so fetch it from cache if available
    return this.http.delete<void>(`${this.apiUrl}/columns/${columnId}`).pipe(
      tap(() => {
        this.cache.invalidate(`columns:.*`);
        this.cache.invalidate(`project-full:.*`);
      }),
    );
  }

  // Board Member methods
  getProjectMembers(projectId: string): Observable<ProjectMember[]> {
    return this.cache.get(
      `project-members:${projectId}`,
      () =>
        this.http.get<ProjectMember[]>(
          `${this.apiUrl}/projects/${projectId}/members`,
        ),
      180000, // 3 min TTL
    );
  }

  inviteProjectMember(
    projectId: string,
    request: InviteMemberRequest,
  ): Observable<ProjectMember> {
    return this.http
      .post<ProjectMember>(`${this.apiUrl}/projects/${projectId}/members`, request)
      .pipe(
        tap(() => {
          this.cache.invalidateKey(`project-members:${projectId}`);
        }),
      );
  }

  updateProjectMemberRole(
    projectId: string,
    userId: string,
    request: UpdateMemberRoleRequest,
  ): Observable<ProjectMember> {
    return this.http
      .patch<ProjectMember>(
        `${this.apiUrl}/projects/${projectId}/members/${userId}`,
        request,
      )
      .pipe(
        tap(() => {
          this.cache.invalidateKey(`project-members:${projectId}`);
        }),
      );
  }

  removeProjectMember(projectId: string, userId: string): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/projects/${projectId}/members/${userId}`)
      .pipe(
        tap(() => {
          this.cache.invalidateKey(`project-members:${projectId}`);
        }),
      );
  }

  getProjectFull(
    projectId: string,
    params?: { limit?: number; offset?: number },
  ): Observable<ProjectFullResponse> {
    const queryParams: Record<string, string> = {};
    if (params?.limit != null) queryParams['limit'] = String(params.limit);
    if (params?.offset != null) queryParams['offset'] = String(params.offset);

    const cacheKey = `project-full:${projectId}:${queryParams['limit'] ?? '1000'}:${queryParams['offset'] ?? '0'}`;
    return this.cache.get(
      cacheKey,
      () =>
        this.http.get<ProjectFullResponse>(
          `${this.apiUrl}/projects/${projectId}/full`,
          { params: queryParams },
        ),
      60000, // 1 min TTL for full board data
    );
  }

  duplicateProject(
    projectId: string,
    request: DuplicateProjectRequest,
  ): Observable<Project> {
    return this.http
      .post<Project>(`${this.apiUrl}/projects/${projectId}/duplicate`, request)
      .pipe(
        tap(() => {
          this.cache.invalidate(`projects:.*`);
        }),
      );
  }
}
