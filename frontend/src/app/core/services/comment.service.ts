import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Comment {
  id: string;
  task_id: string;
  content: string;
  author_id: string;
  parent_id: string | null;
  mentioned_user_ids: string[];
  created_at: string;
  updated_at: string;
  author: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  };
}

export interface CreateCommentRequest {
  content: string;
  parent_id?: string;
}

export interface UpdateCommentRequest {
  content: string;
}

@Injectable({
  providedIn: 'root',
})
export class CommentService {
  private readonly apiUrl = '/api/v1';

  constructor(private http: HttpClient) {}

  listByTask(taskId: string): Observable<Comment[]> {
    return this.http.get<Comment[]>(`${this.apiUrl}/tasks/${taskId}/comments`);
  }

  create(
    taskId: string,
    content: string,
    parentId?: string
  ): Observable<Comment> {
    const body: CreateCommentRequest = { content };
    if (parentId) {
      body.parent_id = parentId;
    }
    return this.http.post<Comment>(
      `${this.apiUrl}/tasks/${taskId}/comments`,
      body
    );
  }

  update(id: string, content: string): Observable<Comment> {
    return this.http.put<Comment>(`${this.apiUrl}/comments/${id}`, { content });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/comments/${id}`);
  }
}
