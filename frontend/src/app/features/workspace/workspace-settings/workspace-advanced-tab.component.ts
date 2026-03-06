import {
  Component,
  input,
  output,
  signal,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Workspace,
  WorkspaceService,
} from '../../../core/services/workspace.service';

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
            <h3 class="text-sm font-medium text-[var(--foreground)]">
              Export Workspace Data
            </h3>
            <p class="text-xs text-[var(--muted-foreground)] mt-1">
              Download all projects, tasks, and members
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button
              (click)="onExportWorkspace('json')"
              [disabled]="exporting()"
              class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--foreground)] border border-[var(--border)] rounded-md hover:bg-[var(--muted)] disabled:opacity-50"
            >
              @if (exporting()) {
                Exporting...
              } @else {
                <i class="pi pi-download" style="font-size: 0.875rem"></i>
                JSON
              }
            </button>
            <button
              (click)="onExportWorkspace('csv')"
              [disabled]="exporting()"
              class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--foreground)] border border-[var(--border)] rounded-md hover:bg-[var(--muted)] disabled:opacity-50"
            >
              @if (exporting()) {
                Exporting...
              } @else {
                <i class="pi pi-download" style="font-size: 0.875rem"></i>
                CSV
              }
            </button>
          </div>
        </div>
      </div>

      <!-- Coming Soon placeholders -->
      @for (section of advancedPlaceholders; track section.title) {
        <div class="widget-card p-6 opacity-60">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-sm font-medium text-[var(--foreground)]">
                {{ section.title }}
              </h3>
              <p class="text-xs text-[var(--muted-foreground)] mt-1">
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
  private workspaceService = inject(WorkspaceService);

  workspace = input<Workspace | null>(null);
  workspaceId = input.required<string>();

  exportRequested = output<void>();

  exporting = signal(false);

  advancedPlaceholders = [
    {
      title: 'Default Project Settings',
      description:
        'Configure default columns, labels, and automation rules for new projects',
    },
    {
      title: 'Custom Field Definitions',
      description:
        'Define custom fields that can be used across all projects in this workspace',
    },
    {
      title: 'Automation Defaults',
      description: 'Set up default automation rules that apply to all projects',
    },
  ];

  onExportWorkspace(format: 'csv' | 'json'): void {
    this.exporting.set(true);
    const wsName = this.workspace()?.name || this.workspaceId();

    this.workspaceService
      .exportWorkspace(this.workspaceId(), format)
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `workspace-${wsName}.${format === 'csv' ? 'csv' : 'json'}`;
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
