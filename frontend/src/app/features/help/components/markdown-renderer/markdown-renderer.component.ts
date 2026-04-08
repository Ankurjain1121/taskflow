import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { inject } from '@angular/core';
import { marked } from 'marked';

@Component({
  selector: 'app-markdown-renderer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="prose" [innerHTML]="renderedHtml()"></div>`,
  styles: [`
    :host { display: block; }
    .prose { line-height: 1.7; color: var(--card-foreground); }
    .prose :deep(h2) { font-size: 1.25rem; font-weight: 600; margin-top: 2rem; margin-bottom: 0.75rem; color: var(--card-foreground); }
    .prose :deep(h3) { font-size: 1.1rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.5rem; color: var(--card-foreground); }
    .prose :deep(p) { margin-bottom: 0.75rem; color: var(--muted-foreground); font-size: 0.875rem; }
    .prose :deep(ul), .prose :deep(ol) { margin-bottom: 0.75rem; padding-left: 1.5rem; color: var(--muted-foreground); font-size: 0.875rem; }
    .prose :deep(li) { margin-bottom: 0.25rem; }
    .prose :deep(strong) { font-weight: 600; color: var(--card-foreground); }
    .prose :deep(code) { font-size: 0.8rem; padding: 0.15rem 0.4rem; border-radius: 0.375rem; background: var(--secondary); color: var(--foreground); font-family: monospace; }
    .prose :deep(pre) { margin-bottom: 1rem; padding: 1rem; border-radius: 0.75rem; background: var(--secondary); overflow-x: auto; border: 1px solid var(--border); }
    .prose :deep(pre code) { padding: 0; background: none; }
    .prose :deep(table) { width: 100%; margin-bottom: 1rem; border-collapse: collapse; font-size: 0.875rem; }
    .prose :deep(th) { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 2px solid var(--border); font-weight: 600; color: var(--card-foreground); }
    .prose :deep(td) { padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border); color: var(--muted-foreground); }
    .prose :deep(a) { color: var(--primary); text-decoration: underline; }
    .prose :deep(a:hover) { opacity: 0.8; }
    .prose :deep(hr) { border: none; border-top: 1px solid var(--border); margin: 1.5rem 0; }
  `],
})
export class MarkdownRendererComponent {
  content = input.required<string>();
  private readonly sanitizer = inject(DomSanitizer);

  readonly renderedHtml = computed<SafeHtml>(() => {
    const raw = marked.parse(this.content(), { async: false }) as string;
    return this.sanitizer.bypassSecurityTrustHtml(raw);
  });
}
