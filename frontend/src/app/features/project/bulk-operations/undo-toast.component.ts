import {
  Component,
  signal,
  OnDestroy,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { BulkOperationsService } from '../../../core/services/bulk-operations.service';
import { MessageService } from 'primeng/api';

interface UndoEntry {
  operationId: string;
  description: string;
  remainingSeconds: number;
  timerId: ReturnType<typeof setInterval>;
  expiryTimerId: ReturnType<typeof setTimeout>;
}

const UNDO_WINDOW_SECONDS = 60;

@Component({
  selector: 'app-undo-toast',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (activeUndo()) {
      <div
        class="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white rounded-lg shadow-2xl px-5 py-3 flex items-center gap-4 animate-slide-up"
      >
        <span class="text-sm">{{ activeUndo()!.description }}</span>
        <button
          class="px-3 py-1 text-sm font-medium bg-blue-600 hover:bg-blue-700 rounded transition-colors"
          (click)="onUndo()"
        >
          Undo ({{ activeUndo()!.remainingSeconds }}s)
        </button>
        <button
          class="text-gray-400 hover:text-white transition-colors"
          (click)="dismiss()"
        >
          <i class="pi pi-times text-sm"></i>
        </button>
      </div>
    }
  `,
  styles: [
    `
      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translate(-50%, 10px);
        }
        to {
          opacity: 1;
          transform: translate(-50%, 0);
        }
      }
      .animate-slide-up {
        animation: slideUp 0.2s ease-out;
      }
    `,
  ],
})
export class UndoToastComponent implements OnDestroy {
  private bulkOpsService = inject(BulkOperationsService);
  private messageService = inject(MessageService);

  activeUndo = signal<UndoEntry | null>(null);

  show(operationId: string, description: string): void {
    this.clearActiveUndo();

    const entry: UndoEntry = {
      operationId,
      description,
      remainingSeconds: UNDO_WINDOW_SECONDS,
      timerId: setInterval(() => {
        const current = this.activeUndo();
        if (!current) return;
        const next = current.remainingSeconds - 1;
        if (next <= 0) {
          this.dismiss();
          return;
        }
        this.activeUndo.set({ ...current, remainingSeconds: next });
      }, 1000),
      expiryTimerId: setTimeout(() => {
        this.dismiss();
      }, UNDO_WINDOW_SECONDS * 1000),
    };

    this.activeUndo.set(entry);
  }

  onUndo(): void {
    const entry = this.activeUndo();
    if (!entry) return;

    this.bulkOpsService.undoOperation(entry.operationId).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Undone',
          detail: 'Bulk operation was reverted',
          life: 3000,
        });
        this.clearActiveUndo();
      },
      error: (err) => {
        const status = err?.status;
        if (status === 410 || status === 404) {
          this.messageService.add({
            severity: 'error',
            summary: 'Undo expired',
            detail: 'The undo window has passed. Changes cannot be reverted.',
            life: 5000,
          });
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Undo failed',
            detail: 'Could not revert the operation. Please try again.',
            life: 5000,
          });
        }
        this.clearActiveUndo();
      },
    });
  }

  dismiss(): void {
    this.clearActiveUndo();
  }

  ngOnDestroy(): void {
    this.clearActiveUndo();
  }

  private clearActiveUndo(): void {
    const entry = this.activeUndo();
    if (entry) {
      clearInterval(entry.timerId);
      clearTimeout(entry.expiryTimerId);
    }
    this.activeUndo.set(null);
  }
}
