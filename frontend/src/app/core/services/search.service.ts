import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TaskSearchResult {
  id: string;
  title: string;
  description: string | null;
  board_id: string;
  board_name: string;
  workspace_id: string;
  workspace_name: string;
}

export interface BoardSearchResult {
  id: string;
  name: string;
  description: string | null;
  workspace_id: string;
  workspace_name: string;
}

export interface CommentSearchResult {
  id: string;
  content: string;
  task_id: string;
  task_title: string;
  board_id: string;
  board_name: string;
  workspace_id: string;
}

export interface SearchResults {
  tasks: TaskSearchResult[];
  boards: BoardSearchResult[];
  comments: CommentSearchResult[];
}

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly apiUrl = '/api';

  constructor(private http: HttpClient) {}

  search(query: string, limit = 20): Observable<SearchResults> {
    const params = new HttpParams().set('q', query).set('limit', limit.toString());
    return this.http.get<SearchResults>(`${this.apiUrl}/search`, { params });
  }
}
