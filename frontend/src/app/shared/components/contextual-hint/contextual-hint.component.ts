import {
  Component,
  input,
  output,
  signal,
  inject,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatureHintsService } from '../../../core/services/feature-hints.service';

@Component({
  selector: 'app-contextual-hint',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div
        class="fixed bottom-20 right-5 z-50 max-w-xs p-4 rounded-xl shadow-lg border bg-[var(--card)] border-[var(--primary)]/30 animate-slide-in"
        role="status"
        aria-label="Feature hint"
      >
        <div class="flex items-start gap-3">
          <span class="text-[var(--primary)] text-lg flex-shrink-0">
            <i class="pi pi-lightbulb"></i>
          </span>
          <div>
            <p class="text-sm font-medium text-[var(--foreground)]">
              Did you know?
            </p>
            <p class="text-sm text-[var(--muted-foreground)] mt-1">
              {{ message() }}
            </p>
            @if (shortcutKey()) {
              <kbd
                class="mt-1.5 inline-block px-1.5 py-0.5 text-xs font-mono bg-[var(--secondary)] rounded border border-[var(--border)]"
              >
                {{ shortcutKey() }}
              </kbd>
            }
          </div>
        </div>
        <div class="flex justify-end mt-3">
          <button
            class="text-xs font-medium text-[var(--primary)] hover:text-[var(--primary)]/80 transition-colors"
            (click)="dismiss()"
          >
            Got it
          </button>
        </div>
      </div>
    }
  `,
  styles: [
    `
      @keyframes slide-in {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .animate-slide-in {
        animation: slide-in 0.3s ease-out;
      }
    `,
  ],
})
export class ContextualHintComponent implements OnInit, OnDestroy {
  private hintsService = inject(FeatureHintsService);
  private timer: ReturnType<typeof setTimeout> | null = null;

  hintId = input.required<string>();
  message = input.required<string>();
  shortcutKey = input<string>('');
  delayMs = input<number>(2000);

  dismissed = output<void>();

  visible = signal(false);

  ngOnInit(): void {
    if (this.hintsService.isHintDismissed(this.hintId())) return;
    if (this.hintsService.hintShownThisSession()) return;

    this.timer = setTimeout(() => {
      if (this.hintsService.isHintDismissed(this.hintId())) return;
      if (this.hintsService.hintShownThisSession()) return;
      this.visible.set(true);
      this.hintsService.showHint(this.hintId());
    }, this.delayMs());
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  dismiss(): void {
    this.hintsService.dismissHint(this.hintId());
    this.visible.set(false);
    this.dismissed.emit();
  }
}
