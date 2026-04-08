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
import { HelpContentService } from '../../services/help-content.service';
import { WorkspaceContextService } from '../../../../core/services/workspace-context.service';
import {
  HelpBreadcrumbsComponent,
  BreadcrumbItem,
} from '../help-breadcrumbs/help-breadcrumbs.component';

@Component({
  selector: 'app-help-category',
  standalone: true,
  imports: [CommonModule, RouterModule, HelpBreadcrumbsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-help-breadcrumbs [items]="breadcrumbs()" />

    @if (category(); as cat) {
      <div class="mb-8">
        <div class="flex items-center gap-3 mb-2">
          <div
            class="w-10 h-10 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center"
          >
            <i [class]="cat.icon" class="text-[var(--primary)] text-lg"></i>
          </div>
          <h2 class="text-xl font-bold text-[var(--card-foreground)]">
            {{ cat.title }}
          </h2>
        </div>
        <p class="text-sm text-[var(--muted-foreground)] ml-[3.25rem]">
          {{ cat.description }}
        </p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        @for (article of articles(); track article.slug) {
          <a
            [routerLink]="helpBase() + '/' + categorySlug() + '/' + article.slug"
            class="block bg-[var(--card)] rounded-xl border border-[var(--border)] p-5 hover:border-[var(--primary)] transition-colors group"
          >
            <div class="flex items-start justify-between gap-2 mb-2">
              <h3
                class="font-medium text-[var(--card-foreground)] group-hover:text-[var(--primary)] transition-colors"
              >
                {{ article.title }}
              </h3>
              @if (article.videoUrl) {
                <i
                  class="pi pi-video text-[var(--muted-foreground)] text-sm flex-shrink-0 mt-0.5"
                  title="Includes video"
                ></i>
              }
            </div>
            <p class="text-sm text-[var(--muted-foreground)] line-clamp-2">
              {{ article.summary }}
            </p>
            <span
              class="inline-flex items-center gap-1 mt-3 text-xs font-medium text-[var(--primary)]"
            >
              Read more
              <i class="pi pi-angle-right text-xs"></i>
            </span>
          </a>
        }
      </div>

      @if (articles().length === 0) {
        <div
          class="bg-[var(--card)] rounded-xl border border-[var(--border)] p-8 text-center"
        >
          <i class="pi pi-inbox text-3xl text-[var(--muted-foreground)] mb-3"></i>
          <p class="text-sm text-[var(--muted-foreground)]">
            No articles in this category yet.
          </p>
        </div>
      }
    } @else {
      <div
        class="bg-[var(--card)] rounded-xl border border-[var(--border)] p-8 text-center"
      >
        <i
          class="pi pi-exclamation-triangle text-3xl text-[var(--muted-foreground)] mb-3"
        ></i>
        <p class="text-sm text-[var(--muted-foreground)]">
          Category not found.
        </p>
      </div>
    }
  `,
})
export class HelpCategoryComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly helpContent = inject(HelpContentService);
  private readonly wsContext = inject(WorkspaceContextService);

  readonly categorySlug = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('categorySlug') ?? '')),
  );

  readonly category = computed(() =>
    this.helpContent.getCategoryBySlug(this.categorySlug() ?? ''),
  );

  readonly articles = computed(() =>
    this.helpContent.getArticlesByCategory(this.categorySlug() ?? ''),
  );

  readonly helpBase = computed(() => {
    const wsId = this.wsContext.activeWorkspaceId();
    return wsId ? `/workspace/${wsId}/help` : '/help';
  });

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { label: 'Help', link: this.helpBase() },
    { label: this.category()?.title ?? 'Category' },
  ]);
}
