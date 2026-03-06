import {
  Component,
  inject,
  signal,
  input,
  output,
  model,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { RadioButton } from 'primeng/radiobutton';
import { ProgressSpinner } from 'primeng/progressspinner';
import { ImportExportService } from '../../../core/services/import-export.service';

export interface ExportDialogData {
  projectId: string;
  boardName: string;
}

@Component({
  selector: 'app-export-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    Dialog,
    RadioButton,
    ProgressSpinner,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      header="Export Project"
      [(visible)]="visible"
      [modal]="true"
      [style]="{ width: '480px' }"
      [closable]="true"
    >
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        Export tasks from "{{ boardName() }}" to a file.
      </p>

      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300"
          >Format</label
        >
        <div class="flex flex-col gap-3">
          <div class="flex items-center gap-2">
            <p-radioButton
              name="exportFormat"
              value="csv"
              [(ngModel)]="selectedFormat"
              inputId="formatCsv"
            />
            <label for="formatCsv" class="text-sm cursor-pointer">
              <span class="font-medium">CSV</span>
              <span class="text-gray-500 dark:text-gray-400 ml-1"
                >- Spreadsheet compatible (Excel, Google Sheets)</span
              >
            </label>
          </div>
          <div class="flex items-center gap-2">
            <p-radioButton
              name="exportFormat"
              value="json"
              [(ngModel)]="selectedFormat"
              inputId="formatJson"
            />
            <label for="formatJson" class="text-sm cursor-pointer">
              <span class="font-medium">JSON</span>
              <span class="text-gray-500 dark:text-gray-400 ml-1"
                >- Structured data with board metadata</span
              >
            </label>
          </div>
        </div>
      </div>

      @if (error()) {
        <div
          class="mt-4 p-3 rounded-md"
          style="
            background: var(--status-red-bg);
            border: 1px solid var(--status-red-border);
          "
        >
          <p class="text-sm" style="color: var(--status-red-text)">
            {{ error() }}
          </p>
        </div>
      }

      <ng-template #footer>
        <div class="flex justify-end gap-2">
          <p-button
            label="Cancel"
            [text]="true"
            severity="secondary"
            (onClick)="onCancel()"
            [disabled]="exporting()"
          />
          <p-button
            label="Export"
            (onClick)="onExport()"
            [disabled]="exporting()"
            [loading]="exporting()"
          />
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class ExportDialogComponent {
  private importExportService = inject(ImportExportService);

  /** Two-way bound visibility */
  visible = model(false);

  /** Input data for the dialog */
  projectId = input<string>('');
  boardName = input<string>('');

  /** Emits result when dialog closes with a value */
  exported = output<void>();

  selectedFormat = 'csv';
  exporting = signal(false);
  error = signal<string | null>(null);

  onCancel(): void {
    this.visible.set(false);
  }

  onExport(): void {
    this.exporting.set(true);
    this.error.set(null);

    if (this.selectedFormat === 'csv') {
      this.importExportService.exportCsv(this.projectId()).subscribe({
        next: (blob) => {
          this.downloadBlob(
            blob,
            `${this.sanitizeFilename(this.boardName())}_export.csv`,
          );
          this.exporting.set(false);
          this.visible.set(false);
          this.exported.emit();
        },
        error: () => {
          this.error.set('Failed to export CSV. Please try again.');
          this.exporting.set(false);
        },
      });
    } else {
      this.importExportService.exportJson(this.projectId()).subscribe({
        next: (data) => {
          const json = JSON.stringify(data, null, 2);
          const blob = new Blob([json], { type: 'application/json' });
          this.downloadBlob(
            blob,
            `${this.sanitizeFilename(this.boardName())}_export.json`,
          );
          this.exporting.set(false);
          this.visible.set(false);
          this.exported.emit();
        },
        error: () => {
          this.error.set('Failed to export JSON. Please try again.');
          this.exporting.set(false);
        },
      });
    }
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  private sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  }
}
