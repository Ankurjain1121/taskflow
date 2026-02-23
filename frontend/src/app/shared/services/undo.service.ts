import { Injectable, signal } from '@angular/core';
import { MessageService } from 'primeng/api';

export interface UndoableAction {
  /** Unique ID for this undo entry. */
  id: string;
  /** Message displayed in the toast (e.g. "Task deleted"). */
  summary: string;
  /** The action to execute after the timeout expires (i.e., the "real" action). */
  execute: () => void;
  /** Optional rollback if the undo window has already passed but we need cleanup. */
  rollback?: () => void;
}

interface PendingAction {
  action: UndoableAction;
  timerId: ReturnType<typeof setTimeout>;
}

const DEFAULT_UNDO_TIMEOUT_MS = 5000;

@Injectable({ providedIn: 'root' })
export class UndoService {
  private pending = new Map<string, PendingAction>();
  private messageService: MessageService | null = null;

  /** Number of pending undo-able actions. */
  readonly pendingCount = signal(0);

  /**
   * Inject MessageService lazily to avoid circular DI issues.
   * Call this once from a root component or provide via constructor.
   */
  setMessageService(ms: MessageService): void {
    this.messageService = ms;
  }

  /**
   * Schedule an action with an undo window.
   * Shows a PrimeNG toast with an "Undo" button.
   * If the user does not click undo within `timeoutMs`, `action.execute()` fires.
   */
  schedule(action: UndoableAction, timeoutMs = DEFAULT_UNDO_TIMEOUT_MS): void {
    // If there's already one with this ID, cancel the old one first
    this.cancelPending(action.id);

    const timerId = setTimeout(() => {
      this.executePending(action.id);
    }, timeoutMs);

    this.pending.set(action.id, { action, timerId });
    this.pendingCount.set(this.pending.size);

    // Show toast
    if (this.messageService) {
      this.messageService.add({
        key: 'undo',
        severity: 'info',
        summary: action.summary,
        detail: 'Click to undo',
        life: timeoutMs,
        data: { undoId: action.id },
      });
    }
  }

  /**
   * Undo a pending action — cancels the timer and optionally calls rollback.
   */
  undo(id: string): void {
    const entry = this.pending.get(id);
    if (!entry) return;

    clearTimeout(entry.timerId);
    this.pending.delete(id);
    this.pendingCount.set(this.pending.size);

    if (entry.action.rollback) {
      entry.action.rollback();
    }

    if (this.messageService) {
      this.messageService.add({
        severity: 'success',
        summary: 'Undone',
        detail: `"${entry.action.summary}" was undone`,
        life: 2000,
      });
    }
  }

  /** Cancel all pending undo actions without executing them. */
  cancelAll(): void {
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timerId);
      if (entry.action.rollback) {
        entry.action.rollback();
      }
    }
    this.pending.clear();
    this.pendingCount.set(0);
  }

  private executePending(id: string): void {
    const entry = this.pending.get(id);
    if (!entry) return;

    this.pending.delete(id);
    this.pendingCount.set(this.pending.size);
    entry.action.execute();
  }

  private cancelPending(id: string): void {
    const entry = this.pending.get(id);
    if (!entry) return;

    clearTimeout(entry.timerId);
    this.pending.delete(id);
    this.pendingCount.set(this.pending.size);
  }
}
