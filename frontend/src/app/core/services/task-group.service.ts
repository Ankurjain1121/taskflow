import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface TaskGroup {
  id: string;
  board_id?: string;
  project_id?: string;
  name: string;
  color: string;
  position: string;
  collapsed: boolean;
  tenant_id: string;
  created_by_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface TaskGroupWithStats {
  group: TaskGroup;
  task_count: number;
  completed_count: number;
  estimated_hours: number | null;
}

export interface CreateTaskGroupRequest {
  board_id?: string;
  project_id?: string;
  name: string;
  color?: string;
  position: string;
}

export interface UpdateTaskGroupRequest {
  name?: string;
  color?: string;
  position?: string;
  collapsed?: boolean;
}

/** Raw shape from GET /groups/stats — backend may use "list" or "group" key */
interface TaskGroupStatsRaw {
  list?: TaskGroup;
  group?: TaskGroup;
  task_count: number;
  completed_count: number;
  estimated_hours: number | null;
}

@Injectable({
  providedIn: 'root',
})
export class TaskGroupService {
  private readonly API_URL = '/api';

  constructor(private http: HttpClient) {}

  listGroups(projectId: string): Observable<TaskGroup[]> {
    return this.http.get<TaskGroup[]>(
      `${this.API_URL}/projects/${projectId}/groups`,
    );
  }

  listGroupsWithStats(projectId: string): Observable<TaskGroupWithStats[]> {
    return this.http
      .get<TaskGroupStatsRaw[]>(`${this.API_URL}/projects/${projectId}/groups/stats`)
      .pipe(
        map((items) =>
          items.map((item) => ({
            group: (item.list ?? item.group) as TaskGroup,
            task_count: item.task_count,
            completed_count: item.completed_count,
            estimated_hours: item.estimated_hours,
          })),
        ),
      );
  }

  getGroup(groupId: string): Observable<TaskGroup> {
    return this.http.get<TaskGroup>(`${this.API_URL}/groups/${groupId}`);
  }

  createGroup(
    projectId: string,
    request: CreateTaskGroupRequest,
  ): Observable<TaskGroup> {
    return this.http.post<TaskGroup>(
      `${this.API_URL}/projects/${projectId}/groups`,
      request,
    );
  }

  updateGroup(
    groupId: string,
    request: UpdateTaskGroupRequest,
  ): Observable<TaskGroup> {
    return this.http.put<TaskGroup>(
      `${this.API_URL}/groups/${groupId}`,
      request,
    );
  }

  toggleCollapse(groupId: string, collapsed: boolean): Observable<TaskGroup> {
    return this.http.put<TaskGroup>(
      `${this.API_URL}/groups/${groupId}/collapse`,
      { collapsed },
    );
  }

  deleteGroup(groupId: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(
      `${this.API_URL}/groups/${groupId}`,
    );
  }
}
