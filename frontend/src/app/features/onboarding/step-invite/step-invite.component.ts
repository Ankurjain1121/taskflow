import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OnboardingService } from '../../../core/services/onboarding.service';

interface EmailEntry {
  id: number;
  value: string;
  error: string | null;
}

@Component({
  selector: 'app-step-invite',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <div class="text-center mb-8">
        <h2
          class="text-2xl font-bold text-[var(--card-foreground)] dark:text-white mb-2"
        >
          Invite Your Team
        </h2>
        <p class="text-[var(--muted-foreground)] dark:text-gray-400">
          Collaboration is better together. Add team members to get started.
        </p>
      </div>

      <div class="space-y-3">
        @for (email of emails; track email.id; let i = $index) {
          <div class="flex items-start gap-2">
            <div class="flex-1">
              <input
                type="email"
                [(ngModel)]="email.value"
                (blur)="validateEmail(email)"
                placeholder="colleague@company.com"
                class="w-full px-4 py-3 border border-[var(--border)] rounded-lg
                       bg-[var(--card)] text-[var(--card-foreground)]
                       focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
                       placeholder-[var(--muted-foreground)]"
                [class.border-red-500]="email.error"
              />
              @if (email.error) {
                <p class="mt-1 text-sm text-red-500">{{ email.error }}</p>
              }
            </div>
            @if (emails.length > 1) {
              <button
                type="button"
                (click)="removeEmail(i)"
                class="p-3 text-gray-400 hover:text-red-500 transition-colors"
                aria-label="Remove email"
              >
                <svg
                  class="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  ></path>
                </svg>
              </button>
            }
          </div>
        }
      </div>

      @if (emails.length < 10) {
        <button
          type="button"
          (click)="addEmail()"
          class="flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700
                 dark:hover:text-blue-300 font-medium transition-colors"
        >
          <svg
            class="w-5 h-5 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            ></path>
          </svg>
          Add another
        </button>
      }

      <div class="pt-4 space-y-3">
        <button
          type="button"
          (click)="sendInvites()"
          [disabled]="!hasValidEmails() || isLoading"
          class="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
                 text-white font-medium rounded-lg transition-colors
                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                 dark:focus:ring-offset-gray-900"
        >
          @if (isLoading) {
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
              Sending Invites...
            </span>
          } @else {
            Send Invites
          }
        </button>

        <button
          type="button"
          (click)="skip()"
          class="w-full py-3 px-4 text-[var(--muted-foreground)] dark:text-gray-400 hover:text-[var(--card-foreground)]
                 dark:hover:text-white font-medium transition-colors"
        >
          Skip this step
        </button>
      </div>

      @if (error) {
        <div
          class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
        >
          <p class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
        </div>
      }

      @if (successMessage) {
        <div
          class="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
        >
          <p class="text-sm text-green-600 dark:text-green-400">
            {{ successMessage }}
          </p>
        </div>
      }
    </div>
  `,
})
export class StepInviteComponent {
  workspaceId = input.required<string>();
  completed = output<void>();

  emails: EmailEntry[] = [{ id: 1, value: '', error: null }];
  nextId = 2;
  isLoading = false;
  error: string | null = null;
  successMessage: string | null = null;

  private emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  constructor(private onboardingService: OnboardingService) {}

  addEmail(): void {
    if (this.emails.length < 10) {
      this.emails.push({ id: this.nextId++, value: '', error: null });
    }
  }

  removeEmail(index: number): void {
    if (this.emails.length > 1) {
      this.emails.splice(index, 1);
    }
  }

  validateEmail(email: EmailEntry): void {
    if (!email.value.trim()) {
      email.error = null;
      return;
    }

    if (!this.emailRegex.test(email.value.trim())) {
      email.error = 'Please enter a valid email address';
    } else {
      email.error = null;
    }
  }

  hasValidEmails(): boolean {
    const validEmails = this.emails.filter(
      (e) => e.value.trim() && !e.error && this.emailRegex.test(e.value.trim()),
    );
    return validEmails.length > 0;
  }

  sendInvites(): void {
    const validEmails = this.emails
      .filter(
        (e) =>
          e.value.trim() && !e.error && this.emailRegex.test(e.value.trim()),
      )
      .map((e) => e.value.trim());

    if (validEmails.length === 0) {
      return;
    }

    this.isLoading = true;
    this.error = null;
    this.successMessage = null;

    this.onboardingService
      .inviteMembers(this.workspaceId(), validEmails)
      .subscribe({
        next: (response) => {
          this.isLoading = false;
          const total = response.invited + response.pending;

          if (total > 0) {
            this.successMessage = `Invitations sent to ${total} team member(s)!`;
            setTimeout(() => this.completed.emit(), 1500);
          } else {
            this.completed.emit();
          }
        },
        error: (err) => {
          this.isLoading = false;
          this.error =
            err.error?.message ||
            'Failed to send invitations. Please try again.';
        },
      });
  }

  skip(): void {
    this.completed.emit();
  }
}
