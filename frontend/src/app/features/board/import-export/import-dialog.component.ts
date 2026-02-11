import {
  Component,
  inject,
  signal,
  computed,
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
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import {
  ImportExportService,
  ImportTaskItem,
} from '../../../core/services/import-export.service';

export interface ImportDialogData {
  boardId: string;
  boardName: string;
}

export interface ImportDialogResult {
  imported_count: number;
}

@Component({
  selector: 'app-import-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatTabsModule,
    MatProgressSpinnerModule,
    MatIconModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Import Tasks</h2>
    <mat-dialog-content class="import-dialog-content">
      <p class="text-gray-600 mb-4">
        Import tasks into "{{ data.boardName }}".
      </p>

      <mat-tab-group
        [(selectedIndex)]="selectedTab"
        (selectedIndexChange)="onTabChange()"
      >
        <!-- JSON Tab -->
        <mat-tab label="JSON">
          <div class="pt-4 flex flex-col gap-3">
            <p class="text-sm text-gray-500">
              Paste a JSON array of tasks or upload a JSON file.
              Each task should have at least a <code class="bg-gray-100 px-1 rounded">title</code> field.
              Optional: <code class="bg-gray-100 px-1 rounded">description</code>,
              <code class="bg-gray-100 px-1 rounded">priority</code> (urgent/high/medium/low),
              <code class="bg-gray-100 px-1 rounded">column_name</code>,
              <code class="bg-gray-100 px-1 rounded">due_date</code> (YYYY-MM-DD).
            </p>
            <textarea
              [(ngModel)]="jsonText"
              (ngModelChange)="onJsonChange()"
              rows="8"
              class="w-full border border-gray-300 rounded-md p-3 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder='[{ "title": "My task", "priority": "high" }]'
            ></textarea>
            <div class="flex items-center gap-2">
              <label
                class="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-md cursor-pointer transition-colors border border-indigo-200"
              >
                <mat-icon class="text-base">upload_file</mat-icon>
                Upload JSON file
                <input
                  type="file"
                  accept=".json"
                  class="hidden"
                  (change)="onJsonFileSelected($event)"
                />
              </label>
            </div>
          </div>
        </mat-tab>

        <!-- CSV Tab -->
        <mat-tab label="CSV">
          <div class="pt-4 flex flex-col gap-3">
            <p class="text-sm text-gray-500">
              Paste CSV text or upload a CSV file.
              Columns: <code class="bg-gray-100 px-1 rounded">title, description, priority, column_name, due_date</code>.
              A header row is optional (auto-detected).
            </p>
            <textarea
              [(ngModel)]="csvText"
              (ngModelChange)="onCsvChange()"
              rows="8"
              class="w-full border border-gray-300 rounded-md p-3 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="title,description,priority,column_name,due_date
Fix login bug,Users cannot log in,high,In Progress,2025-03-15
Add search,Implement full-text search,medium,To Do,"
            ></textarea>
            <div class="flex items-center gap-2">
              <label
                class="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-md cursor-pointer transition-colors border border-indigo-200"
              >
                <mat-icon class="text-base">upload_file</mat-icon>
                Upload CSV file
                <input
                  type="file"
                  accept=".csv"
                  class="hidden"
                  (change)="onCsvFileSelected($event)"
                />
              </label>
            </div>
          </div>
        </mat-tab>

        <!-- Trello Tab -->
        <mat-tab label="Trello">
          <div class="pt-4 flex flex-col gap-3">
            <div class="bg-blue-50 border border-blue-200 rounded-md p-3">
              <h4 class="text-sm font-medium text-blue-800 mb-1">How to export from Trello</h4>
              <ol class="text-sm text-blue-700 list-decimal list-inside space-y-1">
                <li>Open your Trello board</li>
                <li>Click the menu (...) in the top-right corner</li>
                <li>Select "More" then "Print and Export"</li>
                <li>Choose "Export as JSON"</li>
                <li>Upload the downloaded file below</li>
              </ol>
            </div>

            <div class="flex items-center gap-2">
              <label
                class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-md cursor-pointer transition-colors border border-indigo-200"
              >
                <mat-icon class="text-base">upload_file</mat-icon>
                Upload Trello JSON export
                <input
                  type="file"
                  accept=".json"
                  class="hidden"
                  (change)="onTrelloFileSelected($event)"
                />
              </label>
              @if (trelloFileName()) {
                <span class="text-sm text-gray-500">{{ trelloFileName() }}</span>
              }
            </div>
          </div>
        </mat-tab>
      </mat-tab-group>

      <!-- Preview section -->
      @if (previewCount() > 0) {
        <div class="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <p class="text-sm text-green-700">
            <span class="font-medium">{{ previewCount() }}</span>
            task{{ previewCount() === 1 ? '' : 's' }} ready to import.
          </p>
        </div>
      }

      @if (parseError()) {
        <div class="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p class="text-sm text-red-700">{{ parseError() }}</p>
        </div>
      }

      @if (successMessage()) {
        <div class="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <p class="text-sm text-green-700 font-medium">{{ successMessage() }}</p>
        </div>
      }

      @if (importError()) {
        <div class="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p class="text-sm text-red-700">{{ importError() }}</p>
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()" [disabled]="importing()">
        {{ successMessage() ? 'Close' : 'Cancel' }}
      </button>
      @if (!successMessage()) {
        <button
          mat-flat-button
          color="primary"
          [disabled]="importing() || previewCount() === 0"
          (click)="onImport()"
        >
          @if (importing()) {
            <mat-spinner diameter="18" class="inline-block mr-2"></mat-spinner>
            Importing...
          } @else {
            Import {{ previewCount() }} task{{ previewCount() === 1 ? '' : 's' }}
          }
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: [
    `
      .import-dialog-content {
        min-width: 520px;
        max-height: 70vh;
      }
      mat-spinner {
        display: inline-block;
      }
      code {
        font-size: 0.8em;
      }
    `,
  ],
})
export class ImportDialogComponent {
  data = inject<ImportDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<ImportDialogComponent>);
  private importExportService = inject(ImportExportService);

  selectedTab = 0;
  jsonText = '';
  csvText = '';
  trelloData: unknown = null;

  importing = signal(false);
  parseError = signal<string | null>(null);
  importError = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  trelloFileName = signal<string | null>(null);

  // Preview counts
  jsonPreviewCount = signal(0);
  csvPreviewCount = signal(0);
  trelloPreviewCount = signal(0);

  previewCount = computed(() => {
    switch (this.selectedTab) {
      case 0:
        return this.jsonPreviewCount();
      case 1:
        return this.csvPreviewCount();
      case 2:
        return this.trelloPreviewCount();
      default:
        return 0;
    }
  });

  onTabChange(): void {
    this.parseError.set(null);
    this.importError.set(null);
    this.successMessage.set(null);
  }

  onCancel(): void {
    const msg = this.successMessage();
    if (msg) {
      // Extract count from success message and pass it back
      const match = msg.match(/(\d+)/);
      const count = match ? parseInt(match[1], 10) : 0;
      this.dialogRef.close({ imported_count: count } as ImportDialogResult);
    } else {
      this.dialogRef.close(null);
    }
  }

  // ---- JSON ----

  onJsonChange(): void {
    this.parseError.set(null);
    this.successMessage.set(null);
    this.importError.set(null);

    if (!this.jsonText.trim()) {
      this.jsonPreviewCount.set(0);
      return;
    }

    try {
      const parsed = JSON.parse(this.jsonText);
      if (!Array.isArray(parsed)) {
        this.parseError.set('JSON must be an array of task objects.');
        this.jsonPreviewCount.set(0);
        return;
      }
      const valid = parsed.filter(
        (item: Record<string, unknown>) => item && typeof item['title'] === 'string' && item['title'].trim()
      );
      this.jsonPreviewCount.set(valid.length);
      if (valid.length === 0 && parsed.length > 0) {
        this.parseError.set('No valid tasks found. Each task must have a "title" field.');
      }
    } catch {
      this.parseError.set('Invalid JSON format.');
      this.jsonPreviewCount.set(0);
    }
  }

  onJsonFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      this.jsonText = reader.result as string;
      this.onJsonChange();
    };
    reader.readAsText(file);
    input.value = '';
  }

  // ---- CSV ----

  onCsvChange(): void {
    this.parseError.set(null);
    this.successMessage.set(null);
    this.importError.set(null);

    if (!this.csvText.trim()) {
      this.csvPreviewCount.set(0);
      return;
    }

    const lines = this.csvText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      this.csvPreviewCount.set(0);
      return;
    }

    // Detect header
    const firstLine = lines[0].toLowerCase();
    const hasHeader = firstLine.includes('title');
    const dataLines = hasHeader ? lines.slice(1) : lines;

    const count = dataLines.filter((line) => {
      const firstField = line.split(',')[0]?.trim();
      return firstField && firstField.length > 0;
    }).length;

    this.csvPreviewCount.set(count);
  }

  onCsvFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      this.csvText = reader.result as string;
      this.onCsvChange();
    };
    reader.readAsText(file);
    input.value = '';
  }

  // ---- Trello ----

  onTrelloFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.parseError.set(null);
    this.successMessage.set(null);
    this.importError.set(null);
    this.trelloFileName.set(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);

        // Basic Trello format validation
        if (!parsed.cards && !parsed.lists) {
          this.parseError.set(
            'This does not look like a Trello export. Expected "cards" and "lists" fields.'
          );
          this.trelloPreviewCount.set(0);
          this.trelloData = null;
          return;
        }

        this.trelloData = parsed;
        const cards = (parsed.cards || []) as Array<{ closed?: boolean; name?: string }>;
        const activeCards = cards.filter(
          (c) => !c.closed && c.name && c.name.trim()
        );
        this.trelloPreviewCount.set(activeCards.length);
      } catch {
        this.parseError.set('Invalid JSON file. Please upload a valid Trello export.');
        this.trelloPreviewCount.set(0);
        this.trelloData = null;
      }
    };
    reader.readAsText(file);
    input.value = '';
  }

  // ---- Import ----

  onImport(): void {
    this.importing.set(true);
    this.importError.set(null);
    this.successMessage.set(null);

    switch (this.selectedTab) {
      case 0:
        this.doJsonImport();
        break;
      case 1:
        this.doCsvImport();
        break;
      case 2:
        this.doTrelloImport();
        break;
    }
  }

  private doJsonImport(): void {
    let tasks: ImportTaskItem[];
    try {
      tasks = JSON.parse(this.jsonText);
    } catch {
      this.importError.set('Invalid JSON.');
      this.importing.set(false);
      return;
    }

    this.importExportService
      .importJson(this.data.boardId, tasks)
      .subscribe({
        next: (result) => {
          this.successMessage.set(
            `Successfully imported ${result.imported_count} task${result.imported_count === 1 ? '' : 's'}.`
          );
          this.importing.set(false);
        },
        error: (err) => {
          console.error('JSON import failed:', err);
          this.importError.set('Import failed. Please check your data and try again.');
          this.importing.set(false);
        },
      });
  }

  private doCsvImport(): void {
    this.importExportService
      .importCsv(this.data.boardId, this.csvText)
      .subscribe({
        next: (result) => {
          this.successMessage.set(
            `Successfully imported ${result.imported_count} task${result.imported_count === 1 ? '' : 's'}.`
          );
          this.importing.set(false);
        },
        error: (err) => {
          console.error('CSV import failed:', err);
          this.importError.set('Import failed. Please check your CSV format and try again.');
          this.importing.set(false);
        },
      });
  }

  private doTrelloImport(): void {
    if (!this.trelloData) {
      this.importError.set('No Trello data loaded.');
      this.importing.set(false);
      return;
    }

    this.importExportService
      .importTrello(this.data.boardId, this.trelloData)
      .subscribe({
        next: (result) => {
          let msg = `Successfully imported ${result.imported_count} task${result.imported_count === 1 ? '' : 's'}`;
          if (result.columns_created > 0) {
            msg += ` and created ${result.columns_created} new column${result.columns_created === 1 ? '' : 's'}`;
          }
          if (result.skipped > 0) {
            msg += ` (${result.skipped} skipped)`;
          }
          msg += '.';
          this.successMessage.set(msg);
          this.importing.set(false);
        },
        error: (err) => {
          console.error('Trello import failed:', err);
          this.importError.set(
            'Trello import failed. Please ensure the file is a valid Trello JSON export.'
          );
          this.importing.set(false);
        },
      });
  }
}
