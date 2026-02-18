import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export interface Label {
  id: string;
  name: string;
  color: string;
  project_id: string;
}

@Injectable({ providedIn: 'root' })
export class LabelService {
  private api = inject(ApiService);

  listByProject(projectId: string) {
    return this.api.get<Label[]>(`/projects/${projectId}/labels`);
  }

  create(projectId: string, name: string, color: string) {
    return this.api.post<Label>(`/projects/${projectId}/labels`, { name, color });
  }

  update(labelId: string, data: { name?: string; color?: string }) {
    return this.api.patch<Label>(`/labels/${labelId}`, data);
  }

  delete(labelId: string) {
    return this.api.delete(`/labels/${labelId}`);
  }

  addToTask(taskId: string, labelId: string) {
    return this.api.post(`/tasks/${taskId}/labels/${labelId}`, {});
  }

  removeFromTask(taskId: string, labelId: string) {
    return this.api.delete(`/tasks/${taskId}/labels/${labelId}`);
  }
}
