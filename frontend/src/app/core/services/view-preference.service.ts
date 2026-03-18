import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ViewPreferenceService {
  private readonly PREFIX = 'taskflow_view_';

  getLastView(projectId: string): string | null {
    try {
      return localStorage.getItem(this.PREFIX + projectId);
    } catch {
      return null;
    }
  }

  setLastView(projectId: string, viewMode: string): void {
    try {
      localStorage.setItem(this.PREFIX + projectId, viewMode);
    } catch {
      /* QuotaExceeded - silent */
    }
  }
}
