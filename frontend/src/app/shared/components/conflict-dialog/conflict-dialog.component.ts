import {
  Component,
  input,
  output,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Dialog } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { Task } from '../../../core/services/task.service';
import { computeWordDiff, renderDiffHtml } from '../../utils/word-diff';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

export interface ConflictResolution {
  action: 'keep_mine' | 'accept_theirs';
  serverVersion: number;
  yourChanges?: Partial<Task>;
}

@Component({
  selector: 'app-conflict-dialog',
  standalone: true,
  imports: [CommonModule, Dialog, ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      header="Edit Conflict"
      [visible]="visible()"
      [modal]="true"
      [closable]="true"
      [style]="{ width: '640px', maxHeight: '80vh' }"
      (onHide)="onCancel()"
    >
      <div class="space-y-4">
        <div class="text-sm text-[var(--muted-foreground)]">
          Another user has modified this task while you were editing it. Choose how to resolve the conflict.
        </div>

        @for (field of conflictingFields(); track field.name) {
          <div class="border border-[var(--border)] rounded-lg overflow-hidden">
            <div class="px-3 py-2 bg-[var(--muted)] text-sm font-medium text-[var(--foreground)] capitalize">
              {{ field.label }}
            </div>
            <div class="grid grid-cols-2 divide-x divide-[var(--border)]">
              <!-- Your changes -->
              <div class="p-3">
                <div class="text-xs font-medium text-blue-600 mb-1">Your changes</div>
                @if (field.name === 'description' && field.diffHtml) {
                  <div class="text-sm text-[var(--foreground)] whitespace-pre-wrap" [innerHTML]="field.diffHtml"></div>
                } @else {
                  <div class="text-sm text-[var(--foreground)] bg-blue-50 px-2 py-1 rounded">
                    {{ field.yourValue || '(empty)' }}
                  </div>
                }
              </div>
              <!-- Server version -->
              <div class="p-3">
                <div class="text-xs font-medium text-amber-600 mb-1">Server version</div>
                <div class="text-sm text-[var(--foreground)] bg-amber-50 px-2 py-1 rounded">
                  {{ field.serverValue || '(empty)' }}
                </div>
              </div>
            </div>
          </div>
        }
      </div>

      <ng-template #footer>
        <div class="flex items-center justify-end gap-2">
          <p-button
            label="Cancel"
            severity="secondary"
            [text]="true"
            (onClick)="onCancel()"
          />
          <p-button
            label="Accept Theirs"
            severity="warn"
            [outlined]="true"
            icon="pi pi-refresh"
            (onClick)="onAcceptTheirs()"
          />
          <p-button
            label="Keep Mine"
            icon="pi pi-check"
            (onClick)="onKeepMine()"
          />
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class ConflictDialogComponent {
  visible = input<boolean>(false);
  yourChanges = input<Partial<Task>>({});
  serverVersion = input<Task | null>(null);
  originalTask = input<Task | null>(null);

  resolved = output<ConflictResolution>();
  accepted = output<void>();
  cancelled = output<void>();

  private sanitizer: DomSanitizer;

  constructor(sanitizer: DomSanitizer) {
    this.sanitizer = sanitizer;
  }

  readonly conflictingFields = computed(() => {
    const yours = this.yourChanges();
    const server = this.serverVersion();
    const original = this.originalTask();
    if (!server || !original) return [];

    const fields: {
      name: string;
      label: string;
      yourValue: string;
      serverValue: string;
      diffHtml: SafeHtml | null;
    }[] = [];

    const fieldDefs: { key: keyof Task; label: string }[] = [
      { key: 'title', label: 'Title' },
      { key: 'description', label: 'Description' },
      { key: 'priority', label: 'Priority' },
      { key: 'due_date', label: 'Due Date' },
    ];

    for (const def of fieldDefs) {
      if (!(def.key in yours)) continue;
      const yourVal = String(yours[def.key] ?? '');
      const serverVal = String(server[def.key] ?? '');
      if (yourVal === serverVal) continue;

      let diffHtml: SafeHtml | null = null;
      if (def.key === 'description') {
        const originalVal = String(original[def.key] ?? '');
        const segments = computeWordDiff(originalVal, yourVal);
        diffHtml = this.sanitizer.bypassSecurityTrustHtml(
          renderDiffHtml(segments),
        );
      }

      fields.push({
        name: def.key,
        label: def.label,
        yourValue: yourVal,
        serverValue: serverVal,
        diffHtml,
      });
    }

    return fields;
  });

  onKeepMine(): void {
    const server = this.serverVersion();
    this.resolved.emit({
      action: 'keep_mine',
      serverVersion: (server as Task & { version?: number })?.version ?? 0,
      yourChanges: this.yourChanges(),
    });
  }

  onAcceptTheirs(): void {
    this.accepted.emit();
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
