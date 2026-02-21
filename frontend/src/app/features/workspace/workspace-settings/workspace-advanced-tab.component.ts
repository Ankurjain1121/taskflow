import {
  Component,
  input,
  output,
  signal,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Workspace } from '../../../core/services/workspace.service';

@Component({
  selector: 'app-workspace-advanced-tab',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="py-6 space-y-6">
      <!-- Export -->
      <div class="widget-card p-6">
        <div class="flex items-center justify-between">
          <div>
            <h3
              class="text-sm font-medium text-[var(--foreground)]"
            >
              Export Workspace Data
            </h3>
            <p class="text-xs text-[var(--muted-foreground)] mt-1">
              Download all workspace data as a JSON file
            </p>
          </div>
          <button
            (click)="onExportWorkspace()"
            [disabled]="exporting()"
            class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--foreground)] border border-[var(--border)] rounded-md hover:bg-[var(--muted)] disabled:opacity-50"
          >
            @if (exporting()) {
              <svg
                class="animate-spin h-4 w-4"
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
              Exporting...
            } @else {
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Export JSON
            }
          </button>
        </div>
      </div>

      <!-- Coming Soon placeholders -->
      @for (section of advancedPlaceholders; track section.title) {
        <div class="widget-card p-6 opacity-60">
          <div class="flex items-center justify-between">
            <div>
              <h3
                class="text-sm font-medium text-[var(--foreground)]"
              >
                {{ section.title }}
              </h3>
              <p
                class="text-xs text-[var(--muted-foreground)] mt-1"
              >
                {{ section.description }}
              </p>
            </div>
            <span
              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--secondary)] text-[var(--muted-foreground)]"
            >
              Coming soon
            </span>
          </div>
        </div>
      }
    </div>
  `,
})
export class WorkspaceAdvancedTabComponent {
  private http = inject(HttpClient);

  workspace = input<Workspace | null>(null);
  workspaceId = input.required<string>();

  exportRequested = output<void>();

  exporting = signal(false);

  advancedPlaceholders = [
    {
      title: 'Default Board Settings',
      description:
        'Configure default columns, labels, and automation rules for new boards',
    },
    {
      title: 'Custom Field Definitions',
      description:
        'Define custom fields that can be used across all boards in this workspace',
    },
    {
      title: 'Automation Defaults',
      description: 'Set up default automation rules that apply to all boards',
    },
  ];

  onExportWorkspace(): void {
    this.exporting.set(true);
    this.http
      .get(`/api/workspaces/${this.workspaceId()}/export`, {
        params: { format: 'json' },
        responseType: 'blob',
      })
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `workspace-${this.workspace()?.name || this.workspaceId()}.json`;
          a.click();
          URL.revokeObjectURL(url);
          this.exporting.set(false);
          this.exportRequested.emit();
        },
        error: () => {
          this.exporting.set(false);
        },
      });
  }
}
