import { Component, input, ChangeDetectionStrategy } from '@angular/core';

export type SkeletonVariant = 'card' | 'list' | 'detail' | 'text' | 'heading' | 'circle';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (variant()) {
      @case ('card') {
        <div class="space-y-3">
          @for (i of repeatArray(); track i) {
            <div class="skeleton skeleton-card"></div>
          }
        </div>
      }
      @case ('list') {
        <div class="space-y-2">
          @for (i of repeatArray(); track i) {
            <div class="flex items-center gap-3 p-3">
              <div class="skeleton skeleton-circle w-8 h-8 flex-shrink-0"></div>
              <div class="flex-1 space-y-1.5">
                <div class="skeleton skeleton-text w-3/4"></div>
                <div class="skeleton skeleton-text w-1/2"></div>
              </div>
            </div>
          }
        </div>
      }
      @case ('detail') {
        <div class="space-y-4 p-4">
          <div class="skeleton skeleton-heading w-2/3"></div>
          <div class="space-y-2">
            <div class="skeleton skeleton-text w-full"></div>
            <div class="skeleton skeleton-text w-5/6"></div>
            <div class="skeleton skeleton-text w-4/6"></div>
          </div>
          <div class="flex gap-3 mt-4">
            <div class="skeleton w-24 h-8 rounded-md"></div>
            <div class="skeleton w-24 h-8 rounded-md"></div>
          </div>
        </div>
      }
      @case ('text') {
        <div class="space-y-1.5">
          @for (i of repeatArray(); track i) {
            <div
              class="skeleton skeleton-text"
              [style.width]="getTextWidth(i)"
            ></div>
          }
        </div>
      }
      @case ('heading') {
        <div class="skeleton skeleton-heading" [style.width]="width()"></div>
      }
      @case ('circle') {
        <div
          class="skeleton skeleton-circle"
          [style.width]="width()"
          [style.height]="width()"
        ></div>
      }
    }
  `,
})
export class SkeletonComponent {
  variant = input<SkeletonVariant>('card');
  count = input(3);
  width = input('100%');

  repeatArray(): number[] {
    return Array.from({ length: this.count() }, (_, i) => i);
  }

  getTextWidth(index: number): string {
    const widths = ['100%', '85%', '70%', '90%', '60%'];
    return widths[index % widths.length];
  }
}
