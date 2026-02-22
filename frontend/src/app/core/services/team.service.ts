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

export interface MemberTask {
  task_id: string;
  title: string;
  board_name: string;
  column_name: string;
  priority: string;
  due_date: string | null;
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

  getMemberTasks(
    workspaceId: string,
    userId: string,
  ): Observable<MemberTask[]> {
    return this.http.get<MemberTask[]>(
      `${this.apiUrl}/workspaces/${workspaceId}/members/${userId}/tasks`,
    );
  }

  reassignTasks(
    workspaceId: string,
    taskIds: string[],
    fromUserId: string,
    toUserId: string,
  ): Observable<void> {
    return this.http.post<void>(
      `${this.apiUrl}/workspaces/${workspaceId}/reassign-tasks`,
      {
        task_ids: taskIds,
        from_user_id: fromUserId,
        to_user_id: toUserId,
      },
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
