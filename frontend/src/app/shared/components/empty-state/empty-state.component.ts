import {
  Component,
  input,
  output,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  EmptyStateVariant,
  EmptyStateConfig,
  EMPTY_STATE_CONFIGS,
} from './empty-state-config';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex flex-col items-center justify-center text-center animate-fade-in-up"
      [class]="size() === 'compact' ? 'py-6 px-4' : 'py-12 px-8'"
    >
      <!-- Icon Circle -->
      <div
        class="rounded-full flex items-center justify-center"
        [class]="size() === 'compact' ? 'w-12 h-12 mb-3' : 'w-20 h-20 mb-5'"
        [style.background]="iconBg()"
      >
        <i [class]="iconClass()" [style.color]="iconColor()"></i>
      </div>

      <!-- Title -->
      <h3
        [class]="
          size() === 'compact' ? 'text-sm font-medium' : 'text-lg font-semibold'
        "
        style="color: var(--foreground)"
      >
        {{ resolvedTitle() }}
      </h3>

      <!-- Description -->
      @if (resolvedDescription()) {
        <p
          class="text-sm mt-1.5 max-w-sm"
          style="color: var(--muted-foreground)"
        >
          {{ resolvedDescription() }}
        </p>
      }

      <!-- Shortcut Hint -->
      @if (resolvedShortcutHint() && size() !== 'compact') {
        <div
          class="mt-2 flex items-center gap-1.5 text-xs"
          style="color: var(--muted-foreground)"
        >
          <kbd
            class="px-1.5 py-0.5 rounded border text-[10px] font-mono"
            style="border-color: var(--border); background: var(--muted)"
          >
            {{ resolvedShortcutHint() }}
          </kbd>
          <span>to create</span>
        </div>
      }

      <!-- Primary CTA -->
      @if (resolvedCtaLabel()) {
        <button
          class="mt-5 px-5 py-2.5 rounded-lg font-medium text-sm transition-colors"
          style="background: var(--primary); color: var(--primary-foreground)"
          (click)="ctaClicked.emit()"
        >
          {{ resolvedCtaLabel() }}
        </button>
      }

      <!-- Secondary CTA -->
      @if (secondaryCtaLabel()) {
        <button
          class="mt-2 text-sm underline"
          style="color: var(--muted-foreground)"
          (click)="secondaryCtaClicked.emit()"
        >
          {{ secondaryCtaLabel() }}
        </button>
      }
    </div>
  `,
})
export class EmptyStateComponent {
  variant = input<EmptyStateVariant>('generic');
  title = input<string>('');
  description = input<string>('');
  subtitle = input<string>('');
  ctaLabel = input<string>('');
  size = input<'compact' | 'default'>('default');
  shortcutHint = input<string>('');
  secondaryCtaLabel = input<string>('');

  ctaClicked = output<void>();
  secondaryCtaClicked = output<void>();

  private readonly config = computed<EmptyStateConfig | undefined>(
    () => EMPTY_STATE_CONFIGS[this.variant()],
  );

  readonly resolvedTitle = computed(
    () => this.title() || this.config()?.defaultTitle || '',
  );

  readonly resolvedDescription = computed(
    () => this.description() || this.config()?.defaultDescription || '',
  );

  readonly resolvedCtaLabel = computed(
    () => this.ctaLabel() || this.config()?.defaultCtaLabel || '',
  );

  readonly resolvedShortcutHint = computed(
    () => this.shortcutHint() || this.config()?.shortcutHint || '',
  );

  readonly iconBg = computed(() => {
    const scheme = this.config()?.colorScheme ?? 'muted';
    switch (scheme) {
      case 'primary':
        return 'color-mix(in srgb, var(--primary) 10%, transparent)';
      case 'success':
        return 'color-mix(in srgb, var(--success) 10%, transparent)';
      case 'warning':
        return 'color-mix(in srgb, var(--accent-warm, #f59e0b) 10%, transparent)';
      case 'info':
        return 'color-mix(in srgb, var(--info, #3b82f6) 10%, transparent)';
      case 'muted':
      default:
        return 'var(--muted)';
    }
  });

  readonly iconColor = computed(() => {
    const scheme = this.config()?.colorScheme ?? 'muted';
    switch (scheme) {
      case 'primary':
        return 'var(--primary)';
      case 'success':
        return 'var(--success)';
      case 'warning':
        return 'var(--accent-warm, #f59e0b)';
      case 'info':
        return 'var(--info, #3b82f6)';
      case 'muted':
      default:
        return 'var(--muted-foreground)';
    }
  });

  readonly iconClass = computed(() => {
    const icon = this.config()?.icon ?? 'pi pi-inbox';
    const sizeClass = this.size() === 'compact' ? 'text-lg' : 'text-3xl';
    return `${icon} ${sizeClass}`;
  });
}
