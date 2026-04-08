import { Component, ChangeDetectionStrategy, input, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HelpContentService } from '../../services/help-content.service';

@Component({
  selector: 'app-help-feedback',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mt-8 pt-6 border-t border-[var(--border)]">
      @if (submitted()) {
        <p class="text-sm text-[var(--muted-foreground)] flex items-center gap-2">
          <i class="pi pi-check-circle text-green-600"></i>
          Thanks for your feedback!
        </p>
      } @else {
        <div class="flex items-center gap-4">
          <span class="text-sm text-[var(--muted-foreground)]">Was this article helpful?</span>
          <div class="flex gap-2">
            <button
              (click)="vote(true)"
              class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] hover:bg-[var(--secondary)] text-[var(--foreground)] transition-colors">
              <i class="pi pi-thumbs-up text-xs"></i> Yes
            </button>
            <button
              (click)="vote(false)"
              class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] hover:bg-[var(--secondary)] text-[var(--foreground)] transition-colors">
              <i class="pi pi-thumbs-down text-xs"></i> No
            </button>
          </div>
        </div>
      }
    </div>
  `,
})
export class HelpFeedbackComponent implements OnInit {
  articleSlug = input.required<string>();
  submitted = signal(false);
  private readonly helpContent = inject(HelpContentService);

  ngOnInit(): void {
    const existing = this.helpContent.getFeedback(this.articleSlug());
    if (existing !== null) {
      this.submitted.set(true);
    }
  }

  vote(helpful: boolean): void {
    this.helpContent.submitFeedback(this.articleSlug(), helpful);
    this.submitted.set(true);
  }
}
