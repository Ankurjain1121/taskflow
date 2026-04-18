import {
  Component,
  ElementRef,
  output,
  signal,
  ChangeDetectionStrategy,
  NgZone,
  inject,
  OnInit,
  OnDestroy,
} from '@angular/core';

const PULL_THRESHOLD = 64;
const MAX_PULL = 96;

@Component({
  selector: 'app-pull-to-refresh',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; position: relative; }
    .ptr-indicator {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      z-index: 10;
      overflow: hidden;
      height: 0;
      transition: none;
    }
    .ptr-indicator.releasing {
      transition: height 0.25s var(--ease-out-expo, ease-out);
    }
    .ptr-indicator i {
      font-size: 1.25rem;
      color: var(--muted-foreground);
      transition: transform 0.15s ease;
    }
    .ptr-indicator i.flipped {
      transform: rotate(180deg);
    }
    .ptr-content {
      transition: none;
    }
    .ptr-content.releasing {
      transition: transform 0.25s var(--ease-out-expo, ease-out);
    }
  `],
  template: `
    <div
      class="ptr-indicator"
      [class.releasing]="releasing()"
      [style.height.px]="pullDistance()"
    >
      @if (refreshing()) {
        <i class="pi pi-spinner pi-spin"></i>
      } @else {
        <i class="pi pi-arrow-down" [class.flipped]="pullDistance() >= ${PULL_THRESHOLD}"></i>
      }
    </div>
    <div
      class="ptr-content"
      [class.releasing]="releasing()"
      [style.transform]="'translateY(' + pullDistance() + 'px)'"
    >
      <ng-content />
    </div>
  `,
})
export class PullToRefreshComponent implements OnInit, OnDestroy {
  readonly refresh = output<{ complete: () => void }>();

  readonly pullDistance = signal(0);
  readonly refreshing = signal(false);
  readonly releasing = signal(false);

  private el = inject(ElementRef);
  private zone = inject(NgZone);
  private startY = 0;
  private pulling = false;

  private boundTouchStart = this.onTouchStart.bind(this);
  private boundTouchMove = this.onTouchMove.bind(this);
  private boundTouchEnd = this.onTouchEnd.bind(this);

  ngOnInit(): void {
    const host = this.el.nativeElement as HTMLElement;
    this.zone.runOutsideAngular(() => {
      host.addEventListener('touchstart', this.boundTouchStart, { passive: true });
      host.addEventListener('touchmove', this.boundTouchMove, { passive: false });
      host.addEventListener('touchend', this.boundTouchEnd, { passive: true });
    });
  }

  ngOnDestroy(): void {
    const host = this.el.nativeElement as HTMLElement;
    host.removeEventListener('touchstart', this.boundTouchStart);
    host.removeEventListener('touchmove', this.boundTouchMove);
    host.removeEventListener('touchend', this.boundTouchEnd);
  }

  private onTouchStart(e: TouchEvent): void {
    if (this.refreshing()) return;
    const scrollTop = this.getScrollTop();
    if (scrollTop <= 0) {
      this.startY = e.touches[0].clientY;
      this.pulling = true;
      this.zone.run(() => this.releasing.set(false));
    }
  }

  private onTouchMove(e: TouchEvent): void {
    if (!this.pulling || this.refreshing()) return;

    const scrollTop = this.getScrollTop();
    if (scrollTop > 0) {
      this.pulling = false;
      this.zone.run(() => this.pullDistance.set(0));
      return;
    }

    const dy = e.touches[0].clientY - this.startY;
    if (dy > 0) {
      e.preventDefault();
      const distance = Math.min(dy * 0.5, MAX_PULL);
      this.zone.run(() => this.pullDistance.set(distance));
    }
  }

  private onTouchEnd(): void {
    if (!this.pulling) return;
    this.pulling = false;

    this.zone.run(() => {
      if (this.pullDistance() >= PULL_THRESHOLD) {
        this.refreshing.set(true);
        this.releasing.set(false);
        this.pullDistance.set(40);
        this.refresh.emit({
          complete: () => {
            this.refreshing.set(false);
            this.releasing.set(true);
            this.pullDistance.set(0);
          },
        });
      } else {
        this.releasing.set(true);
        this.pullDistance.set(0);
      }
    });
  }

  private getScrollTop(): number {
    const host = this.el.nativeElement as HTMLElement;
    let node: HTMLElement | null = host;
    while (node) {
      if (node.scrollTop > 0) return node.scrollTop;
      node = node.parentElement;
    }
    return window.scrollY || document.documentElement.scrollTop;
  }
}
