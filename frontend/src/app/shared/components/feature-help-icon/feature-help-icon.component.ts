import {
  Component,
  input,
  signal,
  ChangeDetectionStrategy,
  HostListener,
  ElementRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-feature-help-icon',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative inline-flex items-center">
      <button
        (click)="toggle($event)"
        class="w-4 h-4 rounded-full border border-[var(--border)] text-[9px] font-bold text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] flex items-center justify-center transition-colors leading-none"
        [attr.aria-label]="'Help: ' + title()"
        type="button"
      >
        ?
      </button>

      @if (open()) {
        <div
          class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-56 p-3 rounded-lg shadow-lg border bg-[var(--card)] border-[var(--border)]"
        >
          <h4 class="text-xs font-semibold text-[var(--foreground)]">
            {{ title() }}
          </h4>
          <p class="text-xs text-[var(--muted-foreground)] mt-1">
            {{ description() }}
          </p>
          @if (shortcutKey()) {
            <div class="mt-1.5">
              <kbd
                class="inline-block px-1.5 py-0.5 text-[10px] font-mono bg-[var(--secondary)] rounded border border-[var(--border)]"
              >
                {{ shortcutKey() }}
              </kbd>
            </div>
          }
          <!-- Arrow -->
          <div
            class="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 bg-[var(--card)] border-r border-b border-[var(--border)] rotate-45"
          ></div>
        </div>
      }
    </div>
  `,
})
export class FeatureHelpIconComponent {
  private elRef = inject(ElementRef);

  title = input.required<string>();
  description = input.required<string>();
  shortcutKey = input<string>('');

  open = signal(false);

  toggle(event: Event): void {
    event.stopPropagation();
    this.open.set(!this.open());
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: Event): void {
    if (!this.open()) return;
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.open.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) this.open.set(false);
  }
}
