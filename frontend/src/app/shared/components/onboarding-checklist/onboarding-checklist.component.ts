import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  OnboardingChecklistService,
  ChecklistItem,
} from '../../../core/services/onboarding-checklist.service';
import { KeyboardShortcutsService } from '../../../core/services/keyboard-shortcuts.service';

@Component({
  selector: 'app-onboarding-checklist',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if ((checklist.shouldShow() || checklist.isDismissed()) && !checklist.isSkipped()) {
      <!-- Collapsed pill -->
      @if (checklist.isDismissed() && !checklist.isSkipped()) {
        <button
          (click)="checklist.reopen()"
          class="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:shadow-xl transition-all duration-200 cursor-pointer"
        >
          <i class="pi pi-list text-sm text-[var(--primary)]"></i>
          <span class="text-sm font-medium">Getting Started</span>
          <span
            class="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold bg-[var(--primary)] text-white"
          >
            {{ checklist.completedCount() }}/{{ checklist.totalCount() }}
          </span>
        </button>
      }

      <!-- Full panel -->
      @if (!checklist.isDismissed()) {
        <div
          class="fixed bottom-6 right-6 z-50 w-[360px] max-sm:w-[calc(100%-2rem)] max-sm:right-4 max-sm:left-4 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg animate-slide-in-right"
        >
          <!-- Header -->
          <div
            class="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]"
          >
            <h3 class="text-sm font-semibold text-[var(--foreground)]">
              Getting Started
            </h3>
            <button
              (click)="checklist.dismiss()"
              class="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
              aria-label="Dismiss checklist"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <!-- Progress bar -->
          <div class="px-5 pt-3 pb-2">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs text-[var(--muted-foreground)]">
                {{ checklist.completedCount() }}/{{
                  checklist.totalCount()
                }}
                complete
              </span>
              <span class="text-xs font-medium text-[var(--primary)]">
                {{ checklist.progress() }}%
              </span>
            </div>
            <div
              class="w-full h-1.5 bg-[var(--secondary)] rounded-full overflow-hidden"
            >
              <div
                class="h-full bg-[var(--primary)] rounded-full transition-all duration-500 ease-out"
                [style.width.%]="checklist.progress()"
              ></div>
            </div>
          </div>

          <!-- Content -->
          <div class="px-5 py-2 max-h-[320px] overflow-y-auto">
            @if (checklist.allComplete()) {
              <!-- Celebration state -->
              <div class="py-6 text-center">
                <div class="text-3xl mb-2">&#127881;</div>
                <h4 class="text-sm font-semibold text-[var(--foreground)] mb-1">
                  You're all set!
                </h4>
                <p class="text-xs text-[var(--muted-foreground)]">
                  You've completed the getting started guide.
                </p>
                <button
                  (click)="checklist.dismiss()"
                  class="mt-4 px-4 py-1.5 text-xs font-medium text-[var(--primary)] border border-[var(--primary)] rounded-lg hover:bg-[var(--primary)] hover:text-white transition-colors"
                >
                  Close
                </button>
              </div>
            } @else {
              <!-- Item list -->
              @for (item of checklist.items(); track item.id) {
                <div
                  class="flex items-start gap-3 py-2.5"
                  [class.opacity-60]="item.completed"
                >
                  <!-- Checkbox icon -->
                  <div class="flex-shrink-0 mt-0.5">
                    @if (item.completed) {
                      <div
                        class="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center"
                      >
                        <svg
                          class="w-3 h-3 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="3"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    } @else {
                      <div
                        class="w-5 h-5 rounded-full border-2 border-[var(--border)]"
                      ></div>
                    }
                  </div>

                  <!-- Text -->
                  <div class="flex-1 min-w-0">
                    <p
                      class="text-sm font-medium text-[var(--foreground)]"
                      [class.line-through]="item.completed"
                    >
                      {{ item.title }}
                    </p>
                    <p class="text-xs text-[var(--muted-foreground)] mt-0.5">
                      {{ item.description }}
                    </p>
                  </div>

                  <!-- CTA button -->
                  @if (!item.completed) {
                    <button
                      (click)="onCtaClick(item)"
                      class="flex-shrink-0 mt-0.5 px-2.5 py-1 text-xs font-medium text-[var(--primary)] border border-[var(--primary)]/40 rounded-md hover:bg-[var(--primary)] hover:text-white transition-colors whitespace-nowrap"
                    >
                      {{ item.ctaLabel }}
                    </button>
                  }
                </div>
              }
            }
          </div>

          <!-- Footer: Skip tutorial -->
          @if (!checklist.allComplete()) {
            <div class="px-5 py-3 border-t border-[var(--border)]">
              @if (!showSkipConfirm()) {
                <button
                  (click)="showSkipConfirm.set(true)"
                  class="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                >
                  Skip tutorial
                </button>
              } @else {
                <div class="flex items-center gap-2 text-xs">
                  <span class="text-[var(--muted-foreground)]"
                    >Are you sure?</span
                  >
                  <button
                    (click)="confirmSkip()"
                    class="font-medium text-red-500 hover:text-red-600"
                  >
                    Yes
                  </button>
                  <button
                    (click)="showSkipConfirm.set(false)"
                    class="font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  >
                    No
                  </button>
                </div>
              }
            </div>
          }
        </div>
      }
    }
  `,
})
export class OnboardingChecklistComponent {
  readonly checklist = inject(OnboardingChecklistService);
  private router = inject(Router);
  private shortcutsService = inject(KeyboardShortcutsService);

  showSkipConfirm = signal(false);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.checklist.isDismissed() && this.checklist.shouldShow()) {
      this.checklist.dismiss();
    }
  }

  onCtaClick(item: ChecklistItem): void {
    if (item.ctaAction === 'open_shortcuts') {
      this.shortcutsService.helpRequested.update((n) => n + 1);
      return;
    }
    if (item.ctaRoute) {
      this.router.navigate([item.ctaRoute]);
    }
  }

  confirmSkip(): void {
    this.checklist.skipAll();
    this.showSkipConfirm.set(false);
  }
}
