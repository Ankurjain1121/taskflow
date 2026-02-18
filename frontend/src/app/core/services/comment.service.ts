import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

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

/** Raw comment shape from backend (flat author fields) */
interface CommentFromApi {
  id: string;
  task_id: string;
  content: string;
  author_id: string;
  parent_id: string | null;
  mentioned_user_ids: string[];
  created_at: string;
  updated_at: string;
  author_name: string;
  author_avatar_url: string | null;
}

function mapComment(c: CommentFromApi): Comment {
  return {
    id: c.id,
    task_id: c.task_id,
    content: c.content,
    author_id: c.author_id,
    parent_id: c.parent_id,
    mentioned_user_ids: c.mentioned_user_ids,
    created_at: c.created_at,
    updated_at: c.updated_at,
    author: {
      id: c.author_id,
      display_name: c.author_name,
      avatar_url: c.author_avatar_url,
    },
  };
}

export interface CreateCommentRequest {
  content: string;
  parent_id?: string;
}

export interface UpdateCommentRequest {
  content: string;
}

/** Flattened comment with author info for display in components */
export interface CommentWithAuthor {
  id: string;
  task_id: string;
  content: string;
  author_id: string;
  author_name: string;
  author_avatar_url: string | null;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

@Injectable({
  providedIn: 'root',
})
export class CommentService {
  private readonly apiUrl = '/api';

  constructor(private http: HttpClient) {}

  listByTask(taskId: string): Observable<Comment[]> {
    return this.http
      .get<{
        comments: CommentFromApi[];
      }>(`${this.apiUrl}/tasks/${taskId}/comments`)
      .pipe(map((res) => res.comments.map(mapComment)));
  }

  create(
    taskId: string,
    content: string,
    parentId?: string,
  ): Observable<Comment> {
    const body: CreateCommentRequest = { content };
    if (parentId) {
      body.parent_id = parentId;
    }
    return this.http
      .post<CommentFromApi>(`${this.apiUrl}/tasks/${taskId}/comments`, body)
      .pipe(map(mapComment));
  }

  update(id: string, content: string): Observable<Comment> {
    return this.http.put<Comment>(`${this.apiUrl}/comments/${id}`, { content });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/comments/${id}`);
  }
}
