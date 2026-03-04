import {
  Component,
  input,
  output,
  signal,
  computed,
  inject,
  ChangeDetectionStrategy,
  AfterViewInit,
  OnDestroy,
  effect,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatureHintsService } from '../../../core/services/feature-hints.service';

export interface SpotlightStep {
  targetSelector: string;
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

@Component({
  selector: 'app-spotlight-overlay',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (active() && internalActive()) {
      <div
        class="fixed inset-0"
        style="z-index: 60"
        role="dialog"
        aria-modal="true"
      >
        <!-- SVG overlay with spotlight cutout -->
        <svg
          class="fixed inset-0 w-full h-full pointer-events-none"
          style="z-index: 59"
        >
          <defs>
            <mask id="spotlight-mask">
              <rect width="100%" height="100%" fill="white" />
              @if (targetRect()) {
                <rect
                  [attr.x]="spotX()"
                  [attr.y]="spotY()"
                  [attr.width]="spotW()"
                  [attr.height]="spotH()"
                  rx="8"
                  fill="black"
                />
              }
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(0,0,0,0.55)"
            mask="url(#spotlight-mask)"
            style="pointer-events: all"
          />
        </svg>

        <!-- Tooltip card -->
        <div
          class="fixed z-[61] max-w-sm p-5 rounded-xl bg-[var(--card)] shadow-2xl border border-[var(--border)]"
          [style.top.px]="tooltipTop()"
          [style.left.px]="tooltipLeft()"
        >
          <h3 class="text-base font-semibold text-[var(--foreground)]">
            {{ currentStep()?.title }}
          </h3>
          <p class="text-sm text-[var(--muted-foreground)] mt-2">
            {{ currentStep()?.description }}
          </p>
          <div class="flex items-center justify-between mt-4">
            <!-- Step dots -->
            <div class="flex gap-1.5">
              @for (step of steps(); track $index) {
                <div
                  class="w-2 h-2 rounded-full transition-colors"
                  [class]="
                    $index === currentStepIndex()
                      ? 'bg-[var(--primary)]'
                      : 'bg-[var(--muted)]'
                  "
                ></div>
              }
            </div>
            <div class="flex gap-2 items-center">
              <button
                class="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                (click)="skip()"
              >
                Skip
              </button>
              @if (currentStepIndex() > 0) {
                <button
                  class="text-sm text-[var(--primary)] hover:text-[var(--primary)]/80 transition-colors"
                  (click)="prev()"
                >
                  Back
                </button>
              }
              <button
                class="px-3 py-1.5 text-sm font-medium rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
                (click)="next()"
              >
                {{ isLastStep() ? 'Done' : 'Next' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class SpotlightOverlayComponent implements AfterViewInit, OnDestroy {
  private hintsService = inject(FeatureHintsService);

  steps = input<SpotlightStep[]>([]);
  active = input<boolean>(false);

  completed = output<void>();
  skipped = output<void>();

  currentStepIndex = signal(0);
  targetRect = signal<DOMRect | null>(null);
  internalActive = signal(false);

  private resizeObserver: ResizeObserver | null = null;
  private updateTimer: ReturnType<typeof setTimeout> | null = null;

  currentStep = computed(() => this.steps()[this.currentStepIndex()]);
  isLastStep = computed(
    () => this.currentStepIndex() === this.steps().length - 1,
  );

  spotX = computed(() => (this.targetRect()?.x ?? 0) - 8);
  spotY = computed(() => (this.targetRect()?.y ?? 0) - 8);
  spotW = computed(() => (this.targetRect()?.width ?? 0) + 16);
  spotH = computed(() => (this.targetRect()?.height ?? 0) + 16);

  tooltipTop = computed(() => {
    const rect = this.targetRect();
    if (!rect) return window.innerHeight / 2 - 80;
    const pos = this.currentStep()?.position ?? 'bottom';
    if (pos === 'top') return rect.y - 160;
    if (pos === 'bottom') return rect.y + rect.height + 16;
    return rect.y;
  });

  tooltipLeft = computed(() => {
    const rect = this.targetRect();
    if (!rect) return window.innerWidth / 2 - 176;
    const pos = this.currentStep()?.position ?? 'bottom';
    if (pos === 'left') return rect.x - 368;
    if (pos === 'right') return rect.x + rect.width + 16;
    return Math.min(rect.x, window.innerWidth - 384);
  });

  constructor() {
    effect(() => {
      const isActive = this.active();
      if (isActive) {
        this.internalActive.set(true);
        this.currentStepIndex.set(0);
        // Delay to let DOM settle
        this.updateTimer = setTimeout(() => this.updateTargetRect(), 100);
      } else {
        this.internalActive.set(false);
      }
    });
  }

  ngAfterViewInit(): void {
    if (this.active()) {
      this.updateTargetRect();
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    if (this.updateTimer) clearTimeout(this.updateTimer);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.active() && this.internalActive()) {
      this.skip();
    }
  }

  next(): void {
    if (this.isLastStep()) {
      this.hintsService.completeSpotlight();
      this.internalActive.set(false);
      this.completed.emit();
    } else {
      this.currentStepIndex.set(this.currentStepIndex() + 1);
      this.updateTargetRect();
    }
  }

  prev(): void {
    if (this.currentStepIndex() > 0) {
      this.currentStepIndex.set(this.currentStepIndex() - 1);
      this.updateTargetRect();
    }
  }

  skip(): void {
    this.hintsService.completeSpotlight();
    this.internalActive.set(false);
    this.skipped.emit();
  }

  private updateTargetRect(): void {
    const step = this.currentStep();
    if (!step || !step.targetSelector) {
      this.targetRect.set(null);
      return;
    }
    // Try each selector separated by comma
    const selectors = step.targetSelector.split(',').map((s) => s.trim());
    let el: Element | null = null;
    for (const sel of selectors) {
      el = document.querySelector(sel);
      if (el) break;
    }
    if (el) {
      this.targetRect.set(el.getBoundingClientRect());
    } else {
      this.targetRect.set(null);
    }
  }
}
