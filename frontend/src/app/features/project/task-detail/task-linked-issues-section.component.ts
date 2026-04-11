import {
  Component,
  DestroyRef,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  LinkedIssue,
  TaskIssueLinkService,
} from '../../../core/services/task-issue-link.service';
import { IssueService } from '../../../core/services/issue.service';
import type { Issue } from '../../../shared/types/issue.types';

@Component({
  selector: 'app-task-linked-issues-section',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: block;
      }
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.75rem;
      }
      .title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--card-foreground, var(--foreground));
      }
      .count {
        font-size: 0.75rem;
        color: var(--muted-foreground);
      }
      .link-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.25rem 0.5rem;
        font-size: 0.75rem;
        background: transparent;
        border: 0;
        color: var(--primary);
        border-radius: 0.375rem;
        cursor: pointer;
      }
      .link-btn:hover {
        background: rgba(191, 123, 84, 0.1);
      }
      .picker {
        background: var(--secondary, var(--muted));
        border-radius: 0.375rem;
        padding: 0.75rem;
        margin-bottom: 0.5rem;
      }
      .picker input[type='search'] {
        width: 100%;
        background: var(--background);
        border: 1px solid var(--border);
        border-radius: 0.375rem;
        padding: 0.4rem 0.625rem;
        font-size: 0.8125rem;
        color: var(--foreground);
        font-family: inherit;
      }
      .picker-list {
        margin-top: 0.5rem;
        max-height: 14rem;
        overflow-y: auto;
      }
      .picker-row {
        padding: 0.4rem 0.5rem;
        border-radius: 0.375rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.8125rem;
      }
      .picker-row:hover {
        background: var(--muted);
      }
      .picker-id {
        font-family: ui-monospace, monospace;
        font-size: 0.7rem;
        color: var(--muted-foreground);
      }
      .sev-badge {
        font-size: 0.65rem;
        font-weight: 600;
        padding: 0.1rem 0.4rem;
        border-radius: 0.25rem;
        text-transform: uppercase;
      }
      .sev-show_stopper { background: #7f1d1d; color: #fecaca; }
      .sev-critical { background: rgba(239, 68, 68, 0.15); color: #b91c1c; }
      .sev-major { background: rgba(245, 158, 11, 0.15); color: #b45309; }
      .sev-minor { background: rgba(59, 130, 246, 0.12); color: #2563eb; }
      .sev-none { background: var(--muted); color: var(--muted-foreground); }
      .list {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
      }
      .item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.625rem;
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 0.5rem;
      }
      .item-title {
        flex: 1;
        font-size: 0.8125rem;
        color: var(--foreground);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .remove-btn {
        width: 1.5rem;
        height: 1.5rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 0.375rem;
        border: 0;
        background: transparent;
        color: var(--muted-foreground);
        cursor: pointer;
      }
      .remove-btn:hover {
        background: var(--muted);
        color: var(--destructive, #dc2626);
      }
      .empty {
        font-size: 0.75rem;
        color: var(--muted-foreground);
        padding: 0.5rem 0.25rem;
      }
    `,
  ],
  template: `
    <div>
      <div class="header">
        <div class="title">
          <i class="pi pi-exclamation-circle text-[var(--muted-foreground)]"></i>
          <span>Linked Issues</span>
          <span class="count">({{ links().length }})</span>
        </div>
        <button type="button" class="link-btn" (click)="toggleAdd()">
          <i class="pi pi-plus text-xs"></i>
          Link issue
        </button>
      </div>

      @if (showPicker()) {
        <div class="picker">
          <input
            type="search"
            placeholder="Search issues in this project..."
            [ngModel]="searchQuery()"
            (ngModelChange)="onSearch($event)"
            aria-label="Search issues"
          />
          @if (candidates().length > 0) {
            <div class="picker-list">
              @for (c of candidates(); track c.id) {
                <div class="picker-row" (click)="link(c)">
                  <span class="picker-id">#{{ c.issue_number }}</span>
                  <span class="sev-badge" [class]="'sev-' + c.severity">{{ c.severity }}</span>
                  <span style="flex:1">{{ c.title }}</span>
                </div>
              }
            </div>
          } @else if (searchQuery().length > 0) {
            <div class="empty">No matching issues.</div>
          }
        </div>
      }

      @if (links().length === 0) {
        <div class="empty">No linked issues.</div>
      } @else {
        <div class="list">
          @for (l of links(); track l.id) {
            <div class="item">
              <span class="picker-id">#{{ l.issue_number }}</span>
              <span class="sev-badge" [class]="'sev-' + l.severity">{{ l.severity }}</span>
              <span class="item-title">{{ l.title }}</span>
              <button
                type="button"
                class="remove-btn"
                (click)="unlink(l)"
                [attr.aria-label]="'Unlink ' + l.title"
              >
                <i class="pi pi-times text-xs"></i>
              </button>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class TaskLinkedIssuesSectionComponent implements OnInit {
  private readonly linkService = inject(TaskIssueLinkService);
  private readonly issueService = inject(IssueService);
  private readonly destroyRef = inject(DestroyRef);

  taskId = input.required<string>();
  projectId = input<string>('');

  readonly links = signal<LinkedIssue[]>([]);
  readonly showPicker = signal(false);
  readonly searchQuery = signal('');
  readonly candidates = signal<Issue[]>([]);

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.linkService
      .listIssuesForTask(this.taskId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => this.links.set(rows),
      });
  }

  toggleAdd(): void {
    this.showPicker.update((s) => !s);
    if (this.showPicker()) {
      this.searchQuery.set('');
      this.loadCandidates('');
    }
  }

  onSearch(q: string): void {
    this.searchQuery.set(q);
    this.loadCandidates(q);
  }

  private loadCandidates(q: string): void {
    this.issueService.list(this.projectId(), { search: q || undefined }).subscribe({
      next: (issues) => {
        // Filter out already-linked
        const linkedIds = new Set(this.links().map((l) => l.id));
        this.candidates.set(issues.filter((i) => !linkedIds.has(i.id)).slice(0, 15));
      },
    });
  }

  link(issue: Issue): void {
    this.linkService.linkIssue(this.taskId(), issue.id).subscribe({
      next: () => {
        this.showPicker.set(false);
        this.searchQuery.set('');
        this.load();
      },
    });
  }

  unlink(link: LinkedIssue): void {
    this.linkService.unlinkIssue(this.taskId(), link.id).subscribe({
      next: () => this.load(),
    });
  }
}
