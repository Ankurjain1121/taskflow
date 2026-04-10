import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  Output,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { IssueService } from '../../core/services/issue.service';
import {
  CreateIssueRequest,
  ISSUE_CLASSIFICATION_OPTIONS,
  ISSUE_REPRODUCIBILITY_OPTIONS,
  ISSUE_SEVERITY_OPTIONS,
  Issue,
  IssueClassification,
  IssueReproducibility,
  IssueSeverity,
} from '../../shared/types/issue.types';

@Component({
  selector: 'app-create-issue-dialog',
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
        width: min(560px, calc(100vw - 2rem));
        max-height: calc(100vh - 2rem);
        overflow-y: auto;
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 0.875rem;
        box-shadow:
          0 25px 50px -12px rgba(0, 0, 0, 0.25),
          0 0 0 1px rgba(255, 255, 255, 0.02);
        padding: 1.5rem 1.5rem 1.25rem;
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
        margin-bottom: 1rem;
      }

      label {
        display: block;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--muted-foreground);
        margin-bottom: 0.375rem;
      }

      .field {
        margin-bottom: 0.875rem;
      }

      .field-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
      }

      input[type='text'],
      input[type='date'],
      textarea,
      select {
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

      input:focus,
      textarea:focus,
      select:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 3px rgba(var(--primary-rgb, 37, 99, 235), 0.15);
      }

      .required {
        color: var(--destructive, #dc2626);
        margin-left: 0.125rem;
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
      .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .btn-primary {
        background: var(--primary);
        color: var(--primary-foreground, #fff);
        border-color: var(--primary);
      }

      .error {
        font-size: 0.75rem;
        color: var(--destructive, #dc2626);
        margin-top: 0.5rem;
      }
    `,
  ],
  template: `
    <div class="backdrop" (click)="cancel()" aria-hidden="true"></div>
    <div
      class="dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-issue-title"
    >
      <h2 id="create-issue-title">Submit Issue</h2>
      <p class="subtitle">Log a bug, feature request, or other issue</p>

      <form (submit)="$event.preventDefault(); submit()">
        <div class="field">
          <label for="issue-title">
            Title<span class="required">*</span>
          </label>
          <input
            id="issue-title"
            type="text"
            name="title"
            [(ngModel)]="title"
            required
            autofocus
            maxlength="500"
          />
        </div>

        <div class="field">
          <label for="issue-desc">Description</label>
          <textarea
            id="issue-desc"
            name="description"
            [(ngModel)]="description"
            placeholder="Steps to reproduce, expected vs actual behavior…"
          ></textarea>
        </div>

        <div class="field-row">
          <div class="field">
            <label for="issue-severity">Severity</label>
            <select
              id="issue-severity"
              name="severity"
              [(ngModel)]="severity"
            >
              @for (opt of severityOptions; track opt.value) {
                <option [value]="opt.value">{{ opt.label }}</option>
              }
            </select>
          </div>

          <div class="field">
            <label for="issue-class">Classification</label>
            <select
              id="issue-class"
              name="classification"
              [(ngModel)]="classification"
            >
              @for (opt of classificationOptions; track opt.value) {
                <option [value]="opt.value">{{ opt.label }}</option>
              }
            </select>
          </div>
        </div>

        <div class="field-row">
          <div class="field">
            <label for="issue-repro">Reproducibility</label>
            <select
              id="issue-repro"
              name="reproducibility"
              [(ngModel)]="reproducibility"
            >
              <option [ngValue]="null">—</option>
              @for (opt of reproducibilityOptions; track opt.value) {
                <option [value]="opt.value">{{ opt.label }}</option>
              }
            </select>
          </div>

          <div class="field">
            <label for="issue-due">Due Date</label>
            <input
              id="issue-due"
              type="date"
              name="due_date"
              [(ngModel)]="dueDate"
            />
          </div>
        </div>

        <div class="field">
          <label for="issue-module">Module / Area</label>
          <input
            id="issue-module"
            type="text"
            name="module"
            [(ngModel)]="module"
            placeholder="e.g. auth, dashboard, api"
          />
        </div>

        @if (error()) {
          <div class="error" role="alert">{{ error() }}</div>
        }

        <div class="actions">
          <button type="button" class="btn" (click)="cancel()" [disabled]="submitting()">
            Cancel
          </button>
          <button
            type="submit"
            class="btn btn-primary"
            [disabled]="submitting() || !title.trim()"
          >
            {{ submitting() ? 'Submitting…' : 'Submit Issue' }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class CreateIssueDialogComponent {
  private readonly issueService = inject(IssueService);
  private readonly destroyRef = inject(DestroyRef);

  projectId = input.required<string>();

  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly created = new EventEmitter<Issue>();

  readonly severityOptions = ISSUE_SEVERITY_OPTIONS;
  readonly classificationOptions = ISSUE_CLASSIFICATION_OPTIONS;
  readonly reproducibilityOptions = ISSUE_REPRODUCIBILITY_OPTIONS;

  // Simple ngModel-bound fields
  title = '';
  description = '';
  severity: IssueSeverity = 'none';
  classification: IssueClassification = 'bug';
  reproducibility: IssueReproducibility | null = null;
  dueDate = '';
  module = '';

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  cancel(): void {
    if (this.submitting()) return;
    this.closed.emit();
  }

  submit(): void {
    const title = this.title.trim();
    if (!title) {
      this.error.set('Title is required');
      return;
    }

    const req: CreateIssueRequest = {
      title,
      description: this.description.trim() || null,
      severity: this.severity,
      classification: this.classification,
      reproducibility: this.reproducibility,
      module: this.module.trim() || null,
      due_date: this.dueDate ? new Date(this.dueDate).toISOString() : null,
    };

    this.submitting.set(true);
    this.error.set(null);

    this.issueService
      .create(this.projectId(), req)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (issue) => {
          this.submitting.set(false);
          this.created.emit(issue);
        },
        error: (err) => {
          this.submitting.set(false);
          this.error.set(err?.error?.message ?? 'Failed to create issue');
        },
      });
  }
}
