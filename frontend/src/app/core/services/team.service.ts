import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface MemberWorkload {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  active_tasks: number;
  overdue_tasks: number;
  done_tasks: number;
  total_tasks: number;
  is_overloaded: boolean;
}

export interface OverloadedMember {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  active_tasks: number;
  overdue_tasks: number;
  workload_threshold: number;
}

@Injectable({
  providedIn: 'root',
})
export class TeamService {
  private readonly apiUrl = '/api';

  constructor(private http: HttpClient) {}

  getTeamWorkload(workspaceId: string): Observable<MemberWorkload[]> {
    return this.http.get<MemberWorkload[]>(
      `${this.apiUrl}/workspaces/${workspaceId}/team/workload`
    );
  }

  getOverloadedMembers(
    workspaceId: string,
    threshold: number = 10
  ): Observable<OverloadedMember[]> {
    const params = new HttpParams().set('threshold', threshold.toString());
    return this.http.get<OverloadedMember[]>(
      `${this.apiUrl}/workspaces/${workspaceId}/team/overloaded`,
      { params }
    );
  }
}
