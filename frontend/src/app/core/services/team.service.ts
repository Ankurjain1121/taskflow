import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface MemberWorkload {
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  active_tasks: number;
  overdue_tasks: number;
  done_tasks: number;
  total_tasks: number;
  tasks_by_status?: Record<string, number>;
  is_overloaded: boolean;
}

export interface OverloadedMember {
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  active_tasks: number;
}

@Injectable({
  providedIn: 'root',
})
export class TeamService {
  private readonly apiUrl = '/api';

  constructor(private http: HttpClient) {}

  getTeamWorkload(workspaceId: string): Observable<MemberWorkload[]> {
    return this.http
      .get<
        MemberWorkload[]
      >(`${this.apiUrl}/workspaces/${workspaceId}/team-workload`)
      .pipe(
        map((members) =>
          members.map((m) => ({
            ...m,
            done_tasks: m.tasks_by_status?.['done'] ?? 0,
          })),
        ),
      );
  }

  getOverloadedMembers(
    workspaceId: string,
    threshold: number = 10,
  ): Observable<OverloadedMember[]> {
    const params = new HttpParams().set('threshold', threshold.toString());
    return this.http.get<OverloadedMember[]>(
      `${this.apiUrl}/workspaces/${workspaceId}/overloaded-members`,
      { params },
    );
  }
}
