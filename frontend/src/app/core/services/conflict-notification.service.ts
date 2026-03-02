import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';

@Injectable({
  providedIn: 'root',
})
export class ConflictNotificationService {
  private messageService = inject(MessageService);

  /** Tracks taskId -> Set of field names currently being edited by this user */
  private activeEdits = new Map<string, Set<string>>();

  registerEdit(taskId: string, fieldName: string): void {
    let fields = this.activeEdits.get(taskId);
    if (!fields) {
      fields = new Set();
      this.activeEdits.set(taskId, fields);
    }
    fields.add(fieldName);
  }

  unregisterEdit(taskId: string, fieldName: string): void {
    const fields = this.activeEdits.get(taskId);
    if (fields) {
      fields.delete(fieldName);
      if (fields.size === 0) {
        this.activeEdits.delete(taskId);
      }
    }
  }

  clearEdits(taskId: string): void {
    this.activeEdits.delete(taskId);
  }

  checkConflict(
    taskId: string,
    changedFields: string[],
    originUserName: string,
  ): void {
    const editingFields = this.activeEdits.get(taskId);
    if (!editingFields || editingFields.size === 0) return;

    const conflicting = changedFields.filter((f) => editingFields.has(f));
    if (conflicting.length === 0) return;

    this.messageService.add({
      severity: 'warn',
      summary: 'Edit conflict',
      detail: `${originUserName} updated ${conflicting.join(', ')}`,
      life: 5000,
    });
  }
}
