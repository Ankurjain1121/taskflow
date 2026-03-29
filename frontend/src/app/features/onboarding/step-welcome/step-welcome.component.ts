import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { OnboardingService } from '../../../core/services/onboarding.service';

@Component({
  selector: 'app-step-welcome',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      <div class="text-center mb-8">
        <div
          class="w-16 h-16 bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <svg
            class="w-8 h-8 text-[var(--primary)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
            ></path>
          </svg>
        </div>
        <h2 class="text-2xl font-bold text-[var(--card-foreground)] mb-2">
          Welcome to {{ workspaceName() }}!
        </h2>
        <p class="text-[var(--muted-foreground)]">
          You've been invited to join this workspace. How would you like to get
          started?
        </p>
      </div>

      <div class="grid gap-4">
        @if (boardIds().length > 0) {
          <button
            type="button"
            (click)="exploreExisting()"
            [disabled]="isLoading"
            class="p-6 border-2 rounded-xl hover:border-[var(--primary)] hover:bg-[color-mix(in_srgb,var(--primary)_5%,transparent)] transition-all text-left group"
            [ngClass]="
              selectedOption === 'explore'
                ? 'border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]'
                : 'border-[var(--border)]'
            "
          >
            <div class="flex items-start">
              <div
                class="w-12 h-12 bg-[color-mix(in_srgb,var(--success)_15%,transparent)] rounded-lg flex items-center justify-center mr-4 flex-shrink-0"
              >
                <svg
                  class="w-6 h-6 text-[var(--success)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  ></path>
                </svg>
              </div>
              <div>
                <h3
                  class="font-semibold text-[var(--card-foreground)] group-hover:text-[var(--primary)]"
                >
                  Explore an existing board
                </h3>
                <p class="text-sm text-[var(--muted-foreground)] mt-1">
                  Jump right in and see what your team is working on.
                </p>
              </div>
            </div>
          </button>
        }

        <button
          type="button"
          (click)="goToDashboard()"
          [disabled]="isLoading"
          class="p-6 border-2 rounded-xl hover:border-[var(--primary)] hover:bg-[color-mix(in_srgb,var(--primary)_5%,transparent)] transition-all text-left group"
          [ngClass]="
            selectedOption === 'dashboard'
              ? 'border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]'
              : 'border-[var(--border)]'
          "
        >
          <div class="flex items-start">
            <div
              class="w-12 h-12 bg-[color-mix(in_srgb,var(--primary)_15%,transparent)] rounded-lg flex items-center justify-center mr-4 flex-shrink-0"
            >
              <svg
                class="w-6 h-6 text-[var(--primary)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                ></path>
              </svg>
            </div>
            <div>
              <h3
                class="font-semibold text-[var(--card-foreground)] group-hover:text-[var(--primary)]"
              >
                Go to Dashboard
              </h3>
              <p class="text-sm text-[var(--muted-foreground)] mt-1">
                Start fresh and set up your workspace your way.
              </p>
            </div>
          </div>
        </button>
      </div>

      @if (error) {
        <div
          class="p-4 bg-[color-mix(in_srgb,var(--destructive)_10%,transparent)] border border-[color-mix(in_srgb,var(--destructive)_30%,transparent)] rounded-lg"
        >
          <p class="text-sm text-[var(--destructive)]">{{ error }}</p>
        </div>
      }
    </div>
  `,
})
export class StepWelcomeComponent {
  workspaceName = input.required<string>();
  workspaceId = input.required<string>();
  boardIds = input<string[]>([]);

  selectedOption: 'explore' | 'dashboard' | null = null;
  isLoading = false;
  error: string | null = null;

  constructor(
    private router: Router,
    private onboardingService: OnboardingService,
  ) {}

  exploreExisting(): void {
    this.selectedOption = 'explore';
    this.isLoading = true;
    this.error = null;

    // Complete onboarding and navigate to workspace dashboard
    this.onboardingService.completeOnboarding().subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/workspace', this.workspaceId(), 'dashboard']);
      },
      error: (err) => {
        this.isLoading = false;
        this.error =
          err.error?.message ||
          'Failed to complete onboarding. Please try again.';
      },
    });
  }

  goToDashboard(): void {
    this.selectedOption = 'dashboard';
    this.isLoading = true;
    this.error = null;

    this.onboardingService.completeOnboarding().subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isLoading = false;
        this.error =
          err.error?.message ||
          'Failed to complete onboarding. Please try again.';
      },
    });
  }
}
