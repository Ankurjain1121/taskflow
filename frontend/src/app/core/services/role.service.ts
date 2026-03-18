import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Capabilities {
  can_view_all_tasks: boolean;
  can_create_tasks: boolean;
  can_edit_own_tasks: boolean;
  can_edit_all_tasks: boolean;
  can_delete_tasks: boolean;
  can_manage_members: boolean;
  can_manage_project_settings: boolean;
  can_manage_automations: boolean;
  can_export: boolean;
  can_manage_billing: boolean;
  can_invite_members: boolean;
  can_manage_roles: boolean;
}

export interface WorkspaceRole {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  capabilities: Capabilities;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface CreateRoleRequest {
  name: string;
  description?: string;
  capabilities: Capabilities;
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string;
  capabilities?: Capabilities;
}

export function defaultCapabilities(): Capabilities {
  return {
    can_view_all_tasks: false,
    can_create_tasks: false,
    can_edit_own_tasks: false,
    can_edit_all_tasks: false,
    can_delete_tasks: false,
    can_manage_members: false,
    can_manage_project_settings: false,
    can_manage_automations: false,
    can_export: false,
    can_manage_billing: false,
    can_invite_members: false,
    can_manage_roles: false,
  };
}

@Injectable({
  providedIn: 'root',
})
export class RoleService {
  constructor(private http: HttpClient) {}

  listRoles(workspaceId: string): Observable<WorkspaceRole[]> {
    return this.http.get<WorkspaceRole[]>(
      `/api/workspaces/${workspaceId}/permission-roles`,
    );
  }

  createRole(
    workspaceId: string,
    data: CreateRoleRequest,
  ): Observable<WorkspaceRole> {
    return this.http.post<WorkspaceRole>(
      `/api/workspaces/${workspaceId}/permission-roles`,
      data,
    );
  }

  updateRole(
    workspaceId: string,
    roleId: string,
    data: UpdateRoleRequest,
  ): Observable<WorkspaceRole> {
    return this.http.put<WorkspaceRole>(
      `/api/workspaces/${workspaceId}/permission-roles/${roleId}`,
      data,
    );
  }

  deleteRole(workspaceId: string, roleId: string): Observable<void> {
    return this.http.delete<void>(
      `/api/workspaces/${workspaceId}/permission-roles/${roleId}`,
    );
  }
}
