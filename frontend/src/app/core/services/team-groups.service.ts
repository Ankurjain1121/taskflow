import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TeamGroup {
  id: string;
  name: string;
  description: string | null;
  color: string;
  workspace_id: string;
  member_count: number;
  created_at: string;
}

export interface TeamGroupMember {
  id: string;
  team_id: string;
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  added_at: string;
}

export interface TeamGroupDetail {
  id: string;
  name: string;
  description: string | null;
  color: string;
  workspace_id: string;
  created_by_id: string;
  created_at: string;
  updated_at: string;
  members: TeamGroupMember[];
}

export interface CreateTeamRequest {
  name: string;
  description?: string;
  color?: string;
}

export interface UpdateTeamRequest {
  name: string;
  description?: string;
  color?: string;
}

@Injectable({ providedIn: 'root' })
export class TeamGroupsService {
  private readonly apiUrl = '/api';

  constructor(private http: HttpClient) {}

  listTeams(workspaceId: string): Observable<TeamGroup[]> {
    return this.http.get<TeamGroup[]>(
      `${this.apiUrl}/workspaces/${workspaceId}/teams`,
    );
  }

  getTeam(teamId: string): Observable<TeamGroupDetail> {
    return this.http.get<TeamGroupDetail>(`${this.apiUrl}/teams/${teamId}`);
  }

  createTeam(
    workspaceId: string,
    req: CreateTeamRequest,
  ): Observable<TeamGroupDetail> {
    return this.http.post<TeamGroupDetail>(
      `${this.apiUrl}/workspaces/${workspaceId}/teams`,
      req,
    );
  }

  updateTeam(
    teamId: string,
    req: UpdateTeamRequest,
  ): Observable<TeamGroupDetail> {
    return this.http.put<TeamGroupDetail>(
      `${this.apiUrl}/teams/${teamId}`,
      req,
    );
  }

  deleteTeam(teamId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/teams/${teamId}`);
  }

  addMember(teamId: string, userId: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/teams/${teamId}/members`, {
      user_id: userId,
    });
  }

  removeMember(teamId: string, userId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/teams/${teamId}/members/${userId}`,
    );
  }
}
