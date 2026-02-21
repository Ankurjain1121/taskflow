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
  confirmColor?: 'primary' | 'accent' | 'warn';
}

@Component({
  selector: 'app-confirm-dialog',
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
      <p class="text-gray-600 dark:text-gray-400">{{ data().message }}</p>

      <ng-template #footer>
        <div class="flex justify-end gap-2">
          <p-button
            [label]="data().cancelText || 'Cancel'"
            [text]="true"
            severity="secondary"
            (onClick)="cancelled.emit()"
          />
          <p-button
            [label]="data().confirmText || 'Confirm'"
            [severity]="data().confirmColor === 'warn' ? 'danger' : 'primary'"
            (onClick)="confirmed.emit()"
          />
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class ConfirmDialogComponent {
  visible = input<boolean>(false);
  data = input.required<ConfirmDialogData>();
  confirmed = output<void>();
  cancelled = output<void>();
}
