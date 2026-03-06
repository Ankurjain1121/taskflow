import {
  Component,
  input,
  output,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Dialog } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';

export interface BulkPreviewData {
  action: string;
  description: string;
  taskCount: number;
  warnings: string[];
  params?: Record<string, unknown>;
}

@Component({
  selector: 'app-bulk-preview-dialog',
  standalone: true,
  imports: [CommonModule, Dialog, ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [visible]="visible()"
      (visibleChange)="onVisibleChange($event)"
      header="Confirm Bulk Action"
      [modal]="true"
      [closable]="true"
      [style]="{ width: '450px' }"
    >
      @if (data()) {
        <div class="space-y-4">
          <div class="flex items-start gap-3">
            <div
              class="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center"
            >
              <i
                class="pi pi-info-circle text-blue-600 text-lg"
              ></i>
            </div>
            <div>
              <p class="font-medium text-[var(--foreground)]">
                {{ data()!.description }}
              </p>
              <p class="text-sm text-[var(--muted-foreground)] mt-1">
                {{ data()!.taskCount }} task{{
                  data()!.taskCount !== 1 ? 's' : ''
                }}
                will be affected
              </p>
            </div>
          </div>

          @if (data()!.warnings.length > 0) {
            <div
              class="bg-yellow-50 border border-yellow-200 rounded-md p-3"
            >
              @for (warning of data()!.warnings; track warning) {
                <p
                  class="text-sm text-yellow-800 flex items-center gap-2"
                >
                  <i class="pi pi-exclamation-triangle text-yellow-600"></i>
                  {{ warning }}
                </p>
              }
            </div>
          }
        </div>
      }

      <ng-template #footer>
        <div class="flex justify-end gap-2">
          <p-button
            label="Cancel"
            severity="secondary"
            (onClick)="onCancel()"
          />
          <p-button
            label="Confirm"
            [loading]="executing()"
            (onClick)="onConfirm()"
          />
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class BulkPreviewDialogComponent {
  visible = input.required<boolean>();
  data = input.required<BulkPreviewData | null>();

  confirmed = output<void>();
  cancelled = output<void>();

  executing = signal(false);

  onVisibleChange(value: boolean): void {
    if (!value) {
      this.cancelled.emit();
    }
  }

  onConfirm(): void {
    this.executing.set(true);
    this.confirmed.emit();
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  resetExecuting(): void {
    this.executing.set(false);
  }
}
