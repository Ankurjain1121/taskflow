import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { HelpSearchService } from '../../services/help-search.service';
import { HelpContentService } from '../../services/help-content.service';
import { WorkspaceContextService } from '../../../../core/services/workspace-context.service';
import {
  HelpBreadcrumbsComponent,
  BreadcrumbItem,
} from '../help-breadcrumbs/help-breadcrumbs.component';

@Component({
  selector: 'app-help-search-results',
  standalone: true,
  imports: [CommonModule, RouterModule, HelpBreadcrumbsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-help-breadcrumbs [items]="breadcrumbs()" />

    <div class="mb-6">
      <h2 class="text-xl font-bold text-[var(--card-foreground)]">
        @if (results().length > 0) {
          {{ results().length }} result{{ results().length === 1 ? '' : 's' }}
          for "{{ query() }}"
        } @else {
          No results for "{{ query() }}"
        }
      </h2>
    </div>

    @if (results().length > 0) {
      <div class="space-y-3">
        @for (result of results(); track result.item.slug) {
          <a
            [routerLink]="
              helpBase() +
              '/' +
              result.item.categorySlug +
              '/' +
              result.item.slug
            "
            class="block bg-[var(--card)] rounded-xl border border-[var(--border)] p-5 hover:border-[var(--primary)] transition-colors group"
          >
            <div class="flex items-start justify-between gap-3 mb-1.5">
              <h3
                class="font-medium text-[var(--card-foreground)] group-hover:text-[var(--primary)] transition-colors"
              >
                {{ result.item.title }}
              </h3>
              <span
                class="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-[var(--secondary)] text-[var(--muted-foreground)] border border-[var(--border)]"
              >
                {{ getCategoryTitle(result.item.categorySlug) }}
              </span>
            </div>
            <p class="text-sm text-[var(--muted-foreground)] line-clamp-2">
              {{ result.item.summary }}
            </p>
          </a>
        }
      </div>
    } @else if (query()) {
      <div
        class="bg-[var(--card)] rounded-xl border border-[var(--border)] p-8 text-center"
      >
        <i
          class="pi pi-search text-3xl text-[var(--muted-foreground)] mb-3"
        ></i>
        <p class="text-sm text-[var(--muted-foreground)] mb-1">
          No articles matched your search.
        </p>
        <p class="text-xs text-[var(--muted-foreground)]">
          Try different keywords or browse by category.
        </p>
      </div>
    }
  `,
})
export class HelpSearchResultsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly searchService = inject(HelpSearchService);
  private readonly helpContent = inject(HelpContentService);
  private readonly wsContext = inject(WorkspaceContextService);

  readonly query = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('q') ?? '')),
  );

  readonly results = computed(() =>
    this.searchService.search(this.query() ?? ''),
  );

  readonly helpBase = computed(() => {
    const wsId = this.wsContext.activeWorkspaceId();
    return wsId ? `/workspace/${wsId}/help` : '/help';
  });

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { label: 'Help', link: this.helpBase() },
    { label: 'Search Results' },
  ]);

  getCategoryTitle(slug: string): string {
    return this.helpContent.getCategoryBySlug(slug)?.title ?? slug;
  }
}
