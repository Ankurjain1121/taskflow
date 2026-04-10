import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ISSUE_RESOLUTION_OPTIONS,
  IssueResolutionType,
} from '../../shared/types/issue.types';

@Component({
  selector: 'app-resolve-issue-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  styles: [
    `
      :host {
        position: fixed;
        inset: 0;
        z-index: 50;
      }
      .backdrop {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.45);
        backdrop-filter: blur(2px);
      }
      .dialog {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: min(480px, calc(100vw - 2rem));
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 0.875rem;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        padding: 1.5rem;
        color: var(--foreground);
      }
      h2 {
        font-size: 1.125rem;
        font-weight: 700;
        margin: 0 0 0.25rem;
      }
      .subtitle {
        font-size: 0.75rem;
        color: var(--muted-foreground);
        margin-bottom: 1.25rem;
      }
      .subtitle strong {
        color: var(--foreground);
      }
      label {
        display: block;
        font-size: 0.7rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--muted-foreground);
        margin-bottom: 0.375rem;
      }
      .field {
        margin-bottom: 1rem;
      }
      select,
      textarea {
        width: 100%;
        background: var(--background);
        border: 1px solid var(--border);
        border-radius: 0.5rem;
        padding: 0.55rem 0.75rem;
        font-size: 0.875rem;
        color: var(--foreground);
        font-family: inherit;
      }
      textarea {
        min-height: 90px;
        resize: vertical;
      }
      .actions {
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
        margin-top: 1.25rem;
        padding-top: 1rem;
        border-top: 1px solid var(--border);
      }
      .btn {
        padding: 0.55rem 1.1rem;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        font-weight: 500;
        border: 1px solid var(--border);
        background: var(--card);
        color: var(--foreground);
        cursor: pointer;
      }
      .btn-primary {
        background: var(--primary);
        color: var(--primary-foreground, #fff);
        border-color: var(--primary);
      }
    `,
  ],
  template: `
    <div class="backdrop" (click)="closed.emit()" aria-hidden="true"></div>
    <div
      class="dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="resolve-title"
    >
      <h2 id="resolve-title">Resolve Issue</h2>
      <p class="subtitle">
        Closing <strong>{{ issueTitle() }}</strong>
      </p>

      <form (submit)="$event.preventDefault(); submit()">
        <div class="field">
          <label for="res-type">Resolution</label>
          <select id="res-type" [(ngModel)]="resolutionType" name="res_type">
            @for (opt of options; track opt.value) {
              <option [value]="opt.value">{{ opt.label }}</option>
            }
          </select>
        </div>

        <div class="field">
          <label for="res-notes">Notes (optional)</label>
          <textarea
            id="res-notes"
            name="res_notes"
            [(ngModel)]="resolutionNotes"
            placeholder="What was done, how it was fixed, any follow-up…"
          ></textarea>
        </div>

        <div class="actions">
          <button type="button" class="btn" (click)="closed.emit()">
            Cancel
          </button>
          <button type="submit" class="btn btn-primary">
            Close Issue
          </button>
        </div>
      </form>
    </div>
  `,
})
export class ResolveIssueDialogComponent {
  issueTitle = input<string>('');

  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly confirmed = new EventEmitter<{
    resolution_type: IssueResolutionType;
    resolution_notes: string | null;
  }>();

  readonly options = ISSUE_RESOLUTION_OPTIONS;
  resolutionType: IssueResolutionType = 'fixed';
  resolutionNotes = '';

  submit(): void {
    this.confirmed.emit({
      resolution_type: this.resolutionType,
      resolution_notes: this.resolutionNotes.trim() || null,
    });
  }
}
