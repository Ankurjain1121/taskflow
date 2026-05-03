import {
  Component,
  output,
  signal,
  inject,
  ChangeDetectionStrategy,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Subject,
  debounceTime,
  distinctUntilChanged,
  takeUntil,
  switchMap,
  catchError,
  of,
} from 'rxjs';
import {
  CrmService,
  CrmSearchResult,
  CrmEntityType,
} from '../../../core/services/crm.service';

export interface CrmLinkedEvent {
  entity_type: CrmEntityType;
  entity_id: string;
  twenty_workspace_id: string;
}

@Component({
  selector: 'app-crm-entity-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .picker-input {
        width: 100%;
        padding: 0.375rem 0.625rem;
        font-size: 0.875rem;
        border: 1px solid var(--border);
        border-radius: 0.5rem;
        background: var(--background);
        color: var(--foreground);
        outline: none;
        transition: border-color var(--duration-fast, 150ms) var(--ease-standard, ease);
      }
      .picker-input:focus {
        border-color: var(--primary);
      }
      .result-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.25rem 0.625rem;
        border-radius: 9999px;
        font-size: 0.8125rem;
        cursor: pointer;
        background: color-mix(in srgb, var(--primary) 10%, transparent);
        color: var(--foreground);
        border: 1px solid transparent;
        transition:
          border-color var(--duration-fast, 150ms) var(--ease-standard, ease),
          transform 100ms ease;
        white-space: nowrap;
      }
      .result-pill:hover {
        border-color: var(--primary);
        transform: translateY(-1px);
      }
      .type-badge {
        font-size: 0.6875rem;
        opacity: 0.65;
        text-transform: capitalize;
      }
      .stage-badge {
        font-size: 0.6875rem;
        opacity: 0.65;
      }
      .sep {
        opacity: 0.4;
        font-size: 0.75rem;
      }
    `,
  ],
  template: `
    <div>
      <label
        class="block text-xs font-semibold uppercase tracking-wide mb-1.5"
        style="color: var(--muted-foreground)"
      >
        Search CRM
      </label>
      <input
        class="picker-input"
        type="text"
        [ngModel]="query()"
        (ngModelChange)="onQueryChange($event)"
        placeholder="Type a name…"
        aria-label="Search CRM entities"
      />

      @if (loading()) {
        <div class="mt-2 flex gap-2 flex-wrap">
          @for (i of [1, 2, 3]; track i) {
            <div
              class="h-7 w-24 rounded-full animate-pulse"
              style="background: var(--border)"
            ></div>
          }
        </div>
      }

      @if (!loading() && results().length > 0) {
        <div class="mt-2 flex gap-1.5 flex-wrap">
          @for (r of results(); track r.entity_id) {
            <button
              class="result-pill"
              type="button"
              (click)="onPillClick(r)"
              [title]="r.name"
            >
              <i [class]="entityIcon(r.entity_type)" style="font-size: 0.7rem; opacity: 0.7"></i>
              <span>{{ r.name }}</span>
              <span class="sep">·</span>
              <span class="type-badge">{{ r.entity_type }}</span>
              @if (r.stage) {
                <span class="sep">·</span>
                <span class="stage-badge">{{ r.stage }}</span>
              }
            </button>
          }
        </div>
      }

      @if (!loading() && query().length >= 2 && results().length === 0 && !searchError()) {
        <p class="mt-2 text-xs" style="color: var(--muted-foreground)">
          No results for "{{ query() }}"
        </p>
      }

      @if (searchError()) {
        <p class="mt-2 text-xs" style="color: var(--destructive)">
          Search unavailable — try again.
        </p>
      }
    </div>
  `,
})
export class CrmEntityPickerComponent implements OnDestroy {
  private crmService = inject(CrmService);
  private destroy$ = new Subject<void>();
  private search$ = new Subject<string>();

  linked = output<CrmLinkedEvent>();

  query = signal('');
  results = signal<CrmSearchResult[]>([]);
  loading = signal(false);
  searchError = signal(false);

  constructor() {
    this.search$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) => {
          if (q.trim().length < 2) {
            this.results.set([]);
            this.loading.set(false);
            return of(null);
          }
          this.loading.set(true);
          this.searchError.set(false);
          return this.crmService.searchEntities(q).pipe(
            catchError(() => {
              this.searchError.set(true);
              return of(null);
            }),
          );
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((results) => {
        this.loading.set(false);
        if (results !== null) {
          this.results.set(results);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onQueryChange(q: string): void {
    this.query.set(q);
    this.search$.next(q);
  }

  onPillClick(result: CrmSearchResult): void {
    this.linked.emit({
      entity_type: result.entity_type,
      entity_id: result.entity_id,
      twenty_workspace_id: result.twenty_workspace_id,
    });
    this.query.set('');
    this.results.set([]);
  }

  entityIcon(type: CrmEntityType): string {
    switch (type) {
      case 'contact':
        return 'pi pi-user';
      case 'company':
        return 'pi pi-building';
      case 'deal':
        return 'pi pi-briefcase';
    }
  }
}
