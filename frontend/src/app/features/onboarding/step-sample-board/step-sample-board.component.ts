import { Component, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { OnboardingService } from '../../../core/services/onboarding.service';

interface SampleColumn {
  name: string;
  color: string;
  taskCount: number;
}

@Component({
  selector: 'app-step-sample-board',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      <div class="text-center mb-8">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Sample Board Preview
        </h2>
        <p class="text-gray-600 dark:text-gray-400">
          Generate a sample board with pre-made tasks to explore TaskFlow's
          features.
        </p>
      </div>

      <!-- Sample Board Preview -->
      <div
        class="bg-gray-100 dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700"
      >
        <div class="flex items-center mb-4">
          <div
            class="w-3 h-3 bg-blue-500 rounded-full mr-2"
            aria-hidden="true"
          ></div>
          <span class="font-medium text-gray-900 dark:text-white"
            >Getting Started Board</span
          >
        </div>

        <div class="grid grid-cols-4 gap-3">
          @for (column of sampleColumns; track column.name) {
            <div
              class="bg-white dark:bg-gray-700 rounded-lg p-3 shadow-sm border border-gray-200 dark:border-gray-600"
            >
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center">
                  <div
                    class="w-2 h-2 rounded-full mr-2"
                    [style.background-color]="column.color"
                  ></div>
                  <span
                    class="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {{ column.name }}
                  </span>
                </div>
                <span
                  class="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-600 px-1.5 py-0.5 rounded"
                >
                  {{ column.taskCount }}
                </span>
              </div>
              <!-- Task placeholder bars -->
              <div class="space-y-2">
                @for (i of getTaskPlaceholders(column.taskCount); track i) {
                  <div
                    class="h-8 bg-gray-100 dark:bg-gray-600 rounded animate-pulse"
                  ></div>
                }
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="space-y-3 pt-4">
        @if (!isGenerated()) {
          <button
            type="button"
            (click)="generate()"
            [disabled]="isLoading()"
            class="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
                   text-white font-medium rounded-lg transition-colors
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                   dark:focus:ring-offset-gray-900"
          >
            @if (isLoading()) {
              <span class="flex items-center justify-center">
                <svg
                  class="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  ></circle>
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Generating Board...
              </span>
            } @else {
              <span class="flex items-center justify-center">
                <svg
                  class="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  ></path>
                </svg>
                Generate Sample Board
              </span>
            }
          </button>
        } @else {
          <div
            class="flex items-center justify-center p-4 bg-green-50 dark:bg-green-900/20
                      border border-green-200 dark:border-green-800 rounded-lg mb-4"
          >
            <svg
              class="w-5 h-5 text-green-500 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              ></path>
            </svg>
            <span class="text-green-700 dark:text-green-400 font-medium">
              Sample board created successfully!
            </span>
          </div>

          <button
            type="button"
            (click)="goToDashboard()"
            [disabled]="isNavigating()"
            class="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
                   text-white font-medium rounded-lg transition-colors
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                   dark:focus:ring-offset-gray-900"
          >
            @if (isNavigating()) {
              <span class="flex items-center justify-center">
                <svg
                  class="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  ></circle>
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Finishing up...
              </span>
            } @else {
              Go to Dashboard
            }
          </button>
        }
      </div>

      @if (error()) {
        <div
          class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
        >
          <p class="text-sm text-red-600 dark:text-red-400">{{ error() }}</p>
        </div>
      }
    </div>
  `,
})
export class StepSampleBoardComponent {
  workspaceId = input.required<string>();

  isLoading = signal(false);
  isGenerated = signal(false);
  isNavigating = signal(false);
  error = signal<string | null>(null);

  private generatedBoardId: string | null = null;

  sampleColumns: SampleColumn[] = [
    { name: 'To Do', color: '#6366f1', taskCount: 3 },
    { name: 'In Progress', color: '#3b82f6', taskCount: 2 },
    { name: 'Review', color: '#f59e0b', taskCount: 2 },
    { name: 'Done', color: '#22c55e', taskCount: 1 },
  ];

  constructor(
    private router: Router,
    private onboardingService: OnboardingService
  ) {}

  getTaskPlaceholders(count: number): number[] {
    return Array(count)
      .fill(0)
      .map((_, i) => i);
  }

  generate(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.onboardingService.generateSampleBoard(this.workspaceId()).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        this.isGenerated.set(true);
        this.generatedBoardId = response.board_id;
      },
      error: (err) => {
        this.isLoading.set(false);
        this.error.set(
          err.error?.message ||
            'Failed to generate sample board. Please try again.'
        );
      },
    });
  }

  goToDashboard(): void {
    this.isNavigating.set(true);
    this.error.set(null);

    this.onboardingService.completeOnboarding().subscribe({
      next: () => {
        this.isNavigating.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isNavigating.set(false);
        this.error.set(
          err.error?.message ||
            'Failed to complete onboarding. Please try again.'
        );
      },
    });
  }
}
