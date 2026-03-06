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
          (click)="createSample()"
          [disabled]="isLoading"
          class="p-6 border-2 rounded-xl hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-left group"
          [ngClass]="
            selectedOption === 'sample'
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
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                ></path>
              </svg>
            </div>
            <div>
              <h3
                class="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400"
              >
                Create a sample project to learn
              </h3>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Get familiar with TaskFlow using pre-made example tasks.
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

  goToSampleBoard = output<void>();

  selectedOption: 'explore' | 'sample' | null = null;
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

    // Complete onboarding and navigate to dashboard
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

  createSample(): void {
    this.selectedOption = 'sample';
    this.goToSampleBoard.emit();
  }
}
