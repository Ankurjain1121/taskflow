import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PersonalBoardItem {
  id: string;
  task_id: string;
  column_name: string;
  position: number;
  task_title: string;
  task_priority: 'urgent' | 'high' | 'medium' | 'low' | 'none';
  task_due_date: string | null;
  project_id: string;
  project_name: string;
  status_name: string | null;
  status_type: string | null;
}

export interface PersonalBoardResponse {
  backlog: PersonalBoardItem[];
  today: PersonalBoardItem[];
  in_progress: PersonalBoardItem[];
  done: PersonalBoardItem[];
}

export interface MovePersonalTaskInput {
  column: string;
  position: number;
}

@Injectable({
  providedIn: 'root',
})
export class MyWorkBoardService {
  private readonly apiUrl = '/api/my-work/board';

  constructor(private http: HttpClient) {}

  getBoard(): Observable<PersonalBoardResponse> {
    return this.http.get<PersonalBoardResponse>(this.apiUrl);
  }

  moveTask(taskId: string, column: string, position: number): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/${taskId}`, {
      column,
      position,
    } as MovePersonalTaskInput);
  }
}
