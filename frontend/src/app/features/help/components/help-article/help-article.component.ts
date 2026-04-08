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
import { MarkdownRendererComponent } from '../markdown-renderer/markdown-renderer.component';
import { HelpVideoPlayerComponent } from '../help-video-player/help-video-player.component';
import { HelpFeedbackComponent } from '../help-feedback/help-feedback.component';

@Component({
  selector: 'app-help-article',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    HelpBreadcrumbsComponent,
    MarkdownRendererComponent,
    HelpVideoPlayerComponent,
    HelpFeedbackComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-help-breadcrumbs [items]="breadcrumbs()" />

    @if (article(); as art) {
      <article class="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6 sm:p-8">
        <h1
          class="text-2xl font-bold text-[var(--card-foreground)] font-display mb-2"
        >
          {{ art.title }}
        </h1>
        <p class="text-xs text-[var(--muted-foreground)] mb-6">
          Updated {{ art.updatedAt }}
        </p>

        @if (art.videoUrl) {
          <div class="mb-6">
            <app-help-video-player
              [src]="art.videoUrl"
              [poster]="art.videoPosterUrl ?? ''"
            />
          </div>
        }

        <app-markdown-renderer [content]="art.content" />

        <!-- Related Articles -->
        @if (relatedArticles().length > 0) {
          <div class="mt-8 pt-6 border-t border-[var(--border)]">
            <h3
              class="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-4"
            >
              Related Articles
            </h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              @for (related of relatedArticles(); track related.slug) {
                <a
                  [routerLink]="
                    helpBase() +
                    '/' +
                    related.categorySlug +
                    '/' +
                    related.slug
                  "
                  class="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--secondary)] transition-colors"
                >
                  <i
                    class="pi pi-file-edit text-[var(--muted-foreground)] text-sm flex-shrink-0"
                  ></i>
                  <div class="min-w-0">
                    <span
                      class="text-sm font-medium text-[var(--card-foreground)] block truncate"
                    >
                      {{ related.title }}
                    </span>
                    <span
                      class="text-xs text-[var(--muted-foreground)] truncate block"
                    >
                      {{ related.summary }}
                    </span>
                  </div>
                </a>
              }
            </div>
          </div>
        }

        <app-help-feedback [articleSlug]="art.slug" />
      </article>
    } @else {
      <div
        class="bg-[var(--card)] rounded-xl border border-[var(--border)] p-8 text-center"
      >
        <i
          class="pi pi-exclamation-triangle text-3xl text-[var(--muted-foreground)] mb-3"
        ></i>
        <p class="text-sm text-[var(--muted-foreground)]">
          Article not found.
        </p>
      </div>
    }
  `,
})
export class HelpArticleComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly helpContent = inject(HelpContentService);
  private readonly wsContext = inject(WorkspaceContextService);

  readonly categorySlug = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('categorySlug') ?? '')),
  );

  readonly articleSlug = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('articleSlug') ?? '')),
  );

  readonly category = computed(() =>
    this.helpContent.getCategoryBySlug(this.categorySlug() ?? ''),
  );

  readonly article = computed(() =>
    this.helpContent.getArticleBySlug(
      this.categorySlug() ?? '',
      this.articleSlug() ?? '',
    ),
  );

  readonly relatedArticles = computed(() => {
    const a = this.article();
    return a ? this.helpContent.getRelatedArticles(a) : [];
  });

  readonly helpBase = computed(() => {
    const wsId = this.wsContext.activeWorkspaceId();
    return wsId ? `/workspace/${wsId}/help` : '/help';
  });

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { label: 'Help', link: this.helpBase() },
    {
      label: this.category()?.title ?? 'Category',
      link: `${this.helpBase()}/${this.categorySlug()}`,
    },
    { label: this.article()?.title ?? 'Article' },
  ]);
}
