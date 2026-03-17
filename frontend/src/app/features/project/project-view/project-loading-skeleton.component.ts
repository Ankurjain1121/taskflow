import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-project-loading-skeleton',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex-1 overflow-x-auto p-4">
      <div class="flex gap-2 h-full">
        @for (i of [1, 2, 3, 4]; track i) {
          <div class="flex-shrink-0 w-[272px]">
            <div class="widget-card p-3">
              <div
                class="skeleton skeleton-text w-24 mb-4"
                style="height: 14px;"
              ></div>
              <div class="space-y-3">
                @for (j of [1, 2, 3]; track j) {
                  <div
                    class="bg-[var(--muted)] rounded-lg p-3 border border-[var(--border)]"
                  >
                    <div class="skeleton skeleton-text w-full mb-2"></div>
                    <div class="skeleton skeleton-text w-3/4 mb-3"></div>
                    <div class="flex items-center gap-2">
                      <div class="skeleton w-16 h-5 rounded-full"></div>
                      <div class="flex-1"></div>
                      <div class="skeleton skeleton-circle w-6 h-6"></div>
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class ProjectLoadingSkeletonComponent {}
