import {
  Directive,
  ElementRef,
  inject,
  input,
  effect,
  DestroyRef,
} from '@angular/core';

@Directive({
  selector: '[appCountUp]',
  standalone: true,
})
export class CountUpDirective {
  private readonly el = inject(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  /** Target number to count up to */
  readonly appCountUp = input.required<number>();

  /** Duration in ms (default 600) */
  readonly countUpDuration = input<number>(600);

  private animFrameId = 0;

  constructor() {
    effect(() => {
      const target = this.appCountUp();
      const duration = this.countUpDuration();
      this.animate(target, duration);
    });

    this.destroyRef.onDestroy(() => {
      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
      }
    });
  }

  private animate(target: number, duration: number): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }

    // Respect prefers-reduced-motion
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      this.el.nativeElement.textContent = String(target);
      return;
    }

    if (target === 0) {
      this.el.nativeElement.textContent = '0';
      return;
    }

    const start = performance.now();
    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out expo curve
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = Math.round(eased * target);
      this.el.nativeElement.textContent = String(current);

      if (progress < 1) {
        this.animFrameId = requestAnimationFrame(step);
      }
    };

    this.animFrameId = requestAnimationFrame(step);
  }
}
