import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { CardQuickEditService } from './card-quick-edit/card-quick-edit.service';
import { CardQuickEditPopoverComponent } from './card-quick-edit/card-quick-edit-popover.component';
import { ContextualHintComponent } from '../../../shared/components/contextual-hint/contextual-hint.component';
import { FeatureHintsService } from '../../../core/services/feature-hints.service';
import { SpotlightOverlayComponent } from '../../../shared/components/spotlight-overlay/spotlight-overlay.component';
import { SpotlightStep } from '../../../shared/components/spotlight-overlay/spotlight-overlay.component';
import { ProjectStateService } from './project-state.service';

@Component({
  selector: 'app-project-view-overlays',
  standalone: true,
  imports: [
    CommonModule,
    CardQuickEditPopoverComponent,
    ContextualHintComponent,
    SpotlightOverlayComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Card Quick-Edit Popover -->
    @if (quickEditService.isOpen() && quickEditService.anchorRect()) {
      <div
        class="fixed inset-0 z-40"
        (click)="quickEditService.close()"
        aria-hidden="true"
      ></div>
      <div
        class="fixed z-50"
        [style.left.px]="quickEditService.anchorRect()!.left"
        [style.top.px]="quickEditService.anchorRect()!.bottom + 4"
      >
        <app-card-quick-edit-popover />
      </div>
    }

    <!-- Spotlight Overlay (first-run tour) -->
    <app-spotlight-overlay
      [steps]="spotlightSteps()"
      [active]="spotlightActive()"
      (completed)="onSpotlightDone()"
      (skipped)="onSpotlightDone()"
    />

    <!-- Contextual Hints -->
    @if (
      hintsService.boardVisitCount() >= 2 &&
      !hintsService.isHintDismissed('board-shortcuts')
    ) {
      <app-contextual-hint
        hintId="board-shortcuts"
        message="Press ? to see all keyboard shortcuts. Navigate the board without touching your mouse!"
        shortcutKey="?"
        [delayMs]="3000"
      />
    }
    @if (
      hintsService.boardVisitCount() >= 3 &&
      !hintsService.isHintDismissed('board-cmd-k')
    ) {
      <app-contextual-hint
        hintId="board-cmd-k"
        message="Press Ctrl+K to open the command palette for quick actions and search."
        shortcutKey="Ctrl+K"
        [delayMs]="5000"
      />
    }

    <!-- ARIA live region for keyboard announcements -->
    <div aria-live="polite" class="sr-only" id="board-announcements"></div>

    <!-- Snackbar for errors -->
    @if (state.errorMessage()) {
      <div
        role="alert"
        aria-live="assertive"
        class="fixed bottom-4 right-4 bg-[var(--destructive)] text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3"
      >
        <span>{{ state.errorMessage() }}</span>
        <button
          (click)="state.clearError()"
          class="hover:opacity-70"
          aria-label="Dismiss error"
        >
          <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
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
    }
  `,
})
export class ProjectViewOverlaysComponent {
  readonly quickEditService = inject(CardQuickEditService);
  readonly hintsService = inject(FeatureHintsService);
  readonly state = inject(ProjectStateService);

  readonly spotlightSteps = input.required<SpotlightStep[]>();
  readonly spotlightActive = input.required<boolean>();
  readonly spotlightDone = output<void>();

  onSpotlightDone(): void {
    this.spotlightDone.emit();
  }
}
