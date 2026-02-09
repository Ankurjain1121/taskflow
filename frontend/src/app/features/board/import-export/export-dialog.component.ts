import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialogModule,
  MAT_DIALOG_DATA,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatRadioModule } from '@angular/material/radio';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ImportExportService } from '../../../core/services/import-export.service';

export interface ExportDialogData {
  boardId: string;
  boardName: string;
}

@Component({
  selector: 'app-export-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatRadioModule,
    MatProgressSpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Export Board</h2>
    <mat-dialog-content>
      <p class="text-gray-600 mb-4">
        Export tasks from "{{ data.boardName }}" to a file.
      </p>

      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-gray-700">Format</label>
        <mat-radio-group [(ngModel)]="selectedFormat" class="flex flex-col gap-2">
          <mat-radio-button value="csv">
            <span class="text-sm">
              <span class="font-medium">CSV</span>
              <span class="text-gray-500 ml-1">- Spreadsheet compatible (Excel, Google Sheets)</span>
            </span>
          </mat-radio-button>
          <mat-radio-button value="json">
            <span class="text-sm">
              <span class="font-medium">JSON</span>
              <span class="text-gray-500 ml-1">- Structured data with board metadata</span>
            </span>
          </mat-radio-button>
        </mat-radio-group>
      </div>

      @if (error()) {
        <div class="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p class="text-sm text-red-700">{{ error() }}</p>
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()" [disabled]="exporting()">
        Cancel
      </button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="exporting()"
        (click)="onExport()"
      >
        @if (exporting()) {
          <mat-spinner diameter="18" class="inline-block mr-2"></mat-spinner>
          Exporting...
        } @else {
          Export
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      mat-dialog-content {
        min-width: 420px;
      }
      mat-spinner {
        display: inline-block;
      }
    `,
  ],
})
export class ExportDialogComponent {
  data = inject<ExportDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<ExportDialogComponent>);
  private importExportService = inject(ImportExportService);

  selectedFormat = 'csv';
  exporting = signal(false);
  error = signal<string | null>(null);

  onCancel(): void {
    this.dialogRef.close(null);
  }

  onExport(): void {
    this.exporting.set(true);
    this.error.set(null);

    if (this.selectedFormat === 'csv') {
      this.importExportService.exportCsv(this.data.boardId).subscribe({
        next: (blob) => {
          this.downloadBlob(blob, `${this.sanitizeFilename(this.data.boardName)}_export.csv`);
          this.exporting.set(false);
          this.dialogRef.close('exported');
        },
        error: (err) => {
          console.error('CSV export failed:', err);
          this.error.set('Failed to export CSV. Please try again.');
          this.exporting.set(false);
        },
      });
    } else {
      this.importExportService.exportJson(this.data.boardId).subscribe({
        next: (data) => {
          const json = JSON.stringify(data, null, 2);
          const blob = new Blob([json], { type: 'application/json' });
          this.downloadBlob(blob, `${this.sanitizeFilename(this.data.boardName)}_export.json`);
          this.exporting.set(false);
          this.dialogRef.close('exported');
        },
        error: (err) => {
          console.error('JSON export failed:', err);
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
