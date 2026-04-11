import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  ActivityService,
  StatusTimelineEntry,
} from '../../../core/services/activity.service';

/**
 * Read-only vertical timeline of every status transition for a single task.
 *
 * Data source: `GET /api/tasks/{task_id}/status-timeline`. Rendered as a
 * left-anchored rail with a dot per entry, chronological (oldest → newest).
 * Empty state is shown when the task has no recorded status changes yet.
 */
@Component({
  selector: 'app-task-status-timeline-section',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: block;
      }
      .header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
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
      .empty {
        font-size: 0.75rem;
        color: var(--muted-foreground);
        padding: 0.5rem 0.25rem;
      }
      .timeline {
        position: relative;
        padding-left: 1.5rem;
      }
      .timeline::before {
        content: '';
        position: absolute;
        left: 0.5rem;
        top: 0.25rem;
        bottom: 0.25rem;
        width: 2px;
        background: var(--border);
        border-radius: 1px;
      }
      .entry {
        position: relative;
        padding-bottom: 0.875rem;
        display: flex;
        gap: 0.625rem;
        align-items: flex-start;
      }
      .entry:last-child {
        padding-bottom: 0;
      }
      .dot {
        position: absolute;
        left: -1.5rem;
        top: 0.35rem;
        width: 1.05rem;
        height: 1.05rem;
        border-radius: 9999px;
        background: var(--card, var(--background));
        border: 2px solid var(--primary);
        box-shadow: 0 0 0 3px var(--background);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .dot-inner {
        width: 0.35rem;
        height: 0.35rem;
        border-radius: 9999px;
        background: var(--primary);
      }
      .avatar {
        width: 1.5rem;
        height: 1.5rem;
        border-radius: 9999px;
        background: var(--muted);
        color: var(--muted-foreground);
        font-size: 0.65rem;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        overflow: hidden;
        text-transform: uppercase;
      }
      .avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .body {
        flex: 1;
        font-size: 0.8125rem;
        color: var(--foreground);
        line-height: 1.35;
        min-width: 0;
      }
      .body .actor {
        font-weight: 600;
      }
      .pill {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.05rem 0.4rem;
        border-radius: 9999px;
        font-size: 0.7rem;
        font-weight: 500;
        background: var(--muted);
        color: var(--foreground);
        border: 1px solid var(--border);
      }
      .pill.pill-empty {
        color: var(--muted-foreground);
        font-style: italic;
      }
      .pill-swatch {
        display: inline-block;
        width: 0.5rem;
        height: 0.5rem;
        border-radius: 9999px;
        background: var(--muted-foreground);
      }
      .time {
        display: block;
        margin-top: 0.15rem;
        font-size: 0.7rem;
        color: var(--muted-foreground);
      }
    `,
  ],
  template: `
    <div>
      <div class="header">
        <div class="title">
          <i class="pi pi-history text-[var(--muted-foreground)]"></i>
          <span>Status Timeline</span>
          <span class="count">({{ entries().length }})</span>
        </div>
      </div>

      @if (entries().length === 0) {
        <div class="empty">No status changes yet.</div>
      } @else {
        <div class="timeline" role="list" aria-label="Task status timeline">
          @for (e of entries(); track e.id) {
            <div class="entry" role="listitem">
              <span class="dot" aria-hidden="true">
                <span class="dot-inner"></span>
              </span>

              <span
                class="avatar"
                [attr.aria-label]="e.actor_name || 'Unknown user'"
              >
                @if (e.actor_avatar_url) {
                  <img
                    [src]="e.actor_avatar_url"
                    [alt]="e.actor_name || ''"
                    loading="lazy"
                  />
                } @else {
                  {{ initialFor(e.actor_name) }}
                }
              </span>

              <div class="body">
                <span class="actor">{{ e.actor_name || 'Someone' }}</span>
                changed status from
                <span
                  class="pill"
                  [class.pill-empty]="!e.from_status_name"
                  [style.background]="backgroundFor(e.from_status_color)"
                  [style.borderColor]="borderFor(e.from_status_color)"
                  [style.color]="textColorFor(e.from_status_color)"
                >
                  @if (e.from_status_color) {
                    <span
                      class="pill-swatch"
                      [style.background]="e.from_status_color"
                    ></span>
                  }
                  {{ e.from_status_name || '—' }}
                </span>
                to
                <span
                  class="pill"
                  [class.pill-empty]="!e.to_status_name"
                  [style.background]="backgroundFor(e.to_status_color)"
                  [style.borderColor]="borderFor(e.to_status_color)"
                  [style.color]="textColorFor(e.to_status_color)"
                >
                  @if (e.to_status_color) {
                    <span
                      class="pill-swatch"
                      [style.background]="e.to_status_color"
                    ></span>
                  }
                  {{ e.to_status_name || '—' }}
                </span>
                <time
                  class="time"
                  [attr.datetime]="e.created_at"
                  [attr.title]="absoluteTime(e.created_at)"
                >
                  {{ relativeTime(e.created_at) }}
                </time>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class TaskStatusTimelineSectionComponent implements OnInit {
  private readonly activityService = inject(ActivityService);
  private readonly destroyRef = inject(DestroyRef);

  taskId = input.required<string>();

  readonly entries = signal<StatusTimelineEntry[]>([]);
  readonly count = computed(() => this.entries().length);

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.activityService
      .getStatusTimeline(this.taskId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => this.entries.set(rows),
        error: () => this.entries.set([]),
      });
  }

  initialFor(name: string | null): string {
    if (!name) return '?';
    const trimmed = name.trim();
    return trimmed.length > 0 ? trimmed.charAt(0) : '?';
  }

  backgroundFor(color: string | null): string {
    if (!color) return 'var(--muted)';
    return `${color}22`;
  }

  borderFor(color: string | null): string {
    if (!color) return 'var(--border)';
    return `${color}55`;
  }

  textColorFor(color: string | null): string {
    if (!color) return 'var(--foreground)';
    return color;
  }

  absoluteTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  }

  /**
   * Lightweight "X ago" formatter. Avoids pulling in a date library.
   */
  relativeTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const diffMs = Date.now() - d.getTime();
    const diffSec = Math.max(0, Math.round(diffMs / 1000));

    if (diffSec < 60) return 'just now';
    const diffMin = Math.round(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.round(diffHr / 24);
    if (diffDay < 30) return `${diffDay}d ago`;
    const diffMo = Math.round(diffDay / 30);
    if (diffMo < 12) return `${diffMo}mo ago`;
    const diffYr = Math.round(diffMo / 12);
    return `${diffYr}y ago`;
  }
}
