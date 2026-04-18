import {
  Directive,
  ElementRef,
  output,
  signal,
  OnInit,
  OnDestroy,
  Renderer2,
  inject,
  input,
} from '@angular/core';

/**
 * Swipeable directive for touch devices.
 *
 * Usage:
 *   <div appSwipeable (swipedRight)="onComplete()" (swipedLeft)="onSnooze()">
 *     ...card content...
 *   </div>
 *
 * Only activates on touch devices (`pointer: coarse`).
 * Swipe right reveals a green check background; swipe left reveals an amber clock background.
 * Past 30% threshold the action fires on release; otherwise snaps back.
 */
@Directive({
  selector: '[appSwipeable]',
  standalone: true,
  host: {
    '[class.swipeable-active]': 'isTouch',
  },
})
export class SwipeableDirective implements OnInit, OnDestroy {
  private readonly el = inject(ElementRef);
  private readonly renderer = inject(Renderer2);

  /** Whether to enable swipe-right action. Defaults to true. */
  readonly swipeRightEnabled = input(true);
  /** Whether to enable swipe-left action. Defaults to true. */
  readonly swipeLeftEnabled = input(true);

  /** Emits when user completes a right swipe past threshold. */
  readonly swipedRight = output<void>();
  /** Emits when user completes a left swipe past threshold. */
  readonly swipedLeft = output<void>();

  /** Is this a touch device? */
  isTouch = false;

  private wrapper!: HTMLElement;
  private backdropLeft!: HTMLElement;
  private backdropRight!: HTMLElement;

  private startX = 0;
  private startY = 0;
  private currentX = 0;
  private tracking = false;
  private directionLocked = false;
  private isHorizontal = false;

  private readonly ACTIVATION_PX = 10;
  private readonly THRESHOLD_RATIO = 0.3;
  private readonly MAX_SWIPE_RATIO = 0.55;

  private cleanupFns: (() => void)[] = [];

  ngOnInit(): void {
    this.isTouch = window.matchMedia('(pointer: coarse)').matches;
    if (!this.isTouch) return;

    this.setupDOM();
    this.bindEvents();
  }

  ngOnDestroy(): void {
    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns = [];
  }

  private setupDOM(): void {
    const host = this.el.nativeElement as HTMLElement;

    // Create wrapper that will translate
    this.wrapper = this.renderer.createElement('div');
    this.renderer.addClass(this.wrapper, 'swipeable-content');

    // Move all children into wrapper
    while (host.firstChild) {
      this.wrapper.appendChild(host.firstChild);
    }
    this.renderer.appendChild(host, this.wrapper);

    // Create right-swipe backdrop (green, check icon) — appears on the LEFT as card slides right
    this.backdropRight = this.createBackdrop('right');
    this.renderer.appendChild(host, this.backdropRight);

    // Create left-swipe backdrop (amber, clock icon) — appears on the RIGHT as card slides left
    this.backdropLeft = this.createBackdrop('left');
    this.renderer.appendChild(host, this.backdropLeft);

    // Host styles
    this.renderer.setStyle(host, 'position', 'relative');
    this.renderer.setStyle(host, 'overflow', 'hidden');
    this.renderer.setStyle(host, 'touch-action', 'pan-y');
  }

  private createBackdrop(direction: 'left' | 'right'): HTMLElement {
    const el = this.renderer.createElement('div');
    this.renderer.addClass(el, 'swipeable-backdrop');
    this.renderer.addClass(el, `swipeable-backdrop-${direction}`);

    const isRight = direction === 'right';
    const bg = isRight ? '#10b981' : '#f59e0b';
    const icon = isRight ? '\u2713' : '\u23F0';
    const justify = isRight ? 'flex-start' : 'flex-end';

    Object.assign(el.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      right: '0',
      bottom: '0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: justify,
      padding: '0 24px',
      background: bg,
      opacity: '0',
      zIndex: '0',
      borderRadius: 'inherit',
      pointerEvents: 'none',
    });

    const iconEl = this.renderer.createElement('span');
    this.renderer.addClass(iconEl, 'swipeable-icon');
    iconEl.textContent = icon;
    Object.assign(iconEl.style, {
      fontSize: '24px',
      color: 'white',
      fontWeight: 'bold',
      transform: 'scale(0.5)',
      transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
      willChange: 'transform',
    });
    this.renderer.appendChild(el, iconEl);

    return el;
  }

  private bindEvents(): void {
    const host = this.el.nativeElement as HTMLElement;

    const onStart = (e: TouchEvent) => this.onTouchStart(e);
    const onMove = (e: TouchEvent) => this.onTouchMove(e);
    const onEnd = (e: TouchEvent) => this.onTouchEnd(e);

    host.addEventListener('touchstart', onStart, { passive: true });
    host.addEventListener('touchmove', onMove, { passive: false });
    host.addEventListener('touchend', onEnd, { passive: true });
    host.addEventListener('touchcancel', onEnd, { passive: true });

    this.cleanupFns.push(
      () => host.removeEventListener('touchstart', onStart),
      () => host.removeEventListener('touchmove', onMove),
      () => host.removeEventListener('touchend', onEnd),
      () => host.removeEventListener('touchcancel', onEnd),
    );
  }

  private onTouchStart(e: TouchEvent): void {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    this.startX = touch.clientX;
    this.startY = touch.clientY;
    this.currentX = 0;
    this.tracking = true;
    this.directionLocked = false;
    this.isHorizontal = false;

    // Remove transition during drag
    this.wrapper.style.transition = 'none';
  }

  private onTouchMove(e: TouchEvent): void {
    if (!this.tracking || e.touches.length !== 1) return;

    const touch = e.touches[0];
    const dx = touch.clientX - this.startX;
    const dy = touch.clientY - this.startY;

    // Direction lock: wait until we move past activation threshold
    if (!this.directionLocked) {
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (absDx < this.ACTIVATION_PX && absDy < this.ACTIVATION_PX) return;

      this.directionLocked = true;
      this.isHorizontal = absDx > absDy;

      if (!this.isHorizontal) {
        this.tracking = false;
        return;
      }
    }

    // Block right swipe if disabled
    if (dx > 0 && !this.swipeRightEnabled()) {
      this.resetPosition();
      return;
    }
    // Block left swipe if disabled
    if (dx < 0 && !this.swipeLeftEnabled()) {
      this.resetPosition();
      return;
    }

    // Prevent vertical scroll while swiping horizontally
    e.preventDefault();

    const cardWidth = this.el.nativeElement.offsetWidth;
    const maxPx = cardWidth * this.MAX_SWIPE_RATIO;

    // Apply diminishing returns past threshold
    const sign = dx > 0 ? 1 : -1;
    const absDx = Math.abs(dx);
    const clamped = absDx <= maxPx ? absDx : maxPx + (absDx - maxPx) * 0.3;
    this.currentX = sign * clamped;

    this.wrapper.style.transform = `translateX(${this.currentX}px)`;

    // Update backdrop visibility
    const progress = Math.min(Math.abs(this.currentX) / (cardWidth * this.THRESHOLD_RATIO), 1);
    const isRight = this.currentX > 0;
    const activeBackdrop = isRight ? this.backdropRight : this.backdropLeft;
    const inactiveBackdrop = isRight ? this.backdropLeft : this.backdropRight;

    activeBackdrop.style.opacity = String(Math.min(progress * 0.9, 0.95));
    inactiveBackdrop.style.opacity = '0';

    // Scale icon based on progress
    const iconEl = activeBackdrop.querySelector('.swipeable-icon') as HTMLElement;
    if (iconEl) {
      const scale = 0.5 + progress * 0.7;
      iconEl.style.transform = `scale(${scale})`;
    }
  }

  private onTouchEnd(_e: TouchEvent): void {
    if (!this.tracking) return;
    this.tracking = false;

    if (!this.isHorizontal) {
      this.resetPosition();
      return;
    }

    const cardWidth = this.el.nativeElement.offsetWidth;
    const thresholdPx = cardWidth * this.THRESHOLD_RATIO;

    if (Math.abs(this.currentX) >= thresholdPx) {
      // Action triggered — slide out then emit
      const direction = this.currentX > 0 ? 'right' : 'left';
      this.slideOut(direction);
    } else {
      // Snap back
      this.snapBack();
    }
  }

  private slideOut(direction: 'right' | 'left'): void {
    const cardWidth = this.el.nativeElement.offsetWidth;
    const targetX = direction === 'right' ? cardWidth : -cardWidth;

    this.wrapper.style.transition = 'transform 250ms cubic-bezier(0.16, 1, 0.3, 1)';
    this.wrapper.style.transform = `translateX(${targetX}px)`;

    // Emit after the animation
    setTimeout(() => {
      if (direction === 'right') {
        this.swipedRight.emit();
      } else {
        this.swipedLeft.emit();
      }

      // Reset after a brief delay to allow parent to handle removal
      setTimeout(() => this.resetPosition(), 300);
    }, 250);
  }

  private snapBack(): void {
    this.wrapper.style.transition =
      'transform 400ms cubic-bezier(0.68, -0.55, 0.265, 1.55)';
    this.wrapper.style.transform = 'translateX(0)';

    this.backdropRight.style.opacity = '0';
    this.backdropLeft.style.opacity = '0';

    const rightIcon = this.backdropRight.querySelector('.swipeable-icon') as HTMLElement;
    const leftIcon = this.backdropLeft.querySelector('.swipeable-icon') as HTMLElement;
    if (rightIcon) rightIcon.style.transform = 'scale(0.5)';
    if (leftIcon) leftIcon.style.transform = 'scale(0.5)';
  }

  private resetPosition(): void {
    this.wrapper.style.transition = 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1)';
    this.wrapper.style.transform = 'translateX(0)';
    this.backdropRight.style.opacity = '0';
    this.backdropLeft.style.opacity = '0';
    this.currentX = 0;
  }
}
