import {
  Component,
  input,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ShareSettingsComponent } from '../share/share-settings.component';
import { WebhookSettingsComponent } from '../webhooks/webhook-settings.component';
import { ImportDialogComponent } from '../import-export/import-dialog.component';
import { ExportDialogComponent } from '../import-export/export-dialog.component';

@Component({
  selector: 'app-project-integrations-settings',
  standalone: true,
  imports: [
    CommonModule,
    ShareSettingsComponent,
    WebhookSettingsComponent,
    ImportDialogComponent,
    ExportDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="py-6 space-y-8">
      <!-- Share Settings -->
      @defer {
        <section>
          <app-share-settings [boardId]="boardId()" />
        </section>
      } @placeholder {
        <div class="flex items-center justify-center py-8">
          <svg
            class="animate-spin h-6 w-6 text-primary"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            ></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </div>
      }

      <!-- Webhooks -->
      @defer {
        <section>
          <app-webhook-settings [boardId]="boardId()" />
        </section>
      } @placeholder {
        <div class="flex items-center justify-center py-8">
          <svg
            class="animate-spin h-6 w-6 text-primary"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            ></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </div>
      }

      <!-- Import / Export -->
      <section class="bg-[var(--card)] shadow rounded-lg">
        <div class="px-6 py-4 border-b border-[var(--border)]">
          <h2 class="text-lg font-medium text-[var(--foreground)]">
            Import / Export
          </h2>
        </div>
        <div class="px-6 py-4 space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h3
                class="text-sm font-medium text-[var(--foreground)]"
              >
                Import Tasks
              </h3>
              <p class="text-sm text-[var(--muted-foreground)]">
                Import tasks from JSON, CSV, or Trello exports.
              </p>
            </div>
            <button
              (click)="showImportDialog.set(true)"
              class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary/10 transition-colors"
            >
              <i class="pi pi-upload"></i>
              Import
            </button>
          </div>
          <div class="border-t border-[var(--border)]"></div>
          <div class="flex items-center justify-between">
            <div>
              <h3
                class="text-sm font-medium text-[var(--foreground)]"
              >
                Export Project
              </h3>
              <p class="text-sm text-[var(--muted-foreground)]">
                Export all tasks to CSV or JSON format.
              </p>
            </div>
            <button
              (click)="showExportDialog.set(true)"
              class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary/10 transition-colors"
            >
              <i class="pi pi-download"></i>
              Export
            </button>
          </div>
        </div>
      </section>
    </div>

    <app-import-dialog
      [(visible)]="showImportDialog"
      [boardId]="boardId()"
      [boardName]="boardName()"
    />
    <app-export-dialog
      [(visible)]="showExportDialog"
      [boardId]="boardId()"
      [boardName]="boardName()"
    />
  `,
})
export class ProjectIntegrationsSettingsComponent {
  boardId = input.required<string>();
  boardName = input<string>('');

  showImportDialog = signal(false);
  showExportDialog = signal(false);
}
