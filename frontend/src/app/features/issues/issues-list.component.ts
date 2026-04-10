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
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { IssueService } from '../../core/services/issue.service';
import {
  ISSUE_CLASSIFICATION_OPTIONS,
  ISSUE_SEVERITY_OPTIONS,
  ISSUE_STATUS_OPTIONS,
  Issue,
  IssueClassification,
  IssueFilters,
  IssueSeverity,
  IssueStatus,
  IssueSummary,
  severityLabel,
  statusLabel,
} from '../../shared/types/issue.types';
import { CreateIssueDialogComponent } from './create-issue-dialog.component';
import { SeverityBadgeComponent } from './severity-badge.component';

@Component({
  selector: 'app-issues-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    DatePipe,
    CreateIssueDialogComponent,
    SeverityBadgeComponent,
  ],
  styles: [
    `
      :host {
        display: block;
        color: var(--foreground);
      }

      .page-wrap {
        padding: 1.5rem 2rem;
        max-width: 1400px;
        margin: 0 auto;
      }

      .page-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1.5rem;
      }

      .title {
        font-size: 1.5rem;
        font-weight: 700;
        letter-spacing: -0.01em;
      }

      .subtitle {
        font-size: 0.875rem;
        color: var(--muted-foreground);
        margin-top: 0.125rem;
      }

      .summary-cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 0.75rem;
        margin-bottom: 1.5rem;
      }

      .summary-card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 0.75rem;
        padding: 1rem 1.25rem;
      }

      .summary-card .label {
        font-size: 0.75rem;
        color: var(--muted-foreground);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        font-weight: 600;
      }

      .summary-card .value {
        font-size: 1.75rem;
        font-weight: 700;
        margin-top: 0.25rem;
      }

      .summary-card.critical .value {
        color: var(--destructive, #dc2626);
      }

      .toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
        margin-bottom: 1rem;
      }

      .toolbar select,
      .toolbar input[type='search'] {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 0.5rem;
        padding: 0.5rem 0.75rem;
        color: var(--foreground);
        font-size: 0.875rem;
      }

      .toolbar input[type='search'] {
        flex: 1 1 240px;
        min-width: 200px;
      }

      .btn {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.55rem 1rem;
        border-radius: 0.5rem;
        font-size: 0.875rem;
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
        border-color: var(--primary);
        color: var(--primary-foreground, #fff);
      }
      .btn-primary:hover {
        filter: brightness(1.05);
      }

      .issues-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 0.75rem;
        overflow: hidden;
      }
      .issues-table th,
      .issues-table td {
        padding: 0.75rem 1rem;
        text-align: left;
        font-size: 0.875rem;
        border-bottom: 1px solid var(--border);
        vertical-align: middle;
      }
      .issues-table thead th {
        background: var(--muted);
        font-weight: 600;
        color: var(--muted-foreground);
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .issues-table tbody tr:last-child td {
        border-bottom: 0;
      }
      .issues-table tbody tr {
        transition: background 0.15s ease;
      }
      .issues-table tbody tr:hover {
        background: var(--muted);
      }

      .issue-id {
        font-family: var(--font-mono, ui-monospace, monospace);
        font-size: 0.75rem;
        color: var(--muted-foreground);
      }

      .issue-title {
        font-weight: 500;
        color: var(--foreground);
      }

      .status-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.25rem 0.625rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 500;
        background: var(--muted);
        color: var(--foreground);
      }
      .status-dot {
        width: 0.5rem;
        height: 0.5rem;
        border-radius: 9999px;
        display: inline-block;
      }
      .status-dot.open { background: #10b981; }
      .status-dot.progress { background: #3b82f6; }
      .status-dot.hold { background: #f59e0b; }
      .status-dot.closed { background: #6b7280; }
      .status-dot.reopen { background: #ef4444; }

      .empty {
        padding: 3rem 1rem;
        text-align: center;
        color: var(--muted-foreground);
      }
    `,
  ],
  template: `
    <div class="page-wrap">
      <div class="page-header">
        <div>
          <h1 class="title">Issues</h1>
          <p class="subtitle">Track bugs, feature requests, and issues for this project</p>
        </div>
        <button type="button" class="btn btn-primary" (click)="openCreate()">
          + Submit Issue
        </button>
      </div>

      <!-- Summary cards -->
      @if (summary(); as s) {
        <div class="summary-cards">
          <div class="summary-card">
            <div class="label">Total</div>
            <div class="value">{{ s.total }}</div>
          </div>
          <div class="summary-card">
            <div class="label">Open</div>
            <div class="value">{{ s.open }}</div>
          </div>
          <div class="summary-card">
            <div class="label">Closed</div>
            <div class="value">{{ s.closed }}</div>
          </div>
          <div class="summary-card critical">
            <div class="label">Critical</div>
            <div class="value">{{ s.critical }}</div>
          </div>
          <div class="summary-card critical">
            <div class="label">Show Stopper</div>
            <div class="value">{{ s.show_stopper }}</div>
          </div>
        </div>
      }

      <!-- Toolbar / filters -->
      <div class="toolbar" role="search">
        <input
          type="search"
          placeholder="Search issues..."
          [ngModel]="search()"
          (ngModelChange)="onSearchChange($event)"
          aria-label="Search issues"
        />

        <select
          [ngModel]="statusFilter()"
          (ngModelChange)="onStatusChange($event)"
          aria-label="Status filter"
        >
          <option value="">All statuses</option>
          @for (opt of statusOptions; track opt.value) {
            <option [value]="opt.value">{{ opt.label }}</option>
          }
        </select>

        <select
          [ngModel]="severityFilter()"
          (ngModelChange)="onSeverityChange($event)"
          aria-label="Severity filter"
        >
          <option value="">All severities</option>
          @for (opt of severityOptions; track opt.value) {
            <option [value]="opt.value">{{ opt.label }}</option>
          }
        </select>

        <select
          [ngModel]="classificationFilter()"
          (ngModelChange)="onClassificationChange($event)"
          aria-label="Classification filter"
        >
          <option value="">All types</option>
          @for (opt of classificationOptions; track opt.value) {
            <option [value]="opt.value">{{ opt.label }}</option>
          }
        </select>
      </div>

      <!-- List -->
      @if (loading()) {
        <div class="empty">Loading issues…</div>
      } @else if (filteredIssues().length === 0) {
        <div class="empty">
          @if (hasFilters()) {
            No issues match your filters.
          } @else {
            No issues yet. Click <strong>Submit Issue</strong> to log the first one.
          }
        </div>
      } @else {
        <table class="issues-table" role="table">
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Title</th>
              <th scope="col">Severity</th>
              <th scope="col">Status</th>
              <th scope="col">Reporter</th>
              <th scope="col">Assignee</th>
              <th scope="col">Due</th>
            </tr>
          </thead>
          <tbody>
            @for (issue of filteredIssues(); track issue.id) {
              <tr (click)="openIssue(issue)" style="cursor:pointer">
                <td class="issue-id">#{{ issue.issue_number }}</td>
                <td class="issue-title">{{ issue.title }}</td>
                <td><app-severity-badge [severity]="issue.severity" /></td>
                <td>
                  <span class="status-badge">
                    <span
                      class="status-dot"
                      [class.open]="issue.status === 'open'"
                      [class.progress]="issue.status === 'in_progress'"
                      [class.hold]="issue.status === 'on_hold'"
                      [class.closed]="issue.status === 'closed'"
                      [class.reopen]="issue.status === 'reopened'"
                    ></span>
                    {{ statusLabel(issue.status) }}
                  </span>
                </td>
                <td>{{ issue.reporter_name || '—' }}</td>
                <td>{{ issue.assignee_name || 'Unassigned' }}</td>
                <td>{{ issue.due_date ? (issue.due_date | date: 'mediumDate') : '—' }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>

    @if (createOpen()) {
      <app-create-issue-dialog
        [projectId]="projectId()"
        (closed)="createOpen.set(false)"
        (created)="onCreated($event)"
      />
    }
  `,
})
export class IssuesListComponent implements OnInit {
  private readonly issueService = inject(IssueService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly statusOptions = ISSUE_STATUS_OPTIONS;
  readonly severityOptions = ISSUE_SEVERITY_OPTIONS;
  readonly classificationOptions = ISSUE_CLASSIFICATION_OPTIONS;
  readonly severityLabel = severityLabel;
  readonly statusLabel = statusLabel;

  readonly projectId = signal<string>('');
  readonly workspaceId = signal<string>('');
  readonly issues = signal<Issue[]>([]);
  readonly summary = signal<IssueSummary | null>(null);
  readonly loading = signal(true);
  readonly createOpen = signal(false);

  // Filter state
  readonly search = signal('');
  readonly statusFilter = signal<IssueStatus | ''>('');
  readonly severityFilter = signal<IssueSeverity | ''>('');
  readonly classificationFilter = signal<IssueClassification | ''>('');

  readonly hasFilters = computed(
    () =>
      this.search().length > 0 ||
      this.statusFilter() !== '' ||
      this.severityFilter() !== '' ||
      this.classificationFilter() !== '',
  );

  readonly filteredIssues = computed(() => {
    const q = this.search().trim().toLowerCase();
    const st = this.statusFilter();
    const sv = this.severityFilter();
    const cl = this.classificationFilter();
    return this.issues().filter((i) => {
      if (st && i.status !== st) return false;
      if (sv && i.severity !== sv) return false;
      if (cl && i.classification !== cl) return false;
      if (q) {
        const hay = `${i.title} ${i.description ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  });

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.workspaceId.set(params.get('workspaceId') ?? '');
      const projectId = params.get('projectId') ?? '';
      this.projectId.set(projectId);
      if (projectId) {
        this.load();
      }
    });
  }

  private load(): void {
    this.loading.set(true);
    const filters: IssueFilters = {};
    this.issueService
      .list(this.projectId(), filters)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.issues.set(list);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });

    this.issueService
      .summary(this.projectId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (s) => this.summary.set(s),
      });
  }

  openCreate(): void {
    this.createOpen.set(true);
  }

  onCreated(_issue: Issue): void {
    this.createOpen.set(false);
    // Refetch — the list endpoint joins reporter/assignee names
    this.load();
  }

  openIssue(issue: Issue): void {
    // Deep link placeholder: future issue detail page
    this.router.navigate([
      '/workspace',
      this.workspaceId(),
      'project',
      this.projectId(),
      'issues',
      issue.id,
    ]);
  }

  onSearchChange(v: string): void {
    this.search.set(v);
  }
  onStatusChange(v: string): void {
    this.statusFilter.set((v as IssueStatus) || '');
  }
  onSeverityChange(v: string): void {
    this.severityFilter.set((v as IssueSeverity) || '');
  }
  onClassificationChange(v: string): void {
    this.classificationFilter.set((v as IssueClassification) || '');
  }
}
