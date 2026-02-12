import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TaskGroup {
  id: string;
  board_id: string;
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
  board_id: string;
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

@Injectable({
  providedIn: 'root'
})
export class TaskGroupService {
  private readonly API_URL = '/api';

  constructor(private http: HttpClient) {}

  /**
   * List task groups for a board
   */
  listGroups(boardId: string): Observable<TaskGroup[]> {
    return this.http.get<TaskGroup[]>(`${this.API_URL}/boards/${boardId}/groups`);
  }

  /**
   * List task groups with statistics
   */
  listGroupsWithStats(boardId: string): Observable<TaskGroupWithStats[]> {
    return this.http.get<TaskGroupWithStats[]>(`${this.API_URL}/boards/${boardId}/groups/stats`);
  }

  /**
   * Get a specific task group
   */
  getGroup(groupId: string): Observable<TaskGroup> {
    return this.http.get<TaskGroup>(`${this.API_URL}/groups/${groupId}`);
  }

  /**
   * Create a new task group
   */
  createGroup(boardId: string, request: CreateTaskGroupRequest): Observable<TaskGroup> {
    return this.http.post<TaskGroup>(`${this.API_URL}/boards/${boardId}/groups`, request);
  }

  /**
   * Update a task group
   */
  updateGroup(groupId: string, request: UpdateTaskGroupRequest): Observable<TaskGroup> {
    return this.http.put<TaskGroup>(`${this.API_URL}/groups/${groupId}`, request);
  }

  /**
   * Toggle collapse state
   */
  toggleCollapse(groupId: string, collapsed: boolean): Observable<TaskGroup> {
    return this.http.put<TaskGroup>(`${this.API_URL}/groups/${groupId}/collapse`, { collapsed });
  }

  /**
   * Delete a task group (moves tasks to "Ungrouped")
   */
  deleteGroup(groupId: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.API_URL}/groups/${groupId}`);
  }
}
