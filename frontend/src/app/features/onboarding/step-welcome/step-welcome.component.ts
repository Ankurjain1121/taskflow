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
          class="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <svg
            class="w-8 h-8 text-blue-600 dark:text-blue-400"
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
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Welcome to {{ workspaceName() }}!
        </h2>
        <p class="text-gray-600 dark:text-gray-400">
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
            class="p-6 border-2 rounded-xl hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-left group"
            [ngClass]="
              selectedOption === 'explore'
                ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700'
            "
          >
            <div class="flex items-start">
              <div
                class="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mr-4 flex-shrink-0"
              >
                <svg
                  class="w-6 h-6 text-green-600 dark:text-green-400"
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
                  class="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400"
                >
                  Explore an existing board
                </h3>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
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
          class="p-6 border-2 rounded-xl hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-left group"
          [ngClass]="
            selectedOption === 'dashboard'
              ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20'
              : 'border-gray-200 dark:border-gray-700'
          "
        >
          <div class="flex items-start">
            <div
              class="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mr-4 flex-shrink-0"
            >
              <svg
                class="w-6 h-6 text-purple-600 dark:text-purple-400"
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
                class="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400"
              >
                Go to Dashboard
              </h3>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Start fresh and set up your workspace your way.
              </p>
            </div>
          </div>
        </button>
      </div>

      @if (error) {
        <div
          class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
        >
          <p class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
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
