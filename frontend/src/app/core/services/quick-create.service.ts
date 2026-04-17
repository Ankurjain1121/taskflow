import { Injectable, signal } from '@angular/core';

export interface QuickCreateRequest {
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: Date | null;
  projectId?: string;
}

@Injectable({ providedIn: 'root' })
export class QuickCreateService {
  readonly request = signal<QuickCreateRequest | null>(null);

  openQuickCreate(opts: QuickCreateRequest): void {
    this.request.set(opts);
  }

  clearRequest(): void {
    this.request.set(null);
  }
}
