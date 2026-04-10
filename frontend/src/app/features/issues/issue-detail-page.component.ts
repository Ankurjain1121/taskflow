import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { IssueService } from '../../core/services/issue.service';
import {
  ISSUE_CLASSIFICATION_OPTIONS,
  ISSUE_REPRODUCIBILITY_OPTIONS,
  ISSUE_SEVERITY_OPTIONS,
  ISSUE_STATUS_OPTIONS,
  ISSUE_RESOLUTION_OPTIONS,
  Issue,
  IssueClassification,
  IssueReproducibility,
  IssueResolutionType,
  IssueSeverity,
  IssueStatus,
  severityLabel,
  statusLabel,
} from '../../shared/types/issue.types';
import { SeverityBadgeComponent } from './severity-badge.component';
import { ResolveIssueDialogComponent } from './resolve-issue-dialog.component';

@Component({
  selector: 'app-issue-detail-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    DatePipe,
    SeverityBadgeComponent,
    ResolveIssueDialogComponent,
  ],
  styles: [
    `
      :host {
        display: block;
        color: var(--foreground);
      }
      .page {
        padding: 1.5rem 2rem;
        max-width: 1100px;
        margin: 0 auto;
      }
      .crumbs {
        font-size: 0.8rem;
        color: var(--muted-foreground);
        margin-bottom: 1rem;
      }
      .crumbs a {
        color: var(--muted-foreground);
        text-decoration: none;
      }
      .crumbs a:hover {
        color: var(--foreground);
        text-decoration: underline;
      }

      .header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1.25rem;
      }
      .header-left {
        flex: 1;
        min-width: 0;
      }
      .issue-id {
        font-family: var(--font-mono, ui-monospace, monospace);
        font-size: 0.75rem;
        color: var(--muted-foreground);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .title {
        font-size: 1.5rem;
        font-weight: 700;
        letter-spacing: -0.01em;
        margin: 0.25rem 0 0;
        line-height: 1.25;
      }
      .title-input {
        width: 100%;
        font-size: 1.5rem;
        font-weight: 700;
        background: var(--background);
        border: 1px solid var(--border);
        border-radius: 0.5rem;
        padding: 0.5rem 0.75rem;
        color: var(--foreground);
        font-family: inherit;
      }
      .header-actions {
        display: flex;
        gap: 0.5rem;
        flex-shrink: 0;
      }

      .btn {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.55rem 0.9rem;
        border-radius: 0.5rem;
        font-size: 0.8rem;
        font-weight: 500;
        border: 1px solid var(--border);
        background: var(--card);
        color: var(--foreground);
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .btn:hover {
        border-color: var(--primary);
      }
      .btn-primary {
        background: var(--primary);
        color: var(--primary-foreground, #fff);
        border-color: var(--primary);
      }
      .btn-primary:hover {
        filter: brightness(1.05);
      }
      .btn-danger {
        background: var(--destructive, #dc2626);
        color: #fff;
        border-color: var(--destructive, #dc2626);
      }
      .btn-danger:hover {
        filter: brightness(1.05);
      }
      .btn-ghost {
        background: transparent;
      }

      .grid {
        display: grid;
        grid-template-columns: 1fr 280px;
        gap: 1.5rem;
      }
      @media (max-width: 860px) {
        .grid {
          grid-template-columns: 1fr;
        }
      }

      .card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 0.75rem;
        padding: 1.25rem;
      }

      .card + .card {
        margin-top: 1rem;
      }

      .card h2 {
        font-size: 0.75rem;
        text-transform: uppercase;
        font-weight: 600;
        letter-spacing: 0.04em;
        color: var(--muted-foreground);
        margin: 0 0 0.75rem;
      }

      .desc {
        white-space: pre-wrap;
        line-height: 1.6;
        color: var(--foreground);
      }
      .desc-empty {
        color: var(--muted-foreground);
        font-style: italic;
      }
      .desc-textarea {
        width: 100%;
        min-height: 120px;
        background: var(--background);
        border: 1px solid var(--border);
        border-radius: 0.5rem;
        padding: 0.55rem 0.75rem;
        color: var(--foreground);
        font-family: inherit;
        font-size: 0.875rem;
        resize: vertical;
      }

      .meta-row {
        display: grid;
        grid-template-columns: 110px 1fr;
        gap: 0.5rem 0.75rem;
        align-items: center;
        font-size: 0.8125rem;
        padding: 0.4rem 0;
      }
      .meta-row + .meta-row {
        border-top: 1px solid var(--border);
      }
      .meta-label {
        color: var(--muted-foreground);
        text-transform: uppercase;
        font-size: 0.7rem;
        font-weight: 600;
        letter-spacing: 0.04em;
      }
      .meta-value {
        color: var(--foreground);
      }
      .meta-value select,
      .meta-value input[type='date'] {
        width: 100%;
        background: var(--background);
        border: 1px solid var(--border);
        border-radius: 0.375rem;
        padding: 0.3rem 0.5rem;
        color: var(--foreground);
        font-size: 0.8125rem;
        font-family: inherit;
      }

      .status-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.2rem 0.6rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 500;
        background: var(--muted);
      }
      .status-dot {
        width: 0.5rem;
        height: 0.5rem;
        border-radius: 9999px;
      }
      .status-dot.open { background: #10b981; }
      .status-dot.progress { background: #3b82f6; }
      .status-dot.hold { background: #f59e0b; }
      .status-dot.closed { background: #6b7280; }
      .status-dot.reopen { background: #ef4444; }

      .resolution-banner {
        background: rgba(107, 114, 128, 0.1);
        border: 1px solid var(--border);
        border-left: 3px solid #6b7280;
        padding: 0.75rem 1rem;
        border-radius: 0.5rem;
        margin-top: 1rem;
      }
      .resolution-banner strong {
        color: var(--foreground);
      }
      .resolution-banner p {
        margin: 0.5rem 0 0;
        color: var(--muted-foreground);
        font-size: 0.8125rem;
      }

      .loading,
      .error {
        padding: 3rem 1rem;
        text-align: center;
        color: var(--muted-foreground);
      }
      .error {
        color: var(--destructive, #dc2626);
      }
    `,
  ],
  template: `
    @if (loading()) {
      <div class="loading">Loading issue…</div>
    } @else if (errorMessage()) {
      <div class="error">{{ errorMessage() }}</div>
    } @else if (issue() !== null) {
      @let i = issue()!;
      <div class="page">
        <nav class="crumbs" aria-label="Breadcrumb">
          <a
            [routerLink]="[
              '/workspace',
              workspaceId(),
              'project',
              projectId(),
              'issues',
            ]"
            >Issues</a
          >
          <span> / </span>
          <span>#{{ i.issue_number }}</span>
        </nav>

        <div class="header">
          <div class="header-left">
            <div class="issue-id">Issue #{{ i.issue_number }}</div>
            @if (editingTitle()) {
              <input
                class="title-input"
                [(ngModel)]="titleDraft"
                (keydown.enter)="saveTitle()"
                (keydown.escape)="cancelTitleEdit()"
                autofocus
              />
              <div style="display:flex;gap:.5rem;margin-top:.5rem">
                <button class="btn btn-primary" (click)="saveTitle()">Save</button>
                <button class="btn" (click)="cancelTitleEdit()">Cancel</button>
              </div>
            } @else {
              <h1 class="title" (dblclick)="startTitleEdit()">{{ i.title }}</h1>
            }
          </div>
          <div class="header-actions">
            @if (isClosed()) {
              <button class="btn" (click)="onReopen()" [disabled]="saving()">
                <i class="pi pi-refresh" aria-hidden="true"></i>
                Reopen
              </button>
            } @else {
              <button class="btn btn-primary" (click)="openResolveDialog()" [disabled]="saving()">
                <i class="pi pi-check" aria-hidden="true"></i>
                Resolve
              </button>
            }
            <button class="btn" (click)="startTitleEdit()" [disabled]="editingTitle()">
              <i class="pi pi-pencil" aria-hidden="true"></i>
              Edit
            </button>
          </div>
        </div>

        <div class="grid">
          <div>
            <section class="card">
              <h2>Description</h2>
              @if (editingDesc()) {
                <textarea
                  class="desc-textarea"
                  [(ngModel)]="descDraft"
                ></textarea>
                <div style="display:flex;gap:.5rem;margin-top:.5rem">
                  <button class="btn btn-primary" (click)="saveDesc()">Save</button>
                  <button class="btn" (click)="cancelDescEdit()">Cancel</button>
                </div>
              } @else {
                @if (i.description) {
                  <div class="desc" (dblclick)="startDescEdit()">
                    {{ i.description }}
                  </div>
                } @else {
                  <div class="desc-empty" (dblclick)="startDescEdit()">
                    No description. Double-click to add one.
                  </div>
                }
              }

              @if (isClosed() && i.resolution_type) {
                <div class="resolution-banner" role="note">
                  <strong
                    >Resolved as
                    {{ resolutionLabel(i.resolution_type) }}</strong
                  >
                  @if (i.closed_at) {
                    <span> on {{ i.closed_at | date: 'medium' }}</span>
                  }
                  @if (i.resolution_notes) {
                    <p>{{ i.resolution_notes }}</p>
                  }
                </div>
              }
            </section>
          </div>

          <aside>
            <section class="card">
              <h2>Details</h2>

              <div class="meta-row">
                <span class="meta-label">Status</span>
                <span class="meta-value">
                  <span class="status-pill">
                    <span
                      class="status-dot"
                      [class.open]="i.status === 'open'"
                      [class.progress]="i.status === 'in_progress'"
                      [class.hold]="i.status === 'on_hold'"
                      [class.closed]="i.status === 'closed'"
                      [class.reopen]="i.status === 'reopened'"
                    ></span>
                    {{ statusLabel(i.status) }}
                  </span>
                </span>
              </div>

              <div class="meta-row">
                <span class="meta-label">Severity</span>
                <span class="meta-value">
                  <select
                    [ngModel]="i.severity"
                    (ngModelChange)="updateField('severity', $event)"
                  >
                    @for (opt of severityOptions; track opt.value) {
                      <option [value]="opt.value">{{ opt.label }}</option>
                    }
                  </select>
                </span>
              </div>

              <div class="meta-row">
                <span class="meta-label">Type</span>
                <span class="meta-value">
                  <select
                    [ngModel]="i.classification"
                    (ngModelChange)="updateField('classification', $event)"
                  >
                    @for (opt of classificationOptions; track opt.value) {
                      <option [value]="opt.value">{{ opt.label }}</option>
                    }
                  </select>
                </span>
              </div>

              <div class="meta-row">
                <span class="meta-label">Reporter</span>
                <span class="meta-value">{{ i.reporter_name || '—' }}</span>
              </div>

              <div class="meta-row">
                <span class="meta-label">Assignee</span>
                <span class="meta-value">{{ i.assignee_name || 'Unassigned' }}</span>
              </div>

              <div class="meta-row">
                <span class="meta-label">Reproducible</span>
                <span class="meta-value">
                  <select
                    [ngModel]="i.reproducibility || ''"
                    (ngModelChange)="updateReproducibility($event)"
                  >
                    <option value="">—</option>
                    @for (opt of reproOptions; track opt.value) {
                      <option [value]="opt.value">{{ opt.label }}</option>
                    }
                  </select>
                </span>
              </div>

              <div class="meta-row">
                <span class="meta-label">Module</span>
                <span class="meta-value">{{ i.module || '—' }}</span>
              </div>

              <div class="meta-row">
                <span class="meta-label">Due date</span>
                <span class="meta-value">
                  {{ i.due_date ? (i.due_date | date: 'mediumDate') : '—' }}
                </span>
              </div>

              <div class="meta-row">
                <span class="meta-label">Created</span>
                <span class="meta-value">
                  {{ i.created_at | date: 'medium' }}
                </span>
              </div>

              <div class="meta-row">
                <span class="meta-label">Updated</span>
                <span class="meta-value">
                  {{ i.updated_at | date: 'medium' }}
                </span>
              </div>
            </section>
          </aside>
        </div>
      </div>

      @if (resolveOpen()) {
        <app-resolve-issue-dialog
          [issueTitle]="i.title"
          (closed)="resolveOpen.set(false)"
          (confirmed)="onResolve($event)"
        />
      }
    }
  `,
})
export class IssueDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly issueService = inject(IssueService);
  private readonly destroyRef = inject(DestroyRef);

  readonly severityOptions = ISSUE_SEVERITY_OPTIONS;
  readonly classificationOptions = ISSUE_CLASSIFICATION_OPTIONS;
  readonly reproOptions = ISSUE_REPRODUCIBILITY_OPTIONS;
  readonly statusOptions = ISSUE_STATUS_OPTIONS;
  readonly severityLabel = severityLabel;
  readonly statusLabel = statusLabel;

  readonly workspaceId = signal('');
  readonly projectId = signal('');
  readonly issueId = signal('');
  readonly issue = signal<Issue | null>(null);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly saving = signal(false);
  readonly resolveOpen = signal(false);

  readonly editingTitle = signal(false);
  readonly editingDesc = signal(false);
  titleDraft = '';
  descDraft = '';

  readonly isClosed = computed(() => {
    const s = this.issue()?.status;
    return s === 'closed';
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.workspaceId.set(params.get('workspaceId') ?? '');
      this.projectId.set(params.get('projectId') ?? '');
      this.issueId.set(params.get('issueId') ?? '');
      if (this.issueId()) {
        this.load();
      }
    });
  }

  private load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.issueService.get(this.issueId()).subscribe({
      next: (i) => {
        this.issue.set(i);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(
          err?.error?.error?.message ?? 'Failed to load issue',
        );
      },
    });
  }

  // ------------------------- title editing -------------------------
  startTitleEdit(): void {
    const i = this.issue();
    if (!i) return;
    this.titleDraft = i.title;
    this.editingTitle.set(true);
  }

  cancelTitleEdit(): void {
    this.editingTitle.set(false);
  }

  saveTitle(): void {
    const title = this.titleDraft.trim();
    if (!title) return;
    this.saving.set(true);
    this.issueService.update(this.issueId(), { title }).subscribe({
      next: () => {
        this.saving.set(false);
        this.editingTitle.set(false);
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  // ------------------------- description editing -------------------------
  startDescEdit(): void {
    this.descDraft = this.issue()?.description ?? '';
    this.editingDesc.set(true);
  }

  cancelDescEdit(): void {
    this.editingDesc.set(false);
  }

  saveDesc(): void {
    this.saving.set(true);
    this.issueService
      .update(this.issueId(), { description: this.descDraft.trim() || null })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.editingDesc.set(false);
          this.load();
        },
        error: () => this.saving.set(false),
      });
  }

  // ------------------------- inline field updates -------------------------
  updateField(
    field: 'severity' | 'classification' | 'status',
    value: IssueSeverity | IssueClassification | IssueStatus,
  ): void {
    const patch: Record<string, unknown> = { [field]: value };
    this.issueService.update(this.issueId(), patch).subscribe({
      next: () => this.load(),
    });
  }

  updateReproducibility(value: string): void {
    const repro = (value || null) as IssueReproducibility | null;
    this.issueService
      .update(this.issueId(), { reproducibility: repro })
      .subscribe({ next: () => this.load() });
  }

  // ------------------------- resolve / reopen -------------------------
  openResolveDialog(): void {
    this.resolveOpen.set(true);
  }

  onResolve(payload: { resolution_type: IssueResolutionType; resolution_notes: string | null }): void {
    this.saving.set(true);
    this.issueService.resolve(this.issueId(), payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.resolveOpen.set(false);
        this.load();
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }

  onReopen(): void {
    this.saving.set(true);
    this.issueService.reopen(this.issueId()).subscribe({
      next: () => {
        this.saving.set(false);
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  resolutionLabel(v: IssueResolutionType): string {
    return ISSUE_RESOLUTION_OPTIONS.find((o) => o.value === v)?.label ?? v;
  }
}
