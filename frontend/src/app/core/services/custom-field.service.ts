import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type CustomFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'dropdown'
  | 'checkbox';

export interface BoardCustomField {
  id: string;
  project_id: string;
  name: string;
  field_type: CustomFieldType;
  options: string[] | null;
  is_required: boolean;
  position: number;
  tenant_id: string;
  created_by_id: string;
  created_at: string;
  updated_at: string;
}

export interface TaskCustomFieldValue {
  id: string;
  task_id: string;
  field_id: string;
  value_text: string | null;
  value_number: number | null;
  value_date: string | null;
  value_bool: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface TaskCustomFieldValueWithField {
  id: string;
  task_id: string;
  field_id: string;
  field_name: string;
  field_type: CustomFieldType;
  options: string[] | null;
  is_required: boolean;
  value_text: string | null;
  value_number: number | null;
  value_date: string | null;
  value_bool: boolean | null;
}

export interface CreateCustomFieldRequest {
  name: string;
  field_type: CustomFieldType;
  options?: string[];
  is_required?: boolean;
}

export interface UpdateCustomFieldRequest {
  name?: string;
  options?: string[];
  is_required?: boolean;
  position?: number;
}

export interface SetFieldValue {
  field_id: string;
  value_text?: string | null;
  value_number?: number | null;
  value_date?: string | null;
  value_bool?: boolean | null;
}

@Injectable({ providedIn: 'root' })
export class CustomFieldService {
  constructor(private http: HttpClient) {}

  listBoardFields(projectId: string): Observable<BoardCustomField[]> {
    return this.http.get<BoardCustomField[]>(
      `/api/projects/${projectId}/custom-fields`,
    );
  }

  createField(
    projectId: string,
    req: CreateCustomFieldRequest,
  ): Observable<BoardCustomField> {
    return this.http.post<BoardCustomField>(
      `/api/projects/${projectId}/custom-fields`,
      req,
    );
  }

  updateField(
    id: string,
    req: UpdateCustomFieldRequest,
  ): Observable<BoardCustomField> {
    return this.http.put<BoardCustomField>(`/api/custom-fields/${id}`, req);
  }

  deleteField(id: string): Observable<void> {
    return this.http.delete<void>(`/api/custom-fields/${id}`);
  }

  getTaskValues(taskId: string): Observable<TaskCustomFieldValueWithField[]> {
    return this.http.get<TaskCustomFieldValueWithField[]>(
      `/api/tasks/${taskId}/custom-fields`,
    );
  }

  setTaskValues(
    taskId: string,
    values: SetFieldValue[],
  ): Observable<TaskCustomFieldValue[]> {
    return this.http.put<TaskCustomFieldValue[]>(
      `/api/tasks/${taskId}/custom-fields`,
      { values },
    );
  }
}
