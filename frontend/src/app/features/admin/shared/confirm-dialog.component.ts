import { Component, input, output, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

/**
 * Reusable confirm dialog using PrimeNG Dialog.
 *
 * Usage:
 * <app-admin-confirm-dialog
 *   [visible]="showDialog"
 *   [data]="dialogData"
 *   (confirmed)="onConfirm()"
 *   (cancelled)="onCancel()"
 * />
 */
@Component({
  selector: 'app-admin-confirm-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ButtonModule, Dialog],
  template: `
    <p-dialog
      [visible]="visible()"
      [modal]="true"
      [style]="{ width: '400px' }"
      [header]="data().title"
      (onHide)="cancelled.emit()"
    >
      <div class="flex items-start gap-3">
        @if (data().isDestructive) {
          <svg
            class="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        }
        <p class="text-gray-600 dark:text-gray-400">{{ data().message }}</p>
      </div>
      <ng-template pTemplate="footer">
        <p-button
          [label]="data().cancelText || 'Cancel'"
          [text]="true"
          (onClick)="cancelled.emit()"
        />
        <p-button
          [label]="data().confirmText || 'Confirm'"
          [severity]="data().isDestructive ? 'danger' : 'primary'"
          (onClick)="confirmed.emit()"
        />
      </ng-template>
    </p-dialog>
  `,
})
export class AdminConfirmDialogComponent {
  visible = input<boolean>(false);
  data = input.required<ConfirmDialogData>();
  confirmed = output<void>();
  cancelled = output<void>();
}
