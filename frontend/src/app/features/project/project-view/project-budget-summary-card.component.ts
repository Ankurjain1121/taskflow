import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';

/**
 * Shape returned by `GET /api/projects/:project_id/budget-summary`.
 * Mirrors `ProjectBudgetSummary` in `backend/crates/db/src/queries/task_budgets.rs`.
 */
export interface ProjectBudgetSummary {
  total_budgeted_hours: number | null;
  total_logged_hours: number;
  total_budgeted_cost: number | null;
  total_actual_cost: number | null;
  total_revenue_budget: number | null;
  task_count_with_budget: number;
}

/**
 * Read-only budget rollup card shown in the project view header.
 *
 * Fetches its own data on init from the budget-summary endpoint and renders
 * four tiles: Budgeted Hours / Logged, Budgeted Cost / Actual, Revenue,
 * and Net Margin (revenue − cost). Null sums render as an em-dash so an
 * empty project doesn't show misleading zeros.
 *
 * Phase 2.6 (task-budget-fields).
 */
@Component({
  selector: 'app-project-budget-summary-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: block;
      }
      .card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 0.75rem;
        padding: 1rem 1.125rem;
        color: var(--foreground);
      }
      .card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.75rem;
      }
      .card-title {
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--muted-foreground);
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
      }
      .task-count {
        font-size: 0.6875rem;
        color: var(--muted-foreground);
      }
      .tiles {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 0.75rem;
      }
      @media (max-width: 900px) {
        .tiles {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      .tile {
        padding: 0.625rem 0.75rem;
        border-radius: 0.5rem;
        background: var(--muted, rgba(0, 0, 0, 0.03));
        border: 1px solid transparent;
        transition: border-color var(--duration-fast, 150ms) var(--ease-standard, ease);
      }
      .tile:hover {
        border-color: var(--border);
      }
      .tile-label {
        font-size: 0.6875rem;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--muted-foreground);
      }
      .tile-primary {
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--foreground);
        line-height: 1.2;
        margin-top: 0.25rem;
      }
      .tile-secondary {
        font-size: 0.75rem;
        color: var(--muted-foreground);
        margin-top: 0.125rem;
      }
      .tile-primary.positive {
        color: var(--primary);
      }
      .tile-primary.negative {
        color: var(--destructive, #b94545);
      }
      .skeleton {
        height: 4.5rem;
        background: var(--muted, rgba(0, 0, 0, 0.04));
        border-radius: 0.5rem;
        animation: pulse 1.4s ease-in-out infinite;
      }
      @keyframes pulse {
        0%,
        100% {
          opacity: 0.6;
        }
        50% {
          opacity: 1;
        }
      }
      .error {
        font-size: 0.75rem;
        color: var(--destructive, #b94545);
        padding: 0.5rem 0;
      }
    `,
  ],
  template: `
    <div class="card">
      <div class="card-header">
        <span class="card-title">
          <i class="pi pi-wallet text-xs"></i>
          Budget Summary
        </span>
        @if (summary()) {
          <span class="task-count">
            {{ summary()!.task_count_with_budget }} task(s) with budget
          </span>
        }
      </div>

      @if (error()) {
        <div class="error">{{ error() }}</div>
      } @else if (loading()) {
        <div class="tiles">
          <div class="skeleton"></div>
          <div class="skeleton"></div>
          <div class="skeleton"></div>
          <div class="skeleton"></div>
        </div>
      } @else if (summary()) {
        <div class="tiles">
          <div class="tile">
            <div class="tile-label">Budgeted Hours</div>
            <div class="tile-primary">
              {{ formatHours(summary()!.total_budgeted_hours) }}
            </div>
            <div class="tile-secondary">
              Logged: {{ formatHours(summary()!.total_logged_hours) }}
            </div>
          </div>

          <div class="tile">
            <div class="tile-label">Budgeted Cost</div>
            <div class="tile-primary">
              {{ formatMoney(summary()!.total_budgeted_cost) }}
            </div>
            <div class="tile-secondary">
              Actual: {{ formatMoney(summary()!.total_actual_cost) }}
            </div>
          </div>

          <div class="tile">
            <div class="tile-label">Revenue Budget</div>
            <div class="tile-primary">
              {{ formatMoney(summary()!.total_revenue_budget) }}
            </div>
            <div class="tile-secondary">Expected</div>
          </div>

          <div class="tile">
            <div class="tile-label">Net Margin</div>
            <div
              class="tile-primary"
              [class.positive]="netMargin() !== null && netMargin()! >= 0"
              [class.negative]="netMargin() !== null && netMargin()! < 0"
            >
              {{ formatMoney(netMargin()) }}
            </div>
            <div class="tile-secondary">Revenue − Cost</div>
          </div>
        </div>
      }
    </div>
  `,
})
export class ProjectBudgetSummaryCardComponent {
  private http = inject(HttpClient);

  projectId = input.required<string>();

  readonly summary = signal<ProjectBudgetSummary | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly netMargin = computed<number | null>(() => {
    const s = this.summary();
    if (!s) return null;
    const revenue = s.total_revenue_budget;
    const cost = s.total_actual_cost ?? s.total_budgeted_cost;
    if (revenue === null && cost === null) return null;
    return (revenue ?? 0) - (cost ?? 0);
  });

  constructor() {
    // Re-fetch whenever projectId changes (effect in injection context).
    effect(() => {
      const id = this.projectId();
      if (!id) return;
      this.load(id);
    });
  }

  private load(projectId: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.http
      .get<ProjectBudgetSummary>(`/api/projects/${projectId}/budget-summary`)
      .subscribe({
        next: (data) => {
          this.summary.set(data);
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.error.set(
            err.status === 403
              ? 'You do not have access to this project budget.'
              : 'Failed to load budget summary.',
          );
          this.loading.set(false);
        },
      });
  }

  formatHours(hours: number | null | undefined): string {
    if (hours === null || hours === undefined) return '—';
    if (hours === 0) return '0h';
    // 1 decimal place for fractional hours; whole numbers stay clean.
    const rounded = Math.round(hours * 10) / 10;
    return `${rounded}h`;
  }

  formatMoney(value: number | null | undefined): string {
    if (value === null || value === undefined) return '—';
    const sign = value < 0 ? '-' : '';
    const abs = Math.abs(value);
    return `${sign}$${abs.toLocaleString('en-US', {
      maximumFractionDigits: 0,
    })}`;
  }
}
